# Memento 当前状态（唯一事实源）

> `as_of`: 2026-10-23
>
> `updated_at`: 2026-10-23 17:49:00 +08:00
> `source`: 当前代码、2026-10-22 前端/Rust 验证复跑、最终构建校验值复核、合成 v3 SQLite 的隔离 Tauri 失败/重试、此前 v1/v2/v3 与合成 3.1.0 加密备份格式测试、浏览器记录照片闭环验证、安装器冒烟、Windows Known Folder 环境核对、工作树基线清单，以及上游 Wry PR #1666 的历史状态和评审反馈
> 本文件优先于 README、PRODUCT 和发布路线。代码或证据变化后，先更新本文件，再同步派生文档。
> 2026-10-23 新增来源：当前调用链、合成照片引用诊断、前端/Rust 检查复跑、候选文件实算哈希、GitHub CLI 只读 Release/PR 查询。下列修订优先于此前“只剩最终产物隔离验收”的结论。

## 当前结论

**2026-10-23 17:49 执行更新：** 用户已授权按完整收尾顺序持续执行。异常照片编辑引用、多照片并发索引、三类时间记录编辑名称、阶段暂停管理、经年/余下单条删除、多图详情和历史每日一行回看/编辑/删除已修复并通过真实浏览器主流程。当前 65 项前端测试、2 项 Rust 测试、生产构建和 1000 条文案检查通过；生产构建下原有迁移、焦点、四页三尺寸、加密导入与替换恢复也通过。发布工作流路径已修正，增加源码/产物清单与只允许托管 Windows VM 的正式 exe 验收脚本；待提交推送后实际运行。此前候选 exe 尚未包含这些修复，不再代表当前源码。下方 16:49 发现记录保留为来源，不能当作修复后的现状。

- 最新本地交付版为 **3.1.0**；2026-10-23 远端核对确认 GitHub Release 最新为 **2.5.0**，不能把本地交付写成已在 GitHub 发布。4.0.0 的便携版与 NSIS 安装包已构建，但尚未发布，也没有创建 PR。
- 4.0.0 主体已实现，并有浏览器验收、单元测试和安装/卸载冒烟记录；2026-10-23 新发现照片引用编辑缺陷、现有功能管理缺口和发布工作流路径失配，需修复与补验收后重新构建，不能称为只剩环境问题。
- **新增 P1：坏照片记录文字编辑会丢失照片引用。** 合成诊断实际调用资产层与 repository，按源码复刻抽屉和 App 的编辑变换；缺失/损坏两种情况下，保存并重载后 `photoIds` 变为空数组，元数据和已有损坏字节仍保留。根因是把可显示照片视图当成完整引用集合。不是 UI E2E，尚未在原生 SQLite 运行；共享 UI 代码使桌面同样存在风险。证据见 `output/diagnostics/20261023-photo-reference-edit/result.json`。
- **发布工程缺口：** 两份 GitHub 发布工作流仍读取旧 `src-tauri/target/release/bundle/nsis` 和根目录便携文件，与当前 `output/releases/4.0.0/` 输出不符；正式发布前需修正并验证。
- **发布门槛仍未关闭（P1）**：扩展进程权限下的隔离 Tauri 测试构建已完成页面加载、合成 v3→v4 迁移、提交失败保留和重试；2026-10-22 再次通过同一隔离故障/重试流程。此前白屏只在受限执行环境中出现。最终 portable exe 的 Known Folder 数据路径尚未在隔离 Windows profile 中验证。一次只覆盖 `APPDATA` 的 portable 启动可能解析到真实用户数据库，是否打开或修改尚未确认；该事件不能当作通过证据。此次环境复核确认当前身份是 `LAPTOP-2MRU83GU\yang`（非管理员），`USERPROFILE` 为 `C:\Users\yang`，直接调用 `SHGetKnownFolderPath(FOLDERID_RoamingAppData)` 返回 `C:\Users\yang\AppData\Roaming`；进程级覆盖 `USERPROFILE` 不改变结果。主机未发现 Windows Sandbox/VM 启动器。用户授权继续后，临时重定向 HKCU `User Shell Folders` 的尝试在执行前被工具策略拒绝；没有发生注册表写入，也不通过其他方式重试该操作。当前仍不能安全启动最终 portable。不得声称真实数据库未被触及，也不得继续读取、写入、迁移或恢复它。
- 未暂存、未提交、未清理工作区。原有未提交源码、文档、图片、`.agents/` 和历史输出均保留。
- 本轮环境盘点发现另有已启用的本地账户 `CodexSandboxOffline`，但它要求密码、profile 未加载且没有活动会话；当前执行环境没有该账户凭据或会话，不能据此安全启动最终产物。
- `docs/worktree-inventory-20261015.md` 记录 2026-10-15 19:11:22 +08:00 的 Git 状态基线：`codex/memento-v4`、HEAD `6d4bf8a35c99ceaf459a0851dc4fc10cf89940f4`、249 个状态项。清单逐项列出归属和处置；来源未追溯的资料只保留，未作为本次产品实现依据。该清单不包含 Git 忽略的 `output/` 产物。

