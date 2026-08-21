<!-- gitPush 提交规则检查视图入口容器（状态编排 + 各功能区块组合 + 修正弹窗，纯编排无领域状态） -->
<template>
  <div class="grc-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projectCount === 0"
      icon="mdi:source-repository"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条 -->
      <RuleCheckToolbar
        :i18n="i18n"
        :analyzing="analyzing"
        :analyzed="analyzed"
        :analyzed-at="analyzedAt"
        :commit-count="commitCount"
        @run-analysis="emit('runAnalysis')"
        @update-count="emit('updateCount', $event)"
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
            @view-project="emit('viewProject', $event)"
            @open-fix="openFix"
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
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查视图入口容器（状态编排 + 各功能区块组合 + 修正弹窗）
import type { CommitRuleCheckStats, CommitRuleViolation } from "../../types"
import { ref } from "vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"
import ReasonDistributionSection from "./ReasonDistributionSection.vue"
import RuleCheckOverview from "./RuleCheckOverview.vue"
import RuleCheckToolbar from "./RuleCheckToolbar.vue"
import ViolationListSection from "./ViolationListSection.vue"

defineProps<{
  i18n: Record<string, any>
  stats: CommitRuleCheckStats
  projectCount: number
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: number
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
  viewProject: [projectId: string]
}>()

/** 当前正在编辑的违规提交（null = 未打开弹窗） */
const editingViolation = ref<CommitRuleViolation | null>(null)

function openFix(violation: CommitRuleViolation) {
  editingViolation.value = violation
}

/** 修正成功后关闭弹窗并重新运行分析，刷新违规列表 */
function handleFixSaved() {
  editingViolation.value = null
  emit("runAnalysis")
}
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
