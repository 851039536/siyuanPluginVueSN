<!-- gitPush 分析条数选择（每项目抓取条数下拉，提交分析与规则检查工具条共用；行数统计视图无此入口） -->
<template>
  <!-- 共享下拉（xsmall 档 = 22px trigger / 10px 字号，与工具条同排按钮同档）；title 经 attrs 落到根元素 -->
  <Select
    :options="options"
    :model-value="String(commitCount)"
    size="xsmall"
    :title="countTitle"
    :aria-label="countTitle"
    @update:model-value="onValueChange"
  />
</template>

<script setup lang="ts">
// gitPush 分析条数选择（每项目抓取条数下拉，提交分析与规则检查工具条共用）
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed } from "vue"
import Select from "@/components/Select.vue"
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"

const props = defineProps<{
  i18n: Record<string, any>
  commitCount: CommitCount
}>()

const emit = defineEmits<{
  updateCount: [n: CommitCount]
}>()

/** 下拉选项：数字直显；"all" 显示 i18n「全部」。值统一为字符串，与 Select 的严格相等判定保持一致 */
const options = computed(() => COMMIT_COUNT_OPTIONS.map((n) => ({
  label: n === "all" ? props.i18n.analysisCommitsAll : String(n),
  value: n === "all" ? "all" : String(n),
})))

/** 选择框 tooltip（数字："每项目 {0} 条"；"all"："每项目全部提交"） */
const countTitle = computed(() =>
  props.commitCount === "all"
    ? props.i18n.analysisCommitsPerProjectAll
    : props.i18n.analysisCommitsPerProject.replace("{0}", String(props.commitCount)),
)

/** 选中变更：回传原类型（"all" 保持字符串，其余还原为数字） */
function onValueChange(value: string | number | boolean | null) {
  const raw = String(value)
  emit("updateCount", raw === "all" ? "all" : Number(raw))
}
</script>