## 产品边界与页面职责

几度是 Windows PC 优先的本地人生时间记录应用，核心闭环为记录、查看、计算和备份。保留“此刻、时光、几度、我的”四页；不增加云同步、账户、社交、AI、地图、天气、积分或移动端布局。视觉方向为 Editorial / Personal Archive / Quiet，主要尺寸 1440×900，验收尺寸为 1280×720、1440×900、1920×1080。

| 页面 | 职责 |
| --- | --- |
| 此刻 | 看见正在发生的时间，记录时刻和每日一行。 |
| 时光 | 按日期与类型回看记录，支持索引和胶片两种视图。 |
| 几度 | 查看经年、余下日期和阶段刻度；比例只表达真实区间。 |
| 我的 | 管理显示设置、备份与恢复、文案来源和应用信息。 |

## 应用结构

- 四个主世界位于 `src/ui/worlds/` 并按需加载；共享媒体、筛选和视觉包裹留在 UI 层。
- `src/App.tsx` 是导航、全局状态、持久化与导入/恢复事务的唯一所有者。
- `src/features/records/types.ts` 提供统一记录表单类型；`src/ui/recording-overlays.tsx` 承载记录抽屉、时刻与阶段详情、备份预览。弹层只通过回调触发动作，不直接写存储。

## v4 数据与备份事实

- 持久状态使用 `schemaVersion: 4`。业务记录只保存照片 ID；照片元数据与文件字节由资产层单独管理。
- Tauri 设计为 SQLite 保存 current/recovery 状态、照片元数据和迁移日志，照片字节写入应用数据目录的 `assets/`。浏览器开发模式使用 localStorage 适配器。
- 本地旧状态与 JSON、ZIP、加密备份可识别 v1/v2/v3；迁移先校验照片资产，写入 v4 恢复快照后才提交 current。备份输出不包含运行时 Blob URL。
- 固定的加密 v3 兼容样本按已提交的 3.1.0 envelope 参数由合成 v3 JSON 生成；测试验证迁移、照片字节和错误密码拒绝。它证明历史格式实现兼容，不是从真实用户或生产旧备份中取得的文件。
- 替换导入和清空数据前保留恢复快照；失败导入会回滚本次新增资产，保留已有同 ID 内容。
- 固定示例 ID 不再用于删除旧记录。照片缺失、损坏或未登记会显示持久警示，保存记录时跳过不安全的资产清理。

## Windows 交付物

以下为修复前的历史候选；当前源码更新后须重新构建并绑定验收证据。历史产物位于 `output/releases/4.0.0/`：

| 交付物 | 文件 | SHA-256 |
| --- | --- | --- |
| 便携版 | `portable/Memento-4.0.0-portable.exe` | `B4D57FD297117846174E3E343E4EAF890030F7270FDA99CB8531A1767E8077C8` |
| NSIS 安装包 | `installer/Memento_4.0.0_x64-setup.exe` | `96477C1044231DABF7F3F92B9FFFD070A40DAF140C1638B91FE6AED92C833649` |

