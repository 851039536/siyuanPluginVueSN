/**
 * Skills 管理器（原 skillsViewer/SkillsViewerManager，随功能并入 aiContentGenerator）
 * 扫描并读取 AI 编程工具的 Skills 配置文件
 * 兼容 Claude, CodeBuddy, Qoder, Trae, Opencode，以及思源内置 Agent 技能目录（工作区作用域）
 */

import { AI_TOOLS } from "@/config/aiTools"
import type { AIToolConfig, AIToolType } from "@/config/aiTools"
import { readWorkspaceDir } from "@/utils/workspaceDir"

/** 技能说明文件名候选：大写优先（Agent Skills 规范），兼容历史小写约定 */
const SKILL_FILE_NAMES = ["SKILL.md", "skill.md"] as const

/** 去掉 UTF-8 BOM 并统一换行为 LF，避免首行 frontmatter/标题判定受编码影响 */
function normalizeSkillMdContent(content: string): string {
  return content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
}

/**
 * 拆分文件头部 YAML frontmatter，只提取 name/description
 * 未闭合（首尾没有成对的 ---）时视为无 frontmatter，由调用方回退旧解析逻辑
 */
function splitFrontmatter(content: string): { body: string, fields: Record<string, string> } {
  const lines = content.split("\n")
  if (lines[0].trim() !== "---") {
    return {
      body: content,
      fields: {},
    }
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
  if (endIndex < 0) {
    return {
      body: content,
      fields: {},
    }
  }

  return {
    body: lines.slice(endIndex + 1).join("\n"),
    fields: parseFrontmatterFields(lines.slice(1, endIndex)),
  }
}

/** 解析 frontmatter 内的 name/description，忽略其他字段与注释 */
function parseFrontmatterFields(lines: string[]): Record<string, string> {
  const fields: Record<string, string> = {}

  for (let i = 0; i < lines.length; i++) {
    const keyMatch = lines[i].match(/^([\w-]+)[ \t]*:(.*)$/)
    if (!keyMatch) continue

    const key = keyMatch[1].toLowerCase()
    if (key !== "name" && key !== "description") continue

    const rawValue = keyMatch[2].trim()
    if (/^[|>][+-]?$/.test(rawValue)) {
      // 块状标量：收集缩进行，| 保留换行，> 折叠为空格
      const blockLines: string[] = []
      let j = i + 1
      while (j < lines.length && (lines[j].trim() === "" || /^\s/.test(lines[j]))) {
        blockLines.push(lines[j].trim())
        j++
      }
      i = j - 1
      fields[key] = rawValue.startsWith("|")
        ? blockLines.join("\n").trim()
        : blockLines.join(" ").trim()
      continue
    }

    // 去掉成对的单/双引号
    fields[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2").trim()
  }

  return fields
}

export interface SkillInfo {
  name: string
  description: string
  content: string
  filePath: string
  tool: AIToolType
  fileSize: number
}

export class SkillsManager {
  private fs: any = null
  private path: any = null
  private homeDir = ""
  private available = false
  /** 思源工作区根目录缓存（null 表示尚未解析；解析失败缓存为空串） */
  private workspaceDirCache: string | null = null

  constructor() {
    this.initFS()
  }

  private initFS() {
    try {
      if (typeof window.require === "function") {
        this.fs = window.require("fs")
        this.path = window.require("path")
        const os = window.require("os")
        this.homeDir = os.homedir()
        this.available = true
      }
    } catch {
      this.available = false
    }
  }

  isAvailable(): boolean {
    return this.available
  }

  getHomeDir(): string {
    return this.homeDir
  }

  /** 思源工作区根目录（内核配置读取，见 @/utils/workspaceDir）；不可用时为空串 */
  async getWorkspaceDir(): Promise<string> {
    if (this.workspaceDirCache === null) {
      this.workspaceDirCache = await readWorkspaceDir()
    }
    return this.workspaceDirCache
  }

  /** 是否为思源工作区作用域下的技能（按路径前缀判定） */
  async isWorkspaceSkill(filePath: string): Promise<boolean> {
    const ws = await this.getWorkspaceDir()
    return !!ws && filePath.startsWith(ws)
  }

  /** skill.md 路径 → 所在技能目录（收敛原消费方对 getNodeModules().path.dirname 的依赖） */
  resolveSkillDir(filePath: string): string {
    return this.path.dirname(filePath)
  }

  /** 工具的首个可打开技能目录：全局（用户目录）优先，其次思源工作区；均无返回 null */
  async firstSkillDir(tool: AIToolConfig): Promise<string | null> {
    if (!this.available) return null
    if (tool.skillPaths.length > 0) {
      return this.path.join(this.homeDir, tool.skillPaths[0])
    }
    const ws = await this.getWorkspaceDir()
    if (ws && tool.workspacePaths && tool.workspacePaths.length > 0) {
      return this.path.join(ws, tool.workspacePaths[0])
    }
    return null
  }

  /** 拼接目录路径（收敛原消费方对 getNodeModules().path.join 的依赖） */
  resolveDir(basePath: string, relPath: string): string {
    return this.path.join(basePath, relPath)
  }

  async scanToolSkills(tool: AIToolConfig, projectPath?: string): Promise<SkillInfo[]> {
    if (!this.available) return []

    const skills: SkillInfo[] = []

    for (const relPath of tool.skillPaths) {
      const fullPath = this.path.join(this.homeDir, relPath)
      const found = await this.scanSkillDirectory(fullPath, tool.id)
      skills.push(...found)
    }

    if (projectPath) {
      for (const relPath of tool.projectPaths) {
        const fullPath = this.path.join(projectPath, relPath)
        const found = await this.scanSkillDirectory(fullPath, tool.id)
        skills.push(...found)
      }
    }

    // 思源工作区作用域（如 data/storage/ai/agent/skills）：与项目路径输入无关，始终扫描
    if (tool.workspacePaths && tool.workspacePaths.length > 0) {
      const ws = await this.getWorkspaceDir()
      if (ws) {
        for (const relPath of tool.workspacePaths) {
          const fullPath = this.path.join(ws, relPath)
          const found = await this.scanSkillDirectory(fullPath, tool.id)
          skills.push(...found)
        }
      }
    }

    return skills
  }

  async scanAllSkills(projectPath?: string): Promise<SkillInfo[]> {
    const results = await Promise.all(
      AI_TOOLS.map((tool) => this.scanToolSkills(tool, projectPath)),
    )
    return results.flat()
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.fs.promises.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /** 在技能目录内按候选文件名查找说明文件，返回磁盘上的真实文件名（规避大小写敏感差异） */
  private async findSkillFile(skillDir: string): Promise<string | null> {
    let entries: any[]
    try {
      entries = await this.fs.promises.readdir(skillDir, { withFileTypes: true })
    } catch {
      return null
    }

    for (const fileName of SKILL_FILE_NAMES) {
      const entry = entries.find((item: any) => !item.isDirectory() && item.name === fileName)
      if (entry) return this.path.join(skillDir, entry.name)
    }

    return null
  }

  private async scanSkillDirectory(
    dirPath: string,
    toolId: AIToolType,
  ): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = []

    try {
      if (!(await this.fileExists(dirPath))) return []

      const entries = await this.fs.promises.readdir(dirPath, {
        withFileTypes: true,
      })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillDir = this.path.join(dirPath, entry.name)

        try {
          const skillMdPath = await this.findSkillFile(skillDir)
          if (skillMdPath) {
            const content = normalizeSkillMdContent(
              await this.fs.promises.readFile(skillMdPath, "utf-8"),
            )
            const stat = await this.fs.promises.stat(skillMdPath)
            const {
              name,
              description,
            } = this.parseSkillMd(content, entry.name)
            skills.push({
              name,
              description,
              content,
              filePath: skillMdPath,
              tool: toolId,
              fileSize: stat.size,
            })
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    } catch {
      // 目录不存在或无法访问
    }

    return skills
  }

  public parseSkillMd(
    content: string,
    fallbackName: string,
  ): {
    name: string
    description: string
  } {
    const normalized = normalizeSkillMdContent(content)
    const {
      body,
      fields,
    } = splitFrontmatter(normalized)

    let name = fields.name || fallbackName
    let description = fields.description || ""

    const lines = body.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!fields.name && name === fallbackName) {
        const headingMatch = trimmed.match(/^#+\s+(.+)/)
        if (headingMatch) {
          name = headingMatch[1].trim()
          continue
        }
      }
      if (!description && trimmed && !trimmed.startsWith("#")) {
        description = trimmed
        break
      }
    }

    if (description.length > 200) {
      description = `${description.slice(0, 200)}...`
    }

    return {
      name,
      description,
    }
  }

  private async checkPathGroup(
    basePath: string,
    relPaths: string[],
  ): Promise<{ exists: boolean, count: number }> {
    let exists = false
    let count = 0
    for (const relPath of relPaths) {
      const fullPath = this.path.join(basePath, relPath)
      try {
        if (await this.fileExists(fullPath)) {
          exists = true
          const entries = await this.fs.promises.readdir(fullPath, {
            withFileTypes: true,
          })
          count += entries.filter((e: any) => e.isDirectory()).length
        }
      } catch {
        // 忽略
      }
    }
    return {
      exists,
      count,
    }
  }

  async checkToolExists(tool: AIToolConfig, projectPath?: string): Promise<{
    global: boolean
    project: boolean
    globalCount: number
    projectCount: number
  }> {
    if (!this.available) {
      return {
        global: false,
        project: false,
        globalCount: 0,
        projectCount: 0,
      }
    }

    // 计数口径：global 桶 = 全局（用户目录）+ 思源工作区作用域（UI 卡片按合计展示）
    const globalResult = await this.checkPathGroup(this.homeDir, tool.skillPaths)
    const wsDir = await this.getWorkspaceDir()
    const workspaceResult = (wsDir && tool.workspacePaths && tool.workspacePaths.length > 0)
      ? await this.checkPathGroup(wsDir, tool.workspacePaths)
      : { exists: false, count: 0 }
    const projectResult = projectPath
      ? await this.checkPathGroup(projectPath, tool.projectPaths)
      : {
          exists: false,
          count: 0,
        }

    return {
      global: globalResult.exists || workspaceResult.exists,
      project: projectResult.exists,
      globalCount: globalResult.count + workspaceResult.count,
      projectCount: projectResult.count,
    }
  }

  async openInFileManager(dirPath: string): Promise<boolean> {
    if (!this.available) return false
    try {
      const { shell } = window.require("electron")
      await shell.openPath(dirPath)
      return true
    } catch {
      return false
    }
  }

  async saveSkillContent(filePath: string, content: string): Promise<boolean> {
    if (!this.available) return false
    try {
      await this.fs.promises.writeFile(filePath, content, "utf-8")
      return true
    } catch {
      return false
    }
  }

  async deleteSkill(skillDirPath: string): Promise<boolean> {
    if (!this.available) return false
    try {
      await this.fs.promises.rm(skillDirPath, {
        recursive: true,
        force: true,
      })
      return true
    } catch {
      return false
    }
  }

  async copySkill(sourceSkillDir: string, targetDir: string): Promise<boolean> {
    if (!this.available) return false
    try {
      const skillName = this.path.basename(sourceSkillDir)
      const destPath = this.path.join(targetDir, skillName)
      if (await this.fileExists(destPath)) return false
      await this.fs.promises.mkdir(targetDir, { recursive: true })
      await this.fs.promises.cp(sourceSkillDir, destPath, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  destroy() {
    this.fs = null
    this.path = null
    this.available = false
    this.workspaceDirCache = null
  }
}
