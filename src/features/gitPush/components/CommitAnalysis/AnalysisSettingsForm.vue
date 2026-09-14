<!-- gitPush 提交分析显示设置表单（控件走共享库：视图分段/范围/周起始/格子颜色，popover 与设置汇总弹窗复用） -->
<template>
  <div class="gpa-settings-form">
    <!-- 设置项：视图（热力图 / 日历 两段式切换；互斥选项用 Button 分组 + aria-pressed） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："视图" -->
      <span class="gpa-settings-label">{{ i18n.analysisViewLabel }}</span>
      <div class="gpa-settings-seg">
        <Button
          class="gpa-settings-seg-btn"
          variant="ghost"
          size="xsmall"
          dense
          :aria-pressed="viewSettings.view === 'heatmap'"
          @click="update({ view: 'heatmap' })"
        >{{ i18n.analysisViewHeatmap }}</Button>
        <Button
          class="gpa-settings-seg-btn"
          variant="ghost"
          size="xsmall"
          dense
          :aria-pressed="viewSettings.view === 'calendar'"
          @click="update({ view: 'calendar' })"
        >{{ i18n.analysisViewCalendar }}</Button>
      </div>
    </div>

    <!-- 设置项：显示范围（最近一年 / 指定年份至今） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："显示范围" -->
      <span class="gpa-settings-label">{{ i18n.analysisRangeLabel }}</span>
      <Select
        class="gpa-settings-select"
        :model-value="String(viewSettings.range)"
        size="xsmall"
        :options="rangeOptions"
        :aria-label="i18n.analysisRangeLabel"
        @change="onRangeChange"
      />
    </div>

    <!-- 设置项：每周第一天（周一 / 周日） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："每周第一天" -->
      <span class="gpa-settings-label">{{ i18n.analysisWeekStart }}</span>
      <Select
        class="gpa-settings-select"
        :model-value="String(viewSettings.weekStart)"
        size="xsmall"
        :options="weekStartOptions"
        :aria-label="i18n.analysisWeekStart"
        @change="onWeekStartChange"
      />
    </div>

    <!-- 设置项：格子颜色（热力主色；共享 ColorField 自绘调色板，思源下原生取色器不弹窗） -->
    <div class="gpa-settings-row">
      <!-- 设置项标签："格子颜色" -->
      <span class="gpa-settings-label">{{ i18n.analysisHeatColor }}</span>
      <ColorField
        :model-value="colorDraft"
        placeholder="#4a90d9"
        @update:model-value="colorDraft = $event"
        @change="commitColor"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析显示设置表单（从 CommitAnalysisSettings 提取，供 popover 与设置汇总弹窗复用）
import type { CommitAnalysisViewSettings } from "../../types"
import { computed, ref, watch } from "vue"
import Button from "@/components/Button.vue"
import ColorField from "@/components/ColorField.vue"
import Select from "@/components/Select.vue"

const props = defineProps<{
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

/** 显示范围选项（"最近一年" + 各年份）：值统一为字符串，与 viewSettings.range 的字符串分支一致 */
const rangeOptions = computed(() => [
  { value: "lastYear", label: props.i18n.analysisRangeLastYear },
  ...props.years.map((y) => ({
    value: String(y),
    label: String(props.i18n.analysisRangeYear).replace("{0}", String(y)),
  })),
])

/** 每周第一天选项（周一 = 1 / 周日 = 0，与 CommitAnalysisViewSettings.weekStart 的取值同源） */
const weekStartOptions = computed(() => [
  { value: "1", label: props.i18n.analysisWdMon },
  { value: "0", label: props.i18n.analysisWdSun },
])

function onRangeChange(v: string | number | boolean | null) {
  if (typeof v !== "string") return
  update({ range: v === "lastYear" ? "lastYear" : Number(v) })
}

function onWeekStartChange(v: string | number | boolean | null) {
  if (typeof v !== "string") return
  update({ weekStart: Number(v) as 0 | 1 })
}

/**
 * 颜色草稿：ColorField 的 update:modelValue 逐字触发（仅改本地草稿），
 * change（文本 blur/回车、调色板选色）才向上派发。
 * 不直接写 viewSettings：父级 updateViewSettings 每次调用都会写一次存储，逐字派发等于逐字写盘。
 */
const colorDraft = ref(props.viewSettings.color)

watch(() => props.viewSettings.color, (v) => {
  colorDraft.value = v
})

function commitColor() {
  if (colorDraft.value === props.viewSettings.color) return
  update({ color: colorDraft.value })
}
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisSettings.scss";
@use "../../styles/index.scss";
</style>
