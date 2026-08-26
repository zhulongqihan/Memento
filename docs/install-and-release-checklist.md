# Windows 安装与发布检查清单

默认交付根目录的 `Memento.exe`，不生成 NSIS/MSI 安装包；标准命令会在构建后自动同步根目录 exe 和 `Memento.exe.sha256`。只有用户明确要求安装包时才执行打包流程。发布前按以下顺序记录结果：

1. 在开发机运行 `npm run typecheck`、`npm test -- --run`、`npm run build`。
2. 运行 `npm run tauri:build`，记录根目录 `Memento.exe` 体积和 `Memento.exe.sha256`。
3. 双击根目录 `Memento.exe`，确认窗口可以直接打开。
4. 打开应用，创建 Moment、经年、余下、刻度各一条，关闭并重新打开，确认数据仍在。
5. 导出 JSON 和 ZIP；删除一条测试记录后，分别验证合并导入与替换导入。
6. 使用至少 8 个字符的密码导出 `.memento`；用错误密码和篡改文件导入，确认均被拒绝；再用正确密码确认能看到备份预览。
7. 用新版本直接运行，确认旧版本数据可打开；保留用户主动导出的备份文件。
8. 检查 1280、1440、1920 桌面宽度；使用键盘 Tab、Enter、Escape 完成打开、保存和关闭。
9. 发布后新增 `docs/reviews/vX.Y.Z.md`，写明已验证项、未验证项、风险等级和下一轮优先级。

当前限制：本机已完成构建和启动冒烟，但尚未获得独立干净 Windows 环境；GitHub CLI Token 仍缺少创建 PR 的权限，Release 已由仓库 GitHub Actions 自动完成。
