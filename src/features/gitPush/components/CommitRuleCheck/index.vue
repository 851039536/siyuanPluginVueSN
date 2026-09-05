<!-- gitPush 提交规则检查视图入口容器（状态编排 + 各功能区块组合 + 修正弹窗，纯编排无领域状态） -->
<template>
  <div class="grc-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projects.length === 0"
      icon="mdi:source-repository"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条 -->
      <RuleCheckToolbar
        :i18n="i18n"
        :projects="projects"
        :project-id="projectId"
        :analyzing="analyzing"
        :analyzed="analyzed"
        :analyzed-at="analyzedAt"
        :commit-count="commitCount"
        @run-analysis="emit('runAnalysis')"
        @update-count="emit('updateCount', $event)"
        @update-project="emit('updateProject', $event)"
      />

      <!-- 首次分析中占位 -->
      <div
        v-if="analyzing && !analyzed"
        class="gp-loading"
      >
        <Loader />
        <!-- 加载中文案："分析中…" -->
        <span class="gp-loading-text">{{ i18n.auditing }}</span>
      </div>

      <!-- 未分析提示 -->
      <EmptyState
        v-else-if="!analyzed"
        icon="mdi:clipboard-check-outline"
        :text="i18n.ruleCheckNotRun"
      />

      <template v-else>
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
            @open-batch-fix="openBatchFix"
          />
        </template>
      </template>
    </template>

    <!-- 提交信息修正弹窗（自包含：内部校验 HEAD/工作区并执行 amend） -->
    <CommitFixDialog
      v-if="editingViolation"
      :i18n="i18n"
      :target="editingViolation"
      @close="editingViolation = null"
      @saved="handleFixSaved"
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
// gitPush 提交规则检查视图入口容器（状态编排 + 各功能区块组合 + 修正弹窗）
import type { CommitRuleCheckStats, CommitRuleViolation, GitProject } from "../../types"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed, ref } from "vue"
import BatchFixDialog from "../common/BatchFixDialog.vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"
import ReasonDistributionSection from "./ReasonDistributionSection.vue"
import RuleCheckOverview from "./RuleCheckOverview.vue"
import RuleCheckToolbar from "./RuleCheckToolbar.vue"
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

/** 当前正在编辑的违规提交（null = 未打开弹窗） */
const editingViolation = ref<CommitRuleViolation | null>(null)

/** 当前批量修正的违规提交集合（null = 未打开批量弹窗） */
const editingBatch = ref<CommitRuleViolation[] | null>(null)

function openFix(violation: CommitRuleViolation) {
  editingViolation.value = violation
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

/** 批量修正保存完成：仅重抓受影响项目（数组），弹窗保持打开由"完成"按钮关闭 */
function handleBatchSaved(projectIds: string[]) {
  emit("runAnalysis", projectIds)
}
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
