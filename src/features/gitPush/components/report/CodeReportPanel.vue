<!-- gitPush 代码统计报告面板：项目/时间范围选择 + 3 分区 Tab（团队总览[含代码贡献度]/技术债务/代码热点） -->
<template>
  <div class="gpr-panel">
    <!-- 无项目空状态 -->
    <EmptyState
      v-if="projects.length === 0"
      icon="mdi:chart-box"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：项目下拉 + 时间范围下拉 + 生成按钮 -->
      <div class="gpr-toolbar">
        <!-- 项目选择（model-value 为只读 prop，更新经 @change → changeProject 事件） -->
        <Select
          :model-value="projectId"
          class="gpr-project-select"
          size="small"
          :options="projectOptions"
          :placeholder="i18n.reportSelectProject"
          @change="onProjectChange"
        />
        <!-- 时间范围选择 -->
        <Select
          :model-value="range"
          class="gpr-range-select"
          size="small"
          :options="rangeOptions"
          @change="onRangeChange"
        />
        <!-- 生成/重新生成按钮（生成中图标转圈） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gpr-run-btn"
          :disabled="running"
          :title="i18n.reportRunHint"
          @click="emit('runReport')"
        >
          <Icon
            icon="mdi:chart-box"
            height="12"
            :class="{ 'gp-spin': running }"
          />
          {{ generated ? i18n.reportRerun : i18n.reportRun }}
        </button>
      </div>

      <!-- 生成中占位（首次） -->
      <div
        v-if="running && !generated"
        class="gp-loading"
      >
        <Loader />
        <!-- 加载中文案："分析中…" -->
        <span class="gp-loading-text">{{ i18n.reportRunning }}</span>
      </div>

      <!-- 尚未生成提示（进入视图后自动生成前的占位，与 analysisNotRun 模式一致） -->
      <EmptyState
        v-else-if="!generated"
        icon="mdi:chart-box"
        :text="i18n.reportNotRun"
      />

      <!-- 失败提示（git 命令失败：路径无效/非 git 仓库） -->
      <div
        v-else-if="!report.ok"
        class="gpr-fail"
      >
        <Icon
          icon="mdi:alert-circle-outline"
          height="14"
        />
        <span>{{ i18n.reportFailed }}</span>
      </div>

      <!-- 空数据提示（命令成功但范围内无提交/无文件，如全新仓库） -->
      <EmptyState
        v-else-if="report.totalCommits === 0"
        icon="mdi:chart-box"
        :text="i18n.reportNoData"
      />

      <template v-else>
        <!-- 生成信息行：生成时间 + 时间范围 + 数据源概况 -->
        <div class="gpr-meta">
          <span
            class="gpr-meta-item"
            :title="report.generatedAt"
          >{{ i18n.reportGenerated.replace("{0}", relativeTime(report.generatedAt, i18n)) }}</span>
          <span class="gpr-meta-item">{{ i18n.reportRangeLabel.replace("{0}", report.rangeLabel) }}</span>
          <span class="gpr-meta-item">{{ i18n.reportFilesAnalyzed.replace("{0}", String(report.analyzedFiles)) }}</span>
        </div>

        <!-- 分区 Tab 栏（团队总览[含代码贡献度]/技术债务/代码热点） -->
        <div class="gpr-tabs">
          <button
            v-for="tab in reportTabs"
            :key="tab.id"
            class="gpr-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <Icon
              :icon="tab.icon"
              height="12"
            />
            {{ i18n[tab.labelKey] }}
            <span
              v-if="tab.count > 0"
              class="gpr-tab-count"
            >{{ tab.count }}</span>
          </button>
        </div>

        <!-- 分区内容（v-show 保留各分区内部状态；团队总览与代码贡献度合并展示：KPI 卡片 + 作者排行表） -->
        <TeamOverviewSection
          v-show="activeTab === 'overview'"
          :i18n="i18n"
          :report="report"
        />
        <AuthorContributionSection
          v-show="activeTab === 'overview'"
          :i18n="i18n"
          :authors="report.authors"
        />
        <TechDebtSection
          v-show="activeTab === 'debt'"
          :i18n="i18n"
          :report="report"
          :project="currentProject"
        />
        <HotspotSection
          v-show="activeTab === 'hotspot'"
          :i18n="i18n"
          :report="report"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// 代码统计报告面板：项目/时间范围选择 + 3 分区 Tab（团队总览[含代码贡献度]/技术债务/代码热点）
import type { CodeReportData, GitProject, ReportRange } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { REPORT_RANGE_LABEL_KEYS, REPORT_RANGES } from "../../types"
import { relativeTime } from "../../utils"
import { countDebtFiles } from "../../reportMetrics"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"
import Select from "@/components/Select.vue"
import TeamOverviewSection from "./TeamOverviewSection.vue"
import AuthorContributionSection from "./AuthorContributionSection.vue"
import TechDebtSection from "./TechDebtSection.vue"
import HotspotSection from "./HotspotSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（useCodeReport 产出） */
  report: CodeReportData
  /** 生成中标记 */
  running: boolean
  /** 是否已生成过至少一轮 */
  generated: boolean
  /** 项目列表（含归档，用于下拉选择） */
  projects: GitProject[]
  /** 当前选中项目 ID */
  projectId: string
  /** 时间范围 */
  range: ReportRange
}>()

const emit = defineEmits<{
  runReport: []
  changeProject: [id: string]
  changeRange: [r: ReportRange]
}>()

/** 分区 Tab 类型（团队总览已合并代码贡献度） */
type ReportTabId = "overview" | "debt" | "hotspot"

/** 分区 Tab 配置（labelKey 为 i18n 键，count 为分区条数徽章：总览=贡献作者数，债务=问题数，热点=分析文件数） */
const reportTabs = computed<ReadonlyArray<{ id: ReportTabId, labelKey: string, icon: string, count: number }>>(() => [
  { id: "overview", labelKey: "reportTabOverview", icon: "mdi:account-group", count: props.report.authors.length },
  { id: "debt", labelKey: "reportTabDebt", icon: "mdi:alert-octagon-outline", count: countDebtFiles(props.report.debtSummary) },
  { id: "hotspot", labelKey: "reportTabHotspot", icon: "mdi:fire", count: props.report.analyzedFiles },
])

/** 当前分区 Tab */
const activeTab = ref<ReportTabId>("overview")

/** 当前选中项目（选中项优先，未选中或已删除回退首个项目；与 useCodeReport 同一回退逻辑，供 TechDebtSection LOC 懒加载） */
const currentProject = computed<GitProject | null>(() => {
  if (props.projects.length === 0) return null
  const selected = props.projects.find((p) => p.id === props.projectId)
  return selected ?? props.projects[0]
})

/** 项目下拉选项（名称，路径在编辑弹窗可见） */
const projectOptions = computed(() =>
  props.projects.map((p) => ({ value: p.id, label: p.name })),
)

/** 时间范围下拉选项（直接由 REPORT_RANGES 单一数据源派生，避免双源漂移） */
const rangeOptions = computed(() =>
  REPORT_RANGES.map((r) => ({
    value: r.value,
    label: props.i18n[REPORT_RANGE_LABEL_KEYS[r.value]],
  })),
)

function onProjectChange(v: string | number | boolean | null) {
  if (typeof v === "string") emit("changeProject", v)
}

function onRangeChange(v: string | number | boolean | null) {
  if (typeof v === "string") emit("changeRange", v as ReportRange)
}
</script>

<style lang="scss">
@use "../../styles/CodeReportPanel.scss";
@use "../../styles/index.scss";
</style>
