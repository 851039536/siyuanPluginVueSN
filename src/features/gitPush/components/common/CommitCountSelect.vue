<!-- gitPush 分析条数选择（每项目抓取条数下拉，提交分析与规则检查工具条共用） -->
<template>
  <select
    class="gp-count-select"
    :value="commitCount"
    :title="countTitle"
    @change="onCountChange"
  >
    <option
      v-for="n in COMMIT_COUNT_OPTIONS"
      :key="String(n)"
      :value="n"
    >{{ countLabel(n) }}</option>
  </select>
</template>

<script setup lang="ts">
// gitPush 分析条数选择（每项目抓取条数下拉，提交分析与规则检查工具条共用）
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed } from "vue"
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"

const props = defineProps<{
  i18n: Record<string, any>
  commitCount: CommitCount
}>()

const emit = defineEmits<{
  updateCount: [n: CommitCount]
}>()

/** 选项显示文案：数字直显；"all" 显示 i18n「全部」 */
function countLabel(n: CommitCount): string {
  return n === "all" ? props.i18n.analysisCommitsAll : String(n)
}

/** 选择框 tooltip（数字："每项目 {0} 条"；"all"："每项目全部提交"） */
const countTitle = computed(() =>
  props.commitCount === "all"
    ? props.i18n.analysisCommitsPerProjectAll
    : props.i18n.analysisCommitsPerProject.replace("{0}", String(props.commitCount)),
)

function onCountChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit("updateCount", v === "all" ? "all" : Number(v))
}
</script>

<style lang="scss">
@use "../../styles/CommitCountSelect.scss";
@use "../../styles/index.scss";
</style>
