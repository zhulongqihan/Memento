# Memento 当前状态（唯一事实源）

> as_of: 2026-10-23
>
> updated_at: 2026-10-23 19:30:00 +08:00
>
> source: 实现 abef939、发布修复至 abfb031、Windows Candidate 39945041846、下载产物及合成 SQLite 独立复核。

## 当前结论

v4 的数据与记录管理收尾完成。独立 Windows VM 中正式安装版和便携版的八项原生流程已通过，但下载后的 SQLite 成功快照遗漏 WAL 内容，证据归档须修正并重新验收。**4.0.0 尚未发布，尚无 v4 PR；最终证据完整性 P1 仍开启。**

- 分支：codex/memento-v4；完整运行通过的源码：abfb031cb84e450b86b8f84cca35dfc99e2bcd44。
- 本地旧交付版为 3.1.0，GitHub Release 最新为 2.5.0（2026-10-23 核对），两者不能混写。
- [Windows Candidate 39945041846](https://github.com/zhulongqihan/Memento/actions/runs/39945041846) 全部 job 成功。证据在 output/ci/39945041846/；exe、sidecar、manifest 下载后再次核对通过，sourceDirty=false。
- 本机 output/releases/4.0.0/ 仍是旧诊断构建，不作为交付；10 月 15 日候选保留在 output/releases/history/4.0.0-before-20261023/。

## 已完成与实际证据

| 范围 | 当前事实 |
| --- | --- |
| 数据底座 | schema v4；SQLite 保存记录与元数据，照片独立文件保存；浏览器为 localStorage 适配器。迁移先校验、保留 recovery，再提交 current。 |
| 备份与恢复 | 读取 v1/v2/v3 JSON、ZIP、加密备份；替换/清空前保留快照，导入失败仅回滚本次新增资产。 |
| 异常照片 | 原始引用与可显示照片分开管理，缺失/损坏图有占位，只有明确移除才解除关联；正式安装版已验证文字编辑保留 SQLite 引用。 |
| 多图 | 最多三图完整详情；同页面不同 ID 并发索引覆盖已修，屏障测试与真实 UI 回归通过；不宣称多标签页事务。 |
| 时间记录 | 三类名称回填，经年/余下单删清置顶，暂停阶段继续管理而不出现在主测量。 |
| 每日一行 | 按月回看，原日期编辑和单条删除，提供键盘焦点恢复。 |
| 四页 | 此刻、时光、几度、我的按需加载；App 统一处理状态和持久化事务。 |

65 项前端、2 项 Rust、类型检查、生产构建和 1000 条文案检查通过。生产浏览器的 13 组主流程/回归覆盖记录编辑、三图、暂停恢复、历史一行、迁移、加密导入和替换恢复，未见 pageerror。四页 × 1280×720、1440×900、1920×1080 无文档横向溢出；焦点、错误态、减少动效和高对比检查通过。未作完整 WCAG/屏幕阅读器认证。

原生报告 output/ci/39945041846/native-verification/result.json 为 passed，实际使用 runneradmin 的 Known Folder，elevated=true，WebView2 155.0.4283.62。新装首屏、卸载保留、真实 3.1.0 与旧表结构、升级安装不改旧状态、迁移故障保留及重试、坏图编辑、替换恢复、最终卸载保留照片均有现场断言；pageErrors为空。已查看首屏、旧版合成记录及恢复后的照片截图。

## 当前归档修正

独立只读复核发现下载的 migrated-state.db 仍为 schema 3/failed，而现场日志为 schema 4/committed。原脚本强制结束进程后直接复制 WAL 模式主文件，遗漏已提交 WAL；这说明归档证据不完整，不是已经证实的产品迁移失败。

新脚本用 SQLite VACUUM INTO 导出一致性快照，随后只读重开，对三张表全部行、完整性、schema、迁移状态和文件哈希验证，并归档合成照片原始字节。独立合成库已复现 raw copy 旧值、SQLite 导出新值，证据 output/diagnostics/sqlite-wal-export-O2KPcC/result.json。旧记录和设置保留断言补齐；独立代码审阅无新阻断项，仍待下一轮下载实证。

截图还发现实际本地时钟被误标“北京时间”，已改为“本地时间”。原生测试将视口固定 1440×900 并记录实际尺寸/横向溢出断言；前轮 runner 原生视口是 1028×749，不能当作原生主尺寸截图。

## 已关闭的 CI 诊断

- Cargo.toml 的 CRLF→LF 导致 Git status dirty/diff 空；固定该文件 text eol=lf，保持严格来源校验，后续证实 clean。
- Tauri NSIS 仅将 bundle 类型 UNK 改为 NSS 三字节，打包后恢复外层 exe；按官方精确操作推导安装文件完整哈希，不再错误要求与 portable 原始哈希相同。
- WebView2 150+ 对 elevated host 忽略调试环境变量；仅在 disposable CI VM 使用按 exe 名称限定的 HKLM WebView 测试策略，并保存/恢复原值。后续正式程序连接与运行通过；未改应用调试设置或 Known Folder。
- 加密测试在慢 runner 上耗时 7.681 秒超过默认 5 秒；只将三项完整 PBKDF2 测试上限设为 30 秒，生产算法/成本及全部断言不变，后续通过。

历史运行与诊断见 [前一阶段记录](https://github.com/zhulongqihan/Memento/blob/abfb031cb84e450b86b8f84cca35dfc99e2bcd44/docs/current-state.md) 与工程审阅。

## 剩余顺序

1. 重跑修订后的完整候选；下载核对一致性 SQLite 快照、照片原始字节、1440×900 原生截图和精确 exe 清单。
2. 关闭 P0/P1，统一状态、发布清单和四类审阅；创建 v4 PR，检查与审阅通过后整合。
3. tag v4.0.0 再次完整验收并发布同一份产物；下载正式 Release 核对，留下四类发布后审阅，交付安装 exe、SHA-256 和说明。

详细清单：[v4 完整收尾计划](plans/v4-completion.md)。不扩展账户、社交、云端、AI、地图、天气、积分、移动布局或新一轮视觉方案。

## 数据与工作区边界

历史一次只设置 APPDATA 的正式 portable 启动可能解析到真实用户数据库，是否打开或修改未知。此后不读取、写入、迁移或恢复真实数据库；独立 VM 通过不能反证历史影响。此前本机 Known Folder 注册表重定向在执行前被工具拒绝，没有该写入，也不换方式绕过。

本轮所有正式程序运行在 hosted VM；本机只构建、浏览器合成测试、只读解包和下载证据复核。.agents/、根图片、旧摘要、研究文档及来源未追溯的 copy-library-report 修改保留，没有纳入产品提交。历史工作区基线见 docs/worktree-inventory-20261015.md。
