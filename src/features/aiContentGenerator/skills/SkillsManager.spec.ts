import {
  describe,
  expect,
  it,
} from "vitest"
import { toSkillItem } from "../types"
import { SkillsManager } from "./SkillsManager"

const manager = new SkillsManager()

describe("skillsManager.parseSkillMd", () => {
  it("取首个标题作为技能名，首个非空非标题行作为描述", () => {
    const {
      name,
      description,
    } = manager.parseSkillMd(
      "# 我的技能\n\n这是描述。\n更多正文内容",
      "fallback-dir",
    )
    expect(name).toBe("我的技能")
    expect(description).toBe("这是描述。")
  })

  it("无标题时回退到目录名，仍提取描述", () => {
    const {
      name,
      description,
    } = manager.parseSkillMd(
      "第一行描述\n第二行内容",
      "fallback-dir",
    )
    expect(name).toBe("fallback-dir")
    expect(description).toBe("第一行描述")
  })

  it("描述命中即停止，不被后续标题覆盖", () => {
    const {
      name,
      description,
    } = manager.parseSkillMd(
      "前言描述\n# 后置标题",
      "fallback-dir",
    )
    expect(name).toBe("fallback-dir")
    expect(description).toBe("前言描述")
  })

  it("跳过标题行取描述（多级标题场景）", () => {
    const {
      name,
      description,
    } = manager.parseSkillMd(
      "## 二级标题\n### 三级标题\n真正的描述",
      "fallback-dir",
    )
    expect(name).toBe("二级标题")
    expect(description).toBe("真正的描述")
  })

  it("描述超过 200 字符时截断并追加省略号", () => {
    const long = "a".repeat(250)
    const { description } = manager.parseSkillMd(long, "fallback-dir")
    expect(description).toHaveLength(203)
    expect(description).toBe(`${"a".repeat(200)}...`)
  })
})

describe("toSkillItem", () => {
  it("skillInfo → SkillItem：id 取 filePath，sources 单元素", () => {
    const item = toSkillItem({
      name: "技能名",
      description: "描述",
      content: "# 技能名",
      filePath: "/home/u/.claude/skills/x/skill.md",
      tool: "claude",
      fileSize: 42,
    })
    expect(item.id).toBe("/home/u/.claude/skills/x/skill.md")
    expect(item.name).toBe("技能名")
    expect(item.tool).toBe("claude")
    expect(item.sources).toHaveLength(1)
    expect(item.sources[0]).toEqual({
      id: "/home/u/.claude/skills/x/skill.md",
      tool: "claude",
      content: "# 技能名",
    })
  })
})
