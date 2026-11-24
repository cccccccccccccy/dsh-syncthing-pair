<p align="center">
  <img src="assets/icon-180.png" width="96" height="96" alt="Syncthing Folder Pair icon">
</p>

# Syncthing Folder Pair

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that pairs one folder on this Mac with one folder on a remote Mac reachable over SSH, then creates the same two-way [Syncthing](https://syncthing.net/) folder on both sides.

Enter two paths in the sidebar panel; the plugin does the rest through each machine's local Syncthing REST API. It also registers a `syncthing_sync` tool so the agent can perform the same operation from chat.

English | [中文](README.zh.md)

## What it does

- Reads the local Syncthing API key from `config.xml` and talks to `127.0.0.1:8384`; it never edits `config.xml` directly.
- Connects to the remote over SSH (key-based, `BatchMode`) and runs the same small Python helper there.
- Creates or updates one Syncthing folder on each side with the same ID, `sendreceive` type, file watcher enabled, and both device IDs in its device list.
- Adds the two devices to each other's Syncthing configuration if they are not already there.
- Shows the state of both sides, plus a list of existing Syncthing folders on this Mac.
- If the remote is unreachable, still configures this Mac and returns a copy-paste command that completes the remote side when run there.
- Refuses to reuse a path already owned by another folder, or a folder ID that points at a different path. It does not delete files.

## Requirements

- DSH `0.2.1-rc.2` or newer.
- Syncthing running on both machines, with its REST API on the default `127.0.0.1:8384`. Tested with Syncthing 2.1.7.
- SSH access from the DSH machine to the remote, using a key (no password prompt). The remote needs `python3` 3.8+.
- Remote macOS or Linux; the helper looks for Syncthing's `config.xml` at the standard macOS and Linux locations.
- Both Syncthing instances must be able to reach each other (LAN, Tailscale, or relays).

## Install

From GitHub:

```sh
dsh plugin --profile web add github:cccccccccccccy/dsh-syncthing-pair
```

Or from the prebuilt release tarball:

```sh
dsh plugin --profile web add https://github.com/cccccccccccccy/dsh-syncthing-pair/releases/download/v1.0.1/dsh-syncthing-pair-1.0.1.tgz
```

Restart `dsh web` if your host requires it, then refresh the page. The plugin adds a **Syncthing 同步** entry to the left sidebar.

## Use

1. Open **Syncthing 同步** in the sidebar.
2. Enter the remote **SSH host** — an alias from `~/.ssh/config` such as `remote-mac`, or `user@host`.
3. Enter the absolute folder path on this Mac and on the remote.
4. Optionally set a display name; it defaults to the local folder name.
5. Click **开始同步**.

The panel reports both sides and lists existing folders. If the remote was offline, copy the generated command and run it in a terminal on the remote, or accept the folder in the remote Syncthing UI and set the path shown in the panel. Then click **重试远端**.

The agent tool takes the same inputs:

```json
{
  "sshHost": "remote-mac",
  "localPath": "/Users/me/Documents/Shared",
  "remotePath": "/Users/me/Documents/Shared",
  "label": "Shared"
}
```

## How it works

```text
DSH plugin (this Mac)
  ├─ python3 syncthing_pair.py → local Syncthing REST API
  └─ ssh <host> python3 -     → remote Syncthing REST API
```

The helper computes a deterministic folder ID from the two paths (`st-<local-folder>-<hash>`), so re-running with the same paths updates the same pair, and changing only the display name does not create a second folder. The plugin preflights both sides before writing anything when both are reachable.

## Safety

- No file deletion, no `config.xml` edits, no telemetry.
- Every HTTP route first asks DSH's connection service (`ctx.connection.requestRejection`): its Host/Origin fence and browser-session authentication must both pass, so the Syncthing API is reachable only from an authenticated page of this DSH host. Anything else is refused with 401/403 before the plugin reads a body or touches Syncthing.
- SSH uses your existing key and host configuration; the plugin does not store credentials.
- A folder whose ID already exists with a different path is rejected rather than overwritten.

## Limitations

- SSH password prompts are not supported; use a key or an SSH agent.
- The Syncthing GUI must listen on `127.0.0.1:8384`; a custom GUI address is not discovered yet.
- Windows remotes are not supported.
- The folder ID is path-derived: moving the local folder and re-running creates a new pair; remove the old folder in Syncthing first.
- Syncthing needs filesystem permission for the chosen folder on each machine (macOS may require Full Disk Access for protected locations).

## Development

```sh
node --check index.js
node --check server.js
node --check client.js
python3 -c "compile(open('syncthing_pair.py').read(), 'syncthing_pair.py', 'exec')"
npm pack --dry-run
```

The plugin is plain JavaScript on the host and browser sides; there is no build step. The Python helper is the only runtime dependency beyond `ssh` and `python3`.

## Changelog

- **1.0.1** — Route access now goes through DSH's connection service (`ctx.connection.requestRejection`), so an unauthenticated or cross-host request is refused with 401/403 before any work.
- **1.0.0** — First release.

## License

MIT
