<!-- 大型菜单：根项水平排列，展开时在下方以「多列并排面板」同时展示子菜单（分组列 + 叶子项） -->
<template>
  <div
    ref="rootRef"
    class="si-megamenu"
    :class="[
      `si-megamenu--${orientation}`,
      `si-megamenu--${size}`,
      { 'si-megamenu--disabled': disabled },
    ]"
    @keydown="handleKeydown"
  >
    <!-- 开始区（左端，如品牌/标题） -->
    <div
      v-if="$slots.start"
      class="si-megamenu__start"
    >
      <slot name="start" />
    </div>

    <!-- 根菜单 -->
    <ul
      class="si-megamenu__root"
      role="menubar"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
    >
      <li
        v-for="(item, index) in model"
        :key="item.key"
        class="si-megamenu__root-item"
        :class="{ 'si-megamenu__root-item--active': activeKey === item.key }"
        role="none"
        @mouseenter="handleItemEnter(item)"
        @mouseleave="handleItemMouseLeave(item)"
      >
        <button
          :ref="(el) => setItemRef(el, index)"
          type="button"
          class="si-megamenu__root-link"
          role="menuitem"
          :data-mm-root="index"
          :disabled="disabled || item.disabled || undefined"
          :aria-haspopup="isExpandable(item) ? 'true' : undefined"
          :aria-expanded="isExpandable(item) ? (activeKey === item.key ? 'true' : 'false') : undefined"
          :aria-controls="isExpandable(item) ? `${menuId}-panel-${index}` : undefined"
          :tabindex="rovingTabindex(index)"
          @focus="markRootFocus(index)"
          @click="handleItemClick(item, $event)"
        >
          <!-- 根项图标 -->
          <IconWrapper
            v-if="item.icon"
            :name="item.icon"
            :size="rootIconSize"
            class="si-megamenu__root-icon"
          />
          <span class="si-megamenu__root-label">{{ item.label }}</span>
          <!-- 可展开标记（↓ 表示有面板） -->
          <IconWrapper
            v-if="isExpandable(item)"
            name="chevronDown"
            :size="chevronSize"
            class="si-megamenu__root-caret"
          />
        </button>

        <!-- 展开面板：多列并排（MegaMenu 的定义性特征） -->
        <div
          v-if="isExpandable(item) && activeKey === item.key"
          :id="`${menuId}-panel-${index}`"
          class="si-megamenu__panel"
          :data-mm-panel="index"
          :style="panelStyle"
          @mouseenter="handlePanelEnter"
          @mouseleave="handlePanelLeave"
        >
          <div class="si-megamenu__grid">
            <!-- 每列 = 一个分组（子项中 header 为 true 的项开新列；其余归入当前列） -->
            <div
              v-for="(column, columnIndex) in buildColumns(item.items)"
              :key="`${item.key}-col-${columnIndex}`"
              class="si-megamenu__column"
            >
              <!-- 列标题（不可点击） -->
              <div
                v-if="column.header"
                class="si-megamenu__column-header"
              >
                {{ column.header.label }}
              </div>
              <ul
                class="si-megamenu__list"
                role="menu"
                :aria-label="column.header ? column.header.label : item.label"
              >
                <li
                  v-for="(leaf, leafIndex) in column.items"
                  :key="leaf.key"
                  role="none"
                >
                  <button
                    type="button"
                    class="si-megamenu__leaf"
                    role="menuitem"
                    data-mm-leaf="1"
                    :data-mm-root-of="index"
                    :data-mm-disabled="leaf.disabled || undefined"
                    :disabled="leaf.disabled || undefined"
                    :tabindex="focusedPath === `${index}-${columnIndex}-${leafIndex}` ? 0 : -1"
                    @focus="markLeafFocus(index, columnIndex, leafIndex)"
                    @click="handleLeafSelect(leaf, $event)"
                  >
                    <IconWrapper
                      v-if="leaf.icon"
                      :name="leaf.icon"
                      :size="leafIconSize"
                      class="si-megamenu__leaf-icon"
                    />
                    <span class="si-megamenu__leaf-text">
                      <span class="si-megamenu__leaf-label">{{ leaf.label }}</span>
                      <span
                        v-if="leaf.description"
                        class="si-megamenu__leaf-desc"
                      >{{ leaf.description }}</span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <!-- 结束区（右端） -->
    <div
      v-if="$slots.end"
      class="si-megamenu__end"
    >
      <slot name="end" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  MegaMenuItem as MegaMenuItemShape,
  MegaMenuOrientation as MegaMenuOrientationShape,
  MegaMenuSize as MegaMenuSizeShape,
} from "./megaMenu/types"
import {
  computed,
  useSlots,
} from "vue"
import IconWrapper from "./IconWrapper.vue"
import { buildColumns } from "./megaMenu/columns"
import { useMegaMenu } from "./megaMenu/useMegaMenu"
import "./kit/theme"

