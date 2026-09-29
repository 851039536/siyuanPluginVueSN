<!-- gitPush 统计视图区块通用包裹器（标题 + 计数徽章 + 操作插槽，与提交分析 .gpa-section 同构） -->
<template>
  <div class="gps-section">
    <div class="gps-section-title">
      <!-- 区块标题文案（父组件传入 i18n 文本） -->
      {{ title }}
      <!-- 计数徽章（走共享 Tag，与提交分析区块计数同构；undefined 不渲染，0 为合法值仍显示） -->
      <Tag
        v-if="count !== undefined"
        class="gps-section-count"
        variant="primary"
        size="xsmall"
        shape="square"
      >{{ count }}</Tag>
      <slot name="action" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
// 统计区块包裹器：统一 section 标题/计数结构（各区块共用），内容与标题右侧操作经插槽分发。
// 内容区自身滚动由各区块内部的表格容器（.gps-table-wrap 限高）承担，包裹器不再设 scroll 开关。
import Tag from "@/components/Tag.vue"

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
