<!--
  焦点陷阱：把 Tab 焦点限制在包裹区域内（参考 PrimeVue FocusTrap）。
  ⚠️ 官方是指令（v-focustrap），本项目按仓库硬规则（src/components/ 为唯一 UI 出口、
     组件须能进预览面板与清单）做成**组件** —— 与 Tooltip 由指令改组件的先例一致。
-->
<template>
  <div
    ref="containerRef"
    class="si-focustrap"
    :tabindex="disabled ? undefined : -1"
    @keydown.tab="handleTabKeydown"
    @focusin="handleFocusIn"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  ref,
  watch,
} from "vue"
import "./kit/theme"
import {
  getFocusableElements,
  resolveWrapTarget,
} from "./focustrap/focusable"

interface Props {
  /**
   * 是否启用陷阱。关闭时：
   * - `autoFocus` 生效时仍会把焦点拉进容器（官方语义：`disabled` 只关「困住」，不关「自动聚焦」）
   * - 不再拦截 Tab 回绕，也不再把外部焦点抢回来
   */
  disabled?: boolean
  /**
   * 挂载时是否自动把焦点移入容器（默认 `true`）。
   * ⚠️ 与官方一致：**该行为不受 `disabled` 影响** —— 官方文档明确 `autoFocus` 默认 `true`，
   *    且在 `disabled` 时「不会默认聚焦」，故这里把两者解耦为独立开关。
   */
  autoFocus?: boolean
  /**
   * 是否在焦点逃逸到容器外时**强行拉回**（默认 `true`）。
   * 这是「陷阱」的实质：模态弹层内点空白不应把焦点丢给背后的页面。
   * 若只是想要 Tab 回绕而不限制外部聚焦（如非模态浮层），设为 `false`。
   */
  trapFocusIn?: boolean
  /** 容器内优先聚焦的目标选择器（默认取首个可聚焦元素，无则聚焦容器自身） */
  initialFocus?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  autoFocus: true,
  trapFocusIn: true,
  initialFocus: undefined,
})

const emit = defineEmits<{
  /** 焦点被拉回容器内时派发：载荷为被拉回的（本应成为焦点的）外部元素 */
  focusEscaped: [element: HTMLElement | null]
}>()

const containerRef = ref<HTMLElement | null>(null)

/** 拉回焦点：优先 `initialFocus` 选择器，其次首个可聚焦元素，都无则聚焦容器自身 */
const focusInside = () => {
  const container = containerRef.value
  if (!container) return

  if (props.initialFocus) {
    const preferred = container.querySelector<HTMLElement>(props.initialFocus)
    if (preferred) {
      preferred.focus()
      return
    }
  }

  const [first] = getFocusableElements(container)
  if (first) {
    first.focus()
    return
  }
  // 容器自身可编程聚焦（`tabindex="-1"`），保证陷阱在无控件时也不把焦点漏到外部
  container.focus()
}

const handleTabKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return
  const container = containerRef.value
  if (!container) return

  const target = resolveWrapTarget(
    container,
    document.activeElement as HTMLElement | null,
    event.shiftKey,
  )
  if (!target) return

  // 仅在需要回绕时接管默认行为，其余情况交还浏览器（保持原生 Tab 语义）
  event.preventDefault()
  target.focus()
}

/**
 * 焦点逃逸拉回：`focusin` 在焦点进入任何元素时冒泡到容器 ——
 * 若新焦点既不在容器内、也不在容器自身，说明焦点跑出去了。
 * ⚠️ 用 `focusin`（冒泡）而非 `focus`（不冒泡），后者无法在容器上委托。
 */
const handleFocusIn = (event: FocusEvent) => {
  if (props.disabled || !props.trapFocusIn) return
  const container = containerRef.value
  if (!container) return

  const next = event.target as HTMLElement | null
  if (next && (next === container || container.contains(next))) return

  emit("focusEscaped", next)
  focusInside()
}

/**
 * 挂载即聚焦（对齐官方 `onMounted` 的 focus 行为）。
 * ⚠️ `disabled` 不阻止 autoFocus：官方把两者解耦（disabled 只关「困住」），
 *    故这里只判断 `autoFocus`。
 */
onMounted(() => {
  if (props.autoFocus) focusInside()
})

// 运行期开关 autoFocus 时同样响应（便于「内容加载完再聚焦」的场景）
watch(
  () => props.autoFocus,
  (value) => {
    if (value) focusInside()
  },
)

defineExpose({
  /** 手动把焦点移入容器（供调用方在异步内容就绪后调用） */
  focus: focusInside,
})
</script>

<style scoped lang="scss">
@use './styles/FocusTrap.scss';
</style>
