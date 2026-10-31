// parseProjectTags 行为断言：中英文逗号、去空白、去重、忽略空项
import { describe, expect, it } from "vitest"
import { parseProjectTags } from "./projectForm"

describe("parseProjectTags", () => {
  it("空文本返回空数组", () => {
    expect(parseProjectTags("")).toEqual([])
    expect(parseProjectTags("  ,  ， ")).toEqual([])
  })

  it("中英文逗号均作为分隔符并去空白", () => {
    expect(parseProjectTags(" a , b，c ")).toEqual(["a", "b", "c"])
  })

  it("重复标签去重且保留首次出现顺序", () => {
    expect(parseProjectTags("a,b,a,c,b")).toEqual(["a", "b", "c"])
  })
})
