# 几度 · Memento 发布路线

执行事实以 [当前状态](current-state.md) 为准。v4 功能与正式 Windows 候选验收完成，进入 PR 和发布阶段。

| 阶段 | 当前结果 | 剩余工作 |
| --- | --- | --- |
| 数据与资产 | 旧版迁移、独立照片、故障保留、重试、备份与恢复的正式程序验证通过；下载 SQLite/照片独立复核通过 | 正式 tag 产物再次核对 |
| 四页与记录 | 编辑回填、三图、暂停恢复、单删、每日一行历史完成；原生主尺寸与浏览器三尺寸已检查；操作列宽 P2 经六组独立几何复核关闭 | 最终 tag 证据核对 |
| 构建与验证 | 65 前端、2 Rust、完整 browser/native 候选通过；源码、exe、SHA-256 与报告绑定 | PR 最终提交检查 |
| 发布 | [候选 39946676016](https://github.com/zhulongqihan/Memento/actions/runs/39946676016) 可追溯，P0/P1 已关闭 | PR 合并、tag 完整验收、Release 下载核对及四类发布后审阅 |

当前本地旧交付版为 3.1.0，GitHub 已发布版为 2.5.0；4.0.0 尚未发布。先完成交付，不扩展账户、社交、云端、AI、地图、天气、积分或移动布局。

[完整收尾计划](plans/v4-completion.md) · [发布检查清单](install-and-release-checklist.md) · [发布说明](release-notes/v4.0.0.md)
