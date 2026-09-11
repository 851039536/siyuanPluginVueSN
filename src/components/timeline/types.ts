// Timeline 类型：对齐档位、尺寸档位与三类插槽的作用域参数
// （Timeline.vue 的私有模块，禁止 feature 直接导入）

/** 布局方向：竖向（事件沿竖线自上而下）/ 横向（事件沿横线自左向右） */
export type TimelineLayout = "vertical" | "horizontal"

/**
 * 对齐档位：时间线（竖线或横线）相对于内容的位置。
 * 竖向用 `left` / `right`，横向用 `top` / `bottom`；`alternate` 两向通用（左右 / 上下交替）。
 */
export type TimelineAlign = "left" | "right" | "alternate" | "top" | "bottom"

/** 尺寸档位（与全库控件阶梯一致） */
export type TimelineSize = "xsmall" | "small" | "medium" | "large"

/**
 * content / opposite / marker 三类插槽统一的作用域参数。
 * 官方另提供 icon（源自其内部图标解析）—— 本项目由调用方在插槽内容里自行渲染 IconWrapper，故不提供。
 */
export interface TimelineSlotProps<T = any> {
  /** 当前事件对象 */
  item: T
  /** 当前事件索引（0 基） */
  index: number
}
