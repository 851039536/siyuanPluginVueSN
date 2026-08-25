<!-- 下拉面板通用外壳：触发按钮 + 弹出面板 + 点击外部关闭，供同级/下级/反链三个下拉组件复用 -->
<template>
  <div
    class="doc-nav-dropdown"
    ref="rootRef"
  >
    <!-- 下拉触发按钮 -->
    <button
      class="doc-nav-dropdown-trigger"
      :class="{ 'doc-nav-dropdown-trigger-open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      @click="handleTriggerClick"
    >
      <IconWrapper
        :name="triggerIcon"
        size="14"
        aria-hidden="true"
      />
      <span class="doc-nav-dropdown-trigger-text">{{ triggerText }} ({{ count }})</span>
      <IconWrapper
        name="chevronDown"
        class="doc-nav-dropdown-caret"
        size="12"
        aria-hidden="true"
      />
    </button>

    <!-- 下拉面板：头部标题 + 插槽内容 -->
    <Transition name="doc-nav-dropdown-fade">
      <div
        v-if="isOpen"
        class="doc-nav-dropdown-panel"
        :role="panelRole"
        :aria-label="panelAriaLabel"
      >
        <div class="doc-nav-dropdown-header">{{ panelTitle }}</div>
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { IconKey } from "@/config/icons"
import { useClickOutside } from "../composables/useClickOutside"

withDefaults(defineProps<{
  /** 触发按钮图标名（docNavSiblings / docNavChildren / docNavBacklink 等） */
  triggerIcon: IconKey
  /** 触发按钮文字 */
  triggerText: string
  /** 面板计数（显示为 "文字 (N)"） */
  count: number
  /** 面板角色（listbox / tree） */
  panelRole: string
  /** 面板无障碍标签 */
  panelAriaLabel: string
  /** 面板头部标题 */
  panelTitle: string
}>(), {
  panelRole: "listbox",
})

const emit = defineEmits<{
  /** 面板开合状态变化（true=打开），父组件可在打开时重置内部状态 */
  (event: "toggle", isOpen: boolean): void
}>()

const isOpen = ref(false)
const rootRef = useClickOutside(isOpen)

function handleTriggerClick(): void {
  isOpen.value = !isOpen.value
  emit("toggle", isOpen.value)
}
</script>

<style scoped lang="scss">
@use "../styles/dropdown-shell";
@use "../styles/index.scss";
</style>
