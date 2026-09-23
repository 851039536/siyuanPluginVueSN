<!-- gitPush 统计视图平台矩阵表格（项目名 + 四平台状态列 + 操作列，单元格视图模型驱动） -->
<template>
  <div class="gps-table-wrap">
    <!-- 表头："项目名称" + 四平台图标列 + 操作列 -->
    <div class="gps-table-row gps-table-row--head">
      <span class="gps-table-cell gps-table-cell--name">{{ i18n.projectName }}</span>
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
      <span class="gps-table-cell gps-table-cell--act"></span>
    </div>
    <!-- 数据行：点击跳转项目详情（icon 为空渲染占位符 -） -->
    <div
      v-for="row in rows"
      :key="row.id"
      class="gps-table-row gps-table-row--clickable"
      @click="emit('viewProject', row.id)"
    >
      <span
        class="gps-table-cell gps-table-cell--name"
        :title="row.path"
      >
        {{ row.name }}
        <span
          v-if="row.nameSuffix"
          class="gps-error-text"
        >{{ row.nameSuffix }}</span>
      </span>
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
      <span class="gps-table-cell gps-table-cell--act">
        <Icon
          icon="mdi:arrow-right"
          height="12"
        />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 平台矩阵表格：表头 + 行骨架固定，单元格图标与 tooltip 经视图模型注入（PlatformSection / RepoLinkAuditSection 共用）
import type { PlatformTableRowView } from "../../../types"
import { Icon } from "@iconify/vue"
import { PLATFORM_META } from "../../../types"

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
