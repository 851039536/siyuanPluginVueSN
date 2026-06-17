<template>
  <div class="gp-stats-panel">
    <!-- 总览卡片 -->
    <div v-if="projectCount > 0" class="gp-stats-cards">
      <div class="gp-stat-card">
        <div class="gp-stat-card-value">{{ projectCount }}</div>
        <div class="gp-stat-card-label">{{ i18n.totalProjects || '项目总数' }}</div>
      </div>
      <div class="gp-stat-card gp-stat-card--info">
        <div class="gp-stat-card-value">{{ remoteCoverage.hasRemote }}</div>
        <div class="gp-stat-card-label">{{ i18n.remoteConfigured || '已配置远程' }}</div>
      </div>
      <div class="gp-stat-card gp-stat-card--warn">
        <div class="gp-stat-card-value">{{ pushStatusStats.ahead }}</div>
        <div class="gp-stat-card-label">{{ i18n.needsPush || '待推送' }}</div>
      </div>
      <div class="gp-stat-card gp-stat-card--accent">
        <div class="gp-stat-card-value">{{ uncommittedProjects.length }}</div>
        <div class="gp-stat-card-label">{{ i18n.uncommitted || '未提交变更' }}</div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="projectCount === 0" class="gp-empty">
      <div class="gp-empty-icon"><Icon icon="mdi:chart-bar" width="48" /></div>
      <div class="gp-empty-text">{{ i18n.noProjectsStats || '暂无项目，请在列表视图中添加' }}</div>
    </div>

    <template v-if="projectCount > 0">
      <!-- 远程覆盖率 -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">{{ i18n.remoteCoverage || '远程仓库覆盖率' }}</div>
        <div class="gp-coverage-list">
          <div class="gp-coverage-item">
            <div class="gp-coverage-head">
              <Icon icon="mdi:github" height="14" />
              <span>GitHub</span>
              <span class="gp-coverage-num">{{ remoteCoverage.github }} / {{ remoteCoverage.total }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div class="gp-coverage-fill" :style="{ width: pct(remoteCoverage.github) }" />
            </div>
          </div>
          <div class="gp-coverage-item">
            <div class="gp-coverage-head">
              <Icon icon="mdi:git" height="14" />
              <span>Gitee</span>
              <span class="gp-coverage-num">{{ remoteCoverage.gitee }} / {{ remoteCoverage.total }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div class="gp-coverage-fill gp-coverage-fill--gitee" :style="{ width: pct(remoteCoverage.gitee) }" />
            </div>
          </div>
          <div class="gp-coverage-item">
            <div class="gp-coverage-head">
              <Icon icon="mdi:tea" height="14" />
              <span>Gitea</span>
              <span class="gp-coverage-num">{{ remoteCoverage.gitea }} / {{ remoteCoverage.total }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div class="gp-coverage-fill gp-coverage-fill--gitea" :style="{ width: pct(remoteCoverage.gitea) }" />
            </div>
          </div>
          <div class="gp-coverage-item">
            <div class="gp-coverage-head">
              <Icon icon="mdi:layers" height="14" />
              <span>{{ i18n.multipleRemotes || '多远程项目' }}</span>
              <span class="gp-coverage-num">{{ remoteCoverage.multiple }} / {{ remoteCoverage.total }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div class="gp-coverage-fill gp-coverage-fill--multi" :style="{ width: pct(remoteCoverage.multiple) }" />
            </div>
          </div>
        </div>
      </div>

      <!-- 待处理项目（推送状态概览 + 待处理表格合并） -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.pendingProjects || '待处理项目' }}
          <span class="gp-stats-section-count">{{ pendingProjects.length }}</span>
        </div>
        <!-- 推送状态概览 -->
        <div class="gp-status-bar">
          <div class="gp-status-chip gp-status-chip--ahead">
            <Icon icon="mdi:cloud-upload-outline" height="13" />
            <span>{{ pushStatusStats.ahead }}</span>
          </div>
          <div class="gp-status-chip gp-status-chip--behind">
            <Icon icon="mdi:cloud-download-outline" height="13" />
            <span>{{ pushStatusStats.behind }}</span>
          </div>
          <div class="gp-status-chip gp-status-chip--synced">
            <Icon icon="mdi:check-circle-outline" height="13" />
            <span>{{ pushStatusStats.synced }}</span>
          </div>
          <div class="gp-status-chip gp-status-chip--none">
            <Icon icon="mdi:lan-disconnect" height="13" />
            <span>{{ pushStatusStats.noRemote }}</span>
          </div>
        </div>
        <!-- 待处理项目表格 -->
        <div v-if="pendingProjects.length > 0" class="gp-table-wrap">
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName || '项目' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.needsPushShort || '待推送' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.staged || '暂存' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.unstaged || '未暂存' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.untracked || '未跟踪' }}</span>
            <span class="gp-table-cell gp-table-cell--act"></span>
          </div>
          <div
            v-for="item in pendingProjects"
            :key="item.project.id"
            class="gp-table-row gp-table-row--clickable"
            @click="emit('viewProject', item.project.id)"
          >
            <span class="gp-table-cell gp-table-cell--name" :title="item.project.path">
              {{ item.project.name }}
            </span>
            <span class="gp-table-cell gp-table-cell--num">
              <span
                v-for="r in item.aheadByRemote"
                :key="r.key"
                class="gp-badge-ahead"
              >↑{{ r.ahead }}</span>
              <span v-if="item.aheadByRemote.length === 0" class="gp-cell-empty">-</span>
            </span>
            <span class="gp-table-cell gp-table-cell--num">
              <span v-if="item.staged > 0" class="gp-badge-staged">{{ item.staged }}</span>
              <span v-else class="gp-cell-empty">-</span>
            </span>
            <span class="gp-table-cell gp-table-cell--num">
              <span v-if="item.unstaged > 0" class="gp-badge-unstaged">{{ item.unstaged }}</span>
              <span v-else class="gp-cell-empty">-</span>
            </span>
            <span class="gp-table-cell gp-table-cell--num">
              <span v-if="item.untracked > 0" class="gp-badge-untracked">{{ item.untracked }}</span>
              <span v-else class="gp-cell-empty">-</span>
            </span>
            <span class="gp-table-cell gp-table-cell--act">
              <Icon icon="mdi:arrow-right" height="12" />
            </span>
          </div>
        </div>
        <div v-else class="gp-status-all-clear">
          <Icon icon="mdi:check-all" height="14" />
          <span>{{ i18n.allClear || '所有项目状态正常' }}</span>
        </div>
      </div>

      <!-- 平台配置状态（显示每个项目各平台是否已配置） -->
      <div v-if="platformStatusProjects.length > 0" class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.platformStatus || '平台配置状态' }}
          <span class="gp-stats-section-count">{{ platformStatusProjects.length }}</span>
        </div>
        <div class="gp-table-wrap">
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName || '项目' }}</span>
            <span
              v-for="pm in PLATFORM_META"
              :key="pm.key"
              class="gp-table-cell gp-table-cell--platform-status"
            >
              <Icon :icon="pm.icon" height="11" />
            </span>
            <span class="gp-table-cell gp-table-cell--act"></span>
          </div>
          <div
            v-for="item in platformStatusProjects"
            :key="item.project.id"
            class="gp-table-row gp-table-row--clickable"
            @click="emit('viewProject', item.project.id)"
          >
            <span class="gp-table-cell gp-table-cell--name" :title="item.project.path">
              {{ item.project.name }}
            </span>
            <span
              v-for="pm in PLATFORM_META"
              :key="pm.key"
              class="gp-table-cell gp-table-cell--platform-status"
              :title="(item as any)[pm.key] ? (i18n.configured || '已配置') : (i18n.notConfigured || '未配置')"
            >
              <Icon
                v-if="(item as any)[pm.key]"
                icon="mdi:check-circle"
                height="13"
                class="gp-platform-ok"
              />
              <Icon
                v-else
                icon="mdi:close-circle-outline"
                height="13"
                class="gp-platform-missing"
              />
            </span>
            <span class="gp-table-cell gp-table-cell--act">
              <Icon icon="mdi:arrow-right" height="12" />
            </span>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import type { GitProject } from "../types"

