<!-- gitPush 统计视图平台矩阵表格（项目名 + 四平台状态列 + 操作列，单元格视图模型驱动） -->
<template>
  <!-- 骨架走共享 StatsTable（表头/可点击行/项目名/操作箭头），本组件只提供四个平台列 -->
  <StatsTable
    :i18n="i18n"
    :rows="rows"
    @view-project="emit('viewProject', $event)"
  >
    <template #head>
      <!-- 表头："项目名称" + 四平台图标列 + 操作列 -->
      <span
        v-for="pm in PLATFORM_META"
        :key="pm.key"
        class="gps-table-cell gps-table-cell--platform-status"
        :title="pm.label"
      >
        <Icon
          :icon="pm.icon"
          height="12"
        />
      </span>
    </template>

    <template #row="{ row }">
      <!-- 单元格：四平台状态图标（icon 为空渲染占位符 -） -->
      <span
        v-for="cell in row.cells"
        :key="cell.key"
        class="gps-table-cell gps-table-cell--platform-status"
        :title="cell.title"
      >
        <Icon
          v-if="cell.icon"
          :icon="cell.icon"
          height="12"
          :class="cell.iconCls"
        />
        <span
          v-else
          class="gps-cell-empty"
        >-</span>
      </span>
    </template>
  </StatsTable>
</template>

<script setup lang="ts">
// 平台矩阵表格：表头 + 行骨架已收敛至共享 StatsTable，本组件只注入四个平台状态列
// （单元格图标与 tooltip 经视图模型预计算，由 PlatformSection 消费）。
import type { PlatformTableRowView } from "../../../types"
import { Icon } from "@iconify/vue"
import { PLATFORM_META } from "../../../types"
import StatsTable from "./StatsTable.vue"

defineProps<{
  i18n: Record<string, any>
  /** 行视图模型（单元格图标与 tooltip 已预计算） */
  rows: PlatformTableRowView[]
}>()

const emit = defineEmits<{ viewProject: [projectId: string] }>()
</script>

<style lang="scss">
@use "../../../styles/StatsPanel.scss";
@use "../../../styles/index.scss";
</style>
