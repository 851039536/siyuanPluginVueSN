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

      <!-- 推送状态分布 -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">{{ i18n.pushStatus || '推送状态分布' }}</div>
        <div class="gp-status-grid">
          <div class="gp-status-cell gp-status-cell--ahead">
            <div class="gp-status-cell-num">{{ pushStatusStats.ahead }}</div>
            <div class="gp-status-cell-label">{{ i18n.needsPush || '🚀 待推送' }}</div>
          </div>
          <div class="gp-status-cell gp-status-cell--behind">
            <div class="gp-status-cell-num">{{ pushStatusStats.behind }}</div>
            <div class="gp-status-cell-label">{{ i18n.behindRemote || '📥 有更新' }}</div>
          </div>
          <div class="gp-status-cell gp-status-cell--synced">
            <div class="gp-status-cell-num">{{ pushStatusStats.synced }}</div>
            <div class="gp-status-cell-label">{{ i18n.synced || '✅ 已同步' }}</div>
          </div>
          <div class="gp-status-cell gp-status-cell--none">
            <div class="gp-status-cell-num">{{ pushStatusStats.noRemote }}</div>
            <div class="gp-status-cell-label">{{ i18n.noRemoteLabel || '📭 无远程' }}</div>
          </div>
        </div>
      </div>

      <!-- 未设置平台的项目 -->
      <div v-if="noPlatformProjects.length > 0" class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.noPlatformProjects || '未设置平台的项目' }}
          <span class="gp-stats-section-count">{{ noPlatformProjects.length }}</span>
        </div>
        <div class="gp-table-wrap">
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName || '项目' }}</span>
            <span class="gp-table-cell gp-table-cell--time">{{ i18n.addedDate || '添加时间' }}</span>
            <span class="gp-table-cell gp-table-cell--act"></span>
          </div>
          <div
            v-for="item in noPlatformProjects"
            :key="item.id"
            class="gp-table-row gp-table-row--clickable"
            @click="emit('viewProject', item.id)"
          >
            <span class="gp-table-cell gp-table-cell--name" :title="item.path">{{ item.name }}</span>
            <span class="gp-table-cell gp-table-cell--time">{{ formatDate(item.addedAt) }}</span>
            <span class="gp-table-cell gp-table-cell--act">
              <Icon icon="mdi:arrow-right" height="12" />
            </span>
          </div>
        </div>
      </div>

      <!-- 项目管理概览（收藏/归档/状态分布） -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">项目管理概览</div>
        <div class="gp-mgmt-grid">
          <div class="gp-mgmt-cell gp-mgmt-star">
            <Icon icon="mdi:star" height="16" />
            <div class="gp-mgmt-num">{{ starredCount }}</div>
            <div class="gp-mgmt-label">收藏</div>
          </div>
          <div class="gp-mgmt-cell gp-mgmt-archive">
            <Icon icon="mdi:archive-outline" height="16" />
            <div class="gp-mgmt-num">{{ archivedCount }}</div>
            <div class="gp-mgmt-label">归档</div>
          </div>
          <div class="gp-mgmt-cell gp-mgmt-active">
            <Icon icon="mdi:circle-medium" height="16" />
            <div class="gp-mgmt-num">{{ statusStats.active }}</div>
            <div class="gp-mgmt-label">活跃</div>
          </div>
          <div class="gp-mgmt-cell gp-mgmt-maintenance">
            <Icon icon="mdi:circle-medium" height="16" />
            <div class="gp-mgmt-num">{{ statusStats.maintenance }}</div>
            <div class="gp-mgmt-label">维护</div>
          </div>
          <div class="gp-mgmt-cell gp-mgmt-paused">
            <Icon icon="mdi:pause-circle-outline" height="16" />
            <div class="gp-mgmt-num">{{ statusStats.paused }}</div>
            <div class="gp-mgmt-label">暂停</div>
          </div>
        </div>
      </div>

      <!-- 标签使用排行 -->
      <div v-if="tagStats.length > 0" class="gp-stats-section">
        <div class="gp-stats-section-title">
          标签使用排行
          <span class="gp-stats-section-count">{{ tagStats.length }}</span>
        </div>
        <div class="gp-tag-stats">
          <button
            v-for="t in tagStats.slice(0, 10)"
            :key="t.tag"
            class="gp-tag-stat"
            :title="`${t.tag} (${t.count} 个项目)`"
          >
            <span class="gp-tag-stat-name">{{ t.tag }}</span>
            <span class="gp-tag-stat-count">{{ t.count }}</span>
          </button>
        </div>
      </div>

      <!-- 未推送项目列表 -->
      <div v-if="needsPushProjects.length > 0" class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.needsPushList || '未及时推送项目' }}
          <span class="gp-stats-section-count">{{ needsPushProjects.length }}</span>
        </div>
        <div class="gp-table-wrap">
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName || '项目' }}</span>
            <span class="gp-table-cell gp-table-cell--plat">{{ i18n.platform || '平台' }}</span>
            <span class="gp-table-cell gp-table-cell--num">Ahead</span>
            <span class="gp-table-cell gp-table-cell--act"></span>
          </div>
          <div
            v-for="item in needsPushProjects"
            :key="item.project.id"
            class="gp-table-row"
          >
            <span class="gp-table-cell gp-table-cell--name">{{ item.project.name }}</span>
            <span class="gp-table-cell gp-table-cell--plat">
              <span
                v-for="r in item.aheadByRemote"
                :key="r.key"
                class="gp-table-remote-tag"
              >{{ platformLabel(r.key) }}</span>
            </span>
            <span class="gp-table-cell gp-table-cell--num">
              <span
                v-for="r in item.aheadByRemote"
                :key="r.key"
                class="gp-badge-ahead"
              >↑{{ r.ahead }}</span>
            </span>
            <span class="gp-table-cell gp-table-cell--act">
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                :title="i18n.viewProject || '查看项目'"
                @click="emit('viewProject', item.project.id)"
              >
                <Icon icon="mdi:arrow-right" height="12" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <!-- 未提交变更项目 -->
      <div v-if="uncommittedProjects.length > 0" class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.uncommittedChanges || '未提交变更项目' }}
          <span class="gp-stats-section-count">{{ uncommittedProjects.length }}</span>
        </div>
        <div class="gp-table-wrap">
          <div class="gp-table-row gp-table-row--head">
            <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName || '项目' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.staged || '暂存' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.unstaged || '未暂存' }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ i18n.untracked || '未跟踪' }}</span>
          </div>
          <div
            v-for="item in uncommittedProjects"
            :key="item.project.id"
            class="gp-table-row"
          >
            <span class="gp-table-cell gp-table-cell--name">{{ item.project.name }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ item.staged }}</span>
            <span class="gp-table-cell gp-table-cell--num">{{ item.unstaged }}</span>
            <span class="gp-table-cell gp-table-cell--num">
              <span v-if="item.untracked > 0" class="gp-badge-ahead">{{ item.untracked }}</span>
              <span v-else>0</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 最近提交 -->
      <div v-if="recentCommits.length > 0" class="gp-stats-section">
        <div class="gp-stats-section-title">{{ i18n.recentCommits || '最近提交' }}</div>
        <div class="gp-timeline">
          <div
            v-for="rc in recentCommits.slice(0, 8)"
            :key="rc.projectId"
            class="gp-timeline-item"
          >
            <div class="gp-timeline-dot" />
            <div class="gp-timeline-body">
              <div class="gp-timeline-name">{{ rc.projectName }}</div>
              <div class="gp-timeline-msg" :title="rc.entry.message">{{ rc.entry.message }}</div>
              <div class="gp-timeline-meta">
                <span>{{ rc.entry.author }}</span>
                <span>·</span>
                <span>{{ rc.entry.relativeDate }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
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

export interface RecentCommitEntry {
  projectId: string; projectName: string
  entry: { hash: string; message: string; author: string; relativeDate: string; date: string }
}

export interface StatusStats {
  active: number; maintenance: number; paused: number
}

export interface TagStatItem {
  tag: string; count: number
}

const props = defineProps<{
  i18n: Record<string, any>
  projectCount: number
  remoteCoverage: RemoteCoverage
  pushStatusStats: PushStatusStats
  needsPushProjects: NeedsPushItem[]
  uncommittedProjects: UncommittedItem[]
  recentCommits: RecentCommitEntry[]
  /** 收藏项目数 */
  starredCount: number
  /** 归档项目数 */
  archivedCount: number
  /** 状态分布 */
  statusStats: StatusStats
  /** 标签使用排行 */
  tagStats: TagStatItem[]
  /** 未设置平台的项目列表 */
  noPlatformProjects: GitProject[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

function pct(count: number): string {
  const total = props.remoteCoverage.total
  if (total === 0) return "0%"
  return `${Math.round((count / total) * 100)}%`
}

function platformLabel(key: string): string {
  return key === "github" ? "GitHub" : key === "gitee" ? "Gitee" : "Gitea"
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
</script>

<style lang="scss">
@use "../styles/variables" as *;
@use "../styles/StatsPanel.scss";
</style>
