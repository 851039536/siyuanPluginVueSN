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

.gp-stats-panel {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

// ── 总览卡片 ──
.gp-stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.gp-stat-card {
  text-align: center;
  padding: 12px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

.gp-stat-card-value {
  font-size: 22px;
  font-weight: 700;
  font-family: $vp-mono;
  line-height: 1.2;
  margin-bottom: 2px;
  color: var(--b3-theme-on-surface);
}

.gp-stat-card-label {
  font-size: 10px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.gp-stat-card--info .gp-stat-card-value { color: var(--b3-theme-primary); }
.gp-stat-card--warn .gp-stat-card-value { color: var(--b3-theme-warning); }
.gp-stat-card--accent .gp-stat-card-value { color: #f58742; }

// ── 区块标题 ──
.gp-stats-section {
  margin-bottom: 14px;
}

.gp-stats-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.45;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.gp-stats-section-count {
  font-size: 10px;
  font-family: $vp-mono;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  font-weight: 600;
  letter-spacing: 0;
}

// ── 远程覆盖率 ──
.gp-coverage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gp-coverage-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.gp-coverage-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.7;
}

.gp-coverage-num {
  margin-left: auto;
  font-family: $vp-mono;
  font-size: 10px;
  opacity: 0.5;
}

.gp-coverage-bar {
  height: 4px;
  background: var(--b3-theme-surface);
  border-radius: 2px;
  overflow: hidden;
}

.gp-coverage-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--b3-theme-primary);
  transition: width 0.3s ease;
}

.gp-coverage-fill--gitee { background: #ee3f4d; }
.gp-coverage-fill--gitea { background: #609926; }
.gp-coverage-fill--multi { background: #8b5cf6; }

// ── 推送状态分布 ──
.gp-status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.gp-status-cell {
  text-align: center;
  padding: 10px 4px;
  border-radius: 6px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
}

.gp-status-cell-num {
  font-size: 18px;
  font-weight: 700;
  font-family: $vp-mono;
  line-height: 1.2;
}

.gp-status-cell-label {
  font-size: 9px;
  opacity: 0.55;
  margin-top: 2px;
}

.gp-status-cell--ahead .gp-status-cell-num { color: var(--b3-theme-primary); }
.gp-status-cell--behind .gp-status-cell-num { color: var(--b3-theme-warning); }
.gp-status-cell--synced .gp-status-cell-num { color: var(--b3-theme-success); }
.gp-status-cell--none .gp-status-cell-num { opacity: 0.3; }

// ── 表格 ──
.gp-table-wrap {
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
}

.gp-table-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  font-size: 11px;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-child {
    border-bottom: none;
  }

  &--head {
    background: var(--b3-theme-surface);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.45;
  }

  &--clickable {
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--b3-theme-surface);
    }
  }
}

.gp-table-cell {
  flex-shrink: 0;

  &--name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &--plat {
    width: 90px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  &--num {
    width: 40px;
    text-align: center;
    font-family: $vp-mono;
    font-size: 10px;
  }

  &--act {
    width: 24px;
    text-align: center;
  }

  &--time {
    width: 90px;
    text-align: center;
    font-size: 10px;
    opacity: 0.55;
    font-family: $vp-mono;
  }
}

.gp-table-remote-tag {
  display: inline-block;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 2px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

.gp-badge-ahead {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  font-family: $vp-mono;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

// ── 时间线 ──
.gp-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.gp-timeline-item {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-child {
    border-bottom: none;
  }
}

.gp-timeline-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
  background: var(--b3-theme-primary);
  opacity: 0.4;
}

.gp-timeline-body {
  flex: 1;
  min-width: 0;
}

.gp-timeline-name {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 1px;
}

.gp-timeline-msg {
  font-size: 10px;
  font-family: $vp-mono;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.gp-timeline-meta {
  font-size: 9px;
  opacity: 0.35;
  display: flex;
  gap: 4px;
}

// ── 项目管理概览 ──
.gp-mgmt-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.gp-mgmt-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 6px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
}

.gp-mgmt-num {
  font-size: 16px;
  font-weight: 700;
  font-family: $vp-mono;
  line-height: 1.1;
}

.gp-mgmt-label {
  font-size: 9px;
  opacity: 0.55;
}

.gp-mgmt-star { color: #f5a623; }
.gp-mgmt-archive { color: var(--b3-theme-on-surface); opacity: 0.6; }
.gp-mgmt-active { color: var(--b3-theme-success); }
.gp-mgmt-maintenance { color: var(--b3-theme-primary); }
.gp-mgmt-paused { color: var(--b3-theme-on-surface); opacity: 0.4; }

// ── 标签使用排行 ──
.gp-tag-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gp-tag-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 10px;
  cursor: default;
  transition: border-color 0.15s;

  &:hover { border-color: var(--b3-theme-primary); }
}

.gp-tag-stat-name {
  font-weight: 500;
}

.gp-tag-stat-count {
  font-family: $vp-mono;
  font-size: 9px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}
</style>
