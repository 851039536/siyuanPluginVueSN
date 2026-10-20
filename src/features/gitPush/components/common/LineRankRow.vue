<!-- gitPush 行数排行行（排名/名称/新建日期/最后修改/占比/总行数；clickable 时根为原生 button 可键盘激活） -->
<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="lrr-row"
    :class="{ 'lrr-row--clickable': clickable }"
    :title="clickable ? i18n.lineDetailClickHint : undefined"
    @click="onClick"
  >
    <!-- 排名序号 -->
    <span class="lrr-rank">{{ rank }}</span>
    <!-- 名称：完整内容走行内 title -->
    <span
      class="lrr-label"
      :title="label"
    >{{ label }}</span>
    <!-- 新建日期（仓库首次提交时间；空串 = 无数据，渲染 "—"） -->
    <span
      class="lrr-date"
      :title="firstCommitTitle || i18n.lineStatsCreatedAt"
    >{{ firstCommit || "—" }}</span>
    <!-- 最后修改（最后一次提交时间；空串 = 无数据，渲染 "—"） -->
    <span
      class="lrr-date"
      :title="lastCommitTitle || i18n.lineStatsLastUpdated"
    >{{ lastCommit || "—" }}</span>
    <!-- 占比列（占总行数百分比） -->
    <span class="lrr-share">{{ share }}</span>
    <!-- 总行数列（存量口径；null = 旧缓存缺失显示 —） -->
    <span class="lrr-total">{{ totalLines?.toLocaleString() ?? "—" }}</span>
  </component>
</template>

<script setup lang="ts">
// gitPush 行数排行行（项目代码行数排行专用；列模板与表头共用见 styles/LineRankRow.scss）
//
// 注：原实现把「日期对 / 总行数」设为可选 prop 并配了 4 套 grid 模板变体
// （--no-date / --no-total 等），供「详情弹窗作者/文件明细」场景复用。
// 那些场景随行数统计改为存量口径后已移除（详情弹窗改用独立表格组件），
// 故可选性成为死代码 —— 单一模板、恒定列集，避免列错位。

const props = withDefaults(defineProps<{
  /** 排名序号（从 1 开始，由调用方传入） */
  rank: number
  /** 名称（项目名，完整内容走 title） */
  label: string
  /** 占比文本（占总行数百分比，withLineShare 预计算） */
  share: string
  /** 新建日期展示文本（YYYY-MM-DD；空串 = 无数据，渲染 "—"） */
  firstCommit: string
  /** 最后修改展示文本（YYYY-MM-DD；空串 = 无数据，渲染 "—"） */
  lastCommit: string
  /** 新建日期的 tooltip 原文（完整 ISO 时间；空则回退表头文案） */
  firstCommitTitle?: string
  /** 最后修改的 tooltip 原文（完整 ISO 时间；空则回退表头文案） */
  lastCommitTitle?: string
  /** 总行数（存量口径；null = 旧缓存缺失显示 —） */
  totalLines?: number | null
  /** 可点击（根元素渲染原生 button，Tab 聚焦 + Enter/Space 激活并 emit select） */
  clickable?: boolean
  /** i18n 文案表（仅用于列 tooltip，零 i18n 分片改动） */
  i18n: Record<string, any>
}>(), {
  clickable: false,
})

const emit = defineEmits<{
  select: []
}>()

function onClick() {
  if (props.clickable) emit("select")
}
</script>

<style lang="scss">
@use "../../styles/LineRankRow.scss";
@use "../../styles/index.scss";
</style>
