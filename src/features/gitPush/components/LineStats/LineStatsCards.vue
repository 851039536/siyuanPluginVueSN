<!-- gitPush 行数统计顶部汇总卡片（总新增 / 总删除 / 总净增 / 当前总行数） -->
<template>
  <!-- 顶部汇总卡片：共享 Card 承载卡片外观，窄面板下按自适应列宽折行 -->
  <div class="gls-cards">
    <Card
      v-for="card in cards"
      :key="card.key"
      class="gls-card"
      variant="bordered"
      size="small"
      body-no-padding
    >
      <div class="gls-card-inner">
        <div
          class="gls-card-value"
          :class="card.valueClass"
          :title="card.hint"
        >{{ card.value }}</div>
        <div class="gls-card-label">{{ card.label }}</div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计顶部汇总卡片（总新增/总删除/总净增/当前总行数）
import type { LineStatsSummary } from "../../types"
import { computed } from "vue"
import Card from "@/components/Card.vue"
import { netClass as sharedNetClass } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全量行数合计（基于全量项目数据独立累加） */
  summary: LineStatsSummary
}>()

/** 单张汇总卡片的视图描述（模板仅做遍历渲染，卡片间差异集中在数据层） */
interface SummaryCard {
  key: string
  value: string
  label: string
  /** 数值语义色类（新增绿 / 删除红 / 净增正负动态 / 存量中性） */
  valueClass?: string
  /** 悬停提示（存量口径说明；增量卡片不传） */
  hint?: string
}

/** 净增行语义色（薄委托共享 netClass，前缀 gls-net，保持模板调用点零改动） */
function netClass(net: number): string {
  return sharedNetClass(net, "gls-net")
}

/** 四张卡片描述（顺序：新增 / 删除 / 净增 / 当前总行数；增删带符号前缀便于与净增横向对照） */
const cards = computed<SummaryCard[]>(() => {
  const { added, deleted, net, totalLines } = props.summary
  return [
    {
      key: "added",
      value: `+${added.toLocaleString()}`,
      label: props.i18n.lineStatsTotalAdded,
      valueClass: "gls-card-value--add",
    },
    {
      key: "deleted",
      value: `−${deleted.toLocaleString()}`,
      label: props.i18n.lineStatsTotalDeleted,
      valueClass: "gls-card-value--del",
    },
    {
      key: "net",
      value: net.toLocaleString(),
      label: props.i18n.lineStatsTotalNet,
      valueClass: netClass(net),
    },
    {
      key: "totalLines",
      value: totalLines.toLocaleString(),
      label: props.i18n.lineStatsTotalLines,
      valueClass: "gls-card-value--total",
      hint: props.i18n.lineStatsTotalHint,
    },
  ]
})
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
