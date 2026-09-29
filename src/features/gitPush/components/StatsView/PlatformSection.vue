<!-- gitPush 统计视图平台区块（覆盖率行内汇总 + 一致性问题汇总 + 每项目平台配置/一致性矩阵） -->
<template>
  <StatsSection
    :title="i18n.platformStatus"
    :count="issueCount > 0 ? issueCount : undefined"
  >
    <!-- 覆盖率行内汇总：原独立条形区块与矩阵表头重复表达同一份 PLATFORM_META，
         改为紧贴表头的一行紧凑统计（平台图标 + 已配置数 / 总数），矩阵单元格仍是明细真源 -->
    <div class="gps-coverage">
      <span
        v-for="c in coverageItems"
        :key="c.key"
        class="gps-coverage-item"
        :title="c.counts"
      >
        <Icon
          :icon="c.icon"
          height="12"
          class="gps-coverage-icon"
          :class="`gps-coverage-icon--${c.key}`"
        />
        <span class="gps-coverage-value">{{ c.count }}</span>
        <span class="gps-coverage-label">{{ c.label }}</span>
      </span>
    </div>

    <!-- 一致性问题汇总：仅在后台校验发现不一致/缺失/失败时出现；链接与远程全部一致则不占视觉空间 -->
    <div
      v-if="!auditing && issueCount > 0"
      class="gps-status-bar"
    >
      <div
        v-for="chip in issueChips"
        :key="chip.key"
        class="gps-status-chip"
        :class="`gps-status-chip--${chip.cls}`"
        :title="chip.label"
      >
        <Icon
          :icon="chip.icon"
          height="12"
        />
        <span>{{ chip.value }}</span>
        <span class="gps-status-chip-label">{{ chip.label }}</span>
      </div>
    </div>

    <!-- 每项目平台矩阵（单元格：已配置/未配置 + 链接与实际远程一致性校验态） -->
    <PlatformTable
      v-if="platformRows.length > 0"
      :i18n="i18n"
      :rows="platformRows"
      @view-project="emit('viewProject', $event)"
    />
    <!-- 空态：所有平台均配置完整且链接一致（无待处理项目行） -->
    <AllClear
      v-else
      :text="i18n.allClear"
    />
  </StatsSection>
</template>

<script setup lang="ts">
// 平台区块：把「远程覆盖率」「平台配置状态」「仓库链接一致性」合并为一个区块——
// 三者是同一份 PLATFORM_META 上的三种切面，一致性校验结果直接叠在矩阵单元格上。
// 覆盖率原为独立条形区块（与矩阵表头重复表达同一份平台清单），现收敛为表头上方一行紧凑统计。
import type { PlatformTableRowView, RepoLinkAuditRow, RepoLinkAuditState, StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META } from "../../types"
import AllClear from "./common/AllClear.vue"
import PlatformTable from "./common/PlatformTable.vue"
import StatsSection from "./common/StatsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 remoteCoverage + projectCount + platformStatusProjects） */
  stats: StatsView
  /** 项目 id → 链接一致性校验行（useRepoLinkAudit 产出，自动后台执行） */
  auditRows: Record<string, RepoLinkAuditRow>
  /** 校验进行中（进行中不显示问题计数，避免展示上一轮的过期数字） */
  auditing: boolean
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 覆盖率条目：四个平台（PLATFORM_META 投影）+ 多远程合计（key 同时作为图标色修饰类后缀） */
const coverageItems = computed(() => {
  const total = props.stats.projectCount
  const platformItems = PLATFORM_META.map((pm) => {
    const count = props.stats.remoteCoverage[pm.key]
    return { key: pm.key, icon: pm.icon, label: pm.label, count, counts: `${count} / ${total}` }
  })
  const multiple = props.stats.remoteCoverage.multiple
  return [
    ...platformItems,
    // 多远程项目条目："多远程项目"
    { key: "multi", icon: "mdi:layers", label: props.i18n.multipleRemotes, count: multiple, counts: `${multiple} / ${total}` },
  ]
})

