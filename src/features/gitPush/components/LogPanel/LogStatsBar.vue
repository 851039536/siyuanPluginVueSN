<!-- gitPush 操作日志状态统计条（按操作类型聚合成功/失败计数，与筛选解耦） -->
<template>
  <div
    v-if="stats.length"
    class="gp-log-stats"
  >
    <template
      v-for="(s, i) in stats"
      :key="s.key"
    >
      <!-- 单个操作类型统计："推送 12✓/2✗" -->
      <span class="gp-log-stat">
        <span class="gp-log-stat-label">{{ s.label }}</span>
        <span class="gp-log-stat-ok">{{ s.ok }}✓</span>
        <span
          v-if="s.fail > 0"
          class="gp-log-stat-fail"
        >{{ s.fail }}✗</span>
      </span>
      <!-- 类型间分隔圆点 -->
      <span
        v-if="i < stats.length - 1"
        class="gp-log-stat-sep"
      >·</span>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志状态统计条（按操作类型聚合成功/失败计数，纯展示）
export interface LogStatItem {
  key: string
  label: string
  ok: number
  fail: number
}

defineProps<{
  /** 按操作类型聚合的成功/失败计数（入口 index.vue 基于全量日志 computed 产出） */
  stats: LogStatItem[]
}>()
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
