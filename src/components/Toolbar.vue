<!-- 工具栏：三段式布局容器（start 左 / center 居中 / end 右），支持三种外观、内边距开关、换行与四档尺寸 -->
<template>
  <div
    :class="rootClasses"
    role="toolbar"
    :aria-label="ariaLabel"
    :aria-labelledby="ariaLabelledby"
  >
    <!-- 三段容器恒定渲染（对齐官方）：未传内容时仍占位，位置不随内容增删跳动 -->
    <div class="si-toolbar__start">
      <slot name="start" />
    </div>
    <div class="si-toolbar__center">
      <slot name="center" />
    </div>
    <div class="si-toolbar__end">
      <slot name="end" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import "./kit/theme"

/** 外观档位：`outlined` 表面底色 + 1px 边框（默认）/ `filled` 实底无边框 / `borderless` 无边框无底色 */
export type ToolbarVariant = "outlined" | "filled" | "borderless"
/** 尺寸档位（与全库控件阶梯一致） */
export type ToolbarSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  /** 外观档位 */
  variant?: ToolbarVariant
  /**
   * 尺寸档位：驱动内边距、最小高度、段间距与基准字号（10/12/14/16）。
   * ⚠️ 组件无法把档位注入插槽 ⇒ 请把同档 `size` 同时传给内部共享控件（`Button` / `Input` 等），否则档位会脱节。
   */
  size?: ToolbarSize
  /** 是否给内边距：关闭后四向贴合，但仍保留档位最小高度（高度不随内容随机变化） */
  padded?: boolean
  /** 窄容器下是否允许换行：开启后 `start` 独占首行，`center` / `end` 落在次行并分居两端 */
  wrap?: boolean
  /** 工具栏的无障碍名称（组件无内置文案，需要可访问名称时传入） */
  ariaLabel?: string
  /** 由外部元素命名工具栏（与 `ariaLabel` 二选一） */
  ariaLabelledby?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: "outlined",
  size: "small",
  padded: true,
  wrap: false,
})

const rootClasses = computed(() => [
  "si-toolbar",
  `si-toolbar--${props.variant}`,
  `si-toolbar--${props.size}`,
  {
    "si-toolbar--padded": props.padded,
    "si-toolbar--wrap": props.wrap,
  },
])
</script>

<style scoped lang="scss">
@use './styles/Toolbar.scss';
</style>
