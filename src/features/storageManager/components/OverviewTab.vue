<!-- 数据管理 - 总览：汇总卡片 + 按功能分组的槽位列表 -->
<template>
  <div class="sm-overview">
    <SummaryCards :inventory="inventory" :t="t" />

    <!-- 加载中："正在统计……" -->
    <div v-if="loading && !inventory" class="sm-empty">{{ t.loading }}</div>

    <div v-else-if="inventory" class="sm-groups">
      <Panel
        v-for="group in inventory.groups"
        :key="group.owner"
        toggleable
        :header="groupHeader(group)"
      >
        <SlotRow
          v-for="usage in group.slots"
          :key="usage.slotId"
          :usage="usage"
          :slot="getSlot(usage.slotId)"
          :t="t"
          @reset="emit('reset', $event)"
        />
      </Panel>
    </div>

    <!-- 空态："暂无数据" -->
    <div v-else class="sm-empty">{{ t.empty }}</div>
  </div>
</template>

<script setup lang="ts">
import {
  getSlot,
} from "@/config/storage"
import type { StorageGroupUsage, StorageInventory } from "../types/model"
import { formatBytes } from "../utils"
import Panel from "@/components/Panel.vue"
import SlotRow from "./SlotRow.vue"
import SummaryCards from "./SummaryCards.vue"

interface Props {
  inventory: StorageInventory | null
  loading: boolean
  t: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  reset: [slotId: string]
}>()

function groupHeader(group: StorageGroupUsage): string {
  const ownerLabel = group.owner === "core"
    ? (props.t.owners?.core || "core")
    : group.owner
  return `${ownerLabel} · ${formatBytes(group.bytes)}`
}
</script>

<style lang="scss" scoped>
@use "../styles/OverviewTab.scss";
@use "../styles/index.scss";
</style>
