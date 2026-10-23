# 几度 · Memento

一个安静的人生时间感知与记录桌面应用。

- 当前本地交付版本：`v3.1.0`（Windows 便携版）；2026-10-23 核对的 GitHub Release 最新为 `v2.5.0`。
- 重构候选版本：`v4.0.0`（未发布）。当前状态、验收记录和剩余发布门槛见 [docs/current-state.md](docs/current-state.md)。
- 早期 WebView2 白屏只出现在受限执行环境；扩展权限下的隔离 Tauri 测试构建已完成页面加载、v3→v4 迁移及失败重试。当前 P1 是最终 portable/installer 尚未在独立 Windows Known Folder profile 验收：当前主机指向真实用户目录，且没有可用的 Sandbox/VM。此前仅覆盖 `APPDATA` 的 portable 启动可能访问真实用户数据库，是否打开或修改未知；P1 关闭前不进入发布 PR。
- v4.0.0 候选交付物：`output/releases/4.0.0/portable/` 与 `output/releases/4.0.0/installer/`，哈希见 [发布说明](docs/release-notes/v4.0.0.md)。
- 2026-10-23 收尾：异常照片引用、多图保存/查看、时间记录编辑/删除、阶段暂停管理、每日一行历史回看已修复并通过浏览器验证。65 项前端测试、2 项 Rust 测试通过。发布工作流已同步，当前继续完成正式 Windows 产物的独立原生验收；进度见 [完整收尾计划](docs/plans/v4-completion.md)。

## 运行与开发

```powershell
npm install
npm run dev
```

开发 Tauri 桌面窗口需要 Rust、Cargo 和 Windows WebView2 Runtime：

```powershell
npm run tauri:dev
```

## 检查与构建

```powershell
npm run typecheck
npm test -- --run
npm run build
npm run copy:validate
npm run tauri:build:portable
npm run tauri:build:installer
npm run tauri:build
```

当前构建脚本将文件与 sidecar SHA-256 放入 `output/releases/4.0.0/`。NSIS 使用 currentUser 安装模式；若系统没有 WebView2 Runtime，首次安装需要联网下载。卸载默认保留本地用户数据。

## 数据策略

- Tauri 桌面版以 SQLite 保存状态和照片元数据，照片字节单独放在本地资产目录。
- 浏览器开发模式使用 localStorage 适配器。
- 数据不会上传服务器。
- JSON 适合结构化交换，ZIP 适合完整迁移，`.memento` 使用 AES-GCM 加密备份。
- v4 读取 v1/v2/v3 本地状态与备份，并在迁移前校验照片和保留恢复快照。
- 文案库随软件本地打包，运行时不请求网络；来源与许可见 `docs/content/` 和 `docs/licenses/`。
