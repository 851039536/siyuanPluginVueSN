<!-- Git 项目统计概览面板 -->
<template>
  <div class="gp-stats-panel">
    <!-- 空状态：无项目时显示“暂无项目统计” -->
    <div
      v-if="projectCount === 0"
      class="gp-empty"
    >
      <div class="gp-empty-icon">
        <Icon
          icon="mdi:chart-bar"
          width="48"
          height="48"
        />
      </div>
      <div class="gp-empty-text">
        {{ i18n.noProjectsStats }}
      </div>
    </div>

    <template v-else>
      <!-- 总览卡片：总项目数 / 已配远程 / 待推送 / 未提交（配置驱动） -->
      <div class="gp-stats-cards">
        <div
          v-for="(card, i) in overviewCards"
          :key="i"
          class="gp-stat-card"
          :class="card.cls"
        >
          <div class="gp-stat-card-value">
            {{ card.value }}
          </div>
          <div class="gp-stat-card-label">
            {{ card.label }}
          </div>
        </div>
      </div>

      <!-- 远程覆盖率 -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.remoteCoverage }}
        </div>
        <div class="gp-coverage-list">
          <div
            v-for="pm in PLATFORM_META"
            :key="pm.key"
            class="gp-coverage-item"
          >
            <div class="gp-coverage-head">
              <Icon
                :icon="pm.icon"
                height="12"
              />
              <span>{{ pm.label }}</span>
              <span class="gp-coverage-num">{{ remoteCoverage[pm.key] }} / {{ projectCount }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div
                class="gp-coverage-fill"
                :class="`gp-coverage-fill--${pm.key}`"
                :style="{ width: pct(remoteCoverage[pm.key]) }"
              />
            </div>
          </div>
          <div class="gp-coverage-item">
            <div class="gp-coverage-head">
              <Icon
                icon="mdi:layers"
                height="12"
              />
              <span>{{ i18n.multipleRemotes }}</span>
              <span class="gp-coverage-num">{{ remoteCoverage.multiple }} / {{ projectCount }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div
                class="gp-coverage-fill gp-coverage-fill--multi"
                :style="{ width: pct(remoteCoverage.multiple) }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 双列布局：待处理项目 + 平台配置状态 -->
      <div class="gp-stats-duo">
      <!-- 待处理项目（推送状态概览 + 待处理表格合并） -->
      <div class="gp-stats-section gp-stats-section--half">
        <div class="gp-stats-section-title">
          {{ i18n.pendingProjects }}
          <span class="gp-stats-section-count">{{ pendingProjects.length }}</span>
        </div>
        <!-- 推送状态概览：待推送/待拉取/已同步/无远程（配置驱动） -->
        <div class="gp-status-bar">
          <div
            v-for="chip in STATUS_CHIPS"
            :key="chip.field"
            class="gp-status-chip"
            :class="`gp-status-chip--${chip.cls}`"
          >
            <Icon
              :icon="chip.icon"
              height="12"
            />
            <span>{{ pushStatusStats[chip.field] }}</span>
          </div>
        </div>
        <!-- 待处理项目表格 -->
        <div
          v-if="pendingProjects.length > 0"
          class="gp-table-wrap"
        >
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.needsPushShort }}</span>
            <!-- 表头三列：已暂存/未暂存/未跟踪（field 同时作为 i18n 键） -->
            <span
              v-for="col in COUNT_COLUMNS"
              :key="col.field"
              class="gp-table-cell gp-table-cell--num"
            >{{ i18n[col.field] }}</span>
            <span class="gp-table-cell gp-table-cell--act"></span>
          </div>
          <div
            v-for="item in pendingProjects"
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

      <!-- 平台配置状态（显示每个项目各平台是否已配置） -->
      <div
        v-if="platformStatusProjects.length > 0"
        class="gp-stats-section gp-stats-section--half"
      >
        <div class="gp-stats-section-title">
          {{ i18n.platformStatus }}
          <span class="gp-stats-section-count">{{ platformStatusProjects.length }}</span>
        </div>
        <div class="gp-table-wrap">
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName }}</span>
            <span
              v-for="pm in PLATFORM_META"
              :key="pm.key"
              class="gp-table-cell gp-table-cell--platform-status"
            >
              <Icon
                :icon="pm.icon"
                height="12"
              />
            </span>
            <span class="gp-table-cell gp-table-cell--act"></span>
          </div>
          <div
            v-for="item in platformStatusProjects"
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
            <span
              v-for="pm in PLATFORM_META"
              :key="pm.key"
              class="gp-table-cell gp-table-cell--platform-status"
              :title="getPlatformStatus(item, pm.key) ? i18n.configured : i18n.notConfigured"
            >
              <Icon
                v-if="getPlatformStatus(item, pm.key)"
                icon="mdi:check-circle"
                height="12"
                class="gp-platform-ok"
              />
              <Icon
                v-else
                icon="mdi:close-circle-outline"
                height="12"
                class="gp-platform-missing"
              />
            </span>
            <span class="gp-table-cell gp-table-cell--act">
              <Icon
                icon="mdi:arrow-right"
                height="12"
              />
            </span>
          </div>
        </div>
      </div>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import type { GitProject, PlatformStatusItem } from "../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META, getPlatformStatus } from "../types"

