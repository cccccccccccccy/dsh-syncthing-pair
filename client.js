/**
 * Syncthing pair — Client half.
 *
 * One sidebar panel with a two-path form. The same Host operation backs the
 * panel and the syncthing_sync agent tool.
 */

window.__ModuleLoader__.load({
  id: 'dsh-syncthing-pair',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'syncthing-pair'
    const PANEL_ID = 'syncthing-pair'
    const STYLE_KEY = 'dsh-syncthing-pair/panel.css'
    const DRAFT_KEY = 'syncthing-pair:draft:v2'

    const zh = {
      panel: 'Syncthing 同步',
      title: 'Syncthing 文件夹配对',
      subtitle: '在本机与一台可通过 SSH 访问的远端 Mac 之间建立双向同步',
      readiness: '连接状态',
      checking: '检测中…',
      localReady: '本机 · Syncthing 已运行',
      localDown: '本机 · Syncthing 未运行',
      remoteReady: '远端 · SSH 已连通',
      remoteDegraded: '远端 · 已连通，Syncthing 异常',
      remoteOffline: '远端 · 未连通',
      noHost: '远端 · 未填写 SSH 主机',
      refresh: '刷新',
      hostField: '远端 SSH 主机',
      hostHint: 'SSH 别名或 user@host，例如 remote-mac；需要已配置免密登录',
      localField: '本机上的文件夹',
      localHint: '绝对路径，例如 /Users/me/Documents/Shared',
      remoteField: '远端 Mac 上的文件夹',
      remoteHint: '绝对路径；macOS 如 /Users/me/...，Linux 如 /home/me/...',
      nameField: '同步名称（可选）',
      nameHint: '留空则使用本机文件夹名',
      start: '开始同步',
      starting: '正在配置…',
      pathRequired: '请先填写本机与远端两个文件夹的绝对路径。',
      hostRequired: '请先填写远端 SSH 主机。',
      formHint: '会在两端创建缺失目录，并把同一文件夹以双向方式共享。不会删除文件。',
      syncthingLink: '打开本机 Syncthing',
      resultOkTitle: '同步已建立',
      resultPartialTitle: '本机端已就绪，远端待处理',
      resultFailTitle: '设置失败',
      folderId: '文件夹 ID',
      name: '名称',
      localFolder: '本机文件夹',
      remoteFolder: '远端文件夹',
      localSide: '本机',
      remoteSide: '远端',
      state: '状态',
      stateIdle: '空闲',
      stateSyncing: '同步中',
      stateScanning: '扫描中',
      statePaused: '已暂停',
      stateError: '错误',
      stateUnknown: '未知',
      stateWaiting: '等待远端配置',
      need: '待下载 {size}',
      commandTitle: '在远端运行这条命令',
      commandHint: '远端当前不可达。打开远端的终端，粘贴并运行；它会读取远端的 Syncthing 配置，创建同一个文件夹并接入本机。',
      copy: '复制命令',
      copied: '已复制',
      copyManual: '请手动选择并复制',
      manualHint: '也可以直接在远端的 Syncthing 界面接受本机共享的文件夹，并把路径设为上面的远端路径。',
      retryRemote: '重试远端',
      retry: '重试',
      details: '查看详情',
      warnings: '提示',
      existingTitle: '现有同步文件夹',
      existingEmpty: '还没有通过 Syncthing 同步的文件夹。',
      existingRefresh: '刷新列表',
      devices: '{n} 个设备',
      noStatus: '尚无状态',
      errorTitle: '出错了',
      errPathInUse: '这个目录已经被本机另一个 Syncthing 文件夹占用，请换一个目录或先处理旧文件夹。',
      errFolderConflict: '同一文件夹 ID 已存在于这台机器，但指向了不同目录。请换一个同步名称，或先在 Syncthing 中删除旧文件夹。',
      errDeviceMismatch: '远端的 Syncthing 设备 ID 与本机记录的不一致，可能是重装过 Syncthing。请先在本机 Syncthing 中更新远端设备。',
      errInvalidPath: '文件夹路径无效：必须是绝对路径，且不能是 Home、/Users 这类过大的目录。',
      errPathUnwritable: '无法创建目录，请检查该路径的权限。',
      errPathExistsFile: '这个路径已经存在，但不是文件夹。',
      errSyncthing: '本机 Syncthing 无法访问。请先启动 Syncthing（127.0.0.1:8384）。',
      errConfig: '找不到 Syncthing 配置，无法读取 API key。',
      errNoPeer: '本机 Syncthing 里还没有远端设备，且远端当前不可达。请先让远端通过 SSH 上线一次。',
      errOffline: '无法通过 SSH 连接远端。本机端已配置；可稍后重试，或使用下面的命令。',
      errTimeout: '操作超时。请检查 Syncthing / SSH 状态后重试。',
      errSsh: 'SSH 连接远端失败。请检查主机名、网络和密钥。',
      errNoHost: '请先填写远端 SSH 主机。',
    }

    const en = {
      panel: 'Syncthing sync',
      title: 'Syncthing folder pair',
      subtitle: 'Create a two-way sync between this Mac and a remote Mac reachable over SSH',
      readiness: 'Connections',
      checking: 'Checking…',
      localReady: 'This Mac · Syncthing running',
      localDown: 'This Mac · Syncthing not running',
      remoteReady: 'Remote · SSH connected',
      remoteDegraded: 'Remote · reachable, Syncthing error',
      remoteOffline: 'Remote · unreachable',
      noHost: 'Remote · SSH host not set',
      refresh: 'Refresh',
      hostField: 'Remote SSH host',
      hostHint: 'SSH alias or user@host, e.g. remote-mac; key-based login required',
      localField: 'Folder on this Mac',
      localHint: 'Absolute path, e.g. /Users/me/Documents/Shared',
      remoteField: 'Folder on the remote Mac',
      remoteHint: 'Absolute path; macOS /Users/me/..., Linux /home/me/...',
      nameField: 'Sync name (optional)',
      nameHint: 'Defaults to the local folder name',
      start: 'Start sync',
      starting: 'Configuring…',
      pathRequired: 'Enter absolute paths for both folders first.',
      hostRequired: 'Enter the remote SSH host first.',
      formHint: 'Missing folders are created on both machines and shared two-way. No files are deleted.',
      syncthingLink: 'Open local Syncthing',
      resultOkTitle: 'Sync established',
      resultPartialTitle: 'Local side is ready; the remote still needs a step',
      resultFailTitle: 'Setup failed',
      folderId: 'Folder ID',
      name: 'Name',
      localFolder: 'Local folder',
      remoteFolder: 'Remote folder',
      localSide: 'This Mac',
      remoteSide: 'Remote',
      state: 'State',
      stateIdle: 'Idle',
      stateSyncing: 'Syncing',
      stateScanning: 'Scanning',
      statePaused: 'Paused',
      stateError: 'Error',
      stateUnknown: 'Unknown',
      stateWaiting: 'Waiting for the remote',
      need: 'Needs {size}',
      commandTitle: 'Run this on the remote',
      commandHint: 'The remote is unreachable. Open Terminal there, paste and run this; it reads the remote Syncthing config, creates the same folder, and joins it to this Mac.',
      copy: 'Copy command',
      copied: 'Copied',
      copyManual: 'Select and copy manually',
      manualHint: 'You can also accept the folder offered by this Mac in the remote Syncthing and set its path to the remote path above.',
      retryRemote: 'Retry remote',
      retry: 'Retry',
      details: 'Details',
      warnings: 'Notes',
      existingTitle: 'Existing sync folders',
      existingEmpty: 'No Syncthing folders yet.',
      existingRefresh: 'Refresh list',
      devices: '{n} devices',
      noStatus: 'No status yet',
      errorTitle: 'Something went wrong',
      errPathInUse: 'That path is already used by another Syncthing folder on this Mac. Pick another path or remove the old folder first.',
      errFolderConflict: 'That folder ID exists on this machine with a different path. Pick another name or remove the old folder first.',
      errDeviceMismatch: 'The remote Syncthing device ID does not match the local record. Update the remote device in this Mac’s Syncthing first.',
      errInvalidPath: 'Invalid path: use an absolute folder path, not the home folder or a system-wide directory.',
      errPathUnwritable: 'Could not create the folder; check permissions for that path.',
      errPathExistsFile: 'That path exists but is not a folder.',
      errSyncthing: 'The local Syncthing API is unreachable. Start Syncthing (127.0.0.1:8384) first.',
      errConfig: 'Syncthing config.xml was not found, so the API key cannot be read.',
      errNoPeer: 'This Mac has no remote device yet and the remote is unreachable. Bring the remote online over SSH once.',
      errOffline: 'SSH to the remote failed. The local side is configured; retry later or use the command below.',
      errTimeout: 'The operation timed out. Check Syncthing and SSH, then retry.',
      errSsh: 'SSH to the remote failed. Check the host name, network and key.',
      errNoHost: 'Enter the remote SSH host first.',
    }

    const CSS = `
.sp-page{display:flex;flex:1 1 auto;width:100%;min-width:0;height:100%;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.55}
.sp-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.sp-content{max-width:840px;margin:0 auto;padding:0 clamp(20px,4vw,40px) 56px}
.sp-header{padding-top:28px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
[data-platform=darwin] .sp-header{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.sp-headText{min-width:0}
.sp-title{margin:0;font-size:20px;font-weight:600;line-height:28px}
.sp-subtitle{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px}
.sp-link{color:var(--dsw-alias-brand-primary);font-size:12px;text-decoration:none;white-space:nowrap}
.sp-link:hover{text-decoration:underline}
.sp-readiness{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px}
.sp-readinessLabel{font-size:12px;color:var(--dsw-alias-label-secondary);margin-right:2px}
.sp-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;font-size:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap;max-width:100%}
.sp-pillLabel{overflow:hidden;text-overflow:ellipsis}
.sp-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 auto}
.sp-pill-ok{color:var(--dsw-alias-state-success-primary)}
.sp-pill-warn{color:var(--dsw-alias-state-warn-primary)}
.sp-pill-error{color:var(--dsw-alias-state-error-primary)}
.sp-pill-idle{color:var(--dsw-alias-state-idle-primary)}
.sp-card{margin-top:18px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:18px}
.sp-form{display:grid;gap:14px}
.sp-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.sp-label{font-size:13px;font-weight:500}
.sp-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.sp-input{box-sizing:border-box;height:36px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none;min-width:0}
.sp-input::placeholder{color:var(--dsw-alias-state-idle-primary)}
.sp-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2)}
.sp-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}
.sp-btn{box-sizing:border-box;height:34px;padding:0 15px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.sp-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.sp-btnPrimary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.sp-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.88}
.sp-btn:disabled{opacity:.55;cursor:default}
.sp-btnSmall{height:28px;padding:0 10px;font-size:12px}
.sp-spinner{width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;display:inline-block;animation:sp-spin .8s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
.sp-banner{margin-top:14px;display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);font-size:13px}
.sp-banner-ok{border-color:var(--dsw-alias-state-success-primary)}
.sp-banner-warn{border-color:var(--dsw-alias-state-warn-primary)}
.sp-banner-error{border-color:var(--dsw-alias-state-error-primary)}
.sp-bannerMark{width:18px;height:18px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;margin-top:1px}
.sp-banner-ok .sp-bannerMark{background:var(--dsw-alias-state-success-primary)}
.sp-banner-warn .sp-bannerMark{background:var(--dsw-alias-state-warn-primary)}
.sp-banner-error .sp-bannerMark{background:var(--dsw-alias-state-error-primary)}
.sp-bannerBody{min-width:0}
.sp-bannerTitle{font-weight:600}
.sp-bannerText{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:2px;word-break:break-word}
.sp-result{margin-top:18px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;overflow:hidden}
.sp-resultHead{padding:15px 18px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sp-resultHead h2{margin:0;font-size:15px;font-weight:600}
.sp-resultBody{padding:14px 18px 18px;display:grid;gap:12px}
.sp-meta{display:grid;gap:4px;min-width:0}
.sp-metaRow{display:flex;gap:8px;align-items:baseline;min-width:0;font-size:12px}
.sp-metaKey{color:var(--dsw-alias-label-secondary);flex:0 0 auto;min-width:76px}
.sp-metaValue{min-width:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}
.sp-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.sp-sides{display:grid;gap:8px}
.sp-side{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);min-width:0}
.sp-sideName{font-weight:600;font-size:13px;flex:0 0 auto;min-width:36px}
.sp-sideBody{min-width:0;flex:1}
.sp-sideLine{font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.sp-sideLine + .sp-sideLine{margin-top:2px}
.sp-warnings{margin:0;padding-left:18px;color:var(--dsw-alias-state-warn-primary);font-size:12px}
.sp-warnings li{word-break:break-word}
.sp-commandTitle{font-size:13px;font-weight:600;margin:2px 0 0}
.sp-commandHint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.sp-command{width:100%;box-sizing:border-box;resize:vertical;min-height:92px;max-height:240px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;outline:none}
.sp-command:focus{border-color:var(--dsw-alias-brand-primary)}
.sp-commandActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sp-copyNote{font-size:12px;color:var(--dsw-alias-state-success-primary)}
.sp-manual{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}
.sp-details{font-size:12px;color:var(--dsw-alias-label-secondary)}
.sp-details summary{cursor:pointer}
.sp-details pre{margin:8px 0 0;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-height:220px;overflow:auto}
.sp-section{margin-top:26px}
.sp-sectionHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.sp-sectionHead h2{margin:0;font-size:15px;font-weight:600}
.sp-list{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.sp-folder{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l1);min-width:0}
.sp-folder:first-child{border-top:none}
.sp-folderMain{flex:1;min-width:0}
.sp-folderTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sp-folderName{font-weight:600;font-size:13px;overflow-wrap:anywhere}
.sp-folderPath{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:3px;overflow-wrap:anywhere}
.sp-folderSide{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:0 0 auto}
.sp-empty{padding:20px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
@media (max-width:560px){
.sp-header{padding-top:20px}
.sp-card{padding:14px}
.sp-resultBody{padding:12px 14px 16px}
.sp-folder{padding:11px 13px}
.sp-side{flex-direction:column;gap:4px}
.sp-sideName{min-width:0}
}
`

    function PanelIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 20 20',
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('rect', {
          x: 2.2, y: 3.4, width: 6.2, height: 6.2, rx: 1.5,
          stroke: 'currentColor', strokeWidth: 1.4,
        }),
        h('rect', {
          x: 11.6, y: 10.4, width: 6.2, height: 6.2, rx: 1.5,
          stroke: 'currentColor', strokeWidth: 1.4,
        }),
        h('path', {
          d: 'M13.2 3.2h3.1v3.1M16.1 3.4l-3.6 3.6M6.8 16.8H3.7v-3.1M3.9 16.6l3.6-3.6',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function Spinner() {
      return h('span', { className: 'sp-spinner', 'aria-hidden': 'true' })
    }

    function Pill({ tone = 'idle', title, children }) {
      return h(
        'span',
        { className: `sp-pill sp-pill-${tone}`, title },
        h('span', { className: 'sp-dot', 'aria-hidden': 'true' }),
        h('span', { className: 'sp-pillLabel' }, children),
      )
    }

    function formatBytes(value) {
      const bytes = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
      if (bytes < 1024) return `${bytes} B`
      const units = ['KB', 'MB', 'GB', 'TB']
      let size = bytes / 1024
      let index = 0
      while (size >= 1024 && index < units.length - 1) {
        size /= 1024
        index += 1
      }
      return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
    }

    function errorKey(error) {
      if (error === undefined || error === null) return undefined
      const code = error.code
      if (code === 'path-in-use') return 'errPathInUse'
      if (code === 'folder-conflict') return 'errFolderConflict'
      if (code === 'device-mismatch') return 'errDeviceMismatch'
      if (code === 'invalid-path' || code === 'invalid-label' || code === 'invalid-folder-id') return 'errInvalidPath'
      if (code === 'path-unwritable') return 'errPathUnwritable'
      if (code === 'path-exists-file') return 'errPathExistsFile'
      if (code === 'syncthing-unreachable' || code === 'syncthing-http') return 'errSyncthing'
      if (code === 'config-not-found' || code === 'api-key-missing') return 'errConfig'
      if (code === 'no-peer') return 'errNoPeer'
      if (code === 'offline') return 'errOffline'
      if (code === 'timeout') return 'errTimeout'
      if (code === 'ssh-failed') return 'errSsh'
      if (code === 'no-host') return 'errNoHost'
      return undefined
    }

    function errorText(t, error) {
      if (error === undefined || error === null) return ''
      const key = errorKey(error)
      if (key !== undefined) return t(key)
      return error.message || t('errorTitle')
    }

    function stateText(t, state) {
      if (state === 'idle') return t('stateIdle')
      if (state === 'syncing') return t('stateSyncing')
      if (state === 'scanning' || state === 'sync-preparing' || state === 'cleaning') return t('stateScanning')
      if (state === 'paused') return t('statePaused')
      if (state === 'error') return t('stateError')
      return t('stateUnknown')
    }

    function stateTone(state) {
      if (state === 'idle') return 'ok'
      if (state === 'syncing' || state === 'scanning' || state === 'sync-preparing' || state === 'cleaning') return 'warn'
      if (state === 'error') return 'error'
      if (state === 'paused') return 'idle'
      return 'idle'
    }

    function folderState(data) {
      return data !== undefined && data !== null && data.status !== undefined && data.status !== null
        ? data.status
        : undefined
    }

    function post(name, body) {
      return fetch(`/syncthing-pair/api/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      }).then(async (response) => {
        const text = await response.text()
        let data
        try {
          data = text === '' ? {} : JSON.parse(text)
        } catch {
          throw new Error(`Unexpected response from the plugin (HTTP ${response.status}).`)
        }
        if (!response.ok) {
          throw new Error(data?.error?.message || `HTTP ${response.status}`)
        }
        return data
      })
    }

    function Field(props) {
      return h(
        'label',
        { className: 'sp-field' },
        h('span', { className: 'sp-label' }, props.label),
        h('input', {
          className: 'sp-input',
          type: 'text',
          value: props.value,
          placeholder: props.placeholder,
          spellCheck: false,
          autoComplete: 'off',
          autoCorrect: 'off',
          autoCapitalize: 'none',
          disabled: props.disabled === true,
          onChange: (event) => props.onChange(event.target.value),
          onBlur: props.onBlur,
        }),
        props.hint ? h('span', { className: 'sp-hint' }, props.hint) : null,
      )
    }

    function SideRow(props) {
      const { t, name, data, error, waiting } = props
      const status = folderState(data)
      const lines = []
      if (waiting === true) {
        lines.push(t('stateWaiting'))
      } else if (error !== undefined && error !== null) {
        lines.push(errorText(t, error))
      } else if (status !== undefined) {
        lines.push(`${t('state')} · ${stateText(t, status.state)}`)
        if (typeof status.needBytes === 'number' && status.needBytes > 0) {
          lines.push(t('need', { size: formatBytes(status.needBytes) }))
        }
        if (typeof status.localFiles === 'number') {
          lines.push(`${status.localFiles} files · ${formatBytes(status.localBytes)}`)
        }
      } else {
        lines.push(t('noStatus'))
      }
      return h(
        'div',
        { className: 'sp-side' },
        h('div', { className: 'sp-sideName' }, name),
        h(
          'div',
          { className: 'sp-sideBody' },
          ...lines.map((line, index) => h('div', { key: String(index), className: 'sp-sideLine' }, line)),
        ),
      )
    }

    function ResultCard(props) {
      const { t, result, onRetry, onCopy, copyState } = props
      const ok = result.ok === true
      const partial = result.partial === true
      const tone = ok ? 'ok' : partial ? 'warn' : 'error'
      const title = ok ? t('resultOkTitle') : partial ? t('resultPartialTitle') : t('resultFailTitle')
      const localError = result.local?.ok === false ? result.local.error : undefined
      const remote = result.remote
      const remoteError = remote?.ok === false ? remote.error : undefined
      const warningList = Array.isArray(result.warnings) ? result.warnings : []
      const command = typeof result.command === 'string' ? result.command : ''
      const details = [result.error?.detail, result.local?.error?.detail, result.remote?.error?.detail]
        .filter((value) => typeof value === 'string' && value !== '')
        .join('\n\n---\n\n')

      return h(
        'section',
        { className: 'sp-result', ref: props.innerRef, 'aria-live': 'polite' },
        h(
          'div',
          { className: 'sp-resultHead' },
          h(Pill, { tone }, title),
        ),
        h(
          'div',
          { className: 'sp-resultBody' },
          h(
            'div',
            { className: 'sp-meta' },
            result.label
              ? h('div', { className: 'sp-metaRow' }, h('span', { className: 'sp-metaKey' }, t('name')), h('span', { className: 'sp-metaValue' }, result.label))
              : null,
            result.localPath
              ? h('div', { className: 'sp-metaRow' }, h('span', { className: 'sp-metaKey' }, t('localFolder')), h('span', { className: 'sp-metaValue sp-code' }, result.localPath))
              : null,
            result.remotePath
              ? h('div', { className: 'sp-metaRow' }, h('span', { className: 'sp-metaKey' }, t('remoteFolder')), h('span', { className: 'sp-metaValue sp-code' }, result.remotePath))
              : null,
            result.folderId
              ? h('div', { className: 'sp-metaRow' }, h('span', { className: 'sp-metaKey' }, t('folderId')), h('span', { className: 'sp-metaValue sp-code' }, result.folderId))
              : null,
          ),
          h(
            'div',
            { className: 'sp-sides' },
            h(SideRow, {
              t,
              name: t('localSide'),
              data: result.local?.data,
              error: localError,
            }),
            h(SideRow, {
              t,
              name: t('remoteSide'),
              data: remote?.data,
              error: remoteError,
              waiting: remote?.ok !== true && remote?.reachable !== true,
            }),
          ),
          warningList.length > 0
            ? h('ul', { className: 'sp-warnings' }, ...warningList.map((warning, index) => h('li', { key: String(index) }, warning)))
            : null,
          command !== ''
            ? h(
                'div',
                { className: 'sp-sides' },
                h('div', { className: 'sp-commandTitle' }, t('commandTitle')),
                h('div', { className: 'sp-commandHint' }, t('commandHint')),
                h('textarea', {
                  className: 'sp-command',
                  readOnly: true,
                  value: command,
                  spellCheck: false,
                  onFocus: (event) => event.target.select(),
                  onKeyDown: (event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
                      event.preventDefault()
                      event.target.select()
                    }
                  },
                }),
                h(
                  'div',
                  { className: 'sp-commandActions' },
                  h(
                    'button',
                    { type: 'button', className: 'sp-btn sp-btnSmall', onClick: () => onCopy(command) },
                    t('copy'),
                  ),
                  copyState === 'copied' ? h('span', { className: 'sp-copyNote' }, t('copied')) : null,
                  copyState === 'manual' ? h('span', { className: 'sp-copyNote' }, t('copyManual')) : null,
                ),
                h('div', { className: 'sp-manual' }, t('manualHint')),
              )
            : null,
          !ok && details !== ''
            ? h(
                'details',
                { className: 'sp-details' },
                h('summary', null, t('details')),
                h('pre', null, details),
              )
            : null,
          h(
            'div',
            { className: 'sp-commandActions' },
            h(
              'button',
              { type: 'button', className: 'sp-btn sp-btnSmall', onClick: onRetry },
              partial ? t('retryRemote') : t('retry'),
            ),
          ),
        ),
      )
    }

    function Page(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const started = React.useRef(false)
      const draftLoaded = React.useRef(false)
      const resultRef = React.useRef(null)
      const [probe, setProbe] = React.useState(null)
      const [checking, setChecking] = React.useState(true)
      const [busy, setBusy] = React.useState(false)
      const [form, setForm] = React.useState({ sshHost: '', localPath: '', remotePath: '', label: '' })
      const [result, setResult] = React.useState(null)
      const [overview, setOverview] = React.useState(null)
      const [error, setError] = React.useState('')
      const [copyState, setCopyState] = React.useState('')

      const refreshProbe = React.useCallback(async (hostOverride) => {
        const host = (typeof hostOverride === 'string' ? hostOverride : form.sshHost).trim()
        setChecking(true)
        setError('')
        try {
          const data = await post('probe', { sshHost: host })
          setProbe(data)
        } catch (failure) {
          setProbe(null)
          setError(failure.message || String(failure))
        } finally {
          setChecking(false)
        }
      }, [form.sshHost])

      const refreshOverview = React.useCallback(async () => {
        try {
          const data = await post('overview')
          if (data.ok === true) setOverview(data.data)
        } catch {
          // The overview is advisory; a failure here must not cover the form.
        }
      }, [])

      React.useEffect(() => {
        if (started.current) return
        started.current = true
        try {
          const raw = window.localStorage.getItem(DRAFT_KEY)
          if (raw !== null) {
            const parsed = JSON.parse(raw)
            if (parsed !== null && typeof parsed === 'object') {
              setForm({
                sshHost: typeof parsed.sshHost === 'string' ? parsed.sshHost : '',
                localPath: typeof parsed.localPath === 'string' ? parsed.localPath : '',
                remotePath: typeof parsed.remotePath === 'string' ? parsed.remotePath : '',
                label: typeof parsed.label === 'string' ? parsed.label : '',
              })
            }
          }
        } catch {
          // Drafts are best-effort.
        }
        draftLoaded.current = true
        refreshOverview()
      }, [refreshOverview])

      React.useEffect(() => {
        if (!draftLoaded.current) return
        try {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
        } catch {
          // Ignore quota / private-mode failures.
        }
      }, [form])

      React.useEffect(() => {
        if (!draftLoaded.current) return undefined
        const timer = window.setTimeout(() => {
          refreshProbe(form.sshHost)
        }, 450)
        return () => window.clearTimeout(timer)
      }, [form.sshHost, refreshProbe])

      React.useEffect(() => {
        if (copyState === '') return undefined
        const timer = window.setTimeout(() => setCopyState(''), 2400)
        return () => window.clearTimeout(timer)
      }, [copyState])

      const submit = React.useCallback(async (event) => {
        if (event !== undefined && typeof event.preventDefault === 'function') event.preventDefault()
        if (form.sshHost.trim() === '') {
          setError(t('hostRequired'))
          return
        }
        if (form.localPath.trim() === '' || form.remotePath.trim() === '') {
          setError(t('pathRequired'))
          return
        }
        setBusy(true)
        setError('')
        setResult(null)
        setCopyState('')
        try {
          const data = await post('apply', {
            sshHost: form.sshHost.trim(),
            localPath: form.localPath.trim(),
            remotePath: form.remotePath.trim(),
            label: form.label.trim() === '' ? undefined : form.label.trim(),
          })
          if (data.ok === false && data.stage === undefined && data.error !== undefined) {
            setError(errorText(t, data.error))
            return
          }
          setResult(data)
          refreshOverview()
          if (data.local?.ok === false && data.local?.error !== undefined) {
            setError(errorText(t, data.local.error))
          }
          window.requestAnimationFrame(() => {
            resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy(false)
        }
      }, [form, refreshOverview, t])

      const copyCommand = React.useCallback(async (text) => {
        try {
          if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text)
            setCopyState('copied')
            return
          }
        } catch {
          // Fall through to the manual state.
        }
        setCopyState('manual')
      }, [])

      const local = probe?.local
      const remote = probe?.remote
      const localTone = checking ? 'idle' : local?.ok === true ? 'ok' : 'error'
      const localLabel = checking ? t('checking') : local?.ok === true ? t('localReady') : t('localDown')
      const remoteEmpty = form.sshHost.trim() === ''
      const remoteNoHost = remoteEmpty || remote?.error?.code === 'no-host'
      const remoteTone = checking ? 'idle' : remoteNoHost ? 'idle' : remote?.ok === true ? 'ok' : remote?.reachable === true ? 'warn' : 'error'
      const remoteLabel = checking
        ? t('checking')
        : remoteNoHost
          ? t('noHost')
          : remote?.ok === true
            ? t('remoteReady')
            : remote?.reachable === true
              ? t('remoteDegraded')
              : t('remoteOffline')
      const folders = Array.isArray(overview?.folders) ? overview.folders : []

      return h(
        'section',
        { className: 'sp-page', 'aria-label': t('title') },
        h(
          'div',
          { className: 'sp-scroll' },
          h(
            'div',
            { className: 'sp-content' },
            h(
              'header',
              { className: 'sp-header' },
              h(
                'div',
                { className: 'sp-headText' },
                h('h1', { className: 'sp-title' }, t('title')),
                h('p', { className: 'sp-subtitle' }, t('subtitle')),
              ),
              h('a', { className: 'sp-link', href: 'http://127.0.0.1:8384', target: '_blank', rel: 'noreferrer' }, t('syncthingLink')),
            ),
            h(
              'div',
              { className: 'sp-readiness' },
              h('span', { className: 'sp-readinessLabel' }, t('readiness')),
              h(Pill, { tone: localTone, title: local?.error?.message }, localLabel),
              h(Pill, { tone: remoteTone, title: remote?.error?.message }, remoteLabel),
              h(
                'button',
                {
                  type: 'button',
                  className: 'sp-btn sp-btnSmall',
                  disabled: checking,
                  onClick: () => {
                    refreshProbe(form.sshHost)
                    refreshOverview()
                  },
                },
                checking ? h(Spinner) : null,
                t('refresh'),
              ),
            ),
            error !== ''
              ? h(
                  'div',
                  { className: 'sp-banner sp-banner-error', role: 'alert' },
                  h('span', { className: 'sp-bannerMark', 'aria-hidden': 'true' }, '!'),
                  h(
                    'div',
                    { className: 'sp-bannerBody' },
                    h('div', { className: 'sp-bannerTitle' }, t('errorTitle')),
                    h('div', { className: 'sp-bannerText' }, error),
                  ),
                )
              : null,
            h(
              'form',
              { className: 'sp-card sp-form', onSubmit: submit },
              h(Field, {
                label: t('hostField'),
                hint: t('hostHint'),
                value: form.sshHost,
                placeholder: 'remote-mac',
                disabled: busy,
                onChange: (value) => setForm((current) => ({ ...current, sshHost: value })),
                onBlur: () => refreshProbe(form.sshHost),
              }),
              h(Field, {
                label: t('localField'),
                hint: t('localHint'),
                value: form.localPath,
                placeholder: '/Users/me/Documents/Shared',
                disabled: busy,
                onChange: (value) => setForm((current) => ({ ...current, localPath: value })),
              }),
              h(Field, {
                label: t('remoteField'),
                hint: t('remoteHint'),
                value: form.remotePath,
                placeholder: '/Users/me/Documents/Shared',
                disabled: busy,
                onChange: (value) => setForm((current) => ({ ...current, remotePath: value })),
              }),
              h(Field, {
                label: t('nameField'),
                hint: t('nameHint'),
                value: form.label,
                placeholder: '',
                disabled: busy,
                onChange: (value) => setForm((current) => ({ ...current, label: value })),
              }),
              h('p', { className: 'sp-hint' }, t('formHint')),
              h(
                'div',
                { className: 'sp-actions' },
                h(
                  'button',
                  { type: 'submit', className: 'sp-btn sp-btnPrimary', disabled: busy },
                  busy ? h(Spinner) : null,
                  busy ? t('starting') : t('start'),
                ),
              ),
            ),
            result !== null
              ? h(ResultCard, {
                  t,
                  result,
                  innerRef: resultRef,
                  onRetry: submit,
                  onCopy: copyCommand,
                  copyState,
                })
              : null,
            h(
              'section',
              { className: 'sp-section' },
              h(
                'div',
                { className: 'sp-sectionHead' },
                h('h2', null, t('existingTitle')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sp-btn sp-btnSmall',
                    onClick: refreshOverview,
                  },
                  t('existingRefresh'),
                ),
              ),
              h(
                'div',
                { className: 'sp-list' },
                folders.length === 0
                  ? h('div', { className: 'sp-empty' }, t('existingEmpty'))
                  : folders.map((folder) => {
                      const status = folder.status
                      const tone = stateTone(status?.state)
                      const state = status === undefined || status === null ? t('noStatus') : stateText(t, status.state)
                      const need = typeof status?.needBytes === 'number' && status.needBytes > 0
                        ? t('need', { size: formatBytes(status.needBytes) })
                        : ''
                      return h(
                        'div',
                        { className: 'sp-folder', key: folder.id },
                        h(
                          'div',
                          { className: 'sp-folderMain' },
                          h(
                            'div',
                            { className: 'sp-folderTop' },
                            h('span', { className: 'sp-folderName' }, folder.label || folder.id),
                            h(Pill, { tone, title: need }, state),
                          ),
                          h('div', { className: 'sp-folderPath sp-code' }, folder.path),
                        ),
                        h(
                          'div',
                          { className: 'sp-folderSide' },
                          h('span', { className: 'sp-hint' }, t('devices', { n: folder.devices ?? 0 })),
                          need !== '' ? h('span', { className: 'sp-hint' }, need) : null,
                        ),
                      )
                    }),
              ),
            ),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'syncthing-pair: dictionaries')

        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.pluginCss = STYLE_KEY
          style.textContent = CSS
          document.head.appendChild(style)
          return () => {
            style.remove()
          }
        }, 'syncthing-pair: styles')

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
            },
            Page,
          ),
        )

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 26,
              locale: NS,
              label: () => t('panel'),
            },
            PanelIcon,
          ),
        )
      },
    }
  },
})
