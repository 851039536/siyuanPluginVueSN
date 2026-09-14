<!-- gitPush 提交规则检查顶部工具条（项目过滤 + 分析状态 + 条数选择 + 分析按钮） -->
<template>
  <!-- 顶部工具条：第一行项目过滤 + 条数选择 + 分析按钮；第二行分析状态 -->
  <div class="grc-toolbar">
    <div class="grc-toolbar-row">
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
      <!-- 按钮文案："开始分析"/"重新分析"（共享 Button：分析中由 loading 转圈、自动禁用并保持按钮宽度） -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="clipboardCheckOutline"
        :loading="analyzing"
        :disabled="analyzing"
        @click="emit('runAnalysis')"
      >
        {{ analyzed ? i18n.auditRerun : i18n.auditRun }}
      </Button>
    </div>
    <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
    <span class="grc-status">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查顶部工具条（项目过滤 + 分析状态 + 条数选择 + 分析按钮）
import type { GitProject } from "../../types"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import { analysisStatusText } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目列表（供下拉选择，含全部项目） */
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
  runAnalysis: []
  updateCount: [n: CommitCount]
  updateProject: [projectId: string]
}>()

/** 项目过滤下拉选项（首项"全部项目"，后续为各项目） */
const projectOptions = computed(() => [
  { value: "", label: props.i18n.ruleCheckAllProjects },
  ...props.projects.map((p) => ({ value: p.id, label: p.name })),
])

/** 分析状态文案（与提交分析工具条共用统一逻辑，notRunKey 区分未分析提示） */
const statusText = computed(() => analysisStatusText({
  analyzing: props.analyzing,
  analyzed: props.analyzed,
  analyzedAt: props.analyzedAt,
  i18n: props.i18n,
  notRunKey: "ruleCheckNotRun",
}))

function onProjectChange(v: string | number | boolean | null) {
  if (typeof v === "string") emit("updateProject", v)
}
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
