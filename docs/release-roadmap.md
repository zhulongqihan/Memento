# 几度 · Memento 发布路线

当前执行事实以 [当前状态基线](current-state.md) 为准（更新时间：2026-10-23 16:49 +08:00）。本路线区分本地交付、GitHub 发布、候选构建和仍需关闭的发布门槛。

## 当前发布基线

- 3.1.0 于 2026-08-28 本地交付 Windows 便携版，没有 NSIS 安装包；2026-10-23 远端核对的 GitHub Release 最新为 2.5.0。
- 4.0.0 便携版和 NSIS 安装包已生成，sidecar SHA-256 已核对，候选说明和四类审阅已建立。受限执行环境中的早期 WebView2 失败后来在扩展权限下的隔离 Tauri 测试构建中通过页面加载、v3→v4 迁移和失败重试；早期失败仅作为环境诊断记录。
- 4.0.0 尚未发布。最终 portable/installer 的 Known Folder 路径仍未在专用 Windows 用户或 VM 中隔离验证；此前仅覆盖 `APPDATA` 的 portable 启动可能访问真实用户数据库，影响未确认。该项是当前 P1，关闭前不创建发布 PR。

## v4.0.0 阶段状态

17:49 执行更新：下列审查发现已完成修复，65 项单元测试和生产构建浏览器主流程通过。发布路径已同步，正式产物的独立 Windows 验收仍待实际运行；当前进度以 [完整收尾计划](plans/v4-completion.md) 为准。

2026-10-23 修订：下表的“完成”仅指已有实现及当时覆盖范围。新增合成诊断确认坏照片文字编辑丢引用；静态核对发现非时刻记录编辑名称回填、暂停阶段管理、多图查看等缺口，以及发布工作流旧路径失配。下一步先修复数据与编辑闭环、同步工作流，再对新构建做隔离原生验收；完整证据与顺序见 [核对摘要](context_summary_20261023_1649.md)。

| 阶段 | 结果 | 状态 |
| --- | --- | --- |
| 0 · 基线冻结 | 保护原工作区、统一版本事实、建立 v1/v2/v3 合成样本。 | 完成 |
| 1 · 数据与资产底座 | schema v4、照片资产层、可恢复迁移、备份兼容和导入失败回滚。既有单元、浏览器与隔离测试构建的原生迁移验证通过。 | 主体实现完成；新增异常照片编辑引用 P1 待修，最终产物原生验收待完成 |
| 2 · 应用边界与四页 | 四页拆分、焦点与错误状态、减少动效、高对比及 1280/1440/1920 桌面尺寸已有验收。 | 主体完成；编辑名称与暂停管理等现有功能待收尾 |
| 3 · 发布候选 | Windows NSIS 与便携版、哈希、候选说明、历史安装/升级/卸载冒烟及四类审阅。 | 已构建；工作流路径待修，修复后需按新哈希完整验收最终产物 |

## v4.0.0 Windows 交付

- 便携版：`output/releases/4.0.0/portable/Memento-4.0.0-portable.exe`
- 安装包：`output/releases/4.0.0/installer/Memento_4.0.0_x64-setup.exe`
- 两份 sidecar SHA-256 和验收摘要见 [v4.0.0 候选说明](release-notes/v4.0.0.md)。
- 安装器采用 `currentUser` 模式和 WebView2 下载引导器。未安装 WebView2 Runtime 的首次安装需要联网。
- NSIS 首次安装、从 3.1.0 可执行文件同目录替换到 4.0.0、卸载均在合成目录通过；目录外合成用户数据在卸载后保留。
- 历史受限执行环境中的隔离 Tauri/Wry 探针曾白屏或启动失败；扩展权限下的隔离 Tauri 测试构建后来已完成页面加载、原生迁移及故障重试。2026-10-22 又在 `output/tauri-isolated/` 合成 profile 复核了失败保留和重试。上述结果不等于最终 portable/installer 的 Known Folder 验收。
- 当前主机的 Known Folder 指向 `C:\Users\yang\AppData\Roaming`，且没有可用 Sandbox/VM；仅覆盖 `APPDATA` 不足以隔离 Tauri `app_data_dir()`。因此最终 4.0.0 产物尚未安全完成首次迁移验收，P1 仍开。

## 构建与发布门槛

```text
npm run typecheck
npm test -- --run
npm run build
npm run copy:validate
git diff --check
npm run tauri:build:portable
npm run tauri:build:installer
npm run tauri:build
```

每个版本在独立 `codex/` 分支完成。v4.0.0 的产品、视觉、数据安全、工程审阅放在 `docs/reviews/`。P0/P1 必须关闭并有证据后才能准备发布 PR。
