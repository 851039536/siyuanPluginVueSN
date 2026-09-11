<!-- 时间线：把一串按先后发生的事件沿线排布，支持竖向（居左 / 居右 / 交错）与横向（居上 / 居下 / 交错）两种布局，
     纯展示无交互；连接线在末项收口，节点不传时回退为主题色空心圆。 -->
<template>
  <ol :class="rootClasses">
    <li
      v-for="(item, index) in value"
      :key="index"
      class="si-timeline__event"
      :class="{ 'si-timeline__event--reverse': isReversed(index) }"
    >
      <!-- 对侧信息：始终渲染以保持两侧等宽、竖线位置稳定（官方 Basic 观感） -->
      <div class="si-timeline__opposite">
        <slot
          name="opposite"
          :item="item"
          :index="index"
        />
      </div>

      <div class="si-timeline__separator">
        <div class="si-timeline__marker">
          <slot
            name="marker"
            :item="item"
            :index="index"
          >
            <span
              class="si-timeline__dot"
              aria-hidden="true"
            />
          </slot>
        </div>
        <!-- 连接线：末项不再向下延长，列表自然收口 -->
        <div
          v-if="index < value.length - 1"
          class="si-timeline__connector"
        />
      </div>

      <div class="si-timeline__content">
        <slot
          name="content"
          :item="item"
          :index="index"
        />
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type {
  TimelineAlign as TimelineAlignShape,
  TimelineLayout as TimelineLayoutShape,
  TimelineSize as TimelineSizeShape,
  TimelineSlotProps as TimelineSlotPropsShape,
} from "./timeline/types"
import { computed } from "vue"
import "./kit/theme"

export type TimelineAlign = TimelineAlignShape
export type TimelineLayout = TimelineLayoutShape
export type TimelineSize = TimelineSizeShape
/** content / opposite / marker 三类插槽统一的作用域参数 */
export type TimelineSlotProps<T = any> = TimelineSlotPropsShape<T>

interface Props {
  /** 事件集合（元素为任意对象，渲染字段由插槽决定） */
  value: any[]
  /**
   * 布局方向：竖向（`vertical`，默认）事件自上而下、线在左/右；
   * 横向（`horizontal`）事件自左向右、线在上/下。
   */
  layout?: TimelineLayoutShape
  /** 线相对于内容的位置（竖向用 `left` / `right`，横向用 `top` / `bottom`；`alternate` 两向通用） */
  align?: TimelineAlignShape
  /** 尺寸档位（仅驱动字号，节点直径与线宽恒定） */
  size?: TimelineSizeShape
}

const props = withDefaults(defineProps<Props>(), {
  layout: "vertical",
  align: "left",
  size: "small",
})

const rootClasses = computed(() => [
  "si-timeline",
  `si-timeline--${props.layout}`,
  `si-timeline--${props.align}`,
  `si-timeline--${props.size}`,
])

/**
 * 该行 / 列是否反向（`opposite` 与 `content` 互换位置）：
 * - 竖向：`right` 整表镜像（内容在左）；`alternate` 奇数索引反向，等价官方 `nth-child(even)` 反向排列
 * - 横向：`bottom` 整表镜像（内容在上）；`alternate` 同上，表现为上下交替
 */
const isReversed = (index: number) => {
  if (props.align === "alternate") {
    return index % 2 === 1
  }
  return props.layout === "horizontal"
    ? props.align === "bottom"
    : props.align === "right"
}
</script>

<style scoped lang="scss">
@use './styles/Timeline.scss';
</style>
