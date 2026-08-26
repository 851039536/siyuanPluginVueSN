---
name: docAnalysis-0B-exclude-bookmark
overview: 为 docAnalysis 的「0B」统计增加排除设定：用户可在健康度详情弹窗中勾选书签值，带被勾选书签的文档整体排除出统计口径（总文档数与 0B 数同步减少，健康度/大小分布/问题速览三处自动同步），设置持久化到 HealthSettings。
todos:
  - id: model-and-utils
    content: 扩展 HealthSettings 字段与默认值，新增 buildBookmarkExcludeClause 工具函数和 DocQueryConfig.excludeBookmarked
    status: completed
  - id: stats-layer-exclude
    content: useDocAnalysis 注入 getZeroByteExcludeBookmarks 并兼容新旧设置，useDocStats analyzeDocStats 统一 ncWithExclude 整体排除
    status: completed
    dependencies:
      - model-and-utils
  - id: drilldown-exclude
    content: runDocQuery 支持 excludeBookmarked 排除拼接，统计下钻四个入口统一开启、主动查询保持全量
    status: completed
    dependencies:
      - model-and-utils
  - id: herocard-ui
    content: HeroCard 弹窗新增 0B 排除书签勾选区并修复 toggleDeduction 丢字段，HeroCard.scss 补样式
    status: completed
    dependencies:
      - model-and-utils
  - id: auto-reanalyze
    content: index.vue handleUpdateHealthSettings 检测排除书签差异，变化且已分析时自动重新分析
    status: completed
    dependencies:
      - stats-layer-exclude
      - herocard-ui
---

## 产品概述

为 docAnalysis 的「大小分布」与「健康度详情」中的 **0B 空文档** 统计增加排除设定：用户可在健康度详情弹窗内勾选若干书签值，带被勾选书签的文档**整体排除**出统计口径（总文档数与 0B 数同步减少），使健康度口径更干净。

## 核心功能

- 健康度详情弹窗新增「0B 排除书签」勾选区，书签选项来自动态统计的实际书签值
- 带被勾选书签的文档从总文档数、0B 数及全部统计维度中整体排除（大小分布 0B 卡片、健康度 zeroByte 扣分项、问题速览 0B 徽章三处同步生效）
- 统计下钻列表与统计口径一致（同样排除），主动文档查询保持全量不受影响
- 排除设定持久化，更改后自动重新分析即时生效

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + 思源 SQL（`@/api` 的 `sql()`），无新增依赖。

## 实现方案

### 核心思路

0B 数量单一数据源为 `docStats.zeroByteDocs`（`analyzeDocStats` 首个 size SQL 的 `zero_count`），大小分布卡片、健康度扣分项、问题速览徽章全部读取该字段，因此**在 SQL 统计层排除一次，三处自动同步**。所有统计查询（size SQL、重名 SQL 及全部 analyze* 工具函数）都统一拼接 `nc`（notebookCondition）条件，在 `nc` 后统一追加书签排除子句即可实现整体排除。

### 关键决策

1. **排除子句统一用无别名 `id`**：多数查询用 `FROM blocks b`，但 `analyzeContentScan`/`analyzeContentQuality` 部分 SQL 是 `SELECT id FROM blocks`（无别名）。SQLite 单表上下文可将 `id` 解析为 `b.id`，且 `SIZE_WORDCOUNT_SUBQUERY` 无 id 列无歧义，统一无别名写法最安全。
2. **排除配置持久化扩展 `HealthSettings`**：复用现有加载 + watch 自动持久化 + 无效 key 过滤链路（`useDocAnalysis.ts` 57-91 行），新增字段需兼容旧存储（undefined 兜底空数组）。
3. **下钻与主动查询分离**：`DocQueryConfig` 新增 `excludeBookmarked` 开关，仅统计下钻入口（queryByStatsCategory/queryByBookmark/queryByMissingPlatform/queryByPlatformPublished）开启，主动 `queryDocs` 保持全量。
4. **UI 勾选数据源并集去重**：排除后该书签值会从 `bookmarkDistribution` 消失，选项列表须合并已勾选书签，保证可取消勾选。
5. **自动重新分析**：`handleUpdateHealthSettings` 检测 `zeroByteExcludeBookmarks` 序列化差异，变化且已分析时自动 `handleAnalyze()`（复用 `onPlatformSaved` 先例）。

