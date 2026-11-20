#!/usr/bin/env python3
"""Create or update one Syncthing send-receive folder pair on two Macs.

The DSH plugin runs this script locally on the Air and, when the mini is
reachable, over SSH on the mini. It only uses the local Syncthing REST API and
never edits config.xml directly. Input is a base64 JSON payload; output is one
STPAIR: line of JSON.
"""

import argparse
import base64
import getpass
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "http://127.0.0.1:8384"
CONFIG_CANDIDATES = [
    os.path.expanduser("~/Library/Application Support/Syncthing/config.xml"),
    os.path.expanduser("~/.local/state/syncthing/config.xml"),
    os.path.expanduser("~/.config/syncthing/config.xml"),
]
CONFIG = next((path for path in CONFIG_CANDIDATES if os.path.isfile(path)), CONFIG_CANDIDATES[0])
RESULT_PREFIX = "STPAIR:"

FORBIDDEN_PATHS = {
    "/", "/Users", "/Volumes", "/System", "/Library", "/Applications",
    "/private", "/etc", "/var", "/tmp", "/opt",
}
FOLDER_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


class PairError(Exception):
    def __init__(self, code, message, detail="", http_status=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or ""
        self.http_status = http_status


def fail(code, message, detail=""):
    raise PairError(code, message, detail)


def emit(action, ok, data=None, error=None):
    payload = {"ok": bool(ok), "action": action}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    sys.stdout.write(RESULT_PREFIX + json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()
    sys.exit(0 if ok else 1)


def api_key():
    if not os.path.isfile(CONFIG):
        fail("config-not-found", "Syncthing config.xml was not found.", CONFIG)
    try:
        with open(CONFIG, "r", encoding="utf-8", errors="replace") as handle:
            text = handle.read()
    except OSError as exc:
        fail("config-not-found", "Syncthing config.xml could not be read.", "%s: %s" % (CONFIG, exc))
    match = re.search(r"<apikey>([^<]+)</apikey>", text)
    if match is None:
        fail("api-key-missing", "Syncthing config.xml has no <apikey>.", CONFIG)
    return match.group(1).strip()


def api(method, path, body=None, key=None):
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={"X-API-Key": key or "", "Content-Type": "application/json"},
    )
    # Never let a system proxy (Clash and friends) intercept loopback calls.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=20) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:2000]
        raise PairError(
            "syncthing-http",
            "Syncthing API %s %s failed with HTTP %s." % (method, path, exc.code),
            detail,
            http_status=exc.code,
        )
    except urllib.error.URLError as exc:
        fail(
            "syncthing-unreachable",
            "Cannot reach Syncthing on 127.0.0.1:8384. Start Syncthing and retry.",
            str(exc.reason),
        )
    except OSError as exc:
        fail("syncthing-unreachable", "Cannot reach Syncthing on 127.0.0.1:8384.", str(exc))
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError:
        return {"raw": raw.decode("utf-8", "replace")}


def clean_path(value):
    if not isinstance(value, str) or not value.strip():
        fail("invalid-path", "Folder path is empty.")
    raw = os.path.expanduser(value.strip())
    if "\x00" in raw:
        fail("invalid-path", "Folder path contains a NUL byte.", raw)
    if not os.path.isabs(raw):
        fail("invalid-path", "Folder path must be absolute.", raw)
    normalized = os.path.abspath(raw)
    if normalized in FORBIDDEN_PATHS:
        fail("invalid-path", "This folder is too broad to sync.", normalized)
    home = os.path.abspath(os.path.expanduser("~"))
    if normalized == home:
        fail("invalid-path", "Do not sync the whole home folder.", normalized)
    if len(normalized) > 900:
        fail("invalid-path", "Folder path is too long.", normalized)
    return normalized


def clean_folder_id(value):
    text = value if isinstance(value, str) else ""
    if FOLDER_ID.match(text) is None:
        fail("invalid-folder-id", "Folder id must match [a-z0-9._-] and be at most 64 characters.", text)
    return text


def clean_label(value, fallback):
    text = value if isinstance(value, str) else ""
    text = "".join(ch for ch in text.strip() if ch >= " " and ch != "\x7f")[:80].strip()
    if not text:
        text = fallback
    if not text:
        fail("invalid-label", "Folder label is empty.")
    return text


def ensure_directory(target, create):
    if os.path.exists(target):
        if not os.path.isdir(target):
            fail("path-exists-file", "That path exists but is not a folder.", target)
        return False
    if not create:
        fail("path-missing", "Folder does not exist and createMissing is false.", target)
    try:
        os.makedirs(target, exist_ok=True)
    except OSError as exc:
        fail("path-unwritable", "Cannot create the folder.", "%s: %s" % (target, exc))
    return True


def norm_path(value):
    return os.path.normpath(value) if isinstance(value, str) and value else ""


def ensure_device(key, device_id, name):
    for device in api("GET", "/rest/config/devices", key=key):
        if device.get("deviceID") == device_id:
            if device.get("paused"):
                return False, "The peer device entry is paused."
            return False, None
    template = dict(api("GET", "/rest/config/defaults/device", key=key))
    template.update({
        "deviceID": device_id,
        "name": name,
        "addresses": ["dynamic"],
        "compression": "metadata",
        "paused": False,
    })
    api("POST", "/rest/config/devices", template, key=key)
    return True, None


def ensure_folder(key, folder_id, label, target, peer_id, self_id):
    folders = api("GET", "/rest/config/folders", key=key)
    existing = next((folder for folder in folders if folder.get("id") == folder_id), None)
    conflict = next(
        (
            folder for folder in folders
            if folder.get("id") != folder_id and norm_path(folder.get("path")) == norm_path(target)
        ),
        None,
    )
    if conflict is not None:
        fail(
            "path-in-use",
            "Another Syncthing folder on this Mac already uses that path.",
            "%s (%s)" % (conflict.get("path"), conflict.get("id")),
        )
    if existing is not None:
        if norm_path(existing.get("path")) != norm_path(target):
            fail(
                "folder-conflict",
                "That folder id already exists on this Mac with a different path.",
                "%s: %s" % (folder_id, existing.get("path")),
            )
        warning = None
        if existing.get("paused"):
            warning = "The folder is paused."
        elif existing.get("type") != "sendreceive":
            warning = "The folder type is %s, not sendreceive." % existing.get("type")
        update = dict(existing)
        update["label"] = label
        devices = list(update.get("devices") or [])
        known = {device.get("deviceID") for device in devices}
        for device_id in (peer_id, self_id):
            if device_id and device_id not in known:
                devices.append({"deviceID": device_id, "introducedBy": "", "encryptionPassword": ""})
                known.add(device_id)
        update["devices"] = devices
        api("PUT", "/rest/config/folders/" + urllib.parse.quote(folder_id, safe=""), update, key=key)
        return {"created": False, "warning": warning}
    template = dict(api("GET", "/rest/config/defaults/folder", key=key))
    devices = []
    for device_id in (peer_id, self_id):
        if device_id and device_id not in {item.get("deviceID") for item in devices}:
            devices.append({"deviceID": device_id, "introducedBy": "", "encryptionPassword": ""})
    template.update({
        "id": folder_id,
        "label": label,
        "path": target,
        "type": "sendreceive",
        "devices": devices,
        "rescanIntervalS": 3600,
        "fsWatcherEnabled": True,
        "fsWatcherDelayS": 10,
        "paused": False,
    })
    api("POST", "/rest/config/folders", template, key=key)
    return {"created": True, "warning": None}


def folder_status(key, folder_id):
    try:
        return api(
            "GET",
            "/rest/db/status?folder=" + urllib.parse.quote(folder_id, safe=""),
            key=key,
        )
    except PairError as exc:
        if exc.http_status == 404:
            return None
        raise


def status_view(status):
    if not status:
        return None
    return {
        key: status.get(key)
        for key in (
            "state", "globalFiles", "globalBytes", "localFiles", "localBytes",
            "needFiles", "needBytes", "errors", "pullErrors",
        )
    }


def request_scan(key, folder_id):
    try:
        api(
            "POST",
            "/rest/db/scan?folder=" + urllib.parse.quote(folder_id, safe=""),
            key=key,
        )
    except PairError:
        # The folder config was written; a failed immediate scan is not fatal.
        pass


def read_probe(key):
    status = api("GET", "/rest/system/status", key=key)
    version = api("GET", "/rest/system/version", key=key)
    devices = api("GET", "/rest/config/devices", key=key)
    folders = api("GET", "/rest/config/folders", key=key)
    return {
        "hostname": socket.gethostname(),
        "user": getpass.getuser(),
        "myID": status.get("myID", ""),
        "version": version.get("longVersion") or version.get("version", ""),
        "configPath": CONFIG,
        "devices": [
            {
                "id": device.get("deviceID"),
                "name": device.get("name") or "",
                "paused": bool(device.get("paused")),
            }
            for device in devices
        ],
        "folders": [
            {
                "id": folder.get("id"),
                "label": folder.get("label") or "",
                "path": folder.get("path") or "",
            }
            for folder in folders
        ],
        "folderCount": len(folders),
    }


def action_probe(key, _params):
    return read_probe(key)


def action_apply(key, params):
    target = clean_path(params.get("path"))
    folder_id = clean_folder_id(params.get("folderId"))
    label = clean_label(params.get("label"), os.path.basename(target) or folder_id)
    peer_id = (params.get("peerId") or "").strip()
    self_id = (params.get("selfId") or "").strip()
    peer_name = (params.get("peerName") or "peer").strip()[:64] or "peer"
    create_missing = params.get("createMissing", True) is not False

    if not peer_id:
        fail("no-peer", "Peer device id is missing.")

    status = api("GET", "/rest/system/status", key=key)
    my_id = status.get("myID", "")
    if not my_id:
        fail("syncthing-unreachable", "Syncthing did not report a device id.")
    if self_id and self_id != my_id:
        fail(
            "device-mismatch",
            "This Mac's Syncthing device id does not match the expected one.",
            "expected %s, actual %s" % (self_id, my_id),
        )
    if peer_id == my_id:
        fail("no-peer", "Peer device id is the same as this Mac's device id.")

    created_directory = ensure_directory(target, create_missing)
    device_added, device_warning = ensure_device(key, peer_id, peer_name)
    folder_result = ensure_folder(key, folder_id, label, target, peer_id, my_id)
    request_scan(key, folder_id)
    time.sleep(0.8)
    current = folder_status(key, folder_id)
    warnings = [warning for warning in (device_warning, folder_result.get("warning")) if warning]
    return {
        "hostname": socket.gethostname(),
        "myID": my_id,
        "createdDirectory": created_directory,
        "deviceAdded": device_added,
        "folderCreated": folder_result["created"],
        "folder": {
            "id": folder_id,
            "label": label,
            "path": target,
            "type": "sendreceive",
        },
        "status": status_view(current),
        "warnings": warnings,
    }


def action_overview(key, _params):
    status = api("GET", "/rest/system/status", key=key)
    version = api("GET", "/rest/system/version", key=key)
    folders = []
    for folder in api("GET", "/rest/config/folders", key=key):
        current = folder_status(key, folder.get("id", ""))
        folders.append({
            "id": folder.get("id"),
            "label": folder.get("label") or "",
            "path": folder.get("path") or "",
            "type": folder.get("type") or "",
            "paused": bool(folder.get("paused")),
            "devices": len(folder.get("devices") or []),
            "status": status_view(current),
        })
    folders.sort(key=lambda item: (item.get("label") or "").lower())
    return {
        "hostname": socket.gethostname(),
        "myID": status.get("myID", ""),
        "version": version.get("longVersion") or version.get("version", ""),
        "folders": folders,
    }


def action_status(key, params):
    folder_id = clean_folder_id(params.get("folderId"))
    current = folder_status(key, folder_id)
    return {
        "folderId": folder_id,
        "status": status_view(current),
    }


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    action = "unknown"
    try:
        payload = json.loads(base64.b64decode(args.payload).decode("utf-8"))
        action = payload.get("action", "unknown")
        params = payload.get("params") or {}
        key = api_key()
        if action == "probe":
            data = action_probe(key, params)
        elif action == "apply":
            data = action_apply(key, params)
        elif action == "overview":
            data = action_overview(key, params)
        elif action == "status":
            data = action_status(key, params)
        else:
            fail("unknown-action", "Unknown helper action.", action)
        emit(action, True, data=data)
    except PairError as exc:
        emit(action, False, error={"code": exc.code, "message": exc.message, "detail": exc.detail})
    except Exception as exc:  # noqa: BLE001 - the envelope must always reach the caller
        emit(action, False, error={"code": "internal", "message": "Unexpected helper failure.", "detail": repr(exc)})


if __name__ == "__main__":
    main()
