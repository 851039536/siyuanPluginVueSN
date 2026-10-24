// src/features/gitPush/utils/i18nFormat.spec.ts — i18n 占位替换单一真源单元测试
//
// 覆盖重点：{0}/{1} 顺序占位、只替换首个出现、无参数/无占位原样返回、
// args 少于占位数时未替换占位保留（防 undefined 泄漏）。
import { describe, expect, it } from "vitest"
import { fmtTemplate } from "./i18nFormat"

describe("fmtTemplate", () => {
  it("按序号替换多个占位", () => {
    expect(fmtTemplate("共 {0} 个文件，展示前 {1} 个", 200, 12)).toBe("共 200 个文件，展示前 12 个")
  })

  it("同一占位多次出现只替换首个（与历史 .replace(\"{0}\",…) 行为一致）", () => {
    expect(fmtTemplate("{0} + {0}", "a")).toBe("a + {0}")
  })

  it("无参数/无占位原样返回", () => {
    expect(fmtTemplate("静态文案")).toBe("静态文案")
    expect(fmtTemplate("{0}")).toBe("{0}")
  })

  it("args 少于占位数：未替换占位保留，不出现 undefined", () => {
    const out = fmtTemplate("{0} / {1}", "x")
    expect(out).toBe("x / {1}")
    expect(out).not.toContain("undefined")
  })

  it("数值参数转字符串替换", () => {
    expect(fmtTemplate("第 {0} 项", 3)).toBe("第 3 项")
  })
})
