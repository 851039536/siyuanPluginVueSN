// 提交分析缓存新鲜度判定（diffHeadProjects）单元测试
//
// 契约：只有「缓存与当前都存在且不同」才判定过期；探测失败（空串）、旧缓存缺记录、
// 已删除项目一律不触发重抓——否则每次进入概览都会误跑整轮 git log。
import { describe, expect, it } from "vitest"
import { diffHeadProjects } from "./analysisFreshness"

describe("diffHeadProjects（HEAD 新鲜度判定）", () => {
  it("HEAD 不一致的项目判定为过期", () => {
    const stale = diffHeadProjects(
      { a: "111", b: "222" },
      { a: "111", b: "333" },
      ["a", "b"],
    )
    expect(stale).toEqual(["b"])
  })

  it("HEAD 一致时不判定过期", () => {
    expect(diffHeadProjects({ a: "111" }, { a: "111" }, ["a"])).toEqual([])
  })

  it("探测失败（空串）不判定过期：结果未知不得误伤缓存", () => {
    expect(diffHeadProjects({ a: "111" }, { a: "" }, ["a"])).toEqual([])
    expect(diffHeadProjects({ a: "111" }, {}, ["a"])).toEqual([])
  })

  it("旧缓存无 heads 字段/缺该项目记录时不判定（兼容升级）", () => {
    expect(diffHeadProjects(undefined, { a: "111" }, ["a"])).toEqual([])
    expect(diffHeadProjects({}, { a: "111" }, ["a"])).toEqual([])
  })

  it("已删除的项目不参与判定", () => {
    expect(diffHeadProjects({ gone: "111" }, { gone: "222" }, [])).toEqual([])
  })
})
