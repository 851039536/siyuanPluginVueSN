<!-- 分隔线：以「线型 × 方向 × 内容位置」描述一条 1px 细线，默认插槽可在线上承载文字或图标 -->
<template>
  <div
    :class="[rootClasses, { 'si-divider--with-content': $slots.default }]"
    role="separator"
    :aria-orientation="layout"
  >
    <template v-if="$slots.default">
      <span
        class="si-divider__line"
        aria-hidden="true"
      />
      <span class="si-divider__content"><slot /></span>
      <span
        class="si-divider__line"
        aria-hidden="true"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import "./kit/theme"

type DividerType = "solid" | "dashed" | "dotted"
type DividerLayout = "horizontal" | "vertical"
type DividerAlign = "left" | "center" | "right" | "top" | "bottom"

/** 各方向允许的内容位置（官方语义：align 与方向绑定，交叉组合回落居中） */
const ALIGN_BY_LAYOUT: Record<DividerLayout, DividerAlign[]> = {
  horizontal: ["left", "center", "right"],
  vertical: ["top", "center", "bottom"],
}

interface Props {
  /** 线型 */
  type?: DividerType
  /** 方向：水平用于上下分节，垂直用于并排内容之间 */
  layout?: DividerLayout
  /**
   * 内容位置：水平取 `left` / `center` / `right`，垂直取 `top` / `center` / `bottom`。
   * 不传时按居中处理；取值与方向不匹配时静默回落居中（与官方一致）。
   */
  align?: DividerAlign
}

const props = withDefaults(defineProps<Props>(), {
  type: "solid",
  layout: "horizontal",
})

/** 归一后的内容位置：未传或与方向不匹配时回落 center */
const align = computed<DividerAlign>(() => {
  const value = props.align
  return value && ALIGN_BY_LAYOUT[props.layout].includes(value) ? value : "center"
})

const rootClasses = computed(() => [
  "si-divider",
  `si-divider--${props.layout}`,
  `si-divider--${props.type}`,
  `si-divider--${align.value}`,
])
</script>

<style scoped lang="scss">
@use './styles/Divider.scss';
</style>