两份 sidecar SHA-256 均与最终文件实算值一致。NSIS 为 currentUser 安装，配置了 WebView2 下载引导器；没有 WebView2 Runtime 的新电脑首次安装需要联网获取运行时。卸载默认保留用户数据。

## 验收证据（2026-10-15）

- `npm run typecheck`：通过。
- `npm test -- --run`：10 个文件、60 项通过；正式测试脚本排除 `output/` 中的生成副本，避免重复执行旧 smoke 测试。
- `cargo test --manifest-path src-tauri/Cargo.toml`：2 项通过，包括照片路径约束和并发写入不覆盖。
- `npm run build`：通过。`npm run copy:validate`：通过，1000 条文案无重复或缺项。`git diff --check`：通过；仅有 Git 对 LF/CRLF 的提示。
- `npm run tauri:build:portable`、`npm run tauri:build:installer` 和总入口 `npm run tauri:build` 均有成功构建记录。总入口遇到一次 Windows `EPERM` 覆盖瞬时失败后，独立安装包重试和总入口重跑都成功。
- Playwright / Edge 真实浏览器验证覆盖 v3 本地状态与照片迁移、损坏照片警示、四页 × 三种尺寸共 12 张截图、抽屉焦点进入/约束/恢复、空标题错误、高对比、减少动效、About 版本、Timeline 筛选语义、合并导入提交失败后重试。另于 2026-10-15 使用独立浏览器上下文完成 Replace → Replace → recovery restore：先导入合成 v3 备份并验证照片经 Blob URL 实际渲染，再替换为含合成资产的 v4 备份，确认 recovery 中仍保留 v3 状态与照片字节；恢复后 v3 照片仍可渲染、恢复快照清除、仅被 v4 替换导入引用的资产被清理，浏览器无未捕获错误。脚本、三张流程截图和结果 JSON 在 `output/playwright/memento-v4-final/`。
- 2026-10-15 补充 Edge 隔离浏览器中的 UI 记录照片闭环：通过记录面板上传合成 PNG，验证 v4 状态只保存照片 ID、资产字节与元数据独立持久化；整页重载后照片在时间轴和详情中实际解码；编辑后再次重载仍保留修改和照片；确认删除后记录、无引用照片字节及元数据均清理。弹层拆分后重跑四页布局、焦点、导入失败重试和照片闭环，全部通过且无页面异常。脚本、结果 JSON、详情截图位于 `output/playwright/memento-v4-final/`。此结果仅覆盖浏览器 localStorage 适配器，不替代原生 SQLite 验收。
- 另用隔离 Edge 测试经年、余下、阶段的 UI 创建和 Degrees 展示；阶段读屏标签明确包含起止日期与当前比例（合成区间示例为 36.4%）。Timeline 实际切换“初见”与“人生节点”筛选，各只呈现匹配类型。加密 v3.1.0 合成 fixture 的 UI 流程验证错误密码不改当前状态、正确密码预览、Replace 迁移 v4 状态并保留恢复快照，导入照片可实际解码；结果分别见 `measurement-workflows-verification.json` 与 `encrypted-import-verification.json`。
- 安装器静默首次安装通过；同目录内从仓库 3.1.0 基线程序替换为 4.0.0 NSIS 文件通过；卸载通过。两次冒烟卸载均确认安装程序已移除，目录外合成用户数据哨兵仍在。升级安装器本身没有改写合成 schema v3 SQLite 数据。
- 以下条目是受限执行环境下的历史失败诊断；扩展进程权限下的隔离 Tauri 测试构建随后已完成页面加载、原生迁移及失败重试。历史失败不能代表当前测试构建的原生状态。
- 早期隔离 Tauri v3→v4 运行没有生成 `photo_assets` / `asset_migration_log` 表或迁移记录；后续扩展进程权限运行已通过，不再以该早期结果描述当前原生状态。
- 16:33 的隔离诊断使用 `output/tauri-isolated/diagnose-20261015-03/` 合成 profile 和全限定进程级路径。`memento.exe` 创建了标题为“几度 · Memento”的 Tauri 窗口及 WebView2 profile；UI Automation 只观察到 `WRY_WEBVIEW` 面板，没有可访问的页面内容；本地 CDP 端口也未开放。SQLite 表清单仍只有合成 v3 的 `app_state`，没有发生迁移。前两次诊断把 WebView2 环境路径设为相对路径，结果无效，不作为启动证据。
- 生产 `dist` 经 Edge 打开后 `.app-shell` 正常出现，页面资源和控制台没有错误；Tauri dev URL `127.0.0.1:1420` 在 Edge 中也正常渲染。隔离 Tauri 窗口截图 `output/playwright/memento-v4-final/native-window-diagnostic-04.png` 显示 1440×900 白屏。
- 早期测试 feature 在 `src-tauri/src/lib.rs` 为隔离运行记录 `run`、`setup` 和 `on_page_load` 事件。`diagnose-dev-20261015-04`、跳过 SQL 插件的 `diagnose-dev-no-sql-20261015-01`，以及 17:47 的 `probe-static-page-20261015-01` 均只记录 `run`，没有 `setup` / 页面加载。静态对照把 `devUrl` 指向 `127.0.0.1:1420` 的独立 HTML 页，但服务端没有收到 Tauri 请求；SQL 插件未启用，合成 profile 使用绝对 `MEMENTO_ISOLATED_DATA_DIR` 与 `WEBVIEW2_USER_DATA_FOLDER`。
- `probe-static-page-20261015-01` 的 WebView2 Crashpad 生成两份 browser 进程转储（Runtime `155.0.4283.45`，browser PID `42644`）：异常 `0x0517a7ed` 位于 `msedge_elf.dll+0x282890`，随后为 `0x80000003` 位于 `msedge.dll+0xb30119d`，均发生于启动后约 6–8 秒。profile 全新；转储模块清单没有非系统 / Edge DLL。当前 shell 没有 `WEBVIEW2_*` 环境覆盖或对应策略注册表项；该时段未查到匹配的 Code Integrity、AppLocker、Defender CFA 或 Application Error 事件。故障已收窄到 WebView2 主 browser 进程启动，不等于已查明其内部根因。
- `probe-unfocused-20261015-02` 以 `focus: false` 和另一个全新 profile 复测，仍只记录 `run`、没有页面请求，并在启动后约 6–8 秒产生同样两份转储（browser PID `37612`、异常码和模块偏移均相同）。因此 Wry 默认焦点调用不是已证实的根因。
- 受限执行环境中的一次复测使用 `output/builds/memento-isolated-storage-test/release/memento.exe` 与 `output/tauri-isolated/final-20261015-01/` 合成 schema v3 数据；`APPDATA`、`MEMENTO_ISOLATED_DATA_DIR` 和 `WEBVIEW2_USER_DATA_FOLDER` 均指向该 profile。Runtime 日志只记录 `run`，没有 `setup` 或 `on_page_load`；独立 WebView2 profile 创建了 `EBWebView`。关闭进程后只读检查数据库仍只有 `app_state.current`（schema v3），没有 recovery 行、照片表、迁移日志或资产目录。后续扩展进程权限下的隔离测试构建已通过原生迁移和重试；这次历史复测没有定位故障根因。
- `probe-disable-gpu-20261015-03` 在仅对进程设置 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu` 后重测。静态服务器收到 `GET /`，但 1440×900 窗口仍白屏，Rust 日志只有 `run`，没有 `setup` / `on_page_load`；Crashpad 仍生成两份 browser 转储，异常分别为 `0x0517a7ed` (`msedge_elf.dll+0x282890`) 与 `0x80000003` (`msedge.dll+0xb30119d`)。仅禁用 GPU 不能恢复 WebView。
- `wry-host-probe-20261015-04` 是独立于 Tauri 与 Memento 的最小 Wry 宿主，使用本项目锁定的 Wry `0.55.1` / Tao `0.35.3`，加载同一隔离静态页。窗口成功创建，但 `WebViewBuilder::build` 没有返回，静态服务没有收到本次请求；WebView2 profile 的 Crashpad 生成两份转储，异常码与模块偏移和 Tauri 探针完全一致。此结果将故障进一步定位到 Wry/WebView2 创建阶段。
- `wry-html-probe-20261015-06` 仍使用 Wry `0.55.1` / Tao `0.35.3`，但改为 `WebViewBuilder::with_html` 载入内存 HTML，不访问静态服务器；创建仍卡在 `WebViewBuilder::build`，Crashpad 再次出现同一对异常码和模块偏移。因此问题发生在 WebView 创建过程，不能归因于 URL 或应用页面导航。
- 受限执行环境中的 `output/tauri-isolated/direct-com-probe-20261015-01/` 是直接 WebView2 COM 对照，使用 `webview2-com 0.38.2`、Windows crate `0.61.3`、STA、可见 Win32 parent window 和新建显式 `userDataFolder`。Run 03 的环境回调在 16 ms 返回；controller 已在 6.5 秒的导航阶段标记前完成。`NavigateToString` 后 `NavigationCompleted` 报 `IsSuccess=false`、`WebErrorStatus=9 (CONNECTION_ABORTED)`；事件记录 GPU kind 6 与 renderer kind 1 多次退出。隔离 profile 的 Crashpad 生成 `c1ad6321-89d5-48ab-b497-dadc3f92b666.dmp`（1,299,152 bytes）。源码、离线 Cargo 锁文件与完整阶段日志均保存在此目录。探针确实把新绝对 profile 传给 WebView2 API；它没有使用 Wry/Tao，但使用同一库的 `wait_with_pump` 消息泵。后续扩展进程权限下的 COM 对照导航成功；早期失败结果用于记录受限环境差异，不代表当前隔离测试状态。
- Wry `0.55.1` 的本地 `src/webview2/mod.rs` 在创建环境、controller 和读取 cookies 时调用 `webview2_com::wait_with_pump`。上游 [PR #1666](https://github.com/tauri-apps/wry/pull/1666) 提议在相关调用点改用 `CoWaitForMultipleHandles` 处理 COM STA 重入。该 PR 当前已关闭、未合并并等待后续回应；作者描述的确定复现是 ARM64，另有评审者报告该改动未解决其 x64 死锁。该评论并非本机同一复现，不能排除本机问题，但降低了把此提案当作 x64 修复方向的可信度；它不是当前根因结论。
- 2026-10-15 的二进制检查确认 Edge `msedge.exe`、WebView2 `msedgewebview2.exe`、Tauri 调试程序和独立 Wry 探针均为 x64；Edge 与 WebView2 可执行文件均为版本 `155.0.4283.45`、Microsoft 签名有效。两个安装目录内的 `msedge.dll` 与 `msedge_elf.dll` SHA-256 完全一致。未发现位数不匹配、签名无效或共享 DLL 版本差异；WebView2 专用启动程序与宿主交互仍待排查。
- 运行时盘点只发现 WebView2 Runtime `155.0.4283.45` 和同版本 Edge 稳定版；没有已安装的 Beta、Dev 或 Canary channel。缓存可离线构建 Wry `0.55.1`，但无法构建 Wry `0.54.4` 或上游 `0.57.0`，未执行网络下载或系统运行时安装，因此版本对照仍缺失。
- 上游版本核对：本工作区锁定 Tauri `2.11.5` / `tauri-runtime-wry 2.11.4` / Wry `0.55.1`；上游已有 Tauri `2.12.4` 与 Wry `0.57.0`。本次所读发布说明没有显示与当前 browser 启动崩溃直接匹配的 Windows 修复，尚未尝试依赖升级。
- 修改隔离诊断代码后，`cargo test --manifest-path src-tauri/Cargo.toml` 通过 2 项 Rust 资产测试。
- 新增 COM 失败事件字段记录后，受限环境中的 GPU 子进程报告 `STATUS_ACCESS_DENIED (0xC0000022)`，renderer 报 `LAUNCH_FAILED`/退出码 `49`；同一探针以受审查的扩展进程权限在 `%TEMP%` 新 profile 导航成功（580 ms）。这与受限执行环境阻止 WebView2 子进程相符，是基于对照的环境推断。
- 最新隔离 Tauri 测试构建在受审查的扩展进程权限下，使用 `output/tauri-isolated/codex-unsandboxed-20261015-01/` 合成 schema v3 数据，记录 `run → setup → Started → Finished`。只读验收通过：current 与 recovery 均为 schema v4，迁移日志 `committed/completed`，合成照片 69 bytes，SHA-256 `d3c936ebdd73f46e6422d5946044c99d524554082272019ab738800318b04892`。
- 第二个隔离 Tauri profile 注入 current 行提交失败，验收确认 current 保留 schema v3、recovery 为 v4、迁移状态为 `failed/committing_state`；移除合成触发器并重启同一隔离测试构建后，current/recovery v4、迁移 `committed/completed` 与照片哈希均通过。
- **未确认：最终 portable exe 的原生数据路径。** 一次安全隔离尝试只覆盖了 `APPDATA` 环境变量，而正式 Tauri 构建的 `app_data_dir()` 通过 Windows Known Folder 路径解析；输出中的合成数据库仍为 schema v3、没有迁移表。该运行可能解析到真实 `C:\Users\yang\AppData\Roaming\com.zhulongqihan.memento\memento.db`，所以不作为隔离验收，也不能断言真实数据库未被打开或修改。进程已关闭；未继续读取、写入、迁移或尝试恢复真实数据库。
- 测试 feature 的 Tauri/SQLite 成功、失败与重试证据仅来自 `output/tauri-isolated/` 合成 profile。需在能证明 Known Folder 指向隔离 profile 的环境中完成最终产物验收后，才能关闭数据安全与发布 P1。

## 2026-10-22 复核补充

- `npm.cmd test -- --run`：10 个文件、60 项通过；`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run copy:validate` 均通过。构建入口 chunk 386.47 kB，旁白 chunk 443.76 kB；文案校验 1000 项无错误。`cargo test --manifest-path src-tauri/Cargo.toml`：2 项通过。`git diff --check` 通过，仅有 LF/CRLF 转换提示。
- 对最终候选产物重新计算 SHA-256 并与 sidecar 比对：portable `B4D57FD297117846174E3E343E4EAF890030F7270FDA99CB8531A1767E8077C8`（14,394,368 bytes），installer `96477C1044231DABF7F3F92B9FFFD070A40DAF140C1638B91FE6AED92C833649`（5,468,718 bytes），均匹配。
- 在 `output/tauri-isolated/known-folder-portable-20261022/` 合成目录重建隔离测试二进制并复测：注入 current 提交失败后，进程正常退出；current 仍为 v3，recovery 为 v4，迁移为 `failed/committing_state`，照片为 69 bytes、SHA-256 `d3c936ebdd73f46e6422d5946044c99d524554082272019ab738800318b04892`。移除合成故障后重新启动，同一隔离二进制正常退出；current/recovery 均为 v4，迁移 `committed/completed`，照片字节与哈希保持一致。测试 `MEMENTO_ISOLATED_DATA_DIR` 和 WebView2 profile 均位于 `output/`；这不是最终 portable 或真实 Known Folder 验收。
- 本次未读取或修改真实用户数据库。当前 `SHGetKnownFolderPath(FOLDERID_RoamingAppData)` 仍指向 `C:\Users\yang\AppData\Roaming`。临时 HKCU `User Shell Folders` 重定向尝试被工具策略在执行前拒绝，无注册表写入；不尝试绕过该拒绝。此前那次仅覆盖 `APPDATA` 的 portable 启动究竟是否打开或修改真实数据库，依旧未知。
- 本机账户/会话只读核对发现 `CodexSandboxOffline` 已启用，但要求密码、profile 未加载且 `query user` 仅显示当前 `yang` 会话；当前执行环境没有该账户的登录会话或凭据。此账户目前不能作为最终产物的 Known Folder 隔离验收环境。
- 因缺少可用专用 Windows 测试用户/VM，最终 portable/installer 的 Known Folder 首启迁移与恢复验收仍未完成；数据安全 P1 继续开启，不创建发布 PR，不称候选已可发布。

## 未完成门槛

0. **修复后最终验证：** 数据引用、浏览器并发索引和全部已列功能缺口已经实现并通过单元/真实浏览器回归；正式安装程序的 SQLite 编辑路径仍需在独立 Windows runner 验证，完成前不扩大为原生通过结论。
1. **P1：** 隔离测试构建的原生 v3→v4 迁移、失败保留和重试已通过；此前 WebView2 子进程失败与受限执行环境相关。最终 portable exe 的 app data 路径尚未安全隔离，最近一次启动不能作为验收，且可能触及真实用户数据库。当前执行主机的 Known Folder 解析到 `C:\Users\yang\AppData\Roaming`，没有可用的本机 Windows Sandbox/VM，且当前身份非管理员。需在专用 Windows 测试用户或 VM 中验收最终产物启动、迁移、照片校验和失败恢复，并由数据安全复审；真实库访问影响仍未确认。
2. 所有 P0/P1 关闭前不创建发布 PR，也不将 4.0.0 标为已发布或 release-ready。
3. 两份 GitHub 工作流路径与先验证后发布的依赖已修正，待远端实际运行；需核对新源码提交、安装器/便携版和 SHA-256。历史安装冒烟不替代新产物验收。

## 2026-10-23 状态审查

- 今日 `npm.cmd test -- --run` 通过 10 文件/60 项；类型检查、网页生产构建、1000 条文案校验、`cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`（2 项）及 `git diff --check` 通过。这些检查没有覆盖新增照片编辑缺陷；合成诊断的 3 个断言用于确认现有行为，不代表功能验收通过。
- 两份候选 exe 的实算 SHA-256 与上表和 sidecar 一致。今天未重新构建或启动最终 Windows 程序；原生与浏览器 UI 验收仍采用已有历史证据。
- `gh release list` 仅返回 [v2.5.0](https://github.com/zhulongqihan/Memento/releases/tag/v2.5.0)；`gh pr list --state all` 返回仍开放的 #1、#2，无 v4 PR。当前分支仍为 `codex/memento-v4`，HEAD 为 `6d4bf8a`；审查开始时 28 个已跟踪修改、228 个未跟踪文件（包含技能与历史文档，不都是产品源码），未暂存或提交。
- 静态确认：编辑抽屉标题仅取 `existingMoment.title`；阶段列表过滤停用项而主测量回退至第一项；详情只展示首张照片；经年/余下没有单条删除回调；每日一行只暴露当天内容。这些应作为现有能力的收尾问题，不能从历史新建流程通过推导编辑/历史查看也通过。
- `visibility-verification.json` 为服务连接拒绝、检查为空；它不是动效产品故障证据，也不是隐藏暂停通过证据。
- 本轮没有修改应用源码、访问真实用户数据库、修改账户/注册表、安装或发布。完整核对与下一步顺序见 `docs/context_summary_20261023_1649.md`。9 月研究和旧上下文保留为历史，不作为当前行动清单。

## 规范与证据文件

- 本次发布候选说明：`docs/release-notes/v4.0.0.md`
- 本次审阅：`docs/reviews/4.0.0-product.md`、`docs/reviews/4.0.0-visual.md`、`docs/reviews/4.0.0-data-safety.md`、`docs/reviews/4.0.0-engineering.md`
- 最终 Windows 文件及校验：`output/releases/4.0.0/`
- 浏览器截图和验证摘要：`output/playwright/memento-v4-final/`
- 工作树逐项基线：`docs/worktree-inventory-20261015.md`