export interface RemoteCoverage {
  github: number
  gitee: number
  gitea: number
  cnb: number
  hasRemote: number
  multiple: number
}

export interface PushStatusStats {
  ahead: number
  behind: number
  synced: number
  noRemote: number
}

export interface NeedsPushItem {
  project: GitProject
  aheadByRemote: { key: string, ahead: number }[]
  totalAhead: number
}

export interface UncommittedItem {
  project: GitProject
  staged: number
  unstaged: number
  untracked: number
}

const props = defineProps<{
  i18n: Record<string, any>
  projectCount: number
  remoteCoverage: RemoteCoverage
  pushStatusStats: PushStatusStats
  needsPushProjects: NeedsPushItem[]
  uncommittedProjects: UncommittedItem[]
  /** 平台配置状态明细（每个项目的 GitHub/Gitee/Gitea/CNB 是否已配置） */
  platformStatusProjects: PlatformStatusItem[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

// 总览卡片配置：总项目数 / 已配远程 / 待推送 / 未提交
const overviewCards = computed(() => [
  { value: props.projectCount, label: props.i18n.totalProjects, cls: "" },
  { value: props.remoteCoverage.hasRemote, label: props.i18n.remoteConfigured, cls: "gp-stat-card--info" },
  { value: props.pushStatusStats.ahead, label: props.i18n.needsPush, cls: "gp-stat-card--warn" },
  { value: props.uncommittedProjects.length, label: props.i18n.uncommitted, cls: "gp-stat-card--accent" },
])

// 推送状态 chip 配置：待推送/待拉取/已同步/无远程
const STATUS_CHIPS = [
  { field: "ahead", icon: "mdi:cloud-upload-outline", cls: "ahead" },
  { field: "behind", icon: "mdi:cloud-download-outline", cls: "behind" },
  { field: "synced", icon: "mdi:check-circle-outline", cls: "synced" },
  { field: "noRemote", icon: "mdi:lan-disconnect", cls: "none" },
] as const

// 变更计数列配置：已暂存/未暂存/未跟踪（field 同时作为表头 i18n 键）
const COUNT_COLUMNS = [
  { field: "staged", badge: "gp-badge-ahead" },
  { field: "unstaged", badge: "gp-badge-unstaged" },
  { field: "untracked", badge: "gp-badge-untracked" },
] as const

function pct(count: number): string {
  if (props.projectCount === 0) return "0%"
  return `${Math.round((count / props.projectCount) * 100)}%`
}

/** 合并后的待处理项目（需要推送 + 有未提交变更） */
interface PendingProjectItem {
  project: GitProject
  aheadByRemote: { key: string, ahead: number }[]
  totalAhead: number
  staged: number
  unstaged: number
  untracked: number
}

const pendingProjects = computed<PendingProjectItem[]>(() => {
  const map = new Map<string, PendingProjectItem>()
  // 先收集需要推送的项目
  for (const np of props.needsPushProjects) {
    map.set(np.project.id, {
      project: np.project,
      aheadByRemote: np.aheadByRemote,
      totalAhead: np.totalAhead,
      staged: 0,
      unstaged: 0,
      untracked: 0,
    })
  }
  // 再合并有未提交变更的项目
  for (const uc of props.uncommittedProjects) {
    const existing = map.get(uc.project.id)
    if (existing) {
      existing.staged = uc.staged
      existing.unstaged = uc.unstaged
      existing.untracked = uc.untracked
    } else {
      map.set(uc.project.id, {
        project: uc.project,
        aheadByRemote: [],
        totalAhead: 0,
        staged: uc.staged,
        unstaged: uc.unstaged,
        untracked: uc.untracked,
      })
    }
  }
  // 按 totalAhead 降序 → staged+unstaged+untracked 降序
  return [...map.values()].sort((a, b) => {
    if (a.totalAhead !== b.totalAhead) return b.totalAhead - a.totalAhead
    const aTotal = a.staged + a.unstaged + a.untracked
    const bTotal = b.staged + b.unstaged + b.untracked
    return bTotal - aTotal
  })
})
</script>

<style lang="scss">
@use "../styles/variables" as *;
@use "../styles/StatsPanel.scss";
</style>
