<!-- 仓库链接一致性区块（统计面板子区块：按需批量比对手动仓库链接与实际 git 远程 URL） -->
<template>
  <div class="gp-stats-section">
    <div class="gp-stats-section-title">
      <!-- 区块标题："仓库链接一致性" -->
      {{ i18n.repoLinkAudit }}
      <span
        v-if="audited"
        class="gp-stats-section-count"
      >{{ issueRows.length }}</span>
      <!-- 按钮："开始分析"/"重新分析"（分析中转圈禁用） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm gp-audit-run-btn"
        :disabled="auditing"
        @click="emit('runAudit')"
      >
        <Icon
          :icon="auditing ? 'mdi:loading' : 'mdi:magnify-scan'"
          height="12"
          :class="{ 'gp-spin': auditing }"
        />
        <span>{{ audited ? i18n.auditRerun : i18n.auditRun }}</span>
      </button>
    </div>

    <!-- 未分析提示："点击开始分析，将对所有项目执行 git remote -v 比对" -->
    <div
      v-if="!audited && !auditing"
      class="gp-audit-hint"
    >
      {{ i18n.auditHint }}
    </div>
    <!-- 首轮分析中占位："分析中…" -->
    <div
      v-else-if="!audited"
      class="gp-audit-hint"
    >
      {{ i18n.auditing }}
    </div>

    <template v-else>
      <!-- 四态汇总 chips：一致/不一致/仅配置链接/仅存在远程（hover 显示状态名） -->
      <div class="gp-status-bar">
        <div
          v-for="chip in AUDIT_CHIPS"
          :key="chip.state"
          class="gp-status-chip"
          :class="`gp-status-chip--${chip.cls}`"
          :title="i18n[chip.labelKey]"
        >
          <Icon
            :icon="chip.icon"
            height="12"
          />
          <span>{{ summary[chip.state] }}</span>
        </div>
      </div>
      <!-- 问题项目表格（仅展示存在不一致/缺失/检测失败的项目） -->
      <div
        v-if="issueRows.length > 0"
        class="gp-table-wrap"
      >
        <div class="gp-table-row gp-table-row--head">
          <!-- 表头："项目名称" -->
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
          v-for="row in issueRows"
          :key="row.id"
          class="gp-table-row gp-table-row--clickable"
          @click="emit('viewProject', row.id)"
        >
          <span
            class="gp-table-cell gp-table-cell--name"
            :title="row.path"
          >
            {{ row.name }}
            <!-- 错误标注："路径无效或检测失败" -->
            <span
              v-if="row.error"
              class="gp-audit-error-text"
            >{{ i18n.auditError }}</span>
          </span>
          <!-- 平台单元格：四态图标（tooltip 同时展示状态名 + 链接与远程 URL 原文） -->
          <span
            v-for="cell in row.cells"
            :key="cell.key"
            class="gp-table-cell gp-table-cell--platform-status"
            :title="cellTitle(cell)"
          >
            <Icon
              v-if="cell.state !== 'none'"
              :icon="STATE_META[cell.state].icon"
              height="12"
              :class="STATE_META[cell.state].cls"
            />
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
      <!-- 全部一致空态："链接与远程全部一致" -->
      <div
        v-else
        class="gp-status-all-clear"
      >
        <Icon
          icon="mdi:check-all"
          height="12"
        />
        <span>{{ i18n.auditAllMatch }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  RepoLinkAuditCell,
  RepoLinkAuditRow,
  RepoLinkAuditSummary,
} from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  rows: RepoLinkAuditRow[]
  auditing: boolean
  audited: boolean
  summary: RepoLinkAuditSummary
}>()

const emit = defineEmits<{
  runAudit: []
  viewProject: [projectId: string]
}>()

// 汇总 chip 配置：一致/不一致/仅配置链接/仅存在远程（cls 对应 gp-status-chip 修饰类）
const AUDIT_CHIPS = [
  { state: "match", icon: "mdi:check-circle-outline", cls: "synced", labelKey: "auditMatch" },
  { state: "mismatch", icon: "mdi:alert-circle-outline", cls: "error", labelKey: "auditMismatch" },
  { state: "linkOnly", icon: "mdi:link-variant-off", cls: "behind", labelKey: "auditLinkOnly" },
  { state: "remoteOnly", icon: "mdi:source-branch", cls: "ahead", labelKey: "auditRemoteOnly" },
] as const

// 单元格四态图标 + 颜色类（none 直接渲染占位符）
const STATE_META = {
  match: { icon: "mdi:check-circle", cls: "gp-audit-match", labelKey: "auditMatch" },
  mismatch: { icon: "mdi:alert-circle", cls: "gp-audit-mismatch", labelKey: "auditMismatch" },
  linkOnly: { icon: "mdi:link-variant-off", cls: "gp-audit-linkonly", labelKey: "auditLinkOnly" },
  remoteOnly: { icon: "mdi:source-branch", cls: "gp-audit-remoteonly", labelKey: "auditRemoteOnly" },
} as const

/** 仅展示存在问题的项目行 */
const issueRows = computed(() => props.rows.filter((r) => r.hasIssue))

/** 单元格 tooltip：状态名 + 链接与远程 URL 原文（便于排错） */
function cellTitle(cell: RepoLinkAuditCell): string {
  if (cell.state === "none") { return "" }
  const label = props.i18n[STATE_META[cell.state].labelKey]
  return `${label}\n${props.i18n.auditLinkPrefix}: ${cell.link || "-"}\n${props.i18n.auditRemotePrefix}: ${cell.remoteUrl || "-"}`
}
</script>

<style lang="scss">
@use "../../styles/RepoLinkAuditSection.scss";
@use "../../styles/index.scss";
</style>
