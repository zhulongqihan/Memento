# 几度 · Memento

一个安静的人生时间感知与记录桌面应用。留下发生过的事，回看已经走过的时间，也看见正在经历和仍然拥有的时间。

当前正式版本为 [v4.0.0](https://github.com/zhulongqihan/Memento/releases/tag/v4.0.0)（2026-10-23）。[下载安装包](https://github.com/zhulongqihan/Memento/releases/download/v4.0.0/Memento_4.0.0_x64-setup.exe)，附 SHA-256 与发布说明。实现、正式 Windows 验收、公开下载核对及四类发布后审阅已完成；证据见 [当前状态](docs/current-state.md)与[发布记录](docs/releases/4.0.0.md)。

## 四个页面

- 此刻：看见正在发生的时间，记下时刻和每日一行。
- 时光：按索引或胶片回看照片与记录，按月查找历史每日一行。
- 几度：查看经年、余下和阶段刻度，管理与修改时间记录。
- 我的：显示设置、JSON/ZIP/加密备份、恢复快照与应用信息。

Windows PC 优先，无需账户，数据保存在本机。桌面版用 SQLite 保存记录和照片元数据，照片文件独立保存；开发浏览器使用 localStorage。文案库随应用打包，来源与许可见 `docs/content/`、`docs/licenses/`。

## 开发与检查

```powershell
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run copy:validate
npm run test:ui
```

桌面开发需要 Rust、Cargo 和 WebView2 Runtime；运行 `npm run tauri:dev`。浏览器验收需要 Microsoft Edge。

## Windows 构建

```powershell
npm run tauri:build
npm run release:verify
```

产物放在 `output/releases/4.0.0/`，包含 portable、NSIS 安装包、SHA-256 和 manifest。安装面向当前用户；缺少 WebView2 Runtime 时首次安装需联网下载。卸载默认保留记录和照片。安装器和便携版目前均未做 Authenticode 代码签名。

正式 exe 的原生验收由独立 GitHub hosted Windows VM 执行；`npm run test:native` 会拒绝本地运行。[发布说明](docs/release-notes/v4.0.0.md)与[发布检查清单](docs/install-and-release-checklist.md)列出交付内容和门槛。
