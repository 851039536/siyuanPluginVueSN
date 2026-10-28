<!-- gitPush 内联菜单容器（统一 role / 方向键 / 打开聚焦首项 / Esc 上报；定位与宽度类由调用方传入） -->
<template>
  <div
    ref="rootEl"
    class="gp-menu-popover"
    role="menu"
    :aria-label="ariaLabel"
    @keydown="handleKeydown"
    @click.stop
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
// gitPush 内联菜单容器：卡片顶栏/操作栏与面板头部菜单共用同一套键盘与无障碍语义
import { nextTick, onMounted, ref } from "vue"

defineProps<{
  /** 菜单的无障碍名称（通常取触发按钮的 title） */
  ariaLabel?: string
}>()

const emit = defineEmits<{
  /** Esc 按下（调用方如需自行关闭受控菜单可监听；不监听时由全局 Esc 处理） */
  escape: []
}>()

const rootEl = ref<HTMLElement | null>(null)
/** 打开菜单前的焦点元素（Esc 关闭后归还；卡片菜单另由 useCardMenu 处理，重复聚焦无副作用） */
let opener: HTMLElement | null = null

/** 当前菜单里的可交互项（跳过禁用项；分隔线无 role=menuitem 自然被排除） */
function menuItems(): HTMLElement[] {
  const root = rootEl.value
  return root
    ? [...root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')]
    : []
}

/** ↑↓ 循环移动、Home/End 跳首末；Esc 上报但不拦截（全局处理器负责关闭与焦点归还） */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("escape")
    // 父级收到 escape 会同步关闭菜单；再次聚焦触发按钮，避免焦点落到 body
    opener?.focus()
    return
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return
  const items = menuItems()
  if (items.length === 0) return
  e.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next = 0
  if (e.key === "End") next = items.length - 1
  else if (e.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length
  else if (e.key === "ArrowUp") next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
  items[next]?.focus()
}

// 打开即聚焦首项（WAI-ARIA menu button 模式；鼠标用户直接点目标项即可）
onMounted(() => {
  const active = document.activeElement
  opener = active instanceof HTMLElement ? active : null
  nextTick(() => menuItems()[0]?.focus())
})
</script>

<style lang="scss">
@use "../../styles/MenuPopover.scss";
</style>
