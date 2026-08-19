<!-- 通用可折叠区块：chevron + 图标 + 标题 + 状态点/徽标（headerRight slot）+ 折叠体 -->
<template>
  <div class="collapsible-section">
    <button
      class="collapsible-toggle"
      @click="$emit('update:open', !open)"
    >
      <svg
        width="12"
        height="12"
        class="collapsible-chevron"
        :class="{ expanded: open }"
      >
        <use xlink:href="#iconRight"></use>
      </svg>
      <svg
        v-if="icon"
        width="14"
        height="14"
      ><use :xlink:href="icon"></use></svg>
      <span>{{ title }}</span>
      <span
        v-if="statusDot"
        class="collapsible-status-dot"
      ></span>
      <span class="collapsible-header-right">
        <!-- headerRight slot：状态文本 / 评级徽标等靠右内容 -->
        <slot name="headerRight"></slot>
      </span>
    </button>
    <div
      v-if="open"
      class="collapsible-body"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** 折叠头标题 */
  title: string
  /** 标题前图标（Iconify xlink:href，如 "#iconSparkles"） */
  icon?: string
  /** 是否展开（v-model:open 受控） */
  open: boolean
  /** 是否显示加载状态点（primary 色，闪烁动画） */
  statusDot?: boolean
}>()

defineEmits<{
  (e: "update:open", value: boolean): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/CollapsibleSection.scss" as *;
@use "../styles/index.scss" as *;
</style>
