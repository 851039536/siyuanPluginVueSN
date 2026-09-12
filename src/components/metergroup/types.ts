// MeterGroup 类型与纯计算：区间百分比 + 累计百分比
// （MeterGroup.vue 的私有模块，禁止 feature 直接导入）
// 沿用 confirm/position.ts 的「计算外置、组件只做编排」先例 —— 百分比逻辑可单独推理与测试。
import type { IconKey } from "../kit/icons"

/**
 * 单项（对齐官方 `MeterItem`，图标改为受 `IconKey` 约束）。
 * ⚠️ 官方 `MeterItem` 带 `[key: string]: any` 索引签名以承载任意附加字段；
 *    本项目不照搬索引签名（那会让类型检查形同虚设），改为只声明库内实际消费的字段。
 */
export interface MeterItem {
  /** 该项的标签（标签列表中显示为「标签 (百分比)」） */
  label: string
  /** 该项的值（按 `min`/`max` 区间换算为百分比） */
  value: number
  /** 该项的颜色（条段与标签标记共用；不传时由样式按序号回落主题色） */
  color?: string
  /** 该项的图标（受 `IconKey` 约束）；不传时标签标记退化为色块 */
  icon?: IconKey
}

/** 布局方向：水平（默认，条从左往右）/ 垂直（条从下往上） */
export type MeterGroupOrientation = "horizontal" | "vertical"

/** 标签位置：`start`（条之前）/ `end`（默认，条之后） */
export type MeterGroupLabelPosition = "start" | "end"

/** 标签排列方向：`horizontal`（默认，一行）/ `vertical`（一列） */
export type MeterGroupLabelOrientation = "horizontal" | "vertical"

/** 单个值换算为区间百分比（已钳制到 0~100，并四舍五入为整数） */
export function toPercent(value: number, min: number, max: number): number {
  // 区间为 0（min === max）时除法得 NaN/Infinity —— 直接判为 0，避免渲染出 NaN%
  const span = max - min
  if (!Number.isFinite(span) || span === 0) return 0
  const percent = ((value - min) / span) * 100
  if (!Number.isFinite(percent)) return 0
  return Math.round(Math.max(0, Math.min(100, percent)))
}

/**
 * 总值换算为区间百分比（根元素的 `aria-valuenow`）。
 * ⚠️ 刻意**先各自取整再求和**（官方 `totalPercent` 用 `roundedPercent(总和)`，
 *    这里按「逐项取整后累加」）—— 因为条段的宽度就是逐项取整后的百分比，
 *    两者用同一套取整口径，标签里显示的累计值才与目视的条段长度一致。
 */
export function toTotalPercent(items: MeterItem[], min: number, max: number): number {
  return items.reduce((total, item) => total + toPercent(item.value, min, max), 0)
}

/**
 * 各项的**累计**百分比（官方 `percentages` 插槽作用域参数）：
 * 第 i 项为前 i 项（含自身）的百分比之和，用于自定义标签时展示累计进度。
 */
export function toCumulativePercents(items: MeterItem[], min: number, max: number): number[] {
  let sum = 0
  return items.map((item) => {
    sum += toPercent(item.value, min, max)
    return sum
  })
}
