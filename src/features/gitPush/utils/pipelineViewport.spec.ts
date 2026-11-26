import { describe, expect, it } from "vitest"
import {
  centerTransform,
  clampScale,
  clampTransform,
  fitTransform,
  visibleWorldRect,
  zoomAt,
} from "./pipelineViewport"

const content = { width: 800, height: 400 }

describe("pipelineViewport", () => {
  it("缩放限制在 0.5–2 之间，非法值回退 1", () => {
    expect(clampScale(0.1)).toBe(0.5)
    expect(clampScale(5)).toBe(2)
    expect(clampScale(Number.NaN)).toBe(1)
    expect(clampScale(1.25)).toBe(1.25)
  })

  it("内容小于视口时居中锁定，忽略传入偏移", () => {
    const viewport = { width: 1000, height: 500 }
    expect(clampTransform({ scale: 1, x: 999, y: -999 }, content, viewport))
      .toEqual({ scale: 1, x: 100, y: 50 })
  })

  it("内容大于视口时限制在可拖动范围内", () => {
    const viewport = { width: 1000, height: 500 }
    const large = { width: 2000, height: 1000 }
    expect(clampTransform({ scale: 1, x: 500, y: 500 }, large, viewport))
      .toEqual({ scale: 1, x: 0, y: 0 })
    expect(clampTransform({ scale: 1, x: -1500, y: -800 }, large, viewport))
      .toEqual({ scale: 1, x: -1000, y: -500 })
    expect(clampTransform({ scale: 1, x: -300, y: -200 }, large, viewport))
      .toEqual({ scale: 1, x: -300, y: -200 })
  })

  it("视口未测量时原样返回", () => {
    const transform = { scale: 1, x: 12, y: 34 }
    expect(clampTransform(transform, content, { width: 0, height: 0 })).toBe(transform)
  })

  it("居中与适应画布", () => {
    expect(centerTransform(content, { width: 1000, height: 500 }, 1))
      .toEqual({ scale: 1, x: 100, y: 50 })

    const fitted = fitTransform(content, { width: 500, height: 300 }, 10)
    expect(fitted.scale).toBeCloseTo(0.6)
    expect(fitted.scale).toBeLessThanOrEqual(1)
    expect(fitted.x).toBeGreaterThanOrEqual(0)
    expect(fitted.y).toBeGreaterThanOrEqual(0)
  })

  it("以指针为锚点缩放时，锚点下的世界坐标保持不动", () => {
    const viewport = { width: 1000, height: 500 }
    const before = { scale: 1, x: 0, y: 0 }
    const point = { x: 100, y: 100 }
    const after = zoomAt(before, content, viewport, point, 2)
    expect(after.scale).toBe(2)
    const worldBefore = { x: (point.x - before.x) / before.scale, y: (point.y - before.y) / before.scale }
    const worldAfter = { x: (point.x - after.x) / after.scale, y: (point.y - after.y) / after.scale }
    expect(worldAfter.x).toBeCloseTo(worldBefore.x)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y)
  })

  it("缩放达到上限后不再放大", () => {
    const viewport = { width: 1000, height: 500 }
    const zoomed = zoomAt({ scale: 2, x: 0, y: 0 }, content, viewport, { x: 10, y: 10 }, 2)
    expect(zoomed.scale).toBe(2)
  })

  it("可见世界矩形与变换互逆", () => {
    const rect = visibleWorldRect({ scale: 2, x: -100, y: -100 }, { width: 1000, height: 500 })
    expect(rect).toEqual({ x: 50, y: 50, width: 500, height: 250 })
  })
})