// ── 一致性校验态（叠加在平台矩阵单元格上）──
// 四态图标由 useRepoLinkAudit 归一化比对后给出（match/mismatch/linkOnly/remoteOnly），
// 单元格在此之上还要处理 none（该平台链接与远程都没有，回落为纯「未配置」灰点）。
const AUDIT_CELL_META: Record<Exclude<RepoLinkAuditState, "none">, { icon: string, iconCls: string, labelKey: string }> = {
  match: { icon: "mdi:check-circle", iconCls: "gps-audit-match", labelKey: "auditMatch" },
  mismatch: { icon: "mdi:alert-circle", iconCls: "gps-audit-mismatch", labelKey: "auditMismatch" },
  linkOnly: { icon: "mdi:link-variant-off", iconCls: "gps-audit-linkonly", labelKey: "auditLinkOnly" },
  remoteOnly: { icon: "mdi:source-branch", iconCls: "gps-audit-remoteonly", labelKey: "auditRemoteOnly" },
}

// 问题汇总 chip 配置（仅显示确实有问题的三类；一致项数量巨大且无行动价值，不占位置）
const ISSUE_CHIPS = [
  { key: "mismatch", icon: "mdi:alert-circle-outline", cls: "error", labelKey: "auditMismatch" },
  { key: "linkOnly", icon: "mdi:link-variant-off", cls: "behind", labelKey: "auditLinkOnly" },
  { key: "remoteOnly", icon: "mdi:source-branch", cls: "ahead", labelKey: "auditRemoteOnly" },
] as const

/** 存在一致性问题的项目数（一个项目多个平台有问题只计一次） */
const issueCount = computed(() =>
  Object.values(props.auditRows).filter((r) => r.hasIssue).length,
)

/** 问题分类计数（跨全部项目的全部平台单元格；hover 显示状态名） */
const issueChips = computed(() => {
  const counts: Record<string, number> = { mismatch: 0, linkOnly: 0, remoteOnly: 0 }
  for (const row of Object.values(props.auditRows)) {
    for (const c of row.cells) {
      if (c.state !== "none" && c.state !== "match") { counts[c.state]++ }
    }
  }
  return ISSUE_CHIPS.map((c) => ({
    key: c.key,
    icon: c.icon,
    cls: c.cls,
    label: props.i18n[c.labelKey],
    value: counts[c.key],
  }))
})

/** 单元格 tooltip：校验态名称 + 链接与远程原文（排错必需；无校验结果时回落到已配置/未配置） */
function cellTitle(cell: { state: RepoLinkAuditState, link: string, remoteUrl: string }): string {
  const label = cell.state === "none"
    ? (cell.link ? props.i18n.configured : props.i18n.notConfigured)
    : props.i18n[AUDIT_CELL_META[cell.state].labelKey]
  return `${label}\n${props.i18n.auditLinkPrefix}: ${cell.link || "-"}\n${props.i18n.auditRemotePrefix}: ${cell.remoteUrl || "-"}`
}

// 平台状态行视图模型：单元格图标与 tooltip 在此预计算，模板只做渲染。
// 校验结果到达后单元格从「已配置/未配置」升级为四态校验图标（一致/不一致/仅链接/仅远程）。
const platformRows = computed<PlatformTableRowView[]>(() =>
  props.stats.platformStatusProjects.map((item) => {
    const audit = props.auditRows[item.project.id]
    return {
      id: item.project.id,
      name: item.project.name,
      path: item.project.path,
      nameSuffix: audit?.error ? props.i18n.auditError : "",
      cells: PLATFORM_META.map((pm) => {
        const ok = item[pm.key]
        const cell = audit?.cells.find((c) => c.key === pm.key)
        // 有可比对信息（校验态非 none）→ 用四态图标；否则回落为「已配置/未配置」
        const state = cell && cell.state !== "none" ? cell.state : null
        return {
          key: pm.key,
          title: cell ? cellTitle(cell) : (ok ? props.i18n.configured : props.i18n.notConfigured),
          icon: state ? AUDIT_CELL_META[state].icon : (ok ? "mdi:check-circle" : "mdi:close-circle-outline"),
          iconCls: state ? AUDIT_CELL_META[state].iconCls : (ok ? "gps-platform-ok" : "gps-platform-missing"),
        }
      }),
    }
  }),
)
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
