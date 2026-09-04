# StatsView 冗余审查与优化方案

## 一、摘要

对 `src/features/gitPush/components/StatsView/` 全部 7 个组件及关联的 `types/meta.ts`、`utils.ts`、`composables/useGitStats.ts`、`composables/useRepoLinkAudit.ts`、`styles/StatsPanel.scss`、`styles/RepoLinkAuditSection.scss`、`styles/index.scss`、`styles/_mixins.scss` 完成审查。

审查结论分两类:

1. **无争议小清理**(5 项):相同 SCSS 选择器合并、模板中 `ratioPct` 重复计算、多余类型断言、硬编码 RGB 回退色、同文件内审计状态配置双份。
2. **结构性重复**(经用户确认采取"积极提取"):平台表格骨架在两区块间重复(第 2 次出现,突破 Rule of Three)、状态 chips 条重复、all-clear 空态重复、section 包裹器出现 5 次(已超 Rule of Three 阈值)、与 CodeReport 的 `.gpr-section-title` 样式逐字重复。

涉及面:**新增 4 个共享组件 + 1 组视图模型类型 + 1 组 SCSS mixin**,修改 5 个区块组件 + 3 个样式文件 + README;**不新增 i18n 键、不新增图标、不改数据流(useGitStats / useRepoLinkAudit 均不动)**。

## 二、现状分析(审查发现清单)

### A. 无争议冗余

| # | 问题 | 位置 |
|---|------|------|
| A1 | `.gp-badge-behind` 与 `.gp-badge-unstaged` 样式完全相同(`@extend .gp-badge-ahead` + 警告色底/字),重复声明 | `styles/StatsPanel.scss:293-304` |
| A2 | `ratioPct(c.count, stats.projectCount)` 在模板中每条目调用 2 次(`:title` 与 `:style width` 各一次),`stats.projectCount` 重复引用 3 次 | `CoverageSection.vue:14,22,28`、`CategoryDistributionSection.vue:17,25,30` |
| A3 | 多余的 `as string` 类型拓宽断言(`pm.key as string`、`pm.label as string`、`i18n.multipleRemotes as string`) | `CoverageSection.vue:53,55,59` |
| A4 | 硬编码 RGB 回退值 `var(--b3-theme-warning, #f5a623)`(违反"使用主题变量、禁硬编码 RGB 回退"规则) | `styles/StatsPanel.scss:52`;同款问题 `styles/CardHeader.scss:216`(范围外顺带修) |
| A5 | `AUDIT_CHIPS` 与 `STATE_META` 两份配置映射同一组四态(linkOnly/remoteOnly 图标完全相同,match/mismatch 仅 outline 变体不同,labelKey 完全相同) | `RepoLinkAuditSection.vue:161-174` |

### B. 结构性重复

| # | 问题 | 位置 |
|---|------|------|
| B1 | 平台矩阵表格骨架(表头 13 行 + 可点击行骨架 15 行)在两个区块逐字重复,仅单元格内容渲染不同;两处注释均已标注"第 2 次出现,暂不提取" | `PlatformStatusSection.vue:14-61` vs `RepoLinkAuditSection.vue:63-120` |
| B2 | 状态 chips 条(`gp-status-bar` + v-for chip 循环 ~12 行)重复,仅配置数组与取值字段不同 | `PendingProjectsSection.vue:10-24` vs `RepoLinkAuditSection.vue:43-57` |
| B3 | all-clear 空态(勾选图标 + 文案,5 行)重复,仅文案键不同 | `PendingProjectsSection.vue:101-110` vs `RepoLinkAuditSection.vue:123-132` |
| B4 | section 包裹器(`gp-stats-section` + 标题 + 计数徽章)在 5 个区块重复(已超 Rule of Three 阈值 3) | 全部 5 个 Section 组件 |
| B5 | `.gp-stats-section-title/-count` 与 `.gpr-section-title/-count` 逐字重复(两处注释互相引用,标注第 2 次出现) | `StatsPanel.scss:70-94` vs `index.scss:865-888` |

