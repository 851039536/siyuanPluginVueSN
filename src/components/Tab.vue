<!-- 单个标签：与同 value 的 TabPanel 配对，支持禁用与完整的键盘漫游 -->
<template>
  <button
    type="button"
    class="si-tab"
    :class="{
      'si-tab--active': active,
      'si-tab--disabled': disabled,
    }"
    role="tab"
    :id="id"
    :aria-selected="active ? 'true' : 'false'"
    :aria-controls="panelId"
    :tabindex="tabIndex"
    :disabled="disabled"
    :data-active="active ? 'true' : 'false'"
    :data-disabled="disabled ? 'true' : 'false'"
    @click="select"
    @focus="handleFocus"
    @keydown="handleKeydown"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import type {
  TabsValue,
} from "./tabs/types"
import {
  computed,
} from "vue"
import {
  tabId,
  tabPanelId,
  useTabListContext,
  useTabsContext,
} from "./tabs/context"
import "./kit/theme"

interface Props {
  /** 标签值：与同值的 `TabPanel` 配对 */
  value: TabsValue
  /** 是否禁用（禁用项不可点击，键盘导航与 Tab 序列均跳过） */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const context = useTabsContext("Tab")
const listContext = useTabListContext("Tab")

/** 激活判定：`value` 限定为 string | number，故用严格相等（官方为支持任意类型走深比较） */
const active = computed(() => context.value === props.value)

const id = computed(() => tabId(context.id, props.value))
const panelId = computed(() => tabPanelId(context.id, props.value))

/** roving tabindex：仅激活标签可被 Tab 键停留，其余 -1 */
const tabIndex = computed(() => (active.value ? context.tabindex : -1))

const select = () => {
  if (props.disabled) return
  context.updateValue(props.value)
}

/** 焦点移入即选中（`selectOnFocus` 开启时，方向键漫游也会同步切换） */
const handleFocus = () => {
  if (props.disabled || !context.selectOnFocus) return
  context.updateValue(props.value)
}

/** 容器内可用标签（跳过禁用项）：方向键 / Home / End / PageUp / PageDown 的定位依据 */
const enabledTabs = (): HTMLElement[] => {
  const content = listContext.content
  if (!content) return []
  return Array.from(content.querySelectorAll<HTMLElement>('[role="tab"]:not([data-disabled="true"])'))
}

const focusTab = (tab: HTMLElement | undefined) => {
  if (!tab) return
  tab.focus()
  tab.scrollIntoView?.({ block: "nearest" })
}

/** PageUp / PageDown 只滚动不聚焦（官方语义） */
const scrollTab = (tab: HTMLElement | undefined) => {
  tab?.scrollIntoView?.({ block: "nearest" })
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  const tabs = enabledTabs()
  if (tabs.length === 0) return

  const current = event.currentTarget as HTMLElement | null
  const index = current ? tabs.indexOf(current) : -1
  const safeIndex = index < 0 ? 0 : index

  switch (event.code) {
    case "ArrowRight": {
      event.preventDefault()
      focusTab(tabs[(safeIndex + 1) % tabs.length])
      break
    }
    case "ArrowLeft": {
      event.preventDefault()
      focusTab(tabs[(safeIndex - 1 + tabs.length) % tabs.length])
      break
    }
    case "Home": {
      event.preventDefault()
      focusTab(tabs[0])
      break
    }
    case "End": {
      event.preventDefault()
      focusTab(tabs[tabs.length - 1])
      break
    }
    case "PageDown": {
      event.preventDefault()
      scrollTab(tabs[tabs.length - 1])
      break
    }
    case "PageUp": {
      event.preventDefault()
      scrollTab(tabs[0])
      break
    }
    // Enter / 空格：原生 button 随后也会派发 click，但 updateValue 幂等，不会重复切换
    case "Enter":
    case "NumpadEnter":
    case "Space": {
      select()
      break
    }
    default:
      break
  }
}
</script>

<style scoped lang="scss">
@use './styles/Tab.scss';
</style>
