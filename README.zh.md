<p align="center">
  <img src="assets/icon-180.png" width="96" height="96" alt="Syncthing 文件夹配对图标">
</p>

# Syncthing 文件夹配对

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）插件：把本机上的一个目录和一台可通过 SSH 访问的远端 Mac 上的目录配成同一个 [Syncthing](https://syncthing.net/) 双向同步文件夹。

在侧边栏面板里输入两个路径即可；插件通过两端本机的 Syncthing REST API 完成配置。同时注册 `syncthing_sync` 工具，也可以直接在对话里操作。

[English](README.md) | 中文

## 功能

- 从 `config.xml` 读取本机 Syncthing API key，访问 `127.0.0.1:8384`；不直接修改 `config.xml`。
- 通过 SSH（key 登录、`BatchMode`）在远端运行同一套 Python helper。
- 在两端创建或更新同一个 Syncthing 文件夹：相同 ID、`sendreceive`、启用文件监听、设备列表包含两端设备 ID。
- 如果两端 Syncthing 尚未互相添加设备，会自动补上。
- 显示两端状态，以及本机现有 Syncthing 文件夹列表。
- 远端不可达时，仍会配置本机，并生成一条可在远端直接运行的命令。
- 路径已被其他文件夹占用、或同一文件夹 ID 指向不同路径时直接拒绝；不会删除文件。

## 要求

- DSH `0.2.1-rc.2` 或更新版本。
- 两端 Syncthing 均在运行，REST API 使用默认的 `127.0.0.1:8384`。已在 Syncthing 2.1.7 上测试。
- 从 DSH 所在机器到远端可用 SSH key 登录（不弹密码），远端需要有 `python3` 3.8+。
- 远端支持 macOS 和 Linux；helper 会查找两端常见的 Syncthing `config.xml` 位置。
- 两端 Syncthing 能互相连通（局域网、Tailscale 或 relay 均可）。

## 安装

从 GitHub 安装：

```sh
dsh plugin --profile web add github:cccccccccccccy/dsh-syncthing-pair
```

或使用预构建的 release tarball：

```sh
dsh plugin --profile web add https://github.com/cccccccccccccy/dsh-syncthing-pair/releases/download/v1.0.1/dsh-syncthing-pair-1.0.1.tgz
```

按宿主提示重启 `dsh web`，刷新页面。左侧栏会出现 **Syncthing 同步**。

## 使用

1. 打开左侧栏 **Syncthing 同步**。
2. 填写远端 **SSH 主机**：可以是 `~/.ssh/config` 里的别名（如 `remote-mac`），也可以是 `user@host`。
3. 填写本机与远端两个绝对目录。
4. 可选填同步名称；留空时使用本机目录名。
5. 点 **开始同步**。

面板会显示两端状态和现有文件夹。远端离线时，复制生成的命令到远端终端运行；也可以在远端 Syncthing 界面接受共享文件夹并把路径设为面板中的远端路径，然后点 **重试远端**。

Agent 工具的调用参数相同：

```json
{
  "sshHost": "remote-mac",
  "localPath": "/Users/me/Documents/Shared",
  "remotePath": "/Users/me/Documents/Shared",
  "label": "Shared"
}
```

## 工作原理

```text
DSH 插件（本机）
  ├─ python3 syncthing_pair.py → 本机 Syncthing REST API
  └─ ssh <host> python3 -     → 远端 Syncthing REST API
```

helper 根据两个路径计算稳定的文件夹 ID（`st-<本机目录名>-<hash>`）：相同路径重跑会更新同一个文件夹，只改显示名称不会创建第二个。两端都可达时，插件会先做预检，再写入配置。

## 安全

- 不删除文件、不修改 `config.xml`、不上报任何数据。
- 每条 HTTP 路由先经过 DSH 的 connection 服务（`ctx.connection.requestRejection`）：Host/Origin 检查与浏览器会话认证都通过才继续，因此 Syncthing API 只能被本 DSH 主机上已认证的页面调用；其余请求在读请求体、碰 Syncthing 之前就返回 401/403。
- SSH 使用你已有的 key 和 host 配置；插件不存储凭据。
- 已存在但路径不同的文件夹 ID 会被拒绝，不会被覆盖。

## 限制

- 不支持 SSH 密码交互；请使用 key 或 ssh-agent。
- 只发现 `127.0.0.1:8384` 上的 Syncthing GUI；自定义 GUI 地址暂不支持。
- 不支持 Windows 远端。
- 文件夹 ID 由路径推导：移动本机目录后重跑会创建新配对，需要先在 Syncthing 中删除旧文件夹。
- Syncthing 需要目标目录的读写权限（macOS 受保护目录可能需要 Full Disk Access）。

## 开发

```sh
node --check index.js
node --check server.js
node --check client.js
python3 -c "compile(open('syncthing_pair.py').read(), 'syncthing_pair.py', 'exec')"
npm pack --dry-run
```

Host 与浏览器端都是纯 JavaScript，没有构建步骤；除 `ssh` 和 `python3` 之外没有运行时依赖。

## 更新记录

- **1.0.1** — 路由访问改由 DSH 的 connection 服务（`ctx.connection.requestRejection`）把关：未认证或跨主机的请求在做任何事之前直接返回 401/403。
- **1.0.0** — 首个版本。

## 许可证

MIT
