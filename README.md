# 几度 · Memento

一个安静的人生时间感知与记录桌面应用。

当前版本：`v3.1.0`（已完成）

## 运行

```powershell
npm install
npm run dev
```

## 开发桌面窗口

需要 Rust、Cargo 和 Windows WebView2：

```powershell
npm run tauri:dev
```

## 检查与构建

```powershell
npm run typecheck
npm test
npm run build
npm run tauri:build
```

直接运行版会生成并同步到项目根目录：

```text
Memento.exe
```

本版本不生成 NSIS/MSI 安装包。执行 `npm run tauri:build` 后，可直接双击根目录的 [Memento.exe](./Memento.exe)；同时生成 `Memento.exe.sha256` 校验文件。

## 当前数据策略

- Tauri 桌面运行时优先使用 SQLite。
- 浏览器开发模式使用本地存储回退。
- 数据不上传服务器。
- JSON 适合结构化交换，ZIP 适合跨电脑完整迁移。
- `.memento` 是密码保护的 AES-GCM 加密备份；密码不会写入应用或备份文件。
- 3.1.0 的每日一行、今日旁白使用历史和收藏旁白快照也会进入 SQLite 与备份链路。
- 文案库随软件本地打包，运行时不请求网络；来源与许可见 `docs/content/` 和 `docs/licenses/`。