// 公开类型转出（沿用 Dialog / Drawer / Tooltip 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type MegaMenuItem = MegaMenuItemShape
export type MegaMenuOrientation = MegaMenuOrientationShape
export type MegaMenuSize = MegaMenuSizeShape

interface Props {
  /** 根菜单项（每项可带一层 `items` 作为展开面板内容） */
  model: MegaMenuItem[]
  /** 根菜单排列方向：`horizontal`（默认，面板在下方）/ `vertical`（面板在侧方） */
  orientation?: MegaMenuOrientation
  /** 尺寸档位：驱动字号 10/12/14/16 与内边距 */
  size?: MegaMenuSize
  /** 是否禁用整个菜单 */
  disabled?: boolean
  /** 悬停根项是否自动展开面板（默认开；关闭后仅点击展开，适合触屏为主的场景） */
  openOnHover?: boolean
  /** 面板最大高度（CSS 长度，默认 20rem）；超出时面板内部滚动 */
  scrollHeight?: string
  /** 面板内分组列的最小宽度（px，默认 160）；列宽不足时自动换列 */
  columnMinWidth?: number
  /** 根菜单的无障碍名称（无可见标题时必填） */
  ariaLabel?: string
  /** 根菜单的无障碍名称所引用的元素 id */
  ariaLabelledby?: string
}

const props = withDefaults(defineProps<Props>(), {
  orientation: "horizontal",
  size: "small",
  disabled: false,
  openOnHover: true,
  scrollHeight: "20rem",
  columnMinWidth: 160,
  ariaLabel: undefined,
  ariaLabelledby: undefined,
})

const emit = defineEmits<{
  /** 展开态变更：载荷为当前展开的根项 key（null = 全部收起） */
  "update:active": [key: string | null]
  /** 叶子项被点击（在项自身 command 之后派发） */
  select: [item: MegaMenuItem]
}>()

const slots = useSlots()

const {
  activeKey,
  focusedPath,
  menuId,
  rootRef,
  itemRefs,
  isExpandable,
  handleItemEnter,
  handleItemClick,
  handlePanelEnter,
  handlePanelLeave,
  handleLeafClick,
  markRootFocus,
  markLeafFocus,
  handleKeydown,
} = useMegaMenu({
  model: () => props.model,
  disabled: () => props.disabled,
  openOnHover: () => props.openOnHover,
  onOpenChange: (key) => emit("update:active", key),
})

/** 设为 `setItemRef` 的根项元素集合（roving tabindex 与键盘方向键的移动目标） */
const setItemRef = (el: unknown, index: number) => {
  // 根项是原生 button，故 el 即 HTMLElement | null（未走共享 Button 的 expose 契约）
  itemRefs.value[index] = (el as HTMLElement | null) ?? null
}

// `rootRef` 只服务于模板 `ref="rootRef"` 绑定（点击外部判定在 composable 内部读同一 ref），
// script 内无其他读取点 ⇒ 显式标记为已用，避免 TS6133 误报
void rootRef

/** 叶子项点击：先派发 select 事件，再交由 composable 执行 command 并收起 */
const handleLeafSelect = (leaf: MegaMenuItem, event: MouseEvent) => {
  handleLeafClick(leaf, event)
  emit("select", leaf)
}

/** 悬停离开根项：仅当该项面板已展开时才安排延迟关闭（未展开则无事发生） */
const handleItemMouseLeave = (item: MegaMenuItem) => {
  if (activeKey.value !== item.key) return
  handlePanelLeave()
}

/**
 * roving tabindex：整个根菜单只保留一个可 Tab 停留点（当前展开项，或首项）。
 * 这是 menubar 的标准无障碍做法 —— 否则 Tab 要在每个根项上停一次。
 */
const rovingTabindex = (index: number) => {
  const activeIndex = props.model.findIndex((entry) => entry.key === activeKey.value)
  const target = activeIndex >= 0 ? activeIndex : 0
  return index === target ? 0 : -1
}

const rootIconSize = computed(() => (props.size === "large" ? 16 : 14))
const leafIconSize = computed(() => (props.size === "large" ? 16 : 14))
const chevronSize = computed(() => (props.size === "large" ? 14 : 12))

/** 面板样式：最大高度与列最小宽由 props 下发（列宽用 CSS 变量驱动 grid） */
const panelStyle = computed(() => ({
  maxHeight: props.scrollHeight,
  "--si-mm-col-min": `${props.columnMinWidth}px`,
}))

// 无可见标题时给出开发期告警：menubar 缺无障碍名称，屏幕阅读器只能播报「菜单栏」
if (import.meta.env.DEV && !props.ariaLabel && !props.ariaLabelledby && !slots.start && !slots.end) {
  console.warn(
    "[MegaMenu] 建议提供 ariaLabel 或 ariaLabelledby，否则 menubar 缺少无障碍名称。",
  )
}
</script>

<style scoped lang="scss">
@use './styles/MegaMenu.scss';
</style>
