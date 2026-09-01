<!-- gitPush 统计视图待处理项目区块（推送状态概览 chips + 待处理表格合并） -->
<template>
  <div class="gp-stats-section">
    <div class="gp-stats-section-title">
      <!-- 区块标题："待处理项目" -->
      {{ i18n.pendingProjects }}
      <span class="gp-stats-section-count">{{ stats.pendingProjects.length }}</span>
    </div>
    <!-- 推送状态概览：待推送/待拉取/已同步/无远程（配置驱动） -->
    <div class="gp-status-bar">
      <div
        v-for="chip in STATUS_CHIPS"
        :key="chip.field"
        class="gp-status-chip"
        :class="`gp-status-chip--${chip.cls}`"
        :title="i18n[chip.labelKey]"
      >
        <Icon
          :icon="chip.icon"
          height="12"
        />
        <span>{{ stats.pushStatusStats[chip.field] }}</span>
      </div>
    </div>
    <!-- 待处理项目表格 -->
    <div
      v-if="stats.pendingProjects.length > 0"
      class="gp-table-wrap"
    >
      <div class="gp-table-row gp-table-row--head">
        <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName }}</span>
        <span class="gp-table-cell gp-table-cell--num">{{ i18n.needsPushShort }}</span>
        <!-- 表头："待拉取" -->
        <span class="gp-table-cell gp-table-cell--num">{{ i18n.needsPullShort }}</span>
        <!-- 表头三列：已暂存/未暂存/未跟踪（field 同时作为 i18n 键） -->
        <span
          v-for="col in COUNT_COLUMNS"
          :key="col.field"
          class="gp-table-cell gp-table-cell--num"
        >{{ i18n[col.field] }}</span>
        <span class="gp-table-cell gp-table-cell--act"></span>
      </div>
      <div
        v-for="item in stats.pendingProjects"
        :key="item.project.id"
        class="gp-table-row gp-table-row--clickable"
        @click="emit('viewProject', item.project.id)"
      >
        <span
          class="gp-table-cell gp-table-cell--name"
          :title="item.project.path"
        >
          {{ item.project.name }}
        </span>
        <span class="gp-table-cell gp-table-cell--num">
          <span
            v-for="r in item.aheadByRemote"
            :key="r.key"
            class="gp-badge-ahead"
          >↑{{ r.ahead }}</span>
          <span
            v-if="item.aheadByRemote.length === 0"
            class="gp-cell-empty"
          >-</span>
        </span>
        <!-- 待拉取列：各远程落后提交数徽章（0 时显示占位符 -） -->
        <span class="gp-table-cell gp-table-cell--num">
          <span
            v-for="r in item.behindByRemote"
            :key="r.key"
            class="gp-badge-behind"
          >↓{{ r.behind }}</span>
          <span
            v-if="item.behindByRemote.length === 0"
            class="gp-cell-empty"
          >-</span>
        </span>
        <!-- 已暂存/未暂存/未跟踪三列计数徽章（列配置驱动，0 时显示占位符 -） -->
        <span
          v-for="col in COUNT_COLUMNS"
          :key="col.field"
          class="gp-table-cell gp-table-cell--num"
        >
          <span
            v-if="item[col.field] > 0"
            :class="col.badge"
          >{{ item[col.field] }}</span>
          <span
            v-else
            class="gp-cell-empty"
          >-</span>
        </span>
        <span class="gp-table-cell gp-table-cell--act">
          <Icon
            icon="mdi:arrow-right"
            height="12"
          />
        </span>
      </div>
    </div>
    <div
      v-else
      class="gp-status-all-clear"
    >
      <Icon
        icon="mdi:check-all"
        height="12"
      />
      <span>{{ i18n.allClear }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图待处理项目区块（推送状态概览 + 待处理表格）
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"

defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 pushStatusStats + pendingProjects） */
  stats: StatsView
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

// 推送状态 chip 配置：待推送/待拉取/已同步/无远程（labelKey 复用现有 i18n 键作 hover 提示）
const STATUS_CHIPS = [
  { field: "ahead", icon: "mdi:cloud-upload-outline", cls: "ahead", labelKey: "needsPush" },
  { field: "behind", icon: "mdi:cloud-download-outline", cls: "behind", labelKey: "needsPullShort" },
  { field: "synced", icon: "mdi:check-circle-outline", cls: "synced", labelKey: "synced" },
  { field: "noRemote", icon: "mdi:lan-disconnect", cls: "none", labelKey: "noRemoteLabel" },
] as const

// 变更计数列配置：已暂存/未暂存/未跟踪（field 同时作为表头 i18n 键）
const COUNT_COLUMNS = [
  { field: "staged", badge: "gp-badge-ahead" },
  { field: "unstaged", badge: "gp-badge-unstaged" },
  { field: "untracked", badge: "gp-badge-untracked" },
] as const
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
