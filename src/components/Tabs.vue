<!-- 标签页容器：持有激活值（受控 / 非受控）并向 TabList / Tab / TabPanels / TabPanel 提供上下文 -->
<template>
  <div :class="rootClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import type {
  TabsContext,
  TabsScrollStrategy,
  TabsSize,
  TabsValue,
} from "./tabs/types"
import {
  computed,
  provide,
  ref,
  useId,
  watch,
} from "vue"
import { TABS_CONTEXT_KEY } from "./tabs/context"
import "./kit/theme"

interface Props {
  /**
   * 当前激活的标签值（与 `Tab` / `TabPanel` 的 `value` 对应）。
   * 传了即为受控（配合 `v-model:value`）；不传时组件内部自持（非受控）。
   */
  value?: TabsValue
  /** 未激活面板是否完全不渲染：开启后切走再回来会重置面板内状态（默认关闭，仅隐藏并保留状态） */
  lazy?: boolean
  /** 焦点移入标签时是否立即选中 */
  selectOnFocus?: boolean
  /** roving tabindex 基准值：激活标签取该值、其余为 -1；传 -1 可把整组移出 Tab 序列 */
  tabindex?: number
  /** 激活标签的滚动策略：`nearest`（默认，贴边才滚）/ `center` / `false` / 自定义函数 */
  scrollStrategy?: TabsScrollStrategy
  /** 尺寸档位 */
  size?: TabsSize
}

interface Emits {
  (e: "update:value", value: TabsValue): void
}

const props = withDefaults(defineProps<Props>(), {
  lazy: false,
  selectOnFocus: false,
  tabindex: 0,
  scrollStrategy: "nearest",
  size: "small",
})

const emit = defineEmits<Emits>()

/** 实例 id 前缀（多实例唯一，供标签与面板的 id / aria 关联拼接） */
const tabsId = useId()

/** 内部激活值：初始取 props.value；非受控时由此字段自持 */
const innerValue = ref<TabsValue | undefined>(props.value)

/** 受控：外部值变化时单向覆盖内部状态（不传 value 时不会触发，内部自持） */
watch(() => props.value, (next) => {
  innerValue.value = next
})

/** 幂等切换：值未变化时不派发事件（避免父级未回写时的重复 emit 与无谓渲染） */
const updateValue = (next: TabsValue) => {
  if (innerValue.value === next) return
  innerValue.value = next
  emit("update:value", next)
}

/** 容器是否 RTL（滚动读数需取绝对值、写回取负） */
const isRTL = (element: HTMLElement) => getComputedStyle(element).direction === "rtl"

/**
 * 把激活标签滚入可视区（对齐官方四分支语义）：
 * `false` 直接短路、函数交给调用方、`center` 居中、其余（含 `nearest`）仅在越界时贴边滚动。
 */
const scrollToActiveTab = (content: HTMLElement, tab: HTMLElement) => {
  const strategy = props.scrollStrategy
  if (strategy === false) return

  if (typeof strategy === "function") {
    strategy(content, tab)
    return
  }

  const contentWidth = content.clientWidth
  const contentRect = content.getBoundingClientRect()
  const tabRect = tab.getBoundingClientRect()
  // 标签相对滚动内容的逻辑左边界（不依赖 offsetParent，避免容器未定位时读数错误）
  const tabLeft = tabRect.left - contentRect.left + content.scrollLeft
  const tabWidth = tabRect.width
  const tabRight = tabLeft + tabWidth
  const currentScrollLeft = Math.abs(content.scrollLeft)

  let target: number
  if (strategy === "center") {
    target = tabLeft - (contentWidth - tabWidth) / 2
  } else {
    // nearest：留 10% 缓冲带，避免贴边标签在临界位置反复滚动
    const padding = contentWidth * 0.1
    if (tabLeft < currentScrollLeft + padding) {
      target = tabLeft - padding
    } else if (tabRight > currentScrollLeft + contentWidth - padding) {
      target = tabRight - contentWidth + padding
    } else {
      return
    }
  }

  const maxScrollLeft = content.scrollWidth - contentWidth
  const clamped = Math.max(0, Math.min(target, maxScrollLeft))
  content.scrollTo({
    left: isRTL(content) ? -clamped : clamped,
    behavior: "smooth",
  })
}

/** 上下文用 getter 取值：消费方读取即建立响应式依赖，且无需解包 ref */
const context: TabsContext = {
  get value() {
    return innerValue.value
  },
  get lazy() {
    return props.lazy
  },
  get selectOnFocus() {
    return props.selectOnFocus
  },
  get tabindex() {
    return props.tabindex
  },
  get scrollStrategy() {
    return props.scrollStrategy
  },
  get id() {
    return tabsId
  },
  updateValue,
  scrollToActiveTab,
}

provide(TABS_CONTEXT_KEY, context)

const rootClasses = computed(() => [
  "si-tabs",
  `si-tabs--${props.size}`,
])
</script>

<style scoped lang="scss">
@use './styles/Tabs.scss';
</style>