### 性能与可靠性

- 排除子句为 `id NOT IN (SELECT block_id FROM attributes WHERE name='bookmark' AND value IN (...))`，书签值数量少（用户勾选），IN 列表长度有限，SQLite 索引查询开销可忽略；空列表时子句返回空串，零开销。
- 所有维度统一用同一 `ncWithExclude`，保证 totalDocs / bookmarkedDocs / noBookmarkDocs 等交叉指标口径一致，无数据漂移。
- 兼容旧存储：`loadHealthSettings` 对 `zeroByteExcludeBookmarks` 做 `?? []` 兜底，旧数据加载不报错。

## 架构设计

数据流：HeroCard 勾选书签 → emit `update:healthSettings`（保留全量字段）→ index.vue 更新 ref（watch 自动持久化）→ 检测差异触发 `handleAnalyze()` → `analyzeDocStats` 用 `ncWithExclude` 重算全部统计 → 大小分布/健康度/徽章/下钻全部按排除后口径显示。

## 目录结构

```
src/features/docAnalysis/
├── types/
│   └── index.ts                    # [MODIFY] HealthSettings 新增 zeroByteExcludeBookmarks: string[]；DEFAULT_HEALTH_SETTINGS 补空数组
├── utils/
│   ├── sqlHelpers.ts               # [MODIFY] 新增 buildBookmarkExcludeClause(books, idExpr="id") 工具函数（复用 quoteSqlList）
│   └── categoryQueryConfig.ts      # [MODIFY] DocQueryConfig 新增 excludeBookmarked?: boolean
├── composables/
│   ├── useDocAnalysis.ts           # [MODIFY] deps 提供 getZeroByteExcludeBookmarks；makeDefaultHealthSettings/loadHealthSettings 兼容新字段；runDocQuery 按 excludeBookmarked 拼排除子句；queryByMissingPlatform/queryByPlatformPublished 开启排除
│   └── useDocStats.ts              # [MODIFY] analyzeDocStats 构造 ncWithExclude 传给 size SQL/重名 SQL/全部 analyze* 函数；queryByStatsCategory/queryByBookmark 用局部包装 runStatsQuery 统一开启排除
├── components/
│   └── StatsView/
│       ├── HeroCard.vue            # [MODIFY] 弹窗新增「0B 排除书签」勾选区（书签选项 = bookmarkDistribution ∪ 已勾选书签去重）；toggleExcludeBookmark emit 保留全量字段；修复 toggleDeduction 覆盖丢字段隐患
│       └── (index.vue 无需改动，事件链透传已存在)
└── styles/
    └── HeroCard.scss               # [MODIFY] 排除书签勾选区样式（Codex 风格 Token、无 box-shadow）
src/features/docAnalysis/index.vue  # [MODIFY] handleUpdateHealthSettings 检测 zeroByteExcludeBookmarks 差异，变化且 hasAnalyzed 时自动 handleAnalyze()
```

## 实现要点

- `analyzeContentScan`/`analyzeContentQuality` 内部有无别名 SQL（`SELECT id FROM blocks ... ${nc}`），传入 `ncWithExclude`（无别名排除子句）即可，无需改动函数签名。
- `toggleDeduction` 现有实现 emit `{ enabledDeductions: [...] }` 会覆盖丢失新字段，必须改为 `{ ...props.healthSettings, enabledDeductions: [...] }`；新 `toggleExcludeBookmark` 同理保留 enabledDeductions。
- 文案中文硬编码，与 HeroCard 弹窗现有模式一致（不引入 i18n，避免分片改动范围扩大）。
- 验证：read_lints 0 error；用户自行执行 `pnpm lint`、`npx tsc --noEmit` 验证。