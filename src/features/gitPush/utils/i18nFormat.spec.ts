// src/features/gitPush/utils/i18nFormat.spec.ts — i18n 占位替换单一真源单元测试
//
// 覆盖重点：{0}/{1} 顺序占位、只替换首个出现、无参数/无占位原样返回、
// args 少于占位数时未替换占位保留（防 undefined 泄漏）。
import { describe, expect, it } from "vitest"
import { describeAiFallback, fmtTemplate } from "./i18nFormat"

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

describe("describeAiFallback", () => {
  /** 简易 t：回显 key，便于断言走的是哪条文案分支 */
  const t = (key: string, ...args: (string | number)[]) => `${key}(${args.join(",")})`

  it("没配密钥 → 提示去设置里填 key，而不是笼统的「未返回有效信息」", () => {
    expect(describeAiFallback({ fallback: "no-key" }, t)).toBe("aiFallbackNoKey()")
  })

  it("无暂存改动 → 独立文案", () => {
    expect(describeAiFallback({ fallback: "no-diff" }, t)).toBe("aiFallbackNoDiff()")
  })

  it("调用失败 → 拼接具体错误，便于用户自查是 401 还是超时", () => {
    const out = describeAiFallback({ fallback: "api-error", detail: "API请求失败: 401" }, t)
    expect(out).toBe("aiFallbackApiError(API请求失败: 401)")
  })

  it("调用失败但缺 detail → 用占位符兜底，不出现 undefined", () => {
    const out = describeAiFallback({ fallback: "api-error" }, t)
    expect(out).toBe("aiFallbackApiError(-)")
    expect(out).not.toContain("undefined")
  })

  it("输出不合规 → 提示不符合提交规则", () => {
    expect(describeAiFallback({ fallback: "invalid-format" }, t)).toBe("aiFallbackInvalidFormat()")
  })

  it("无 fallback 字段（老调用点）→ 退回原文案，行为不退化", () => {
    expect(describeAiFallback({}, t)).toBe("aiHeuristic()")
  })
})