### C. 审查后不改动的项(记录为有意保留)

| 项 | 理由 |
|----|------|
| PendingProjects 表格不并入共享表格组件 | 列结构不同(数值列 vs 平台矩阵列),仅共享 CSS 类 |
| CoverageSection / CategoryDistributionSection 条形列表结构相似 | 前导元素(图标 vs 色点)与着色源(修饰类 vs 内联 category.color)不同,合并需引入多态配置,收益低 |
| 双行 SCSS 导入导致 CSS 产物按组件重复 | 项目全局约定(LogPanel/CommitAnalysis 等同模式),仅改 StatsView 会造成不一致 |
| 平台品牌色硬编码(#ee3f4d Gitee / #609926 Gitea / #00a8e8 CNB / #8b5cf6 multi) | 品牌识别色,主题变量无法表达,全项目仅此一处使用 |
| OverviewCards.vue、StatsView/index.vue | 无冗余(配置驱动 + 纯编排),不动 |

## 三、改动方案

### 3.1 类型层:`types/meta.ts` 新增平台表格视图模型

在 `RepoLinkAuditSummary` 定义之后、`StatsView` 接口之前插入(供 PlatformTable / PlatformStatusSection / RepoLinkAuditSection 三方共用,满足"被 2 个以上文件使用必须入 types/"规则):

```ts
// ── 统计视图平台矩阵表格视图模型(PlatformTable / PlatformStatusSection / RepoLinkAuditSection 共用)──
/** 平台单元格视图(icon 为空串时渲染占位符 -) */
export interface PlatformTableCellView {
  key: string
  /** hover 提示原文(状态名 + 审计链接/远程 URL 等) */
  title: string
  /** 图标名(空串 = 渲染占位符 -) */
  icon: string
  /** 图标颜色修饰类(如 gp-platform-ok / gp-audit-mismatch) */
  iconCls?: string
}

/** 平台矩阵表格行视图(项目名 + 平台单元格序列) */
export interface PlatformTableRowView {
  id: string
  name: string
  path: string
  /** 名称后缀标注(审计错误标注;空串不渲染) */
  nameSuffix?: string
  cells: PlatformTableCellView[]
}
```

> 不改动既有类型,`types/index.ts` 已统一 re-export `meta.ts`,无需触碰。

### 3.2 新增共享组件(4 个,均放 `components/StatsView/common/`)

#### ① StatsSection.vue — 区块包裹器(消除 B4,5 处)

```vue
<!-- gitPush 统计视图区块通用包裹器(标题 + 计数徽章 + 操作插槽,消除 5 处重复) -->
<template>
  <div class="gp-stats-section">
    <div class="gp-stats-section-title">
      <!-- 区块标题文案由父组件 i18n 传入 -->
      {{ title }}
      <span v-if="count !== undefined" class="gp-stats-section-count">{{ count }}</span>
      <slot name="action" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
// 统计区块包裹器:统一 section 标题/计数结构,内容与标题右侧操作经插槽分发
defineProps<{
  /** 区块标题文案(已渲染的 i18n 文本) */
  title: string
  /** 标题右侧计数徽章(undefined 时不显示;0 为合法值需显示) */
  count?: number
}>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
```

#### ② StatusChipBar.vue — 状态 chips 条(消除 B2)

```vue
<!-- gitPush 统计视图状态 chips 条(图标 + 数值,配置驱动渲染) -->
<template>
  <div class="gp-status-bar">
    <!-- 状态 chip:hover 提示状态名(配置驱动) -->
    <div
      v-for="chip in chips"
      :key="chip.key"
      class="gp-status-chip"
      :class="`gp-status-chip--${chip.cls}`"
      :title="i18n[chip.labelKey]"
    >
      <Icon :icon="chip.icon" height="12" />
      <span>{{ chip.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 状态 chips 条:chips 配置(key 唯一 / icon 图标 / cls 修饰类后缀 / labelKey hover 提示键 / value 数值由调用方 computed 预取)
import { Icon } from "@iconify/vue"

defineProps<{
  i18n: Record<string, any>
  /** chip 配置数组(cls 对应 gp-status-chip--* 修饰类) */
  chips: { key: string, icon: string, cls: string, labelKey: string, value: number }[]
}>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
```

> 设计要点:`value` 由调用方 computed 预取后传入(而非传 `values: Record<string, number>`),规避 `PushStatusStats`/`RepoLinkAuditSummary` 接口无索引签名、不能赋给 `Record<string, number>` 的 TS 限制。

#### ③ PlatformTable.vue — 平台矩阵表格(消除 B1)

```vue
<!-- gitPush 统计视图平台矩阵表格(表头 + 可点击行骨架,单元格视图模型驱动) -->
<template>
  <div class="gp-table-wrap">
    <!-- 表头:"项目名称" + 四平台图标列 + 操作列 -->
    <div class="gp-table-row gp-table-row--head">
      <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName }}</span>
      <span
        v-for="pm in PLATFORM_META"
        :key="pm.key"
        class="gp-table-cell gp-table-cell--platform-status"
        :title="pm.label"
      >
        <Icon :icon="pm.icon" height="12" />
      </span>
      <span class="gp-table-cell gp-table-cell--act"></span>
    </div>
    <!-- 数据行:点击跳转项目详情;平台单元格由视图模型驱动(icon 空串渲染占位符 -) -->
    <div
      v-for="row in rows"
      :key="row.id"
      class="gp-table-row gp-table-row--clickable"
      @click="emit('viewProject', row.id)"
    >
      <span class="gp-table-cell gp-table-cell--name" :title="row.path">
        {{ row.name }}
        <span v-if="row.nameSuffix" class="gp-audit-error-text">{{ row.nameSuffix }}</span>
      </span>
      <span
        v-for="cell in row.cells"
        :key="cell.key"
        class="gp-table-cell gp-table-cell--platform-status"
        :title="cell.title"
      >
        <Icon v-if="cell.icon" :icon="cell.icon" height="12" :class="cell.iconCls" />
        <span v-else class="gp-cell-empty">-</span>
      </span>
      <span class="gp-table-cell gp-table-cell--act">
        <Icon icon="mdi:arrow-right" height="12" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 平台矩阵表格:表头 + 行骨架固定,单元格内容经视图模型(图标/悬停提示)注入
import type { PlatformTableRowView } from "../../types"
import { Icon } from "@iconify/vue"
import { PLATFORM_META } from "../../types"

defineProps<{
  i18n: Record<string, any>
  /** 行视图模型(已含单元格图标与 tooltip 原文) */
  rows: PlatformTableRowView[]
}>()

const emit = defineEmits<{ viewProject: [projectId: string] }>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
```

#### ④ AllClear.vue — "全部正常"空态(消除 B3)

```vue
<!-- gitPush 统计视图"全部正常"空态(勾选图标 + 文案) -->
<template>
  <div class="gp-status-all-clear">
    <Icon icon="mdi:check-all" height="12" />
    <!-- 空态文案由父组件 i18n 传入 -->
    <span>{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
// "全部正常"空态(图标 + 文案,消除两处重复)
import { Icon } from "@iconify/vue"

defineProps<{
  /** 空态文案(已渲染的 i18n 文本) */
  text: string
}>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
```

### 3.3 区块组件改造(5 个)

#### ① CoverageSection.vue(A2 + A3)

- `coverageItems` computed 中预计算 `pct: ratioPct(count, total)`(顶部先取 `const total = props.stats.projectCount`),同时**删除全部 `as string` 断言**(数组字面量联合类型推断天然成立):
```ts
const coverageItems = computed(() => {
  const total = props.stats.projectCount
  return [
    ...PLATFORM_META.map((pm) => ({
      key: pm.key,
      icon: pm.icon,
      label: pm.label,
      count: props.stats.remoteCoverage[pm.key],
      pct: ratioPct(props.stats.remoteCoverage[pm.key], total),
    })),
    // 多远程项目条目:"多远程项目"
    {
      key: "multi",
      icon: "mdi:layers",
      label: props.i18n.multipleRemotes,
      count: props.stats.remoteCoverage.multiple,
      pct: ratioPct(props.stats.remoteCoverage.multiple, total),
    },
  ]
})
```
- 模板:`:title="c.pct"`、`:style="{ width: c.pct }"`;外层换 `<StatsSection :title="i18n.remoteCoverage">`(区块标题中文注释保留在 StatsSection 标签上方)。

#### ② CategoryDistributionSection.vue(A2)

- 新增 computed(原来无 computed,`defineProps` 改为 `const props = defineProps`):
```ts
/** 分类分布行视图:预计算条形宽度百分比,消除模板中每条目 2 次 ratioPct 调用 */
const categoryRows = computed(() => {
  const total = props.stats.projectCount
  return props.stats.categoryDistribution.map((c) => ({ ...c, pct: ratioPct(c.count, total) }))
})
```
- 模板 `v-for="c in categoryRows"`,`:title="c.pct"`、`:style="{ width: c.pct, background: c.color }"`;外层 `<StatsSection v-if="stats.categoryDistribution.length > 0" :title="i18n.categoryDistribution">`。

#### ③ PendingProjectsSection.vue(B2 + B3 + B4)

- 外层换 `<StatsSection :title="i18n.pendingProjects" :count="stats.pendingProjects.length">`。
- 推送状态概览 chips 换 `<StatusChipBar :i18n="i18n" :chips="statusChips" />`,配置改名 `field` → `key` 并新增 value computed:
```ts
// 推送状态 chip 配置:待推送/待拉取/已同步/无远程(labelKey 复用现有 i18n 键作 hover 提示)
const STATUS_CHIPS = [
  { key: "ahead", icon: "mdi:cloud-upload-outline", cls: "ahead", labelKey: "needsPush" },
  { key: "behind", icon: "mdi:cloud-download-outline", cls: "behind", labelKey: "needsPullShort" },
  { key: "synced", icon: "mdi:check-circle-outline", cls: "synced", labelKey: "synced" },
  { key: "noRemote", icon: "mdi:lan-disconnect", cls: "none", labelKey: "noRemoteLabel" },
] as const

/** chip 数值:取推送状态统计 */
const statusChips = computed(() => STATUS_CHIPS.map((c) => ({ ...c, value: props.stats.pushStatusStats[c.key] })))
```
(`defineProps` 改为 `const props = defineProps`;表格部分**保持原样**——列结构不同不并入 PlatformTable。)
- 底部空态换 `<AllClear :text="i18n.allClear" />`。

#### ④ PlatformStatusSection.vue(B1 + B4)

- `platformRows` computed 改产 `PlatformTableRowView[]`(图标与 tooltip 预计算进视图模型,保留 `getPlatformStatus` 类型安全取值):
```ts
// 平台状态行视图模型:预计算每格图标与提示,避免模板中每行 12 次 getPlatformStatus 调用
const platformRows = computed<PlatformTableRowView[]>(() =>
  props.stats.platformStatusProjects.map((item) => ({
    id: item.project.id,
    name: item.project.name,
    path: item.project.path,
    cells: PLATFORM_META.map((pm) => {
      const ok = getPlatformStatus(item, pm.key)
      return {
        key: pm.key,
        title: ok ? props.i18n.configured : props.i18n.notConfigured,
        icon: ok ? "mdi:check-circle" : "mdi:close-circle-outline",
        iconCls: ok ? "gp-platform-ok" : "gp-platform-missing",
      }
    }),
  })),
)
```
- 模板正文替换为:
```vue
<StatsSection
  v-if="stats.platformStatusProjects.length > 0"
  :title="i18n.platformStatus"
  :count="stats.platformStatusProjects.length"
>
  <!-- 平台矩阵表格(表头与行骨架由共享组件渲染) -->
  <PlatformTable
    :i18n="i18n"
    :rows="platformRows"
    @view-project="emit('viewProject', $event)"
  />
</StatsSection>
```

#### ⑤ RepoLinkAuditSection.vue(A5 + B1 + B2 + B3 + B4)

- **合并两份配置为单一四态元数据**(消除 A5):
```ts
// 审计四态元数据:chip 轮廓图标 + 单元格实心图标 + chip 修饰类 + 单元格颜色类 + 状态名 i18n 键
// (合并原 AUDIT_CHIPS / STATE_META 两份配置,linkOnly/remoteOnly 图标本就相同)
const AUDIT_STATE_META = {
  match:      { chipIcon: "mdi:check-circle-outline", cellIcon: "mdi:check-circle",    chipCls: "synced", cellCls: "gp-audit-match",     labelKey: "auditMatch" },
  mismatch:   { chipIcon: "mdi:alert-circle-outline",  cellIcon: "mdi:alert-circle",    chipCls: "error",  cellCls: "gp-audit-mismatch",  labelKey: "auditMismatch" },
  linkOnly:   { chipIcon: "mdi:link-variant-off",      cellIcon: "mdi:link-variant-off", chipCls: "behind", cellCls: "gp-audit-linkonly",  labelKey: "auditLinkOnly" },
  remoteOnly: { chipIcon: "mdi:source-branch",         cellIcon: "mdi:source-branch",   chipCls: "ahead",  cellCls: "gp-audit-remoteonly", labelKey: "auditRemoteOnly" },
} as const
```
- 新增两个 computed + 调整 `cellTitle`:
```ts
/** 四态汇总 chips(数值取 summary) */
const auditChips = computed(() =>
  (Object.keys(AUDIT_STATE_META) as (keyof typeof AUDIT_STATE_META)[]).map((state) => ({
    key: state,
    icon: AUDIT_STATE_META[state].chipIcon,
    cls: AUDIT_STATE_META[state].chipCls,
    labelKey: AUDIT_STATE_META[state].labelKey,
    value: props.summary[state],
  })),
)

/** 仅展示存在问题的项目行(视图模型:单元格图标 + tooltip 原文) */
const issueRows = computed<PlatformTableRowView[]>(() =>
  props.rows.filter((r) => r.hasIssue).map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    nameSuffix: r.error ? props.i18n.auditError : "",
    cells: r.cells.map((c) => {
      if (c.state === "none") { return { key: c.key, title: "", icon: "" } }
      const m = AUDIT_STATE_META[c.state]
      return { key: c.key, title: cellTitle(c), icon: m.cellIcon, iconCls: m.cellCls }
    }),
  })),
)

/** 单元格 tooltip:状态名 + 链接与远程 URL 原文(便于排错) */
function cellTitle(cell: RepoLinkAuditCell): string {
  const label = props.i18n[AUDIT_STATE_META[cell.state].labelKey]
  return `${label}\n${props.i18n.auditLinkPrefix}: ${cell.link || "-"}\n${props.i18n.auditRemotePrefix}: ${cell.remoteUrl || "-"}`
}
```
(原 `cellTitle` 的 `state === "none"` 早退分支移入 issueRows 映射,函数内可断言非 none。)
- 模板结构:
```vue
<StatsSection :title="i18n.repoLinkAudit" :count="audited ? issueRows.length : undefined">
  <template #action>
    <!-- 按钮:"开始分析"/"重新分析"(分析中转圈禁用) -->
    <button class="vp-btn vp-btn--ghost vp-btn--sm gp-audit-run-btn" :disabled="auditing" @click="emit('runAudit')">
      <Icon :icon="auditing ? 'mdi:loading' : 'mdi:magnify-scan'" height="12" :class="{ 'gp-spin': auditing }" />
      <span>{{ audited ? i18n.auditRerun : i18n.auditRun }}</span>
    </button>
  </template>

  <!-- 未分析提示:"点击开始分析,将对所有项目执行 git remote -v 比对" -->
  <div v-if="!audited && !auditing" class="gp-audit-hint">{{ i18n.auditHint }}</div>
  <!-- 首轮分析中占位:"分析中…" -->
  <div v-else-if="!audited" class="gp-audit-hint">{{ i18n.auditing }}</div>

  <template v-else>
    <!-- 四态汇总 chips:一致/不一致/仅配置链接/仅存在远程 -->
    <StatusChipBar :i18n="i18n" :chips="auditChips" />
    <!-- 问题项目表格(仅展示存在不一致/缺失/检测失败的项目) -->
    <PlatformTable
      v-if="issueRows.length > 0"
      :i18n="i18n"
      :rows="issueRows"
      @view-project="emit('viewProject', $event)"
    />
    <!-- 全部一致空态:"链接与远程全部一致" -->
    <AllClear v-else :text="i18n.auditAllMatch" />
  </template>
</StatsSection>
```
- 删除原 `AUDIT_CHIPS`、`STATE_META` 两份配置。

### 3.4 样式层

#### ① `_mixins.scss` 新增两个共享 mixin(消除 B5)

```scss
// ── 统计/报告区块标题与计数徽章(StatsPanel .gp-stats-section-* 与 index.scss .gpr-section-* 共用,原两处逐字重复经审查合并)──
@mixin gp-section-title-base {
  @include gp-label-base;
  font-size: $font-size-xs;
  margin-bottom: $spacing-2;
  display: flex;
  align-items: center;
  gap: $spacing-1;
}

@mixin gp-section-count-base {
  font-size: $font-size-2xs;
  font-family: $vp-mono;
  padding: 0 6px;
  border-radius: $radius-sm;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  font-weight: $font-weight-semibold;
  letter-spacing: 0;
}
```
(`gp-label-base` 已在同文件,嵌套 include 成立;`_mixins.scss` 已引入 variables。)

#### ② `StatsPanel.scss`

1. **合并相同选择器(A1)**:
```scss
// 待拉取/未暂存徽章:与状态 chip --behind 同色系(警告色),两者样式相同合并声明
.gp-badge-behind,
.gp-badge-unstaged {
  @extend .gp-badge-ahead;
  background: var(--b3-theme-warning-lightest);
  color: var(--b3-theme-warning);
}
```
2. **删除硬编码回退(A4)**:`.gp-stat-card--star .gp-stat-card-value { color: var(--b3-theme-warning); }`
3. **标题/计数改用 mixin(B5)**,并更新过时注释(原"与 .gpr-section-title 逐字重复,第 2 次出现"注释改为指向共享 mixin):
```scss
// 标题/计数样式与 index.scss 的 .gpr-section-* 共用 _mixins.scss 的 gp-section-title-base / gp-section-count-base
.gp-stats-section-title {
  @include gp-section-title-base;
}

.gp-stats-section-count {
  @include gp-section-count-base;
}
```
4. **新增 `.gp-audit-error-text`**(自 `RepoLinkAuditSection.scss` 迁入——该类改由共享组件 PlatformTable 渲染):
```scss
// 项目名后的错误标注(路径无效/检测失败;PlatformTable 的 nameSuffix 共享渲染)
.gp-audit-error-text {
  margin-left: $spacing-1;
  font-size: $font-size-2xs;
  color: var(--b3-theme-error);
  opacity: 0.8;
}
```

#### ③ `index.scss`

`.gpr-section-title` / `.gpr-section-count` 改为 `@include gp-section-title-base` / `@include gp-section-count-base`(正文逐字删除,注释同步指向共享 mixin);`.gpr-section` 保持原样。该文件头部已有 `@use "./mixins" as *;` 无需新增导入。

#### ④ `RepoLinkAuditSection.scss`

删除 `.gp-audit-error-text` 规则(已迁至 StatsPanel.scss),其余保留(run-btn/hint/chip--error/四态图标色)。

#### ⑤ `CardHeader.scss`(范围外顺带修,同 A4 规则)

第 216 行 `color: var(--b3-theme-warning, #f5a623);` → `color: var(--b3-theme-warning);`

### 3.5 文档同步

`src/features/gitPush/README.md` 第 95-96 行目录树:`StatsView/` 条目由"统计视图专属(7 个)"更新为"统计视图专属(5 个区块 + common/ 共享组件)",并在子项中补 `common/`(StatsSection/StatusChipBar/PlatformTable/AllClear)说明。

## 四、假设与决策

| 决策点 | 结论 | 依据 |
|--------|------|------|
| 结构性重复提取 | 突破 Rule of Three 提取表格骨架与 chips | 用户明确选择"小清理+积极提取" |
| StatusChipBar 数值传递 | 调用方 computed 预取 `value` 传入,不传 values Record | 规避接口无索引签名不能赋 `Record<string, number>` 的 TS 限制 |
| StatsSection 计数语义 | `count?: number`,`undefined` 不渲染、`0` 渲染 | 对齐原 RepoLinkAuditSection `v-if="audited"` 计数行为 |
| `.gp-audit-error-text` 归属 | 从 RepoLinkAuditSection.scss 迁至 StatsPanel.scss | 改由共享 PlatformTable 渲染,随 StatsView 面板样式维护 |
| 新组件样式导入 | 双行导入 StatsPanel.scss + index.scss | 遵循 SCSS 分离约定,组件自包含 |
| 事件命名 | `viewProject` camelCase 保持 | 现状与硬规则一致 |
| i18n / 图标 | 零新增 | 所有文案键与图标均已存在,无新键无新图标 |
| 数据层 | useGitStats / useRepoLinkAudit / StatsView 类型不动 | 冗余全部位于展示层 |

## 五、验证步骤

1. `npx vue-tsc --noEmit` — 类型检查(重点:`as const` 配置 → props 的可赋值性已按预取 value 方案规避)
2. `pnpm i18n:verify` — 无 i18n 改动,应直接通过
3. `pnpm validate:icons` — 无新图标,应直接通过
4. 用户执行 `pnpm lint`(AI 不运行)
5. 用户在思源中人工回归,核对与重构前行为一致:
   - 统计视图:总览卡片 6 张、覆盖率条形(含 hover 百分比)、分类分布条形、待处理表格(chips + 行点击跳转)、平台配置状态表格
   - 仓库链接一致性:未分析提示 → 分析中 → chips + 问题表格 / 全部一致空态;单元格 hover 四态 tooltip(状态名 + 链接/远程原文);审计错误行标注仍显示
   - 行数/代码报告视图(CodeReport):`.gpr-section-*` 标题/计数渲染正常(mixin 迁移回归)

## 六、实施顺序

1. `types/meta.ts` 新增视图模型接口
2. `_mixins.scss` 新增 mixin → `StatsPanel.scss`(mixin 化 + 合并徽章 + 删回退 + 迁入 error-text)→ `index.scss`(mixin 化)→ `RepoLinkAuditSection.scss`(删迁移规则)→ `CardHeader.scss`(删回退)
3. 新建 `common/` 4 个共享组件(StatsSection → StatusChipBar → AllClear → PlatformTable)
4. 改造 5 个区块组件(Coverage → CategoryDistribution → PendingProjects → PlatformStatus → RepoLinkAudit)
5. README 目录树同步
6. 执行验证步骤 1-3,提示用户完成 4-5
