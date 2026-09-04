<!-- gitPush 统计视图区块通用包裹器（标题 + 计数徽章 + 操作插槽，消除 5 处重复） -->
<template>
  <div class="gp-stats-section">
    <div class="gp-stats-section-title">
      <!-- 区块标题文案（父组件传入 i18n 文本） -->
      {{ title }}
      <span
        v-if="count !== undefined"
        class="gp-stats-section-count"
      >{{ count }}</span>
      <slot name="action" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
// 统计区块包裹器：统一 section 标题/计数结构（5 个区块共用），内容与标题右侧操作经插槽分发
defineProps<{
  /** 区块标题文案（已渲染的 i18n 文本） */
  title: string
  /** 标题右侧计数徽章（undefined 不渲染，0 为合法值仍显示） */
  count?: number
}>()
</script>

<style lang="scss">
@use "../../../styles/StatsPanel.scss";
@use "../../../styles/index.scss";
</style>
