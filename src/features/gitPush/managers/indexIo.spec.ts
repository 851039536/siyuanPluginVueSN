// 索引文件名生成单测：转义单射性（不同 id 不得撞同一文件）+ 遗留命名清理
import { describe, expect, it } from "vitest"
import { legacyProjectIndexFile, projectIndexFile } from "./indexIo"

describe("projectIndexFile 转义单射性", () => {
  it("含非法字符的 id 与其转义结果的字面 id 不碰撞（回归：原 `_` 前缀方案会撞）", () => {
    // "a/b" 转义为 a~2fb（v2）；字面 id "a_2fb" 全为安全字符，原样输出
    // v1 用 `_` 作前缀时两者都是 "a_2fb"，会落到同一份索引文件互相覆盖
    expect(projectIndexFile("commits", "a/b")).not.toBe(projectIndexFile("commits", "a_2fb"))
  })

  it("id 中的转义前缀字符本身被转义，不产生歧义", () => {
    // 字面 "~" 必须被转义，否则无法与转义序列的引导符区分
    expect(projectIndexFile("commits", "a~2fb")).not.toBe(projectIndexFile("commits", "a/b"))
  })

  it("常见 id 集合两两不碰撞", () => {
    const ids = [
      "a/b", "a_2fb", "a~2fb", "a_b", "a\\b", "a:b", "a b", "a-b", "a.b",
      "1-1", "1/1", "", "project", "a~", "~a", "a/b/c",
    ]
    const seen = new Map<string, string>()
    for (const id of ids) {
      const file = projectIndexFile("commits", id)
      const prev = seen.get(file)
      // 空 id 与字面 "project" 是有意的兜底重合，属已知例外
      if (prev !== undefined && !(prev === "" && id === "project")) {
        throw new Error(`id 碰撞：${JSON.stringify(prev)} 与 ${JSON.stringify(id)} -> ${file}`)
      }
      seen.set(file, id)
    }
  })

  it("空 id 走兜底名，不生成隐藏文件", () => {
    expect(projectIndexFile("commits", "")).toBe("project.commits.ndjson")
    expect(projectIndexFile("commits", "")).not.toMatch(/^\./)
  })

  it("非法字符一律不出现在文件名中（不越出索引目录）", () => {
    for (const id of ["a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b"]) {
      expect(projectIndexFile("commits", id)).not.toMatch(/[/\\:*?"<>|]/)
    }
  })

  it("三份 NDJSON 与 meta 后缀互不相同", () => {
    const id = "p1"
    const files = [
      projectIndexFile("commits", id),
      projectIndexFile("files", id),
      projectIndexFile("fileLines", id),
    ]
    expect(new Set(files).size).toBe(3)
  })
})

describe("legacyProjectIndexFile（v1 命名，仅用于升级清理）", () => {
  it("复现 v1 的 `_` 前缀命名", () => {
    expect(legacyProjectIndexFile("commits", "a/b")).toBe("a_2fb.commits.ndjson")
  })

  it("与 v2 命名在含非法字符时不同（升级清盘需两者都删）", () => {
    expect(legacyProjectIndexFile("commits", "a/b")).not.toBe(projectIndexFile("commits", "a/b"))
  })

  it("纯安全字符 id 下 v1 与 v2 命名一致（无需重复删除也无害）", () => {
    expect(legacyProjectIndexFile("commits", "abc-1.2")).toBe(projectIndexFile("commits", "abc-1.2"))
  })
})
