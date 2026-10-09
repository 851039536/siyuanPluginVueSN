<!-- gitPush 操作日志逐平台结果列表（表格行展开区 / 详情弹窗共用同一渲染与 ✓—✗ 口径） -->
<template>
  <div class="gp-log-platforms">
    <div
      v-for="p in platforms"
      :key="p.key"
      class="gp-log-platform-item"
    >
      <!-- 三态标记：成功 ✓ / 跳过 — / 失败 ✗（口径单一真源，故提出为共享组件） -->
      <span
        class="gp-log-platform-mark"
        :class="markClass(p)"
      >{{ markText(p) }}</span>
      <span class="gp-log-platform-label">{{ p.label }}</span>
      <span
        v-if="p.skipped"
        class="gp-log-platform-skip"
      >{{ i18n.opSkipped }}</span>
      <span class="gp-log-platform-summary">{{ p.summary }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志逐平台结果列表：收敛 LogTableRow 与 LogDetailDialog 两处逐字相同的
// 「✓/—/✗ + label + skipped + summary」渲染（原两处连三元表达式都相同，仅外层 class 前缀不同）。
// 样式沿用既有的 .gp-log-platform-* 类名，故观感不变。
import type { GitOpLogPlatform } from "../../types"

defineProps<{
  i18n: Record<string, any>
  /** 逐平台结果（push/pull 条目才有） */
  platforms: GitOpLogPlatform[]
}>()

/** 平台结果三态文本（成功 / 跳过 / 失败） */
function markText(p: GitOpLogPlatform): string {
  return p.ok ? "✓" : p.skipped ? "—" : "✗"
}

/** 平台结果三态配色修饰类（复用既有的 gp-log-dot--* 语义色） */
function markClass(p: GitOpLogPlatform): string {
  return p.ok ? "gp-log-dot--ok" : p.skipped ? "gp-log-dot--skip" : "gp-log-dot--fail"
}
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
