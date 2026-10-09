<!-- gitPush 提交分析水平条形行（标签 + 轨道 + 填充 + 计数，作者排行/内容类型分布共用） -->
<template>
  <div class="gpa-bar-row">
    <!-- 标签（超长省略，完整文本见 hover） -->
    <span
      class="gpa-bar-label"
      :title="label"
    >{{ label }}</span>
    <span class="gpa-bar-track">
      <span
        class="gpa-bar-fill"
        :style="{ width: pct, background: color }"
      />
    </span>
    <span class="gpa-bar-num">{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析水平条形行：收敛 AuthorTypeSection 内「作者排行 / 内容类型分布」两份逐字相同的
// 标签 + 轨道 + 填充 + 计数结构（差异仅 fill 的 background 来源）。
// 样式仍沿用既有的 .gpa-bar-* 类名（CommitAnalysisPanel.scss），故零样式改动、观感不变。
withDefaults(defineProps<{
  /** 行标签（已渲染的 i18n 文本或作者名） */
  label: string
  /** 条形宽度（相对最大值的百分比，withBarPct 预计算） */
  pct: string
  /** 计数（行尾等宽数字） */
  count: number
  /** 填充色（可选；不传则沿用 .gpa-bar-fill 的默认主题色，内容类型分布按类型色传入） */
  color?: string
}>(), {
  color: undefined,
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
