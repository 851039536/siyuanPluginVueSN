import type { SkillItem } from "@/types/ai"
import {
  describe,
  expect,
  it,
} from "vitest"
import { deduplicateSkills } from "./useSkillsLoader"

/** 构造去重入参（仅保留判定所需字段） */
function item(name: string, content: string, tool = "claude"): SkillItem {
  const id = `/skills/${name}-${tool}/SKILL.md`
  return {
    id,
    name,
    description: "",
    content,
    tool,
    scope: "global",
    sources: [{ id, tool, content }],
  }
}

describe("deduplicateSkills", () => {
  it("同名同内容：合并来源但不标记冲突（symlink/copy 重复安装）", () => {
    const merged = deduplicateSkills([
      item("x", "same", "claude"),
      item("x", "same", "codex"),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0].sources).toHaveLength(2)
    expect(merged[0].hasConflict).toBeFalsy()
  })

  it("同名不同内容：保留最长内容并标记冲突", () => {
    const merged = deduplicateSkills([
      item("x", "short", "claude"),
      item("x", "longer content", "codex"),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0].content).toBe("longer content")
    expect(merged[0].hasConflict).toBe(true)
  })

  it("不同名各自保留，不标记冲突", () => {
    const merged = deduplicateSkills([item("a", "1"), item("b", "2")])

    expect(merged).toHaveLength(2)
    expect(merged.every((skill) => !skill.hasConflict)).toBe(true)
  })
})
