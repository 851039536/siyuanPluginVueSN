// diffPrefs.spec.ts — 偏好归一化
import { describe, expect, it } from "vitest"
import { DEFAULT_DIFF_VIEW_PREFS } from "../types/storage"
import { normalizeDiffViewPrefs } from "./diffPrefs"

describe("normalizeDiffViewPrefs", () => {
  it("空值回退默认", () => {
    expect(normalizeDiffViewPrefs(undefined)).toEqual(DEFAULT_DIFF_VIEW_PREFS)
    expect(normalizeDiffViewPrefs(null)).toEqual(DEFAULT_DIFF_VIEW_PREFS)
  })

  it("字段缺失逐项回退，合法值保留", () => {
    expect(normalizeDiffViewPrefs({ layout: "split", wrap: false })).toEqual({
      ...DEFAULT_DIFF_VIEW_PREFS,
      layout: "split",
      wrap: false,
    })
  })

  it("非法 layout / 非布尔字段回退默认", () => {
    expect(normalizeDiffViewPrefs({
      layout: "bogus" as never,
      showLineNumbers: "yes" as never,
      onlyChanges: 1 as never,
    })).toEqual(DEFAULT_DIFF_VIEW_PREFS)
  })
})
