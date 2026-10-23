# Memento 当前状态（唯一事实源）

> as_of: 2026-10-23
>
> updated_at: 2026-10-23 19:50:52 +08:00
>
> source: 源码至 5530cdc、Windows Candidate 39946676016、下载产物独立复核及本地最后一项布局修复。

## 当前结论

v4 的记录、回看、计算和备份收尾完成，正式 Windows 安装版与便携版的八项原生流程已通过。下载后的 SQLite 快照、照片字节与产物身份独立复核通过，**原生交付与证据完整性 P1 已关闭；4.0.0 尚未发布，准备提交 v4 PR。**

- 分支：codex/memento-v4；完整候选来源：5530cdcff7ca2759d808aa0a0494d469a2c4b873。
- [Windows Candidate 39946676016](https://github.com/zhulongqihan/Memento/actions/runs/39946676016) 全部成功，证据在 output/ci/39946676016/；清单和摘要见 [候选验证记录](releases/4.0.0-candidate-verification.json)。
- 该候选完成后发现一项视觉 P2：新增删除使四按钮超过固定 106px 列宽。操作列已改为 max-content，本地生产构建及全部浏览器流程重新通过；经年/余下六组独立三尺寸复核中，数字与按钮均保持 13px 间距、按钮至少 32×32px，长名称与五位数字无溢出。P2 已关闭；最终 PR 与 tag 会重新检查包含此修复的源码。
- 当前旧本地交付版为 3.1.0，GitHub Release 最新为 2.5.0（2026-10-23 核对）。本机 output/releases/4.0.0/ 是旧诊断构建，不能交付。

## 已完成与证据

| 范围 | 当前事实 |
| --- | --- |
| 数据底座 | schema v4；SQLite 保存记录和元数据，照片独立文件保存；迁移先校验资产、保留 recovery，再提交 current。 |
| 备份与恢复 | 读取 v1/v2/v3 JSON、ZIP、加密备份；替换/清空前保留快照，导入失败仅回滚本次新增资产。 |
| 异常照片 | 原始引用与可显示照片分开；缺失/损坏图有占位，文字编辑保留引用，仅主动移除解除关联。正式安装版 SQLite 结果已验证。 |
| 多图 | 最多三图完整详情；同页面不同 ID 并发索引覆盖已修，屏障测试与 UI 回归通过；不宣称多标签页事务。 |
| 时间记录 | 三类名称回填，经年/余下单删清置顶，暂停阶段继续管理但不出现在主测量；时钟标注本地时间。 |
| 每日一行 | 按月回看、原日期编辑、单条删除与键盘焦点恢复。 |
| 四页 | 此刻、时光、几度、我的按需加载；App 统一处理状态和持久化事务。 |

65 项前端、2 项 Rust、类型检查、生产构建和 1000 条文案检查通过。生产浏览器新增 10 项流程加旧迁移、焦点、三尺寸、加密导入和替换恢复三套回归通过，无 pageerror。四页 × 1280×720、1440×900、1920×1080 无文档横向溢出。已覆盖键盘焦点、错误态、减少动效、高对比；未作完整 WCAG、读屏、系统缩放或长期性能认证。

独立 hosted Windows VM 记录真实 Known Folder、elevated=true、WebView2 155.0.4283.62，实际运行正式安装版和 portable：新装首屏、卸载保留、真实 3.1.0 合成旧表基线、升级不改旧状态、迁移故障保留及重试、坏图编辑、替换恢复、最终卸载保留均通过。五个原生视口实际为 1440×900，pageErrors 为空；首屏与恢复照片截图已查看。

## 独立下载复核

- 两个 exe 的完整 SHA-256、字节数和 sidecar 与 manifest 一致；sourceDirty=false。安装文件仅有 Tauri 官方 UNK→NSS 类型标记差异，完整预期 installed hash 通过。
- SQLite 使用 VACUUM INTO 导出一致性快照；只读重开验证完整性及三表全部行。failure-state.db 为 schema 3/failed；migrated-state.db 为 schema 4/committed。
- 独立审查逐项对照旧时刻、经年、余下、阶段、每日一行、旁白使用/收藏及全部设置，成功 current 与 recovery 均保留内容；69 字节合成照片与索引、旧嵌入字节和报告 hash 一致。此前直接复制 WAL 主文件的归档缺陷已闭合。

详细历史诊断保留在 [5530cdc 状态记录](https://github.com/zhulongqihan/Memento/blob/5530cdcff7ca2759d808aa0a0494d469a2c4b873/docs/current-state.md)。当前四类审阅位于 docs/reviews/4.0.0-*.md。

## 剩余顺序

1. 提交 v4 PR；最终提交的检查及审阅通过后合并。
2. tag v4.0.0 完整验收，发布该次运行中已经测试的安装 exe、portable、SHA-256、manifest 和说明。
3. 下载正式 Release 复核，记录四类发布后审阅，同步所有状态文档并交付。

[完整计划](plans/v4-completion.md) · [发布清单](install-and-release-checklist.md)。本轮不扩展产品边界或启动新一轮视觉设计。

## 数据与工作区边界

历史一次只设置 APPDATA 的正式 portable 启动可能解析到真实用户数据库，是否打开或修改未知。此后不读取、写入、迁移或恢复真实数据库；独立 VM 通过不能反证历史影响。此前本机 Known Folder 注册表重定向在执行前被工具拒绝，没有该写入，也不换方式绕过。

本轮所有正式程序运行在 hosted VM；本机只构建、浏览器合成测试、只读解包和下载证据复核。VM 的 WebView2 测试策略仅限定精确 exe，并在退出时恢复原值，不重定向数据目录。保留无关工作区文件；基线见 docs/worktree-inventory-20261015.md。
