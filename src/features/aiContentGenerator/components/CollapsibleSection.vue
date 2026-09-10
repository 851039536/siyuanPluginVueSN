<!-- 通用可折叠区块：chevron + 图标 + 标题 + 状态点/徽标（headerRight slot）+ 折叠体 -->
<template>
  <div class="collapsible-section">
    <!-- 折叠头：整行可点击展开/收起（aria-expanded 暴露展开态，aria-controls 关联折叠体） -->
    <button
      class="collapsible-toggle"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="$emit('update:open', !open)"
    >
      <IconWrapper
        name="chevronRight"
        :size="12"
        class="collapsible-chevron"
        :class="{ expanded: open }"
      />
      <IconWrapper
        v-if="icon"
        :name="icon"
        :size="14"
      />
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
      :id="bodyId"
      class="collapsible-body"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import { useId } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  /** 折叠头标题 */
  title: string
  /** 标题前图标（src/config/icons.ts 已注册的 IconKey） */
  icon?: IconKey
  /** 是否展开（v-model:open 受控） */
  open: boolean
  /** 是否显示加载状态点（primary 色，闪烁动画） */
  statusDot?: boolean
}>()

defineEmits<{
  (e: "update:open", value: boolean): void
}>()

/** 折叠体 id（aria-controls 关联用，避免同页多实例 id 冲突） */
const bodyId = `ai-collapsible-body-${useId()}`
</script>

<style scoped lang="scss">
@use "../styles/CollapsibleSection.scss" as *;
@use "../styles/index.scss" as *;
</style>
