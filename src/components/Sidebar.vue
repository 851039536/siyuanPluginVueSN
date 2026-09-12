<!-- 侧边栏：布局型（占位让主内容区让开）或浮层（叠在内容上），支持三变体与三档折叠 -->
<template>
  <div
    ref="rootRef"
    class="si-sidebar"
    :class="[
      `si-sidebar--${side}`,
      `si-sidebar--${variant}`,
      `si-sidebar--${collapsible}`,
      `si-sidebar--${size}`,
      {
        'si-sidebar--open': open,
        'si-sidebar--overlay': overlay,
        'si-sidebar--collapsed': !open,
      },
    ]"
    :style="rootStyle"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <!-- 叠层遮罩：仅 overlay + 展开时渲染，点击可收起 -->
    <div
      v-if="overlay && open"
      class="si-sidebar__mask"
      @click="handleMaskClick"
    />

    <!-- 面板本体 -->
    <aside
      class="si-sidebar__panel"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
      :aria-hidden="!open || undefined"
      :inert="!open || undefined"
    >
      <!-- 面板内容（图标 + 文字由调用方组织；折叠为图标条时文字由样式隐藏） -->
      <div class="si-sidebar__content">
        <slot :open="open" />
      </div>

      <!-- 底部插槽（典型为用户区 / 设置入口，折叠时也保留） -->
      <div
        v-if="$slots.footer"
        class="si-sidebar__footer"
      >
        <slot
          name="footer"
          :open="open"
        />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type {
  SidebarCollapsible as SidebarCollapsibleShape,
  SidebarSide as SidebarSideShape,
  SidebarSize as SidebarSizeShape,
  SidebarVariant as SidebarVariantShape,
} from "./sidebar/types"
import {
  computed,
  provide,
  ref,
} from "vue"
import { SIDEBAR_CONTEXT_KEY } from "./sidebar/context"
import {
  DEFAULT_HOVER_CLOSE_DELAY,
  DEFAULT_HOVER_OPEN_DELAY,
  DEFAULT_ICON_WIDTH,
  DEFAULT_WIDTH,
} from "./sidebar/types"
import { useSidebar } from "./sidebar/useSidebar"
import "./kit/theme"

// 公开类型转出（沿用 Dialog / Drawer / MegaMenu 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type SidebarSide = SidebarSideShape
export type SidebarVariant = SidebarVariantShape
export type SidebarCollapsible = SidebarCollapsibleShape
export type SidebarSize = SidebarSizeShape

interface Props {
  /** 控制开合（配 `v-model:open`）；**不传即非受控自持**（与 Panel.collapsed 同一范式） */
  open?: boolean
  /** 贴合边：`left`（默认）/ `right` */
  side?: SidebarSide
  /** 视觉变体：`sidebar`（默认，与内容同平面）/ `floating`（悬浮卡片）/ `inset`（内嵌面板） */
  variant?: SidebarVariant
  /** 折叠行为：`offcanvas`（完全隐藏）/ `icon`（收成图标条，默认）/ `none`（不可折叠） */
  collapsible?: SidebarCollapsible
  /** 浮层模式：面板叠在内容之上、不占文档流（配 `offcanvas` 最典型，如移动端抽屉） */
  overlay?: boolean
  /** 悬停面板是否自动展开（默认 `false`；与 `collapsible="icon"` 搭配可做「图标条悬停展开」） */
  openOnHover?: boolean
  /** 悬停展开延迟（ms，默认 50） */
  hoverOpenDelay?: number
  /** 悬停收起延迟（ms，默认 100） */
  hoverCloseDelay?: number
  /** 浮层遮罩点击是否收起（默认 `true`，仅 `overlay` 模式生效） */
  dismissable?: boolean
  /** 展开态宽度（CSS 长度，默认 16rem） */
  width?: string
  /** 折叠为图标条时的宽度（CSS 长度，默认 3rem） */
  iconWidth?: string
  /** 尺寸档位：驱动字号 10/12/14/16 与内边距 */
  size?: SidebarSize
  /** 面板的无障碍名称（无可见标题时必填） */
  ariaLabel?: string
  /** 面板的无障碍名称所引用的元素 id */
  ariaLabelledby?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: undefined,
  side: "left",
  variant: "sidebar",
  collapsible: "icon",
  overlay: false,
  openOnHover: false,
  hoverOpenDelay: DEFAULT_HOVER_OPEN_DELAY,
  hoverCloseDelay: DEFAULT_HOVER_CLOSE_DELAY,
  dismissable: true,
  width: DEFAULT_WIDTH,
  iconWidth: DEFAULT_ICON_WIDTH,
  size: "small",
  ariaLabel: undefined,
  ariaLabelledby: undefined,
})

const emit = defineEmits<{
  /** 开合变更（受控时由调用方回写 `open`） */
  "update:open": [value: boolean]
}>()

const rootRef = ref<HTMLElement | null>(null)

const {
  open,
  show,
  hide,
  toggle,
  handlePointerEnter,
  handlePointerLeave,
  handleMaskClick,
} = useSidebar({
  open: () => props.open,
  collapsible: () => props.collapsible,
  overlay: () => props.overlay,
  openOnHover: () => props.openOnHover,
  hoverOpenDelay: () => props.hoverOpenDelay,
  hoverCloseDelay: () => props.hoverCloseDelay,
  dismissable: () => props.dismissable,
  rootRef,
  onOpenChange: (value) => emit("update:open", value),
})

/** 当前占用宽度：浮层不占位（返回 0），折叠按行为取 0 或 iconWidth */
const occupiedWidth = computed(() => {
  if (props.overlay) return "0px"
  if (open.value) return props.width
  return props.collapsible === "icon" ? props.iconWidth : "0px"
})

/** 面板宽度：浮层模式下折叠为 offcanvas 时不该残留宽度，故同样取 occupiedWidth */
const panelWidth = computed(() => occupiedWidth.value)

provide(SIDEBAR_CONTEXT_KEY, {
  get open() {
    return open.value
  },
  get variant() {
    return props.variant
  },
  get collapsible() {
    return props.collapsible
  },
  get overlay() {
    return props.overlay
  },
  get side() {
    return props.side
  },
  get occupiedWidth() {
    return occupiedWidth.value
  },
  toggle,
})

const rootStyle = computed(() => ({
  "--si-sidebar-width": panelWidth.value,
  "--si-sidebar-expanded": props.width,
}))

defineExpose({
  /** 立即展开 */
  show,
  /** 立即收起 */
  hide,
  /** 切换开合 */
  toggle,
})
</script>

<style scoped lang="scss">
@use './styles/Sidebar.scss';
</style>
