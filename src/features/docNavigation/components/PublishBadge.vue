<!-- 发布状态徽章：文字触发（已发布/未发布），悬停/点击展开显示所有发布平台 -->
<template>
  <div
    ref="rootRef"
    class="doc-nav-publish-badge"
    @mouseenter="handleEnter"
    @mouseleave="handleLeave"
  >
    <!-- 发布状态触发文字：已发布（绿）/ 未发布（灰） -->
    <button
      class="doc-nav-publish-trigger"
      :class="isPublished ? 'is-published' : 'is-unpublished'"
      type="button"
      :aria-expanded="isOpen"
      :title="i18n.docNavShowPublishStatus"
      @click.stop="handleToggle"
    >
      {{ isPublished ? i18n.docNavPublished : i18n.docNavUnpublished }}
    </button>

    <!-- 发布平台浮层：悬停/点击展开 -->
    <Transition name="doc-nav-publish-fade">
      <div
        v-if="isOpen"
        class="doc-nav-publish-panel"
        role="tooltip"
        aria-label="发布平台"
      >
        <!-- 面板标题："发布平台" -->
        <div class="doc-nav-publish-panel-title">{{ i18n.docNavPublishPlatforms }}</div>
        <!-- 平台列表：每个已发布平台一行 -->
        <ul
          v-if="isPublished"
          class="doc-nav-publish-panel-list"
        >
          <li
            v-for="name in publishedPlatforms"
            :key="name"
            class="doc-nav-publish-panel-item"
          >{{ name }}</li>
        </ul>
        <!-- 未发布：显示"未发布" -->
        <div
          v-else
          class="doc-nav-publish-panel-empty"
        >{{ i18n.docNavUnpublished }}</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue"
import { useClickOutside } from "../composables/useClickOutside"

const props = defineProps<{
  /** 已发布到的平台显示名列表（空数组表示未发布） */
  publishedPlatforms: string[]
  /** 功能 i18n（平铺在 plugin.i18n 顶层） */
  i18n: Record<string, string>
}>()

/** 是否已发布（有任一平台） */
const isPublished = computed(() => props.publishedPlatforms.length > 0)

const isOpen = ref(false)
/** 点击锁定状态：锁定后悬停离开不关闭面板，直到点击图标或点击外部 */
const locked = ref(false)
const rootRef = useClickOutside(isOpen)

/** 外部点击关闭（isOpen 变 false）时同步解除锁定，恢复悬停开合 */
watch(isOpen, (v) => {
  if (!v) locked.value = false
})

/** 悬停打开（未锁定时） */
function handleEnter(): void {
  if (!locked.value) isOpen.value = true
}

/** 悬停离开关闭（未锁定时） */
function handleLeave(): void {
  if (!locked.value) isOpen.value = false
}

/** 点击图标：切换锁定并同步面板开合 */
function handleToggle(): void {
  locked.value = !locked.value
  isOpen.value = locked.value
}
</script>

<style scoped lang="scss">
@use "../styles/PublishBadge.scss";
@use "../styles/index.scss";
</style>
