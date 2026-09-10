// SpeedDial 轨迹几何：按方向/轨迹/半径计算每个动作相对主按钮的像素偏移
// （纯函数，不依赖 Vue 响应式；SpeedDial.vue 的私有模块，禁止 feature 直接导入）

import type { SpeedDialDirection, SpeedDialType } from "./types"
import { DIRECTION_ANGLE } from "./types"

export interface ActionOffsetParams {
  /** 动作下标（0 起） */
  index: number
  /** 动作总数 */
  total: number
  /** 展开方向 */
  direction: SpeedDialDirection
  /** 展开轨迹 */
  type: SpeedDialType
  /** 曲线轨迹半径（px），linear 时忽略 */
  radius: number
  /** 按钮边长（px，来自 SIZE_BUTTON_EDGE） */
  itemSize: number
  /** linear 轨迹的项间隙（px） */
  gap: number
}

export interface ActionOffset {
  x: number
  y: number
}

const toRadians = (deg: number) => (deg * Math.PI) / 180

/** 极坐标 → 屏幕像素偏移（0° 向右，顺时针为正，y 轴向下为正） */
const toCartesian = (distance: number, angleDeg: number): ActionOffset => ({
  x: distance * Math.cos(toRadians(angleDeg)),
  y: distance * Math.sin(toRadians(angleDeg)),
})

/**
 * 计算第 index 个动作相对主按钮的像素偏移。
 *
 * - `linear`：沿方向单位向量按「按钮边长 + 间隙」逐项步进
 * - `circle`：从方向角起均分整周（360 / total）
 * - `semi-circle`：以方向角为中心左右各展 90°
 * - `quarter-circle`：以方向角为中心左右各展 45°
 *
 * 保护：曲线轨迹半径小于按钮边长时抬到按钮边长，避免所有动作塌到主按钮上；
 * 单项（total <= 1）时三种曲线统一退化为「沿方向单位向量 × 半径」，避免除零。
 */
export function resolveActionOffset(params: ActionOffsetParams): ActionOffset {
  const {
    index,
    total,
    direction,
    type,
    radius,
    itemSize,
    gap,
  } = params

  const baseAngle = DIRECTION_ANGLE[direction]

  if (type === "linear") {
    // 从主按钮外侧第一格起算（index 0 紧贴主按钮，与主按钮不发生重叠）
    return toCartesian((index + 1) * (itemSize + gap), baseAngle)
  }

  const distance = Math.max(radius, itemSize)

  if (total <= 1) {
    return toCartesian(distance, baseAngle)
  }

  if (type === "circle") {
    return toCartesian(distance, baseAngle + index * (360 / total))
  }

  const span = type === "semi-circle" ? 180 : 90
  const step = span / (total - 1)
  return toCartesian(distance, baseAngle - span / 2 + index * step)
}

/**
 * 几何结果 → 动作项内联 CSS 变量（与 SpeedDial.scss 的变量名构成唯一契约）。
 * 位移与逐项延迟都以变量承载，样式侧无需按项数生成规则。
 */
export function toItemStyle(
  offset: ActionOffset,
  index: number,
  delayStep: number,
): Record<string, string> {
  return {
    "--si-speeddial-x": `${offset.x}px`,
    "--si-speeddial-y": `${offset.y}px`,
    "--si-speeddial-delay": `${index * delayStep}ms`,
  }
}
