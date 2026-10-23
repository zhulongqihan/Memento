# 合成迁移样本

这些文件由固定的虚构记录生成，仅用于 Memento v1/v2/v3 的迁移和备份兼容测试；不含任何真实用户数据库、个人照片或导出文件。

- `local-v1.json`、`local-v2.json`、`local-v3.json`：对应版本的本地 `AppState` JSON。
- `backup-v1.json`、`backup-v2.json`、`backup-v3.json`：对应版本的 JSON 备份包。
- `encrypted-backup-v3-3.1.0.memento`：按已提交的 3.1.0 加密格式，将合成 `backup-v3.json` 固定加密参数后生成的静态 envelope。它是历史格式兼容样本，不是从真实用户或旧版生产数据中取得的文件；密码为测试专用值 `legacy-pass-3.1.0`。用同目录 `generate-encrypted-v3-fixture.mjs` 可复现。
- `backup-v1.zip`、`backup-v2.zip`、`backup-v3.zip`：历史 ZIP 布局，包含 `manifest.json`、`data.json` 和 `assets/{photoId}`。
- 照片是固定的 1×1 合成 PNG；v3 JSON/ZIP manifest 带有校验摘要。

`migration.test.ts` 读取本地状态样本；`backup.test.ts` 读取 JSON 备份，并用相同的 ZIP 布局构造导入用例。静态 ZIP 文件也已逐个检查清单、状态文件和照片资产条目。更新 fixture 时，必须保持记录和照片 ID 引用一致，并重新验证摘要与静态 ZIP 内容。
