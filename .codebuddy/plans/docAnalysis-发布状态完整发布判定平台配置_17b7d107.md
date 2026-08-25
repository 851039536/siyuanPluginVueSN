---
name: docAnalysis-发布状态完整发布判定平台配置
overview: docAnalysis 模块发布状态分析支持「参与完整发布判定平台」可选配置：在平台管理弹窗每行新增开关，勾选的平台全部发布才算完整发布；同时将平台分布表合并进发布状态分区展示。
todos:
  - id: add-fullcheck-field
    content: types/index.ts 为 PlatformMeta 新增 fullCheck 字段并在 DEFAULT_PLATFORM_META 全部补 true
    status: completed
  - id: update-judge-logic
    content: docStatsAnalyzer.ts 改造 analyzePlatformPublish 按勾选平台计算 full/partial/no 与下钻 ID 集
    status: completed
    dependencies:
      - add-fullcheck-field
  - id: merge-platform-distribution
    content: StatsView/index.vue 将平台分布行合并进发布状态分区并迁移 headerExtra，删除独立平台分布表
    status: completed
    dependencies:
      - update-judge-logic
  - id: add-manage-toggle
    content: PlatformManage/index.vue 每行新增参与完整发布判定开关并持久化
    status: completed
    dependencies:
      - add-fullcheck-field
  - id: update-styles-readme
    content: PlatformManageModal.scss 新增开关列样式，README.md 补充可配置说明
    status: completed
    dependencies:
      - add-manage-toggle
      - merge-platform-distribution
---

## 产品概述

为 docAnalysis 发布状态统计增加可配置能力：用户可在「平台管理」弹窗中为每个平台勾选是否参与「完整发布」判定。完整/部分/未发布三态统计基于勾选的平台集合计算，未勾选平台不参与判定。同时将原独立的「平台分布」表合并进发布状态分区展示，形成「完整/部分/未发布 + 各平台分布」的完整发布总览。

## 核心功能

- 平台管理弹窗每行新增「参与完整发布判定」开关，随平台配置持久化
- 完整发布判定仅基于勾选平台：勾选平台全部已发布 = 完整发布；勾选平台一个都未发布 = 未发布；其余 = 部分发布
- 勾选平台为空时回退为全部平台参与判定（保持现有行为）
- 发布状态分区合并展示：完整发布/部分发布/未发布三行 + 各平台分布行（含人均平台数、覆盖率提示）
- 平台过滤栏徽章（未发布到指定平台的文档数）保持基于全部平台统计，不受勾选影响
- 完整发布/未发布下钻（文档列表筛选）与新的判定口径保持一致

## 技术栈

- Vue 3 + TypeScript + SCSS（沿用现有架构，不引入新依赖）

## 实现方案

### 1. 数据模型：PlatformMeta 新增 fullCheck 字段

`src/features/docAnalysis/types/index.ts`：

- `PlatformMeta` 接口新增 `fullCheck?: boolean`（是否参与完整发布判定，undefined 视为 true）
- `DEFAULT_PLATFORM_META` 11 个平台全部补 `fullCheck: true`（默认全参与，兼容旧数据）

### 2. 判定逻辑：analyzePlatformPublish 按勾选平台计算

`src/features/docAnalysis/utils/docStatsAnalyzer.ts`：

- 从 platformMeta 过滤出参与判定的平台集合 `judged = platformMeta.filter((p) => p.fullCheck !== false)`；`judged.length === 0` 时回退全部 platformMeta（保证旧配置行为不变）
- 位掩码只基于 judged 平台构建：`idToBit`、`allMask = (1 << judged.length) - 1`
- 判定规则：
- `mask === 0` → no（勾选平台一个都没发布），加入 noSet
- `mask === allMask` → full（勾选平台全部发布），加入 fullSet
- 其余 → partial
- `platformCounts` 仍统计全部平台（保持平台过滤栏徽章 `platformUnpublishedCounts` 与人均/覆盖率计算基于全平台的口径）

### 3. 展示：发布状态分区合并平台分布

`src/features/docAnalysis/components/StatsView/index.vue`：

- `cardRowsMap` 中 `section.key === "publish"` 时追加 `platformRows.value`（参考 bookmark 分区合并具体书签值的既有模式）
- 删除独立的「平台分布」StatTable，将其 headerExtra（人均 X 平台 · 覆盖率 Y%）迁移到 publish 分区的 headerExtra
- `handleRowSelect` 对 publish 分区：fullPublish/partialPublish/noPublish 三行走 `selectCategory` 下钻；平台分布行（平台 id 非分类 key）不可下钻（不设 clickable，保持现有平台分布行不可下钻行为）
- `platformRows` 行保留 colorClass/占比展示，仅不设 clickable

### 4. 平台管理弹窗：每行新增开关

`src/features/docAnalysis/components/PlatformManage/index.vue`：

- 每行新增「参与完整发布判定」开关列（图标按钮，参考 visible 切换 `cell-vis` 模式），点击切换 `localPlatforms[idx].fullCheck`（undefined → false → true 循环或显式布尔）
- `addPlatform` 新平台默认 `fullCheck: true`
- `handleSave` 的 clean 映射已 spread 全字段，fullCheck 自动随行持久化
- `toggleFullCheck` 方法 + title 提示文案「参与完整发布判定」

### 5. 样式

`src/features/docAnalysis/styles/PlatformManageModal.scss`：

- 新增开关列样式（复用 `cell-vis` 布局模式与 `row-btn-icon` 按钮样式），使用设计 Token（`$color-*`/`$vp-*`/`$font-size-*`），禁止硬编码
- 开关激活态用 `$color-primary` 高亮

### 6. 文档

`src/features/docAnalysis/README.md`：补充「完整发布判定可配置参与平台」说明

## 实现注意事项

- **下钻一致性**：`useDocStats.queryByStatsCategory` 中 `fullPublish`/`noPublish` 走 ID_SET_MAP（fullPublishDocIds/noPublishDocIds），partial 用全集差集——与新判定口径天然一致，无需改动
- **兼容旧数据**：storage 中旧 PlatformMeta 无 fullCheck 字段 → `undefined !== false` 视为参与，行为不变
- **边界**：勾选平台为空时回退全平台，避免出现「永远无法完整发布」的死局
- **文件头注释**：修改的 .ts/.vue 文件保留/更新功能说明注释
- 不执行 pnpm lint / tsc，由用户自行验证