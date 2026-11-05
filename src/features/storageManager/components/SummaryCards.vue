<!-- 数据管理 - 汇总卡片：JSON / SQLite / 文件 / 浏览器存储 / 敏感槽位 -->
<template>
  <div class="sm-summary">
    <Card
      v-for="card in cards"
      :key="card.key"
      size="small"
      :title="card.label"
    >
      <span class="sm-summary__value">{{ card.value }}</span>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Card from "@/components/Card.vue"
import type { StorageInventory } from "../types/model"
import { formatBytes } from "../utils"

interface Props {
  inventory: StorageInventory | null
  t: Record<string, any>
}

const props = defineProps<Props>()

const cards = computed(() => {
  const totals = props.inventory?.totals
  return [
    { key: "json", label: props.t.summary?.json, value: formatBytes(totals?.json ?? 0) },
    { key: "sqlite", label: props.t.summary?.sqlite, value: formatBytes(totals?.sqlite ?? 0) },
    { key: "file", label: props.t.summary?.file, value: formatBytes(totals?.file ?? 0) },
    { key: "local", label: props.t.summary?.localStorage, value: formatBytes(totals?.localStorage ?? 0) },
    { key: "sensitive", label: props.t.summary?.sensitive, value: String(totals?.sensitiveCount ?? 0) },
  ]
})
</script>

<style lang="scss" scoped>
@use "../styles/SummaryCards.scss";
@use "../styles/index.scss";
</style>