export interface RemoteCoverage {
  total: number; github: number; gitee: number; gitea: number
  hasRemote: number; noRemote: number; multiple: number
}

export interface PushStatusStats {
  total: number; ahead: number; behind: number; synced: number; noRemote: number
}

export interface NeedsPushItem {
  project: GitProject
  aheadByRemote: { key: string; ahead: number }[]
  totalAhead: number
}

export interface UncommittedItem {
  project: GitProject
  staged: number; unstaged: number; untracked: number
}



/** 平台配置状态明细项 */
export interface PlatformStatusItem {
  project: GitProject
  github: boolean
  gitee: boolean
  gitea: boolean
  missingCount: number
}

const props = defineProps<{
  i18n: Record<string, any>
  projectCount: number
  remoteCoverage: RemoteCoverage
  pushStatusStats: PushStatusStats
  needsPushProjects: NeedsPushItem[]
  uncommittedProjects: UncommittedItem[]
  /** @deprecated 使用 platformStatusProjects 替代 */
  noPlatformProjects: GitProject[]
  /** 平台配置状态明细（每个项目的 GitHub/Gitee/Gitea 是否已配置） */
  platformStatusProjects: PlatformStatusItem[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

function pct(count: number): string {
  const total = props.remoteCoverage.total
  if (total === 0) return "0%"
  return `${Math.round((count / total) * 100)}%`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** 平台元数据（驱动 v-for） */
const PLATFORM_META: { key: string; icon: string; label: string }[] = [
  { key: "github", icon: "mdi:github", label: "GitHub" },
  { key: "gitee", icon: "mdi:git", label: "Gitee" },
  { key: "gitea", icon: "mdi:tea", label: "Gitea" },
]

/** 合并后的待处理项目（需要推送 + 有未提交变更） */
interface PendingProjectItem {
  project: GitProject
  aheadByRemote: { key: string; ahead: number }[]
  totalAhead: number
  staged: number
  unstaged: number
  untracked: number
  isPending: boolean
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
      isPending: true,
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
        isPending: true,
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
