<!-- gitPush 分析条数选择（每项目抓取条数下拉，提交分析与规则检查工具条共用） -->
<template>
  <select
    class="gp-count-select"
    :value="commitCount"
    :title="i18n.analysisCommitsPerProject.replace('{0}', String(commitCount))"
    @change="onCountChange"
  >
    <option
      v-for="n in COMMIT_COUNT_OPTIONS"
      :key="n"
      :value="n"
    >{{ n }}</option>
  </select>
</template>

<script setup lang="ts">
// gitPush 分析条数选择（每项目抓取条数下拉，提交分析与规则检查工具条共用）
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"

defineProps<{
  i18n: Record<string, any>
  commitCount: number
}>()

const emit = defineEmits<{
  updateCount: [n: number]
}>()

function onCountChange(e: Event) {
  emit("updateCount", Number((e.target as HTMLSelectElement).value))
}
</script>

<style lang="scss">
@use "../../styles/CommitCountSelect.scss";
@use "../../styles/index.scss";
</style>
