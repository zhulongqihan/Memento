# Memento 当前状态（唯一事实源）

> as_of: 2026-10-23
>
> updated_at: 2026-10-23 18:53:23 +08:00
>
> source: 提交 abef939、生产构建浏览器回归、前端/Rust 测试、GitHub Actions 39935987568。

## 当前结论

v4 的数据和记录管理收尾已完成并通过本地验证；源码已提交推送，正在独立 Windows VM 重建和验收正式程序。**4.0.0 尚未发布，最终产物原生验收 P1 仍开启。** 当前没有 v4 发布 PR。

- 当前分支：`codex/memento-v4`；实现提交：`abef939e0b09da9e7efe4ef971663703d6d3a482`。
- 最新本地交付版：3.1.0。2026-10-23 核对的 GitHub Release 最新为 2.5.0，两者不可混写。
- [首次 Windows Candidate](https://github.com/zhulongqihan/Memento/actions/runs/39935987568) 的构建、哈希与浏览器检查通过；原生脚本在启动前因 manifest.sourceDirty=true 拒绝继续。尚无原生数据失败证据，也尚无通过证据。首轮未记录具体文件；第二轮已确认仅 Cargo.toml 的换行被工具改写，见下方根因。
- 本机复建成功且 sourceDirty=false，但未启动程序；`output/releases/4.0.0/` 现为这份诊断构建。10 月 15 日旧产物已完整保留至 `output/releases/history/4.0.0-before-20261023/`。首轮 CI 产物及日志保留在 `output/ci/39935987568/`，均不是已通过原生验收的交付版。

## 已完成

| 范围 | 当前事实与证据 |
| --- | --- |
| 数据底座 | schema v4；记录引用照片 ID，SQLite 保存状态与元数据，照片文件独立；浏览器使用 localStorage 适配器。迁移先校验、保留 recovery，再提交 current。 |
| 备份与恢复 | 读取 v1/v2/v3 JSON、ZIP、加密备份；替换/清空前保留快照，导入失败只回滚本次新增资产，不覆盖同 ID 旧文件。 |
| 异常照片编辑 | 原引用与可显示照片分开管理；缺失或损坏图保留占位，只有明确移除才删除关联。单元和真实 UI 保存/重载均通过。 |
| 多图 | 修复浏览器同页面不同 ID 并发索引覆盖；三图上传、重载、详情解码通过。该保证不扩大为多标签页事务。 |
| 时间记录管理 | 三类记录名称回填；经年/余下单条删除及置顶清理；暂停阶段仍可管理，主测量不显示暂停项。 |
| 每日一行 | 时光中按月回看、编辑、删除历史内容，保留原日期，提供焦点恢复。 |
| 页面结构 | 四页按需加载；App 唯一负责状态与持久化事务，弹层通过回调提交。 |
| 发布工程 | 两份工作流统一产物目录，manifest 绑定 commit/dirty/hash，tag 发布复用独立 Windows 验收产物。首轮远端已执行到原生前置门槛；待修复后重跑。 |

## 当前验证

- 65 项前端测试（11 文件）、2 项 Rust 测试、typecheck、生产构建、1000 条文案检查通过；staged diff 检查通过。
- `npm run test:ui` 使用生产 dist 和独立 Edge context，13 组主流程/回归全部通过，无 pageerror；覆盖缺失/损坏照片编辑、三图、三类名称、阶段暂停恢复、单条删除、历史每日一行、迁移、加密备份及替换恢复。
- 四页在 1280×720、1440×900、1920×1080 无文档横向溢出；抽屉焦点、错误态、减少动效和高对比检查通过。实际查看每日历史、三图详情及坏图编辑截图。
- 当前浏览器证据：`output/playwright/v4-completion/verification.json` 及同目录截图。浏览器证据不替代原生 SQLite 和正式 exe 验收。
- 原生脚本只允许 disposable GitHub hosted Windows runner；记录实际身份和 SHGetKnownFolderPath，拒绝已有应用目录，使用正式发布文件与合成数据库。覆盖新装、真实 3.1.0 程序及旧表结构、迁移提交失败/重试、照片编辑与恢复、卸载保留数据。
- 四类审阅正在收尾，均以最终精确产物的实际结果为准；未作完整 WCAG 或屏幕阅读器认证。

## 首轮 CI 诊断

第二轮 [39938707040](https://github.com/zhulongqihan/Memento/actions/runs/39938707040) 同样在原生启动前拒绝 dirty；sourceChanges 仅为 Cargo.toml，source-diff 为空，runner 开启 core.autocrlf=true。临时独立 Git 仓库明确复现：CRLF 检出后写回 LF，会显示 M 但 diff 为空；配置 text eol=lf 后保持 clean。已新增仅针对 Cargo.toml 的 .gitattributes 规则并把该规则纳入来源检查；没有放宽 sourceDirty gate。诊断证据在 output/diagnostics/git-eol-fresh-hAZxu7/result.json；第二轮完整产物/来源证据在 output/ci/39938707040/。日志另确认 NSIS 会 patch exe 的 bundle 信息；all 模式改为只编译一次；第三轮确认打包器会恢复外层 exe，因此两份程序并不完全同字节。只读解包实算证明差异严格限于 Tauri 的 UNK→NSS 三字节标记，其余字节完全相同。manifest 现记录 expectedInstalledExecutable，原生校验该完整哈希，保留安装版和便携版各自运行验证。Rust 缓存改为失败也保留，并统一测试 target，减少诊断重跑的重复编译。

## 第三轮与打包身份修正

[39940601273](https://github.com/zhulongqihan/Memento/actions/runs/39940601273) 已确认 sourceDirty=false、sourceChanges为空，换行误报关闭；安装器成功安装，但原生脚本在启动前因“安装版必须等于便携版”这一不正确假设失败。Tauri 2.11.4 官方 bundler 源码明确打包后恢复原二进制。只读解包证明只有三个安装类型字节不同，证据 output/ci/39940601273/bundle-identity.json。校验改为依据精确标记推导完整 installed hash，任何其他字节变化仍失败；并未运行本机 exe。正式原生首屏/迁移仍待下一轮。

## 剩余顺序

1. 取得独立 Windows job 的构建、安装、首屏、合成旧库迁移、失败保留/重试、坏图编辑、替换恢复、卸载保留数据结果；按真实日志修复失败。
2. 下载并核对同一产物的 manifest、SHA-256、原生截图及 SQLite/照片结果；关闭所有 P0/P1 后更新四类审阅与发布文档。
3. 创建并审阅 v4 PR，检查通过后整合；tag v4.0.0 运行验收后发布。交付最终安装 exe、校验文件、说明，并记录发布后四类审阅。

详细执行清单：[v4 完整收尾计划](plans/v4-completion.md)。不新增账户、社交、云端、AI、地图、天气、积分、移动布局或新一轮视觉重画。

## 数据与历史边界

历史一次只覆盖 APPDATA 的正式 portable 启动可能解析到真实用户数据库，是否打开或修改未知。此后不得读取、写入、迁移或恢复真实数据库；本轮独立 VM 验收也不能反证历史影响。此前注册表重定向被工具策略在执行前拒绝，没有发生该写入，不通过替代方式重试。

早期 WebView2 白屏发生于受限执行环境；隔离测试 feature 后来已通过原生迁移和失败重试，但其路径不同于正式程序，因此保留最终产物验收门槛。旧诊断、旧候选 hash 和发现过程见 [修复提交保留的历史状态](https://github.com/zhulongqihan/Memento/blob/abef939e0b09da9e7efe4ef971663703d6d3a482/docs/current-state.md)，不再作为当前未修复清单。

`.agents/`、根图片、旧上下文摘要及来源未追溯的 copy-library-report 改动保留在工作区，没有纳入本次产品提交。工作区历史基线见 `docs/worktree-inventory-20261015.md`。
