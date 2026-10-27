/**
 * useDayDragSelect 单测：热力图/日历共用的「拖过一片日格选区间」状态机。
 *
 * 环境是 node（无 DOM），故用一个最小的 window 替身记录 addEventListener/removeEventListener，
 * 手动触发 mouseup 来验证收尾逻辑——被测行为全在事件回调里，不需要真实 DOM。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDayDragSelect } from "./useDayDragSelect"

type Listener = () => void

/** 最小 window 替身：只提供被用到的两个方法，并记录当前挂着的 mouseup 监听 */
function installFakeWindow() {
  const listeners = new Set<Listener>()
  const fake = {
    addEventListener: (type: string, fn: Listener) => {
      if (type === "mouseup") listeners.add(fn)
    },
    removeEventListener: (type: string, fn: Listener) => {
      if (type === "mouseup") listeners.delete(fn)
    },
  }
  vi.stubGlobal("window", fake)
  return {
    /** 当前挂着的 mouseup 监听数（用于验证有无泄漏） */
    count: () => listeners.size,
    fireMouseUp: () => [...listeners].forEach((fn) => fn()),
  }
}

/** MouseEvent 的最小替身：只需 button 字段 */
const primary = { button: 0 } as MouseEvent
const secondary = { button: 2 } as MouseEvent

describe("useDayDragSelect（拖拽框选区间）", () => {
  let win: ReturnType<typeof installFakeWindow>
  let starts: string[]
  let extendsTo: string[]

  beforeEach(() => {
    win = installFakeWindow()
    starts = []
    extendsTo = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function make() {
    return useDayDragSelect({
      onStart: (d) => starts.push(d),
      onExtend: (d) => extendsTo.push(d),
    })
  }

  it("按下主键才起锚；右键/中键不动选区", () => {
    const s = make()
    s.onDown("2026-08-01", primary)
    expect(starts).toEqual(["2026-08-01"])
    expect(s.dragging.value).toBe(true)

    const t = make()
    t.onDown("2026-08-02", secondary)
    expect(starts).toEqual(["2026-08-01"]) // 未新增
    expect(t.dragging.value).toBe(false)
  })

  it("空日期（占位空格）不触发起锚", () => {
    const s = make()
    s.onDown("", primary)
    expect(starts).toEqual([])
    expect(s.dragging.value).toBe(false)
  })

  it("未按下时掠过格子不改变区间（避免悬停误扩）", () => {
    const s = make()
    s.onEnter("2026-08-05")
    expect(extendsTo).toEqual([])
  })

  it("按下后掠过格子逐次扩展另一端", () => {
    const s = make()
    s.onDown("2026-08-01", primary)
    s.onEnter("2026-08-02")
    s.onEnter("2026-08-03")
    expect(extendsTo).toEqual(["2026-08-02", "2026-08-03"])
  })

  it("拖拽结束（移动过）后抑制补发的 click，且在一个宏任务后自动解除", () => {
    vi.useFakeTimers()
    const s = make()
    s.onDown("2026-08-01", primary)
    s.onEnter("2026-08-03")
    win.fireMouseUp()
    expect(s.dragging.value).toBe(false)
    // mouseup 之后浏览器还会补发 click，此刻必须仍是抑制态
    expect(s.suppressClick.value).toBe(true)

    vi.runAllTimers()
    expect(s.suppressClick.value).toBe(false)
  })

  it("纯单击（按下后没移动）不抑制 click，否则单击会失效", () => {
    const s = make()
    s.onDown("2026-08-01", primary)
    win.fireMouseUp()
    expect(s.suppressClick.value).toBe(false)
  })

  it("收尾后摘掉 window 上的 mouseup 监听（不残留）", () => {
    const s = make()
    s.onDown("2026-08-01", primary)
    expect(win.count()).toBe(1)
    win.fireMouseUp()
    expect(win.count()).toBe(0)
  })

  it("重复 mouseup 不重复收尾（拖动未开始就松开不报错、不清掉已选区间）", () => {
    vi.useFakeTimers()
    const s = make()
    s.onDown("2026-08-01", primary)
    s.onEnter("2026-08-02")
    win.fireMouseUp()
    expect(() => win.fireMouseUp()).not.toThrow()
    vi.runAllTimers()
    expect(s.suppressClick.value).toBe(false)
  })
})
