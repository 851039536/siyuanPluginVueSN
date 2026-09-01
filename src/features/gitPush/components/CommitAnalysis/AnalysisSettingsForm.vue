<!-- gitPush 提交分析显示设置表单（共享组件：分析视图 popover 与设置汇总弹窗复用，改动即时派发持久化） -->
<template>
  <div class="gpa-settings-form">
    <!-- 设置项：视图（热力图 / 日历 两段式切换） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："视图" -->
      <span class="gpa-settings-label">{{ i18n.analysisViewLabel }}</span>
      <div class="gpa-settings-seg">
        <button
          class="gpa-settings-seg-btn"
          :class="{ active: viewSettings.view === 'heatmap' }"
          @click="update({ view: 'heatmap' })"
        >{{ i18n.analysisViewHeatmap }}</button>
        <button
          class="gpa-settings-seg-btn"
          :class="{ active: viewSettings.view === 'calendar' }"
          @click="update({ view: 'calendar' })"
        >{{ i18n.analysisViewCalendar }}</button>
      </div>
    </div>

    <!-- 设置项：显示范围（最近一年 / 指定年份至今） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："显示范围" -->
      <span class="gpa-settings-label">{{ i18n.analysisRangeLabel }}</span>
      <select
        class="gpa-settings-select"
        :value="String(viewSettings.range)"
        @change="onRangeChange"
      >
        <!-- 下拉选项："最近一年" -->
        <option value="lastYear">{{ i18n.analysisRangeLastYear }}</option>
        <option
          v-for="y in years"
          :key="y"
          :value="String(y)"
        >{{ i18n.analysisRangeYear.replace("{0}", String(y)) }}</option>
      </select>
    </div>

    <!-- 设置项：每周第一天（周一 / 周日） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："每周第一天" -->
      <span class="gpa-settings-label">{{ i18n.analysisWeekStart }}</span>
      <select
        class="gpa-settings-select"
        :value="String(viewSettings.weekStart)"
        @change="onWeekStartChange"
      >
        <!-- 下拉选项："周一" -->
        <option value="1">{{ i18n.analysisWdMon }}</option>
        <!-- 下拉选项："周日" -->
        <option value="0">{{ i18n.analysisWdSun }}</option>
      </select>
    </div>

    <!-- 设置项：格子颜色（热力主色） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："格子颜色" -->
      <span class="gpa-settings-label">{{ i18n.analysisHeatColor }}</span>
      <input
        type="color"
        class="gp-color-input"
        :value="viewSettings.color"
        :title="viewSettings.color"
        @input="onColorChange"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析显示设置表单（从 CommitAnalysisSettings 提取，供 popover 与设置汇总弹窗复用）
import type { CommitAnalysisViewSettings } from "../../types"

defineProps<{
  i18n: Record<string, any>
  /** 当前显示设置（父级持有，本组件只读展示 + 派发更新） */
  viewSettings: CommitAnalysisViewSettings
  /** 年份选项（数据年份 ∪ 今年 ∪ 已保存年份，降序） */
  years: number[]
}>()

const emit = defineEmits<{
  update: [patch: Partial<CommitAnalysisViewSettings>]
}>()

function update(patch: Partial<CommitAnalysisViewSettings>) {
  emit("update", patch)
}

function onRangeChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  update({ range: v === "lastYear" ? "lastYear" : Number(v) })
}

function onWeekStartChange(e: Event) {
  update({ weekStart: Number((e.target as HTMLSelectElement).value) as 0 | 1 })
}

function onColorChange(e: Event) {
  update({ color: (e.target as HTMLInputElement).value })
}
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisSettings.scss";
@use "../../styles/index.scss";
</style>
