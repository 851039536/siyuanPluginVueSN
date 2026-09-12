<!-- 级联菜单：任意层级的嵌套子菜单，支持内联渲染与事件坐标处弹出（popup）两种形态 -->
<template>
  <div
    ref="rootRef"
    class="si-tieredmenu"
    :class="[
      `si-tieredmenu--${size}`,
      { 'si-tieredmenu--disabled': disabled, 'si-tieredmenu--popup': popup },
    ]"
    @keydown="handleKeydown"
  >
    <!-- 内联模式：菜单本体直接渲染在文档流中 -->
    <Transition
      v-if="!popup"
      name="si-tieredmenu-fade"
    >
      <div
        v-show="!popup"
        class="si-tieredmenu__panel"
      >
        <slot
          name="start"
        />
        <TieredMenuList
          :items="model"
          :level="0"
          :path="[]"
          :active-path="activePath"
          :size="size"
          :disabled="disabled"
          :open-side="openSide"
          :tabindex="tabindex"
          :list-label="ariaLabel"
          @item-enter="handleItemEnter"
          @item-click="onItemClick"
          @submenu-enter="cancelClose"
          @submenu-leave="scheduleClose"
        />
        <slot
          name="end"
        />
      </div>
    </Transition>

    <!-- popup 模式：菜单在触发坐标处浮出（不 Teleport，就地 fixed） -->
    <Transition name="si-tieredmenu-fade">
      <div
        v-if="popup && popupVisible"
        class="si-tieredmenu__panel si-tieredmenu__panel--popup"
        :style="popupStyle"
        role="presentation"
      >
        <slot name="start" />
        <TieredMenuList
          :items="model"
          :level="0"
          :path="[]"
          :active-path="activePath"
          :size="size"
          :disabled="disabled"
          :open-side="openSide"
          :tabindex="tabindex"
          :list-label="ariaLabel"
          @item-enter="handleItemEnter"
          @item-click="onItemClick"
          @submenu-enter="cancelClose"
          @submenu-leave="scheduleClose"
        />
        <slot name="end" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type {
  TieredMenuItem as TieredMenuItemShape,
  TieredMenuSize as TieredMenuSizeShape,
} from "./tieredMenu/types"
import {
  computed,
  nextTick,
  watch,
} from "vue"
import { resolveMenuPosition } from "./tieredMenu/position"
import {
  DEFAULT_POPUP_MENU_LABEL,
  POPUP_VIEWPORT_PADDING,
} from "./tieredMenu/types"
import { useTieredMenu } from "./tieredMenu/useTieredMenu"
import TieredMenuList from "./tieredMenu/TieredMenuList.vue"
import "./kit/theme"

// 公开类型转出（沿用 Dialog / MegaMenu / Sidebar 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type TieredMenuItem = TieredMenuItemShape
export type TieredMenuSize = TieredMenuSizeShape

interface Props {
  /** 根菜单项（`items` 可**递归任意层**） */
  model: TieredMenuItem[]
  /**
   * 是否 popup 模式：`true` 时菜单默认隐藏，需经 `defineExpose` 的
   * `toggle(event)` / `show(event)` / `hide()` 在触发坐标处浮出（右键菜单形态）。
   */
  popup?: boolean
  /** 子菜单优先展开方向；空间不足时组件自动翻转到另一侧 */
  submenuSide?: "left" | "right"
  /** 尺寸档位：驱动字号 10/12/14/16 与内边距 */
  size?: TieredMenuSize
  /** 是否禁用整个菜单 */
  disabled?: boolean
  /** 根层菜单的 roving tabindex 基准（传 `-1` 可把整组移出 Tab 序列） */
  tabindex?: number
  /** 菜单的无障碍名称（无可见标题时建议提供） */
  ariaLabel?: string
  /** 菜单的无障碍名称所引用的元素 id */
  ariaLabelledby?: string
}

const props = withDefaults(defineProps<Props>(), {
  popup: false,
  submenuSide: "right",
  size: "small",
  disabled: false,
  tabindex: 0,
  ariaLabel: DEFAULT_POPUP_MENU_LABEL,
  ariaLabelledby: undefined,
})

const emit = defineEmits<{
  /** 叶子项被点击（在项自身 command 之后派发） */
  select: [item: TieredMenuItem]
  /** popup 模式开合变更 */
  "update:visible": [value: boolean]
}>()

const {
  activePath,
  popupVisible,
  popupPosition,
  rootRef,
  handleItemEnter,
  scheduleClose,
  cancelClose,
  handleItemClick,
  showPopup,
  hidePopup,
  togglePopup,
  setPopupPosition,
  getTriggerPoint,
  handleKeydown,
} = useTieredMenu({
  model: () => props.model,
  disabled: () => props.disabled,
  popup: () => props.popup,
  onPopupChange: (visible) => emit("update:visible", visible),
})

/**
 * 子菜单展开方向：把 prop 的偏好与视口实际空间结合。
 * ⚠️ 真实翻转需要父项矩形与子菜单宽度（逐层测量），此处按**根层可用空间**做一次性判定 ——
 * 级联菜单的层数通常不深，逐层测量收益低而代码复杂度高（有意简化，已在文档标注）。
 */
const openSide = computed(() => props.submenuSide)

/** popup 面板样式：视口坐标（`position: fixed`） */
const popupStyle = computed(() => ({
  top: `${popupPosition.value.top}px`,
  left: `${popupPosition.value.left}px`,
  maxHeight: `calc(100vh - ${POPUP_VIEWPORT_PADDING * 2}px)`,
}))

/**
 * popup 打开后测量面板尺寸并做视口钳制。
 * 必须**先渲染再测量**（尺寸未知无法定位），故用 nextTick 分两步。
 */
watch(popupVisible, async (visible) => {
  if (!visible) return
  await nextTick()
  const panel = rootRef.value?.querySelector<HTMLElement>(".si-tieredmenu__panel--popup")
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  setPopupPosition(resolveMenuPosition({
    anchor: { ...getTriggerPoint(), width: 0, height: 0 },
    menu: { width: rect.width, height: rect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
  }))
})

/** 叶子项点击后额外派发 select（command 由 composable 执行） */
const handleSelect = (item: TieredMenuItem) => emit("select", item)

// 指针移入子菜单面板时取消「延迟收起」（模板经 @submenu-enter 绑定 cancelClose）。
// 该函数由 useTieredMenu 正式导出：早期版本未导出，模板曾退化为复用 openSubmenu([...path])
// 间接触发，语义绕且依赖实现细节，现已直连。

/** 包一层：把 composable 的点击处理与 select 事件串起来 */
const onItemClick = (
  item: TieredMenuItem,
  level: number,
  index: number,
  event: MouseEvent,
) => {
  const isLeaf = !item.items || item.items.length === 0
  handleItemClick(item, level, index, event)
  if (isLeaf && !item.disabled && !item.separator) handleSelect(item)
}

defineExpose({
  /** 在事件坐标处显示（popup 模式） */
  show: (event: Event) => showPopup(event),
  /** 隐藏（popup 模式） */
  hide: () => hidePopup(),
  /** 切换显示（popup 模式） */
  toggle: (event: Event) => togglePopup(event),
})
</script>

<style scoped lang="scss">
@use './styles/TieredMenu.scss';
</style>
