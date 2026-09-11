// Splitter 尺寸计算：初始分配、拖动夹取与键盘步进（纯函数，私有模块，便于独立推理）

/** 单个面板的尺寸约束（百分比） */
export interface PanelConstraint {
  /** 最小尺寸 */
  min: number
  /** 最大尺寸 */
  max: number
  /** 是否允许折叠到 collapsedSize */
  collapsible: boolean
  /** 折叠尺寸 */
  collapsedSize: number
}

/** 一次相邻面板调整的结果 */
export interface ResizePairResult {
  /** 调整后的完整尺寸数组 */
  sizes: number[]
  /** 调整后左侧面板是否处于折叠态（尺寸低于自身最小值） */
  prevCollapsed: boolean
  /** 调整后右侧面板是否处于折叠态 */
  nextCollapsed: boolean
}

/** 数值夹取：非有限值按下界处理 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

/** 约束归一化：min/max/collapsedSize 夹到 0~100，且保证 min ≤ max */
export function normalizeConstraint(constraint: PanelConstraint): PanelConstraint {
  const min = clamp(constraint.min, 0, 100)
  return {
    min,
    max: clamp(constraint.max, min, 100),
    collapsible: constraint.collapsible,
    collapsedSize: clamp(constraint.collapsedSize, 0, 100),
  }
}

/**
 * 计算初始尺寸：显式 size 先占位，其余面板均分剩余空间；
 * 全部显式时按总和归一化到 100（避免布局溢出）。
 */
export function resolveInitialSizes(explicit: Array<number | undefined>): number[] {
  const count = explicit.length
  if (count === 0) return []

  const fixed = explicit.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 100) : undefined,
  )
  // 显式声明累加器类型：数组元素含 undefined，默认推断会让 sum 变成 number | undefined
  const fixedSum = fixed.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const autoCount = fixed.filter((value) => value === undefined).length

  if (autoCount === 0) {
    if (fixedSum <= 0) return fixed.map(() => 100 / count)
    return fixed.map((value) => ((value ?? 0) / fixedSum) * 100)
  }

  const rest = Math.max(0, 100 - fixedSum) / autoCount
  return fixed.map((value) => value ?? rest)
}

/**
 * 调整相邻两个面板：两者之和保持不变，结果按各自约束夹取；
 * 允许折叠的面板被压到 minSize 以下时吸附到 collapsedSize。
 * @param nextTarget 右侧面板的目标尺寸（百分比），由调用方按拖动距离或键盘步进算出
 */
export function resizePair(input: {
  sizes: number[]
  /** 分隔条右侧面板索引（调整 sizes[index - 1] 与 sizes[index]） */
  index: number
  nextTarget: number
  prev: PanelConstraint
  next: PanelConstraint
}): ResizePairResult {
  const { sizes, index, prev, next } = input
  const result = [...sizes]
  if (index <= 0 || index >= sizes.length) {
    return {
      sizes: result,
      prevCollapsed: false,
      nextCollapsed: false,
    }
  }

  const total = (sizes[index - 1] ?? 0) + (sizes[index] ?? 0)

  // 右侧面板的可取区间：自身下界（可折叠时为 0）与「左侧不超其最大值」两条约束取严
  const lower = Math.max(next.collapsible ? 0 : next.min, total - prev.max)
  const upper = Math.min(next.max, total - (prev.collapsible ? 0 : prev.min))
  let nextSize = clamp(input.nextTarget, lower, upper)

  // 折叠吸附：落在 [0, minSize) 且允许折叠 → 吸附到 collapsedSize
  if (next.collapsible && nextSize < next.min) {
    nextSize = clamp(next.collapsedSize, 0, next.min)
  }

  let prevSize = total - nextSize
  if (prev.collapsible && prevSize < prev.min) {
    prevSize = clamp(prev.collapsedSize, 0, prev.min)
    nextSize = total - prevSize
  }

  result[index - 1] = prevSize
  result[index] = nextSize

  return {
    sizes: result,
    prevCollapsed: prevSize < prev.min,
    nextCollapsed: nextSize < next.min,
  }
}

/**
 * 键盘步进的目标尺寸：按 `step` 推进一步；
 * 若目标面板当前处于折叠态而按键方向是「展开」，则直接跳到其最小尺寸
 * （否则每次 ±step 很难从 0 脱出折叠）。
 */
export function stepTarget(input: {
  sizes: number[]
  /** 分隔条右侧面板索引 */
  index: number
  step: number
  /** 本次按键要增长哪一侧面板 */
  grow: "prev" | "next"
  prev: PanelConstraint
  next: PanelConstraint
}): number {
  const nextSize = input.sizes[input.index] ?? 0
  const prevSize = input.sizes[input.index - 1] ?? 0

  if (input.grow === "prev" && prevSize < input.prev.min) {
    return nextSize - (input.prev.min - prevSize)
  }
  if (input.grow === "next" && nextSize < input.next.min) {
    return input.next.min
  }

  return input.grow === "prev" ? nextSize - input.step : nextSize + input.step
}
