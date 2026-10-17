<!-- gitPush 行数排行行（排名/名称/可选日期对/占比/可选总行数；clickable 时根为原生 button 可键盘激活） -->
<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="lrr-row"
    :class="rowClasses"
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
    <!-- 日期对（新建 / 最后修改）：项目排行场景才渲染；
         undefined = 不渲染该列（详情弹窗作者/文件明细场景） -->
    <template v-if="firstCommit !== undefined">
      <span
        class="lrr-date"
        :title="firstCommitTitle || i18n.lineStatsCreatedAt"
      >{{ firstCommit || "—" }}</span>
      <span
        class="lrr-date"
        :title="lastCommitTitle || i18n.lineStatsLastUpdated"
      >{{ lastCommit || "—" }}</span>
    </template>
    <!-- 占比列 -->
    <span class="lrr-share">{{ share }}</span>
    <!-- 总行数列（存量口径；undefined = 不渲染该列，null = 旧缓存缺失显示 —） -->
    <span
      v-if="totalLines !== undefined"
      class="lrr-total"
    >{{ totalLines?.toLocaleString() ?? "—" }}</span>
  </component>
</template>

<script setup lang="ts">
// gitPush 行数排行行（项目排行 + 详情弹窗作者/文件明细共用；列模板与表头共用见 styles/LineRankRow.scss）
import { computed } from "vue"

const props = withDefaults(defineProps<{
  /** 排名序号（从 1 开始，由调用方传入） */
  rank: number
  /** 名称（项目名 / 作者名 / 文件路径，完整内容走 title） */
  label: string
  /** 占比文本（占总和的百分比，withLineShare / withLineBarPct 预计算） */
  share: string
  /**
   * 新建日期展示文本（YYYY-MM-DD）。
   * undefined = 不渲染日期列（详情弹窗场景）；空串 = 无数据，渲染 "—"。
   */
  firstCommit?: string
  /** 最后修改展示文本（YYYY-MM-DD）；undefined 含义同 firstCommit */
  lastCommit?: string
  /** 新建日期的 tooltip 原文（完整 ISO 时间；空则回退表头文案） */
  firstCommitTitle?: string
  /** 最后修改的 tooltip 原文（完整 ISO 时间；空则回退表头文案） */
  lastCommitTitle?: string
  /** 总行数（存量口径；undefined = 不渲染该列，null = 旧缓存缺失显示 —） */
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

/** 列变体：日期列存在与否决定 grid 模板（与样式文件中两个模板单点对应） */
const rowClasses = computed(() => ({
  "lrr-row--clickable": props.clickable,
  "lrr-row--no-total": props.totalLines === undefined,
  "lrr-row--no-date": props.firstCommit === undefined,
}))

function onClick() {
  if (props.clickable) emit("select")
}
</script>

<style lang="scss">
@use "../../styles/LineRankRow.scss";
@use "../../styles/index.scss";
</style>
