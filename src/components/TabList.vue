<!-- 标签栏容器：横向可滚动（滚动条隐藏），激活标签变化时自动滚入可视区 -->
<template>
  <div class="si-tablist">
    <div
      ref="contentRef"
      class="si-tablist__content"
      role="tablist"
      aria-orientation="horizontal"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TabListContext,
} from "./tabs/types"
import {
  onMounted,
  provide,
  ref,
  watch,
} from "vue"
import {
  TAB_LIST_CONTEXT_KEY,
  useTabsContext,
} from "./tabs/context"
import "./kit/theme"

interface Props {
  /** 标签栏整体的无障碍名称（组件无内置文案，需可访问名称时由调用方传入） */
  ariaLabel?: string
  /** 由外部元素命名标签栏（与 `ariaLabel` 二选一） */
  ariaLabelledby?: string
}

defineProps<Props>()

const context = useTabsContext("TabList")

/** `role="tablist"` 的滚动容器，同时供 Tab 做方向键查找与首末定位 */
const contentRef = ref<HTMLElement | null>(null)

provide<TabListContext>(TAB_LIST_CONTEXT_KEY, {
  get content() {
    return contentRef.value
  },
})

/**
 * 把当前激活标签滚入视野。
 * 末项在窄面板里默认不可见，若等用户点开才滚会先看到半截，故挂载后先滚一次。
 */
const scrollActiveIntoView = () => {
  const content = contentRef.value
  if (!content) return
  const active = content.querySelector<HTMLElement>('[role="tab"][data-active="true"]')
  if (active) context.scrollToActiveTab(content, active)
}

// flush: post —— 等根类给定的档位样式生效后再测量，避免按旧字号计算落点
watch(() => context.value, scrollActiveIntoView, { flush: "post" })

// 不能用 immediate：那时 ref 尚未绑定（immediate 不等待 post 刷新）
onMounted(scrollActiveIntoView)
</script>

<style scoped lang="scss">
@use './styles/TabList.scss';
</style>
