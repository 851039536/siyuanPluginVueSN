<!-- 抽屉：受控显示（v-model:visible）+ 四向贴边滑入 + 四档尺寸，标题栏 / 内容区 / 页脚三段结构 -->
<template>
  <Transition
    name="si-drawer-slide"
    @enter="handleEnter"
    @leave="handleLeave"
    @after-leave="handleAfterLeave"
  >
    <div
      v-if="visible"
      :class="maskClasses"
      @mousedown="handleMaskMouseDown"
      @mouseup="handleMaskMouseUp"
    >
      <div
        ref="containerRef"
        class="si-drawer"
        :class="[`si-drawer--${position}`, `si-drawer--${size}`]"
        role="dialog"
        :aria-modal="modal"
        :aria-labelledby="labelledById"
        :aria-label="labelledById ? undefined : ariaLabel"
        tabindex="-1"
      >
        <!-- 整块结构可替换（官方作用域仅有 closeCallback） -->
        <slot
          name="container"
          v-bind="containerScope"
        >
          <div
            v-if="showHeader"
            class="si-drawer__header"
          >
            <!-- 标题内容可整体替换（作用域给标题类名与标题 id，便于调用方沿用外观与无障碍关联） -->
            <slot
              name="header"
              v-bind="headerScope"
            >
              <span
                :id="headerId"
                :class="TITLE_CLASS"
              >{{ header }}</span>
            </slot>
            <div
              v-if="closable"
              class="si-drawer__header-actions"
            >
              <slot
                name="closebutton"
                v-bind="closeButtonScope"
              >
                <Button
                  variant="ghost"
                  :size="size"
                  :icon="$slots.closeicon ? undefined : 'close'"
                  :aria-label="closeLabel"
                  :title="closeLabel"
                  @click="handleClose"
                >
                  <slot name="closeicon" />
                </Button>
              </slot>
            </div>
          </div>

          <div class="si-drawer__content">
            <slot />
          </div>

          <div
            v-if="footer || $slots.footer"
            class="si-drawer__footer"
          >
            <slot name="footer">{{ footer }}</slot>
          </div>
        </slot>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type {
  DrawerSide,
  OverlaySize,
} from "./overlay/types"
import {
  computed,
  ref,
  useId,
  useSlots,
} from "vue"
import {
  DEFAULT_CLOSE_LABEL,
  overlayPositionClass,
} from "./overlay/types"
import { useOverlay } from "./overlay/useOverlay"
import Button from "./Button.vue"
import "./kit/theme"

// 公开类型转出（沿用 Dialog / Paginator 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type DrawerPosition = DrawerSide
export type DrawerSize = OverlaySize

/** 标题元素的类名：同时作为 `header` 插槽的作用域参数，便于调用方替换标题后沿用外观 */
const TITLE_CLASS = "si-drawer__title"

interface Props {
  /** 是否显示（受控，配合 `v-model:visible`；关闭请求统一回写 `false`） */
  visible: boolean
  /** 标题文本（`header` 插槽存在时被覆盖） */
  header?: string
  /** 页脚文本（`footer` 插槽存在时被覆盖；两者皆无时页脚整块不渲染） */
  footer?: string
  /** 贴合边四档：`left`（默认）/ `right` / `top` / `bottom`，模板类驱动、零 JS 定位 */
  position?: DrawerPosition
  /**
   * 模态：声明 `aria-modal`，遮罩加深并允许遮罩点关。
   * 与 `Dialog` 同口径 —— 本项目遮罩恒定渲染，非模态会呈现「透明遮罩挡住点击却看不出遮罩」的怪异态。
   */
  modal?: boolean
  /** 是否显示右上角关闭按钮（`showHeader` 为假时不渲染，此时只能靠 Esc / 遮罩 / 插槽内自建按钮关闭） */
  closable?: boolean
  /** 点击遮罩是否关闭（与 `Dialog` / `ConfirmDialog` 统一命名；非模态下遮罩不接管指针事件，自然不生效） */
  dismissableMask?: boolean
  /** 按 Esc 是否关闭 */
  closeOnEscape?: boolean
  /** 是否渲染标题栏（关闭按钮随标题栏一起渲染） */
  showHeader?: boolean
  /** 尺寸档位：驱动抽屉贴合边方向上的延伸量、内边距与基准字号 */
  size?: DrawerSize
  /** 关闭按钮的无障碍名称（默认中文，可覆盖为调用方 i18n） */
  closeLabel?: string
  /** 无标题时的无障碍名称（有标题时自动关联标题） */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  header: "",
  footer: "",
  position: "left",
  modal: true,
  closable: true,
  dismissableMask: false,
  closeOnEscape: true,
  showHeader: true,
  size: "small",
  closeLabel: DEFAULT_CLOSE_LABEL,
})

const emit = defineEmits<{
  "update:visible": [value: boolean]
  show: []
  hide: []
  "after-hide": []
}>()

const slots = useSlots()

/** 标题元素 id（`aria-labelledby` 指向它；`header` 插槽可据 `headerId` 自建标题元素） */
const headerId = `${useId()}-header`

/** 有可见标题（标题栏开启且传了标题文本或 `header` 插槽）时才建立 `aria-labelledby` 关联 */
const labelledById = computed(() =>
  props.showHeader && (props.header !== "" || !!slots.header) ? headerId : undefined,
)

const containerRef = ref<HTMLElement | null>(null)

/** 关闭请求：统一收敛为派发 `false`，由调用方决定最终状态（官方单向数据流） */
function handleClose(): void {
  emit("update:visible", false)
}

/** 初始焦点：容器内按 footer → header → content 顺序找 `[autofocus]`（与 Dialog 一致），都没有则回退容器 */
function findInitialFocus(): HTMLElement | null {
  const container = containerRef.value
  if (!container) return null
  const sections = [".si-drawer__footer", ".si-drawer__header", ".si-drawer__content"]
  for (const selector of sections) {
    const found = container.querySelector<HTMLElement>(`${selector} [autofocus]`)
    if (found) return found
  }
  return container
}

const {
  handleMaskMouseDown,
  handleMaskMouseUp,
} = useOverlay({
  visible: () => props.visible,
  // 官方点关条件：可点关且处于模态（非模态遮罩本就 `pointer-events: none`）
  dismissableMask: () => props.dismissableMask && props.modal,
  closeOnEscape: () => props.closeOnEscape,
  onDismiss: handleClose,
  containerRef,
  initialFocus: findInitialFocus,
})

const maskClasses = computed(() => [
  "si-drawer-mask",
  overlayPositionClass("si-drawer-mask", props.position),
  ...(props.modal ? [] : ["si-drawer-mask--plain"]),
])

/** `header` 插槽作用域（对齐官方 `{ class }`，另补 `{ headerId }` 以便建立 `aria-labelledby`） */
const headerScope = computed(() => ({
  class: TITLE_CLASS,
  headerId,
}))

/** `closebutton` 插槽作用域（对齐官方 `{ closeCallback }`） */
const closeButtonScope = computed(() => ({
  closeCallback: handleClose,
}))

/** `container` 插槽作用域（对齐官方 `{ closeCallback }`） */
const containerScope = computed(() => ({
  closeCallback: handleClose,
}))

/** 过渡钩子：`show` / `hide` / `after-hide` 分别对应进入、离开、离开完成（与 Dialog 同一时机口径） */
function handleEnter(): void {
  emit("show")
}

function handleLeave(): void {
  emit("hide")
}

function handleAfterLeave(): void {
  emit("after-hide")
}
</script>

<style scoped lang="scss">
@use './styles/Drawer.scss';
</style>
