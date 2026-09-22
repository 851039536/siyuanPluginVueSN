<!-- gitPush 提交规则检查视图入口容器（状态编排 + 各功能区块组合 + 修正/删除/批量修正弹窗，纯编排无领域状态） -->
<template>
  <div class="grc-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projects.length === 0"
      icon="mdi:source-repository"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：项目过滤 + 条数选择 + 分析按钮（状态文案由统一工具条承担） -->
      <AnalysisToolbar
        :i18n="i18n"
        :running="analyzing"
        :done="analyzed"
        :analyzed-at="analyzedAt"
        not-run-key="ruleCheckNotRun"
        icon="clipboardCheckOutline"
        :run-text="i18n.auditRun"
        :rerun-text="i18n.auditRerun"
        :aria-label="i18n.ruleCheckView"
        @run="emit('runAnalysis')"
      >
        <template #controls>
          <!-- 项目过滤下拉（"全部项目"/单个项目，切换即过滤统计结果；项目多时可输入搜索） -->
          <Select
            :model-value="projectId"
            class="grc-project-select"
            size="xsmall"
            :options="projectOptions"
            :placeholder="i18n.ruleCheckSelectProject"
            :max-height="200"
            :filterable="projects.length >= 10"
            :filter-placeholder="i18n.searchPlaceholder"
            @change="onProjectChange"
          />
          <!-- 条数选择（tooltip："每项目 {0} 条"） -->
          <CommitCountSelect
            :i18n="i18n"
            :commit-count="commitCount"
            @update-count="emit('updateCount', $event)"
          />
        </template>
      </AnalysisToolbar>

      <!-- 四态门：分析中占位 / 未分析提示 / 已就绪内容 -->
      <AnalysisGate
        :running="analyzing"
        :done="analyzed"
        :not-run-text="i18n.ruleCheckNotRun"
        :running-text="i18n.auditing"
        icon="mdi:clipboard-check-outline"
      >
        <!-- 空状态：分析完成但无提交数据 -->
        <EmptyState
          v-if="stats.totalCommits === 0"
          icon="mdi:source-commit"
          :text="i18n.ruleCheckNoData"
        />

        <template v-else>
          <!-- 总览卡片 + 规则提示 -->
          <RuleCheckOverview
            :i18n="i18n"
            :stats="stats"
          />

          <!-- 违规类型分布 -->
          <ReasonDistributionSection
            :i18n="i18n"
            :stats="stats"
          />

          <!-- 空状态：全部合规 -->
          <EmptyState
            v-if="stats.violationCount === 0"
            icon="mdi:check-decagram"
            :text="i18n.ruleCheckAllCompliant"
          />

          <!-- 不合规提交列表 -->
          <ViolationListSection
            v-else
            :i18n="i18n"
            :stats="stats"
            :scoped="scoped"
            @view-project="emit('viewProject', $event)"
            @open-fix="openFix"
            @open-drop="openDrop"
            @open-batch-fix="openBatchFix"
          />
        </template>
      </AnalysisGate>
    </template>

    <!-- 提交信息修正弹窗（自包含：内部校验 HEAD/工作区并执行 amend） -->
    <CommitFixDialog
      v-if="editingViolation"
      :i18n="i18n"
      :target="editingViolation"
      @close="editingViolation = null"
      @saved="handleFixSaved"
    />

    <!-- 删除历史提交弹窗（与 LOG Tab 共用，自包含：校验 HEAD/merge/祖先/rebase + bundle 备份 + commit-tree 删除） -->
    <DropCommitDialog
      v-if="droppingViolation"
      :i18n="i18n"
      :target="droppingViolation"
      @close="droppingViolation = null"
      @saved="handleDropSaved"
    />

    <!-- 提交信息批量修正弹窗（自包含：多项目/多条违规校验、AI 批量生成、批量保存） -->
    <BatchFixDialog
      v-if="editingBatch"
      :i18n="i18n"
      :targets="editingBatch"
      @close="editingBatch = null"
      @saved="handleBatchSaved"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查视图入口容器（状态编排 + 各功能区块组合 + 修正/删除/批量修正弹窗）
import type { CommitRuleCheckStats, CommitRuleViolation, GitProject } from "../../types"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed, ref } from "vue"
import BatchFixDialog from "../common/BatchFixDialog.vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import DropCommitDialog from "../common/DropCommitDialog.vue"
import EmptyState from "../common/EmptyState.vue"
import AnalysisGate from "../common/AnalysisGate.vue"
import AnalysisToolbar from "../common/AnalysisToolbar.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import Select from "@/components/Select.vue"
import ReasonDistributionSection from "./ReasonDistributionSection.vue"
import RuleCheckOverview from "./RuleCheckOverview.vue"
import ViolationListSection from "./ViolationListSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  stats: CommitRuleCheckStats
  /** 项目列表（供工具栏项目过滤下拉选择） */
  projects: GitProject[]
  /** 当前选中的过滤项目 ID（"" = 全部项目） */
  projectId: string
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: CommitCount
}>()

const emit = defineEmits<{
  /** 不传 = 全量重跑；传单项目 id 或 id 数组 = 仅局部重抓指定项目 */
  runAnalysis: [projectId?: string | string[]]
  updateCount: [n: CommitCount]
  updateProject: [projectId: string]
  viewProject: [projectId: string]
}>()

/** 是否限定到单个项目（违规列表隐藏重复的项目名 chip，减少视觉噪音） */
const scoped = computed(() => !!props.projectId)

/** 项目过滤下拉选项（首项"全部项目"，后续为各项目） */
const projectOptions = computed(() => [
  { value: "", label: props.i18n.ruleCheckAllProjects },
  ...props.projects.map((p) => ({ value: p.id, label: p.name })),
])

/** 项目过滤变更：仅回传字符串（Select 的 change 载荷为宽类型） */
function onProjectChange(v: string | number | boolean | null) {
  if (typeof v === "string") emit("updateProject", v)
}

/** 当前正在编辑的违规提交（null = 未打开弹窗） */
const editingViolation = ref<CommitRuleViolation | null>(null)

/** 当前待删除的违规提交（null = 未打开删除弹窗） */
const droppingViolation = ref<CommitRuleViolation | null>(null)

/** 当前批量修正的违规提交集合（null = 未打开批量弹窗） */
const editingBatch = ref<CommitRuleViolation[] | null>(null)

function openFix(violation: CommitRuleViolation) {
  editingViolation.value = violation
}

/** 打开删除历史提交弹窗（violation 直接传 target 兼容 CommitFixTarget，merge 等场景由弹窗内部拦截） */
function openDrop(violation: CommitRuleViolation) {
  droppingViolation.value = violation
}

/** 打开批量修正弹窗（违规列表按日期降序传入，批量弹窗内按新→旧顺序处理） */
function openBatchFix(violations: CommitRuleViolation[]) {
  editingBatch.value = violations
}

/** 修正成功后关闭弹窗并仅重抓该项目的提交日志（局部刷新，避免全量重跑所有项目） */
function handleFixSaved(projectId: string) {
  editingViolation.value = null
  emit("runAnalysis", projectId)
}

/** 删除成功后关闭弹窗并仅重抓该项目的提交日志（与修正成功同模式局部刷新） */
function handleDropSaved(projectId: string) {
  droppingViolation.value = null
  emit("runAnalysis", projectId)
}

/** 批量修正保存完成：仅重抓受影响项目（数组），弹窗保持打开由"完成"按钮关闭 */
function handleBatchSaved(projectIds: string[]) {
  emit("runAnalysis", projectIds)
}
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
