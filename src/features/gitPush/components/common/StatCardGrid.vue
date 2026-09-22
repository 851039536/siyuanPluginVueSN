<!-- gitPush 通用 KPI 卡片网格（配置驱动：数值 + 标签 + 语义色类；四个分析类视图总览共用） -->
<template>
  <div
    class="gp-statgrid"
    :style="{ '--gp-statgrid-min': `${minWidth}px` }"
  >
    <div
      v-for="(card, i) in cards"
      :key="card.key ?? i"
      class="gp-statgrid-card"
      :class="card.cls"
    >
      <div
        class="gp-statgrid-value"
        :class="[card.valueCls, { 'gp-statgrid-value--truncate': card.truncate }]"
        :title="card.hint"
      >{{ card.value }}</div>
      <div class="gp-statgrid-label">{{ card.label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 通用 KPI 卡片网格：收敛统计/提交分析/规则检查/行数统计/报告五处同构卡片
// （原 .gp-stats-cards / .gpa-cards / .grc-cards / .gls-cards / .gpr-cards 五份重复模板与 SCSS）
export interface StatCardItem {
  /** 稳定 key（缺省按下标，仅无重复项时可省） */
  key?: string
  /** 卡片数值（已格式化的字符串，调用方负责符号/千分位） */
  value: string | number
  /** 卡片标签（已渲染的 i18n 文本） */
  label: string
  /** 卡片语义色修饰类（作用于数值，如 gp-statgrid-card--warn） */
  cls?: string
  /** 数值附加类（行数统计的增删净着色） */
  valueCls?: string
  /** 悬停提示（口径说明；不传则无 tooltip） */
  hint?: string
  /** 数值是否为长文本（如「最活跃贡献者」人名）：true 时单行省略，避免撑破卡片 */
  truncate?: boolean
}

withDefaults(defineProps<{
  /** 卡片描述列表（模板仅遍历渲染，卡片差异集中在数据层） */
  cards: StatCardItem[]
  /** 单卡最小宽度（px 数值）：各视图列数诉求不同，由调用方按容器宽度给定 */
  minWidth?: number
}>(), {
  minWidth: 110,
})
</script>

<style lang="scss">
@use "../../styles/StatCardGrid.scss";
@use "../../styles/index.scss";
</style>
