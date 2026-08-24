<!-- 统计表格区块组件 - 标题 + 三列（名称/数量/占比）表格 + 行点击下钻 -->
<template>
  <div class="stat-table">
    <!-- 表格标题区 -->
    <div class="st-header">
      <Icon
        :icon="icon"
        :size="13"
      />
      <span class="st-title">{{ title }}</span>
      <span class="st-header-spacer" />
      <slot name="headerExtra" />
    </div>
    <table class="st-table">
      <thead>
        <tr>
          <th class="st-th st-th-name">名称</th>
          <th class="st-th st-th-count">数量</th>
          <th class="st-th st-th-pct">占比</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          class="st-row"
          :class="{
            'st-row-clickable': row.clickable,
            'st-row-active': row.id === activeId,
          }"
          @click="handleRowClick(row)"
        >
          <td class="st-td st-td-name">{{ row.label }}</td>
          <td
            class="st-td st-td-count"
            :class="row.colorClass"
          >{{ row.count.toLocaleString() }}</td>
          <td class="st-td st-td-pct">{{ row.pct }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import type { StatTableRow } from "../../types/index"

interface Props {
  title: string
  icon: string
  rows: StatTableRow[]
  /** 高亮行 id（对应 activeFilter） */
  activeId?: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: "select", id: string): void
}>()

/** 仅可点击行触发下钻 */
function handleRowClick(row: StatTableRow) {
  if (row.clickable) emit("select", row.id)
}
</script>

<style lang="scss" scoped>
@use "../../styles/StatTable.scss";
</style>
