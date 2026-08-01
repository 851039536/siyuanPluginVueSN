<!-- Git 项目统计概览面板 -->
<template>
  <div class="gp-stats-panel">
    <!-- 空状态：无项目时显示“暂无项目统计” -->
    <div
      v-if="stats.projectCount === 0"
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
      <!-- 总览卡片：总项目数 / 已配远程 / 待推送 / 未提交 / 收藏 / 已归档（配置驱动） -->
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

      <!-- 瀑布流布局：四个区块按列自上而下填充，各列高度独立，消除并排等高行的空隙（列数由容器宽度自适应） -->
      <div class="gp-stats-masonry">
      <!-- 远程覆盖率 -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">
          {{ i18n.remoteCoverage }}
        </div>
        <div class="gp-coverage-list">
          <!-- 覆盖率条目：四个平台 + 多远程合计（配置驱动，多远程标签为“多远程项目”；hover 显示百分比） -->
          <div
            v-for="c in coverageItems"
            :key="c.key"
            class="gp-coverage-item"
            :title="pct(c.count)"
          >
            <div class="gp-coverage-head">
              <Icon
                :icon="c.icon"
                height="12"
              />
              <span>{{ c.label }}</span>
              <span class="gp-coverage-num">{{ c.count }} / {{ stats.projectCount }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div
                class="gp-coverage-fill"
                :class="`gp-coverage-fill--${c.key}`"
                :style="{ width: pct(c.count) }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 分类分布：各分类项目数条形区块（用 category.color 着色，复用覆盖率条模式） -->
      <div
        v-if="stats.categoryDistribution.length > 0"
        class="gp-stats-section"
      >
        <!-- 区块标题：“分类分布” -->
        <div class="gp-stats-section-title">
          {{ i18n.categoryDistribution }}
        </div>
        <div class="gp-coverage-list">
          <!-- 分类条目：分类色点 + 名称 + 计数；hover 显示百分比 -->
          <div
            v-for="c in stats.categoryDistribution"
            :key="c.id"
            class="gp-coverage-item"
            :title="pct(c.count)"
          >
            <div class="gp-coverage-head">
              <span
                class="gp-cat-dot"
                :style="{ background: c.color }"
              />
              <span>{{ c.name }}</span>
              <span class="gp-coverage-num">{{ c.count }} / {{ stats.projectCount }}</span>
            </div>
            <div class="gp-coverage-bar">
              <div
                class="gp-coverage-fill"
                :style="{ width: pct(c.count), background: c.color }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 待处理项目（推送状态概览 + 待处理表格合并） -->
      <div class="gp-stats-section">
        <div class="gp-stats-section-title">
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
            <!-- 表头：“待拉取” -->
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

      <!-- 平台配置状态（显示每个项目各平台是否已配置） -->
      <div
        v-if="stats.platformStatusProjects.length > 0"
        class="gp-stats-section"
      >
        <div class="gp-stats-section-title">
          {{ i18n.platformStatus }}
          <span class="gp-stats-section-count">{{ stats.platformStatusProjects.length }}</span>
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
            v-for="row in platformRows"
            :key="row.id"
            class="gp-table-row gp-table-row--clickable"
            @click="emit('viewProject', row.id)"
          >
            <span
              class="gp-table-cell gp-table-cell--name"
              :title="row.path"
            >
              {{ row.name }}
            </span>
            <!-- 悬停提示：“已配置”/“未配置”（行视图模型预计算，避免每格 3 次函数调用） -->
            <span
              v-for="cell in row.cells"
              :key="cell.key"
              class="gp-table-cell gp-table-cell--platform-status"
              :title="cell.ok ? i18n.configured : i18n.notConfigured"
            >
              <!-- 已配置/未配置状态图标（单节点三元切换） -->
              <Icon
                :icon="cell.ok ? 'mdi:check-circle' : 'mdi:close-circle-outline'"
                height="12"
                :class="cell.ok ? 'gp-platform-ok' : 'gp-platform-missing'"
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

      <!-- 仓库链接一致性（按需批量比对手动链接与实际远程 URL） -->
      <RepoLinkAuditSection
        :i18n="i18n"
        :rows="auditRows"
        :auditing="auditing"
        :audited="audited"
        :summary="auditSummary"
        @run-audit="emit('runAudit')"
        @view-project="emit('viewProject', $event)"
      />
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import type { RepoLinkAuditRow, RepoLinkAuditSummary, StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META, getPlatformStatus } from "../../types"
import RepoLinkAuditSection from "./RepoLinkAuditSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（单对象 prop，由 useGitStats.statsView 产出，消除四层透传字段遗漏风险） */
  stats: StatsView
  /** 仓库链接一致性审计状态（useRepoLinkAudit 产出，透传给 RepoLinkAuditSection） */
  auditRows: RepoLinkAuditRow[]
  auditing: boolean
  audited: boolean
  auditSummary: RepoLinkAuditSummary
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  runAudit: []
}>()

// 总览卡片配置：总项目数 / 已配远程 / 待推送 / 未提交 / 收藏 / 已归档
const overviewCards = computed(() => [
  { value: props.stats.projectCount, label: props.i18n.totalProjects, cls: "" },
  { value: props.stats.remoteCoverage.hasRemote, label: props.i18n.remoteConfigured, cls: "gp-stat-card--info" },
  { value: props.stats.pushStatusStats.ahead, label: props.i18n.needsPush, cls: "gp-stat-card--warn" },
  { value: props.stats.uncommittedCount, label: props.i18n.uncommitted, cls: "gp-stat-card--accent" },
  // 收藏卡：“收藏”（与列表星标按钮同色）
  { value: props.stats.starredCount, label: props.i18n.starred, cls: "gp-stat-card--star" },
  // 归档卡：“已归档”（弱化展示）
  { value: props.stats.archivedCount, label: props.i18n.archivedTitle, cls: "gp-stat-card--muted" },
])

// 覆盖率条目：四个平台（PLATFORM_META 投影）+ 多远程合计（key 同时作为 gp-coverage-fill 修饰类后缀）
const coverageItems = computed(() => [
  ...PLATFORM_META.map((pm) => ({
    key: pm.key as string,
    icon: pm.icon,
    label: pm.label as string,
    count: props.stats.remoteCoverage[pm.key],
  })),
  // 多远程项目条目：“多远程项目”
  { key: "multi", icon: "mdi:layers", label: props.i18n.multipleRemotes as string, count: props.stats.remoteCoverage.multiple },
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

// 平台状态行视图模型：预计算每格配置状态，避免模板中每行 12 次 getPlatformStatus 调用
const platformRows = computed(() =>
  props.stats.platformStatusProjects.map((item) => ({
    id: item.project.id,
    name: item.project.name,
    path: item.project.path,
    cells: PLATFORM_META.map((pm) => ({ key: pm.key, ok: getPlatformStatus(item, pm.key) })),
  })),
)

function pct(count: number): string {
  if (props.stats.projectCount === 0) return "0%"
  return `${Math.round((count / props.stats.projectCount) * 100)}%`
}
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
