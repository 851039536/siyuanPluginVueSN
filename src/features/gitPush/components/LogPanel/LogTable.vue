<!-- gitPush 操作日志表格（表头 + 日期分组循环 + 数据行，纯渲染） -->
<template>
  <div class="gp-log-list">
    <!-- 表头（滚动时 sticky 置顶） -->
    <div class="gp-log-thead">
      <!-- 表头："类型" -->
      <span class="gp-log-th gp-log-tcol--action">{{ i18n.logColType }}</span>
      <!-- 表头："状态" -->
      <span class="gp-log-th gp-log-tcol--status">{{ i18n.logColStatus }}</span>
      <!-- 表头："项目" -->
      <span class="gp-log-th gp-log-tcol--project">{{ i18n.logColProject }}</span>
      <!-- 表头："摘要" -->
      <span class="gp-log-th gp-log-tcol--summary">{{ i18n.logColSummary }}</span>
      <!-- 表头："时间" -->
      <span class="gp-log-th gp-log-tcol--time">{{ i18n.logColTime }}</span>
      <!-- 表头："操作" -->
      <span class="gp-log-th gp-log-tcol--ops">{{ i18n.logColOps }}</span>
    </div>

    <template
      v-for="group in groups"
      :key="group.dateKey"
    >
      <!-- 日期分组标题（分隔行）："今天"/"昨天"/"2026-08-10" -->
      <div class="gp-log-group-title">{{ group.dateLabel }}</div>
      <LogTableRow
        v-for="entry in group.entries"
        :key="entry.id"
        :i18n="i18n"
        :entry="entry"
        @open-detail="emit('openDetail', $event)"
        @view-project="emit('viewProject', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志表格（表头 + 日期分组循环 + 数据行，纯渲染）
import type { GitOpLogEntry } from "../../types"
import LogTableRow from "./LogTableRow.vue"

/** 日志日期分组项（表格内部使用） */
export interface LogDateGroup {
  /** "2026-08-12"，用于 v-for key 唯一标识 */
  dateKey: string
  /** "今天" / "昨天" / "2026-08-12" */
  dateLabel: string
  entries: GitOpLogEntry[]
}

defineProps<{
  i18n: Record<string, any>
  /** 按日期分组的分页结果（入口 index.vue computed 产出） */
  groups: LogDateGroup[]
}>()

const emit = defineEmits<{
  openDetail: [entry: GitOpLogEntry]
  viewProject: [projectId: string]
}>()
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
