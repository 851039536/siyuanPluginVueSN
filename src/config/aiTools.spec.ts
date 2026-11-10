import {
  describe,
  expect,
  it,
} from "vitest"
import {
  AI_TOOLS,
  isKnownSkillSourceId,
  SKILL_SOURCES,
  skillSourceId,
} from "./aiTools"

describe("skillSources", () => {
  it("覆盖全部工具的三类路径，且 id 唯一（id 冲突会让一个开关同时影响多条路径）", () => {
    const expected = AI_TOOLS.reduce(
      (sum, tool) =>
        sum + tool.skillPaths.length + tool.projectPaths.length + (tool.workspacePaths?.length ?? 0),
      0,
    )
    expect(SKILL_SOURCES).toHaveLength(expected)

    const ids = SKILL_SOURCES.map((source) => source.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("id 形如 toolId:scope:相对路径，且能被 isKnownSkillSourceId 识别", () => {
    const claudeGlobal = SKILL_SOURCES.find(
      (source) => source.toolId === "claude" && source.scope === "global",
    )
    expect(claudeGlobal?.id).toBe(skillSourceId("claude", "global", ".claude/skills"))

    for (const source of SKILL_SOURCES) {
      expect(isKnownSkillSourceId(source.id)).toBe(true)
    }
  })

  it("未登记/已下线的来源 id 不被识别（持久化残留记录在加载时会被过滤）", () => {
    expect(isKnownSkillSourceId("claude:global:.removed/skills")).toBe(false)
    expect(isKnownSkillSourceId("")).toBe(false)
  })
})
