# Memento 4.0.0 工作区基线清单

- 捕获时间：2026-10-15 19:11:22 +08:00
- 分支：codex/memento-v4
- HEAD：6d4bf8a35c99ceaf459a0851dc4fc10cf89940f4
- 来源：git status --porcelain=v1 --untracked-files=all；共 249 个状态项。
- 全部状态项均保持原样；没有暂存、提交、重置或清理。按路径用途逐项归类；来源无法从 Git 或当前任务记录确认的资料标为“来源未追溯”，仅保留，不纳入产品实现。
- `output/` 下被 Git 忽略的构建、截图和隔离诊断产物不在 Git 状态清单内；它们继续保留，详见 `docs/current-state.md`。

| 状态 | 路径 | 归属与处置 |
| --- | --- | --- |
| M | PRODUCT.md | v4 产品事实与版本文档；属于本目标交付。 |
| M | README.md | v4 产品事实与版本文档；属于本目标交付。 |
| M | docs/content/copy-library-report.json | 旁白文案审计材料；保留；具体修改来源未由 Git 追溯。 |
| M | docs/install-and-release-checklist.md | v4 发布流程文档；属于本目标交付。 |
| M | docs/release-roadmap.md | v4 发布流程文档；属于本目标交付。 |
| M | package-lock.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | package.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | scripts/sync-portable.mjs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src-tauri/Cargo.lock | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src-tauri/Cargo.toml | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src-tauri/src/lib.rs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src-tauri/tauri.conf.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/App.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/backup.test.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/backup.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/migration.test.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/migration.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/repository.test.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/repository.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/seed.test.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/data/seed.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/domain/types.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/styles.css | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/ui/creative-worlds.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/ui/river-drift-overlay.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | src/ux.css | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| M | vite.config.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | .agents/skills/banner-design/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/banner-design/references/banner-sizes-and-styles.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/approval-checklist.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/asset-organization.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/brand-guideline-template.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/color-palette-management.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/consistency-checklist.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/logo-usage-rules.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/messaging-framework.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/typography-specifications.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/update.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/visual-identity.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/references/voice-framework.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/scripts/extract-colors.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/scripts/inject-brand-context.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/scripts/sync-brand-to-tokens.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/scripts/tests/test_sync_brand_to_tokens.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/scripts/validate-asset.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/brand/templates/brand-guidelines-starter.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-backgrounds.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-charts.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-color-logic.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-copy.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-layout-logic.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-layouts.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-strategies.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/data/slide-typography.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/component-specs.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/component-tokens.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/primitive-tokens.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/semantic-tokens.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/states-and-variants.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/tailwind-integration.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/references/token-architecture.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/embed-tokens.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/fetch-background.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/generate-slide.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/generate-tokens.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/html-token-validator.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/search-slides.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/slide-token-validator.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/slide_search_core.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/tests/test_validate_tokens.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/scripts/validate-tokens.cjs | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design-system/templates/design-tokens-starter.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/cip/deliverables.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/cip/industries.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/cip/mockup-contexts.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/cip/styles.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/icon/styles.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/logo/colors.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/logo/industries.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/data/logo/styles.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/banner-sizes-and-styles.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/cip-deliverable-guide.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/cip-design.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/cip-prompt-engineering.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/cip-style-guide.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/design-routing.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/icon-design.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/logo-color-psychology.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/logo-design.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/logo-prompt-engineering.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/logo-style-guide.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/slides-copywriting-formulas.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/slides-create.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/slides-html-template.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/slides-layout-patterns.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/slides-strategies.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/slides.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/references/social-photos-design.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/cip/core.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/cip/generate.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/cip/render-html.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/cip/search.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/icon/generate.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/logo/core.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/logo/generate.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/design/scripts/logo/search.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/slides/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/slides/references/copywriting-formulas.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/slides/references/create.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/slides/references/html-template.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/slides/references/layout-patterns.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/slides/references/slide-strategies.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/LICENSE.txt | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/canvas-design-system.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/shadcn-accessibility.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/shadcn-components.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/shadcn-theming.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/tailwind-customization.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/tailwind-responsive.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/references/tailwind-utilities.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/requirements.txt | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/shadcn_add.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/tailwind_config_gen.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/tests/coverage-ui.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/tests/requirements.txt | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/tests/test_shadcn_add.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-styling/scripts/tests/test_tailwind_config_gen.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/SKILL.md | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/app-interface.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/catalog-summary.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/charts.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/colors.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/data-provenance.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/google-font-licenses.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/google-fonts.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/icons.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/landing.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/motion.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/phosphor-icons-upstream.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/products.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/react-performance.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/angular.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/astro.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/avalonia.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/flutter.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/html-tailwind.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/javafx.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/jetpack-compose.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/laravel.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/nextjs.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/nuxtjs.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/react-native.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/react.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/shadcn.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/svelte.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/swiftui.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/threejs.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/uno.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/uwp.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/vue.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/winui.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/stacks/wpf.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/styles.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/typography.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/ui-reasoning.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/data/ux-guidelines.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/__pycache__/core.cpython-311.pyc | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/__pycache__/design_system.cpython-311.pyc | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/__pycache__/reasoning_contract.cpython-311.pyc | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/core.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/design_system.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/reasoning_contract.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/search.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/google-api.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/google-catalog.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/google-existing.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/google-metadata.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/google-overrides.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/icons-curated.csv | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/phosphor-core.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/phosphor-package.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/phosphor-react-exports.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/catalogs/phosphor-react-package.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/relevance-baseline.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/relevance-cases.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/fixtures/relevance-thresholds.json | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_catalog_refresh.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_core.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_core_data_quality.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_data_contracts.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_design_system_mode.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_native_desktop_stack_freshness.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_relevance_evaluator.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_style_taxonomy.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_text_layout_resilience.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/tests/test_web_stack_freshness.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | .agents/skills/ui-ux-pro-max/scripts/validate_data.py | 保留的外部技能资料；非 Memento 产品源；具体来源未由 Git 追溯；不编辑。 |
| ?? | 1adb58c86aec8e5c2fa921b5b6b214a2.jpg | 保留的图片材料；不是 v4 源文件；来源未由 Git 追溯。 |
| ?? | docs/context_summary_20260919_0114.md | 历史上下文文件；保留供后续任务参考；非产品运行代码。 |
| ?? | docs/context_summary_20260919_0135.md | 历史上下文文件；保留供后续任务参考；非产品运行代码。 |
| ?? | docs/context_summary_20261011_1059.md | 历史上下文文件；保留供后续任务参考；非产品运行代码。 |
| ?? | docs/context_summary_20261015_1641.md | 历史上下文文件；保留供后续任务参考；非产品运行代码。 |
| ?? | docs/context_summary_20261015_1719.md | 历史上下文文件；保留供后续任务参考；非产品运行代码。 |
| ?? | docs/context_summary_20261015_1806.md | 历史上下文文件；保留供后续任务参考；非产品运行代码。 |
| ?? | docs/current-state.md | v4 当前状态、候选发布说明或审阅材料；属于本目标交付。 |
| ?? | docs/product-research-20260919.md | 产品研究材料；保留并将过时结尾修订为历史状态说明。 |
| ?? | docs/release-notes/v4.0.0.md | v4 当前状态、候选发布说明或审阅材料；属于本目标交付。 |
| ?? | docs/reviews/4.0.0-data-safety.md | v4 当前状态、候选发布说明或审阅材料；属于本目标交付。 |
| ?? | docs/reviews/4.0.0-engineering.md | v4 当前状态、候选发布说明或审阅材料；属于本目标交付。 |
| ?? | docs/reviews/4.0.0-product.md | v4 当前状态、候选发布说明或审阅材料；属于本目标交付。 |
| ?? | docs/reviews/4.0.0-visual.md | v4 当前状态、候选发布说明或审阅材料；属于本目标交付。 |
| ?? | docs/worktree-inventory-20261015.md | v4 阶段 0 工作树基线与逐项归属清单；本目标交付。 |
| ?? | scripts/build-isolated-tauri-test.mjs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | scripts/build-windows-release.mjs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | scripts/release-artifacts.mjs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | scripts/tauri-isolated-fixture.mjs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src-tauri/src/assets.rs | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/asset-store.test.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/asset-store.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/backup-import.test.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/backup-import.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/README.md | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v1.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v1.zip | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v2.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v2.zip | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v3.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v3.zip | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/backup-v4-import-transaction.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/local-v1.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/local-v2.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/fixtures/legacy/local-v3.json | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/data/sqlite-database.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/domain/labels.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/domain/narration-state.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/focus-trap.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/narration-source-dialog.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/worlds/DegreesWorld.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/worlds/NowWorld.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/worlds/SettingsWorld.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/worlds/TimelineWorld.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/worlds/media.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/ui/worlds/shared.tsx | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
| ?? | src/version.ts | Memento v4 实现、构建、迁移、界面或验收代码；属于本目标工作树；继续保留未提交。 |
