// 提示词库纯工具行为断言 —— 覆盖审查发现：
//   P2-8 ID 唯一性（替换 Date.now() 同毫秒碰撞）
//   P3-12 透明度转换、i18n 默认值兜底
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  DEFAULT_PROMPTS_I18N,
} from "./types"
import {
  genId,
  resolvePromptsI18n,
  withAlpha,
} from "./utils"

describe("genId (P2-8)", () => {
  it("带前缀且同一前缀批量生成不重复", () => {
    const ids = Array.from({ length: 200 }, () => genId("p"))
    expect(ids.every((id) => id.startsWith("p-"))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("不同前缀互不冲突", () => {
    expect(genId("cat")).not.toBe(genId("c"))
  })
})

describe("withAlpha (P3-12)", () => {
  it("0.125 映射为历史后缀 20（视觉一致）", () => {
    expect(withAlpha("#d97757", 0.125)).toBe("#d9775720")
  })

  it("边界值钳位到 00 / ff", () => {
    expect(withAlpha("#ffffff", -1)).toBe("#ffffff00")
    expect(withAlpha("#000000", 5)).toBe("#000000ff")
  })
})

describe("resolvePromptsI18n (P2-5)", () => {
  it("无入参时返回完整默认值", () => {
    expect(resolvePromptsI18n()).toEqual(DEFAULT_PROMPTS_I18N)
  })

  it("部分键覆盖，其余键回退默认值而非 undefined", () => {
    const resolved = resolvePromptsI18n({ title: "自定义" })
    expect(resolved.title).toBe("自定义")
    expect(resolved.saveFailed).toBe(DEFAULT_PROMPTS_I18N.saveFailed)
    expect(resolved.saveFailed).toBeDefined()
  })
})
