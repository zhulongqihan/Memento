# 几度 · Memento

一个安静的人生时间感知与记录桌面应用。

当前版本：`v2.3.0`（开发中）

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

安装包会生成在：

```text
src-tauri/target/release/bundle/nsis/
```

首版采用 Windows x64 NSIS 安装包，安装后可从桌面快捷方式打开。

## 当前数据策略

- Tauri 桌面运行时优先使用 SQLite。
- 浏览器开发模式使用本地存储回退。
- 数据不上传服务器。
- JSON 适合结构化交换，ZIP 适合跨电脑完整迁移。
