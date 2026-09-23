<!-- 仓库链接一致性区块（统计视图子区块：按需批量比对手动仓库链接与实际 git 远程 URL） -->
<template>
  <StatsSection
    :title="i18n.repoLinkAudit"
    :count="audited ? issueRows.length : undefined"
  >
    <!-- 运行入口就放在本区块标题右侧：审计是区块自己的动作，藏在顶部工具条会让用户找不到 -->
    <template #action>
      <Button
        class="gps-audit-btn"
        variant="ghost"
        size="xsmall"
        dense
        :outlined="audited && !auditing"
        :icon="auditing ? 'loading' : 'linkVariant'"
        :loading="auditing"
        :disabled="auditing"
        :title="audited ? i18n.auditRerun : i18n.auditHint"
        @click="emit('runAudit')"
      >
        {{ audited ? i18n.auditRerun : i18n.auditRun }}
      </Button>
    </template>

    <!-- 未分析提示："点击开始分析，将对所有项目执行 git remote -v 比对" -->
    <div
      v-if="!audited && !auditing"
      class="gps-hint"
    >
      {{ i18n.auditHint }}
    </div>
    <!-- 首轮分析中占位："分析中…" -->
    <div
      v-else-if="!audited"
      class="gps-hint"
    >
      {{ i18n.auditing }}
    </div>

    <template v-else>
      <!-- 四态汇总 chips：一致/不一致/仅配置链接/仅存在远程（hover 显示状态名） -->
      <StatusChipBar :chips="auditChips" />
      <!-- 问题项目表格（仅展示存在不一致/缺失/检测失败的项目） -->
      <PlatformTable
        v-if="issueRows.length > 0"
        :i18n="i18n"
        :rows="issueRows"
        @view-project="emit('viewProject', $event)"
      />
      <!-- 全部一致空态："链接与远程全部一致" -->
      <AllClear
        v-else
        :text="i18n.auditAllMatch"
      />
    </template>
  </StatsSection>
</template>

<script setup lang="ts">
import type {
  PlatformTableRowView,
  RepoLinkAuditCell,
  RepoLinkAuditRow,
  RepoLinkAuditState,
  RepoLinkAuditSummary,
} from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import AllClear from "./common/AllClear.vue"
import PlatformTable from "./common/PlatformTable.vue"
import StatsSection from "./common/StatsSection.vue"
import StatusChipBar from "./common/StatusChipBar.vue"

const props = defineProps<{
  i18n: Record<string, any>
  rows: RepoLinkAuditRow[]
  auditing: boolean
  audited: boolean
  summary: RepoLinkAuditSummary
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  runAudit: []
}>()

// 审计四态元数据（chip 轮廓图标 + 单元格实心图标 + chip 修饰类 + 单元格颜色类 + 状态名 i18n 键；
// linkOnly/remoteOnly 图标本就相同，合并一份配置）
const AUDIT_STATE_META: Record<Exclude<RepoLinkAuditState, "none">, {
  chipIcon: string
  cellIcon: string
  chipCls: string
  cellCls: string
  labelKey: string
}> = {
  match: { chipIcon: "mdi:check-circle-outline", cellIcon: "mdi:check-circle", chipCls: "synced", cellCls: "gps-audit-match", labelKey: "auditMatch" },
  mismatch: { chipIcon: "mdi:alert-circle-outline", cellIcon: "mdi:alert-circle", chipCls: "error", cellCls: "gps-audit-mismatch", labelKey: "auditMismatch" },
  linkOnly: { chipIcon: "mdi:link-variant-off", cellIcon: "mdi:link-variant-off", chipCls: "behind", cellCls: "gps-audit-linkonly", labelKey: "auditLinkOnly" },
  remoteOnly: { chipIcon: "mdi:source-branch", cellIcon: "mdi:source-branch", chipCls: "ahead", cellCls: "gps-audit-remoteonly", labelKey: "auditRemoteOnly" },
}

/** 四态汇总 chips（数值取 summary；label 在此按 i18n 预渲染，chip 组件保持纯展示） */
const auditChips = computed(() =>
  (Object.keys(AUDIT_STATE_META) as Exclude<RepoLinkAuditState, "none">[]).map((state) => ({
    key: state,
    icon: AUDIT_STATE_META[state].chipIcon,
    cls: AUDIT_STATE_META[state].chipCls,
    label: props.i18n[AUDIT_STATE_META[state].labelKey],
    value: props.summary[state],
  })),
)

/** 仅展示存在问题的项目行（视图模型：单元格图标 + tooltip 原文） */
const issueRows = computed<PlatformTableRowView[]>(() =>
  props.rows.filter((r) => r.hasIssue).map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    nameSuffix: r.error ? props.i18n.auditError : "",
    cells: r.cells.map((c) => {
      if (c.state === "none") { return { key: c.key, title: "", icon: "" } }
      const m = AUDIT_STATE_META[c.state]
      return { key: c.key, title: cellTitle(c), icon: m.cellIcon, iconCls: m.cellCls }
    }),
  })),
)

/** 单元格 tooltip：状态名 + 链接与远程 URL 原文（便于排错；none 态不展示） */
function cellTitle(cell: RepoLinkAuditCell): string {
  if (cell.state === "none") { return "" }
  const label = props.i18n[AUDIT_STATE_META[cell.state].labelKey]
  return `${label}\n${props.i18n.auditLinkPrefix}: ${cell.link || "-"}\n${props.i18n.auditRemotePrefix}: ${cell.remoteUrl || "-"}`
}
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
