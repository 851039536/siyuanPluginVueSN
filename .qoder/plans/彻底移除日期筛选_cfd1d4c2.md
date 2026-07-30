# 彻底移除 docAnalysis 日期筛选

## 摘要
用户已确认范围为"彻底移除日期筛选"：删除 DateInput 组件本体，同时移除筛选栏的起始/截止日期输入、`updatedAfter`/`updatedBefore` 字段链路，以及完全依赖这两个字段的 `customTime`（自定义时间）统计卡片。

## 删除文件
- `src/features/docAnalysis/components/DateInput.vue`
- `src/features/docAnalysis/styles/DateInput.scss`

## FilterSettings 清理
- `components/FilterSettings.vue`：
  - 删除 `<div class="filter-group date-group">` 整块（L92-106，含两个 DateInput 与中间的 `~` 分隔符）
  - 删除 `import DateInput from "./DateInput.vue"`（L119）
  - `Icon` 导入与 `.filter-separator`（L57 字数区间仍在用）保留
- `styles/FilterSettings.scss`：删除 `.date-group`（L61-63）与 `.date-picker`（L65-68）规则；`.filter-separator` 保留

## types/index.ts 清理
- `FilterOptions` 接口：删除 `updatedAfter` / `updatedBefore` 两字段（L76-79）
- `DEFAULT_FILTER_OPTIONS`：删除对应两项默认值（L236-237）
- `CATEGORY_LABELS`：删除 `"customTime": "自定义时间"`（L315）
- `STAT_SECTIONS` time 分区：删除 customTime 卡片条目（L398）
- `StatCardDef`：删除 `iconValue?: string` 字段（L364-365，customTime 是唯一使用者）

## 统计卡片组件清理（iconValue 唯一消费链）
- `components/StatsOverview.vue`：删除 `:icon-only="card.iconValue"`（L167）
- `components/StatCard.vue`：删除 `iconOnly` prop、模板中 `v-if="!iconOnly"` / `v-else` 图标分支（统一为数值 + 标签 + 百分比条），并移除因此不再使用的 `Icon` 导入

## useDocAnalysis.ts 清理
- 删除 `toDateDigits()` 函数（L143-147，仅两处消费均被移除）
- `queryByStatsCategory()`：删除 `customTime` 分支整块（L490-499 的"自定义时间"段）
- `queryDocs()`：删除 `afterDigits` / `beforeDigits` 计算与两行日期拼接（L556-559）

## 兼容性说明
- 已持久化的旧配置中残留的 `updatedAfter`/`updatedBefore` 键会经 `Object.assign(filterOptions, ...)` 混入，但无任何读取方，无害，不做迁移处理
- `src/features/statistics/` 下的 `changed-date-picker` 属另一功能模块，不在本次范围

## 验证
- 由用户自行执行：`npx tsc --noEmit`、`pnpm lint`
- 功能自测点：筛选栏不再出现日期输入；统计面板"更新时间"分区不再有"自定义"卡片；其余筛选与分类查询行为不变
