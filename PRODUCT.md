# 几度 · Memento

几度是一款 Windows PC 优先的人生时间感知与记录应用。它帮助用户留下真实发生过的事，看见已经过去、正在经历和还剩下的时间。

- 当前本地交付版本：Windows 桌面版 **3.1.0**；GitHub Release 最新为 **2.5.0**（2026-10-23 核对）。
- 当前重构候选：**4.0.0**，已生成便携版与 NSIS 安装包，尚未发布。
- 核心页面：此刻、时光、几度、我的。
- 产品边界：本地优先，无账号、云端、社交、AI、地图、天气、积分或移动端布局。
- 视觉方向：Editorial / Personal Archive / Quiet；桌面验收尺寸为 1280×720、1440×900、1920×1080。
- v4 数据：状态与照片元数据分离，照片以 ID 引用；Tauri 使用 SQLite 和本地资产文件，浏览器开发模式使用 localStorage。
- 4.0.0 安装包使用 currentUser 模式，缺少 WebView2 Runtime 时需联网获取。卸载默认保留用户数据。
- 2026-10-23 已补齐异常照片编辑引用保护、记录编辑/删除、暂停阶段管理、多图详情及每日一行历史回看，并通过浏览器验证；正式 Windows 产物仍待独立原生验收。

唯一状态源、构建哈希、验证范围和发布阻塞项见 [docs/current-state.md](docs/current-state.md)。此前 WebView2 白屏只出现在受限执行环境；扩展权限下的隔离 Tauri 测试构建已通过页面加载、v3→v4 迁移、失败保留和重试。当前 P1 是最终 portable/installer 尚未在独立 Windows Known Folder profile 验收；当前主机解析到真实用户目录且没有可用 Sandbox/VM。此前一次仅覆盖 `APPDATA` 的 portable 启动可能访问真实用户数据库，影响未确认；P1 关闭前不创建发布 PR。
