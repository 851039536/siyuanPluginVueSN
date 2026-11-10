/**
 * SkillsManager 文件系统行为断言（真实临时目录）
 *
 * 覆盖两处只有落到磁盘才能验证的逻辑：
 * - symlink 安装的技能目录必须被扫描到（`npx skills` 等工具默认以链接安装）
 * - 删除前的来源根守卫（只允许删除已登记根下的直接子目录）
 *
 * 环境说明：Vitest 配置为 node 环境，没有 window；这里注入 `window.require`
 * 让 SkillsManager 拿到真实 node 模块（与思源 Electron 渲染进程的取模块方式一致）。
 */
import type { AIToolConfig } from "@/config/aiTools"
import type { SkillsManager as SkillsManagerType } from "./SkillsManager"
import { createRequire } from "node:module"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { getAITool } from "@/config/aiTools"
import { SkillsManager } from "./SkillsManager"

vi.mock("@/utils/workspaceDir", () => ({
  readWorkspaceDir: vi.fn(() => Promise.resolve("")),
}))

const nodeRequire = createRequire(import.meta.url)

let tempRoot = ""
let skillsRoot = ""
let manager: SkillsManagerType
let tool: AIToolConfig

/** 创建目录符号链接（Windows 用 junction，避免管理员权限要求） */
function createDirLink(target: string, linkPath: string): void {
  symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir")
}

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "siyuan-skills-fs-"))
  skillsRoot = join(tempRoot, ".claude", "skills")

  const realSkillDir = join(skillsRoot, "real-skill")
  mkdirSync(realSkillDir, { recursive: true })
  writeFileSync(
    join(realSkillDir, "SKILL.md"),
    "---\nname: real-skill\ndescription: 真实目录技能\n---\n# Real\n",
    "utf-8",
  )

  // 纯目录、无 SKILL.md：不应计入扫描结果
  mkdirSync(join(skillsRoot, "empty-dir"), { recursive: true })

  // symlink 安装形态：链接目录必须与真实目录一样被扫描到
  createDirLink(realSkillDir, join(skillsRoot, "linked-skill"))

  ;(globalThis as any).window = {
    require: nodeRequire,
  }
  manager = new SkillsManager()
  tool = {
    ...(getAITool("claude") as AIToolConfig),
    skillPaths: [],
    projectPaths: [".claude/skills"],
    workspacePaths: [],
  }
})

afterAll(() => {
  manager?.destroy()
  delete (globalThis as any).window
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
})

describe("scanToolSkills 符号链接", () => {
  it("symlink 安装的技能目录会被扫描到，无 SKILL.md 的目录不计入", async () => {
    const skills = await manager.scanToolSkills(tool, tempRoot)

    expect(skills).toHaveLength(2)
    expect(skills.map((skill) => skill.filePath).sort()).toEqual([
      join(skillsRoot, "linked-skill", "SKILL.md"),
      join(skillsRoot, "real-skill", "SKILL.md"),
    ].sort())
    expect(skills.every((skill) => skill.scope === "project")).toBe(true)
  })
})

describe("isSkillDirUnderRoots", () => {
  it("只承认已登记来源根的直接子目录（含 symlink 目录）", async () => {
    expect(await manager.isSkillDirUnderRoots(join(skillsRoot, "real-skill"), tempRoot)).toBe(true)
    expect(await manager.isSkillDirUnderRoots(join(skillsRoot, "linked-skill"), tempRoot)).toBe(true)
  })

  it("根目录本身与根外路径一律拒绝", async () => {
    expect(await manager.isSkillDirUnderRoots(skillsRoot, tempRoot)).toBe(false)
    expect(await manager.isSkillDirUnderRoots(join(tempRoot, "outside"), tempRoot)).toBe(false)
    // 未提供 projectPath 时，项目级根不在白名单里
    expect(await manager.isSkillDirUnderRoots(join(skillsRoot, "real-skill"), undefined)).toBe(false)
  })
})

describe("deleteSkill 来源根守卫", () => {
  it("拒绝删除 skills 根目录本身", async () => {
    expect(await manager.deleteSkill(skillsRoot, tempRoot)).toBe(false)
    expect(existsSync(skillsRoot)).toBe(true)
  })

  it("允许删除根下的技能子目录", async () => {
    const removable = join(skillsRoot, "empty-dir")
    expect(await manager.deleteSkill(removable, tempRoot)).toBe(true)
    expect(existsSync(removable)).toBe(false)
  })
})
