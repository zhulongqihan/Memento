# Windows 安装与发布检查清单

每个版本都生成 `src-tauri/target/release/bundle/nsis/Memento_X.Y.Z_x64-setup.exe`，发布前按以下顺序记录结果：

1. 在开发机运行 `npm run typecheck`、`npm test -- --run`、`npm run build`。
2. 运行 `npm run tauri:build`，记录安装包体积和 SHA-256。
3. 在干净 Windows 用户环境安装 NSIS 安装包，确认开始菜单/桌面入口存在。
4. 打开应用，创建 Moment、经年、余下、刻度各一条，关闭并重新打开，确认数据仍在。
5. 导出 JSON 和 ZIP；删除一条测试记录后，分别验证合并导入与替换导入。
6. 使用至少 8 个字符的密码导出 `.memento`；用错误密码和篡改文件导入，确认均被拒绝；再用正确密码确认能看到备份预览。
7. 安装下一版本覆盖升级，确认旧版本数据可打开；再从系统设置卸载，确认卸载完成且不误删用户主动保留的备份文件。
8. 检查 1280、1440、1920 桌面宽度；使用键盘 Tab、Enter、Escape 完成打开、保存和关闭。
9. 发布后新增 `docs/reviews/vX.Y.Z.md`，写明已验证项、未验证项、风险等级和下一轮优先级。

当前限制：本机已完成构建和启动冒烟，但尚未获得独立干净 Windows 环境；GitHub 令牌也暂时缺少创建 PR/Release 的权限。
