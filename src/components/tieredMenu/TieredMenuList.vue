<!-- TieredMenu 私有子部件：递归菜单列表（自身递归渲染子菜单），禁止 feature 直接导入 -->
<template>
  <ul
    class="si-tieredmenu__list"
    :class="`si-tieredmenu__list--level-${level}`"
    role="menu"
    :aria-label="listLabel"
  >
    <template
      v-for="(item, index) in items"
      :key="item.key"
    >
      <!-- 分隔线：不参与键盘漫游、不可交互 -->
      <li
        v-if="item.separator"
        class="si-tieredmenu__separator"
        role="separator"
      />

      <li
        v-else
        class="si-tieredmenu__item"
        :class="{ 'si-tieredmenu__item--open': isOpen(index) }"
        role="none"
        @pointerenter="emit('item-enter', item, level, index)"
      >
        <button
          type="button"
          class="si-tieredmenu__link"
          role="menuitem"
          :data-tm-level="level"
          :data-tm-index="index"
          :data-tm-has-submenu="hasSubmenu(item) || undefined"
          :disabled="disabled || item.disabled || undefined"
          :aria-haspopup="hasSubmenu(item) ? 'true' : undefined"
          :aria-expanded="hasSubmenu(item) ? (isOpen(index) ? 'true' : 'false') : undefined"
          :tabindex="tabindex"
          @click="emit('item-click', item, level, index, $event)"
        >
          <IconWrapper
            v-if="item.icon"
            :name="item.icon"
            :size="iconSize"
            class="si-tieredmenu__icon"
          />
          <span class="si-tieredmenu__label">{{ item.label }}</span>
          <!-- 有子菜单时显示指向箭头（左展开时翻转） -->
          <IconWrapper
            v-if="hasSubmenu(item)"
            :name="submenuSide === 'left' ? 'chevronLeft' : 'chevronRight'"
            :size="chevronSize"
            class="si-tieredmenu__caret"
          />
        </button>

        <!-- 递归渲染子菜单 -->
        <div
          v-if="hasSubmenu(item) && isOpen(index)"
          class="si-tieredmenu__submenu"
          :class="`si-tieredmenu__submenu--${submenuSide}`"
          @pointerenter="emit('submenu-enter')"
          @pointerleave="emit('submenu-leave', level + 1)"
        >
          <TieredMenuList
            :items="item.items ?? []"
            :level="level + 1"
            :path="[...path, index]"
            :active-path="activePath"
            :size="size"
            :disabled="disabled"
            :open-side="openSide"
            :tabindex="tabindex"
            :list-label="item.label"
            @item-enter="(child, childLevel, childIndex) => emit('item-enter', child, childLevel, childIndex)"
            @item-click="(child, childLevel, childIndex, event) => emit('item-click', child, childLevel, childIndex, event)"
            @submenu-enter="emit('submenu-enter')"
            @submenu-leave="(deepLevel) => emit('submenu-leave', deepLevel)"
          />
        </div>
      </li>
    </template>
  </ul>
</template>

<script setup lang="ts">
// 递归菜单列表：每层自渲染 `<ul>`，子项继续用本组件递归。
// ⚠️ 递归组件必须显式声明 name（`<script setup>` 下靠文件名推断，但递归引用需 `defineOptions`）。
import type { TieredMenuItem, TieredMenuSize } from "./types"
import {
  computed,
} from "vue"
import IconWrapper from "../IconWrapper.vue"

defineOptions({ name: "TieredMenuList" })

interface Props {
  /** 本层菜单项 */
  items: TieredMenuItem[]
  /** 本层深度（根层为 0） */
  level: number
  /** 从根到本层的下标路径 */
  path: number[]
  /** 全局活动路径（判定本层哪些项展开） */
  activePath: number[]
  /** 尺寸档位 */
  size: TieredMenuSize
  /** 是否禁用 */
  disabled: boolean
  /** 子菜单展开方向（已由根组件按视口空间解析） */
  openSide: "left" | "right"
  /** roving tabindex：仅根层首项为 0，其余 -1（子菜单打开后由键盘进入） */
  tabindex: number
  /** 无障碍名称 */
  listLabel?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 悬停到某项 */
  "item-enter": [item: TieredMenuItem, level: number, index: number]
  /** 点击某项 */
  "item-click": [item: TieredMenuItem, level: number, index: number, event: MouseEvent]
  /** 进入 / 离开子菜单（用于取消 / 安排延迟关闭） */
  "submenu-enter": []
  "submenu-leave": [level: number]
}>()

/** 本层的展开方向：奇数层相对于偶数层反向（否则第二层子菜单会叠在同一侧） */
const submenuSide = computed(() => {
  const base = props.openSide === "left" ? "left" : "right"
  // 偶数层（0、2…）用基准方向，奇数层反向 —— 让级联菜单呈锯齿展开而非一条直线外溢
  return props.level % 2 === 0
    ? base
    : (base === "right" ? "left" : "right")
})

const hasSubmenu = (item: TieredMenuItem) => !!item.items && item.items.length > 0

/** 某项是否展开：本层路径与 activePath 前缀一致，且 activePath 在本层确有选中 */
const isOpen = (index: number) =>
  props.activePath.length > props.level && props.activePath[props.level] === index

const iconSize = computed(() => (props.size === "large" ? 16 : 14))
const chevronSize = computed(() => (props.size === "large" ? 14 : 12))
</script>

<style scoped lang="scss">
@use '../styles/TieredMenu.scss';
</style>
