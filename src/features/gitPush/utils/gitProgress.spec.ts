import { describe, expect, it } from "vitest"
import { createGitProgressParser } from "./gitProgress"

describe("createGitProgressParser", () => {
  it("解析 \\r 原地刷新的多个百分比", () => {
    const parser = createGitProgressParser()
    const events = parser.push(
      "Counting objects: 10%\rCounting objects: 50%\rCounting objects: 100% (5/5), done.\r",
    )
    expect(events.map((e) => [e.stage, e.percent])).toEqual([
      ["counting", 10],
      ["counting", 50],
      ["counting", 100],
    ])
  })

  it("跨块截断的行拼回后只上报一次", () => {
    const parser = createGitProgressParser()
    expect(parser.push("Compress")).toEqual([])
    const events = parser.push("ing objects: 42% (2/5)\r")
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ stage: "compressing", percent: 42 })
  })

  it("剥离 remote: 前缀后再识别阶段", () => {
    const parser = createGitProgressParser()
    const events = parser.push("remote: Receiving objects: 100% (9/9), done.\n")
    expect(events[0]).toMatchObject({ stage: "receiving", percent: 100 })
  })

  it("错误行只作为 detail，不推进阶段", () => {
    const parser = createGitProgressParser()
    const events = parser.push("error: failed to push some refs\n")
    expect(events).toHaveLength(1)
    expect(events[0].stage).toBeUndefined()
    expect(events[0].detail).toContain("failed to push")
  })

  it("To 行映射为 remote，ref 更新行映射为 updating", () => {
    const parser = createGitProgressParser()
    const events = parser.push("To github.com:user/repo.git\n   abc1234..def5678  main -> main\n")
    expect(events.map((e) => e.stage)).toEqual(["remote", "updating"])
  })

  it("被拒推送行不能点亮 updating", () => {
    const parser = createGitProgressParser()
    const events = parser.push(" ! [rejected]        main -> main (fetch first)\n")
    expect(events[0].stage).toBeUndefined()
    expect(events[0].detail).toContain("[rejected]")
  })

  it("Unpacking objects 映射为 unpacking", () => {
    const parser = createGitProgressParser()
    const events = parser.push("Unpacking objects: 100% (3/3), done.\n")
    expect(events[0]).toMatchObject({ stage: "unpacking", percent: 100 })
  })

  it("pull 快进行映射为 updating", () => {
    const parser = createGitProgressParser()
    const events = parser.push("Updating abc1234..def5678\nFast-forward\n")
    expect(events.map((e) => e.stage)).toEqual(["updating", "updating"])
  })

  it("同阶段同百分比的重复进度不重复上报", () => {
    const parser = createGitProgressParser()
    parser.push("Writing objects: 50% (1/2)\r")
    const events = parser.push("Writing objects: 50% (1/2)\r")
    expect(events).toHaveLength(0)
  })

  it("flush 输出残留半行", () => {
    const parser = createGitProgressParser()
    expect(parser.push("Resolving deltas: 77% (7/9)")).toEqual([])
    const events = parser.flush()
    expect(events[0]).toMatchObject({ stage: "resolving", percent: 77 })
  })

  it("多 ref 块时后续阶段重新上报", () => {
    const parser = createGitProgressParser()
    parser.push("Writing objects: 100% (2/2), done.\nTo origin\n")
    const events = parser.push(" Writing objects: 100% (1/1), done.\n")
    expect(events[0]).toMatchObject({ stage: "writing", percent: 100 })
  })
})
