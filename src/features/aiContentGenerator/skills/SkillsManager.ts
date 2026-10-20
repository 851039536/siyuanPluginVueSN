/**
 * Skills 管理器（原 skillsViewer/SkillsViewerManager，随功能并入 aiContentGenerator）
 * 扫描并读取 AI 编程工具的 Skills 配置文件
 * 兼容 Claude, CodeBuddy, Qoder, Trae, Opencode
 */

import { AI_TOOLS } from "@/config/aiTools"
import type { AIToolConfig, AIToolType } from "@/config/aiTools"

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

  /** skill.md 路径 → 所在技能目录（收敛原消费方对 getNodeModules().path.dirname 的依赖） */
  resolveSkillDir(filePath: string): string {
    return this.path.dirname(filePath)
  }

  /** 工具的首个全局技能目录（供「打开目录」使用），无可用路径时返回 null */
  firstGlobalSkillDir(tool: AIToolConfig): string | null {
    if (!this.available || tool.skillPaths.length === 0) return null
    return this.path.join(this.homeDir, tool.skillPaths[0])
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
        const skillMdPath = this.path.join(skillDir, "skill.md")

        try {
          if (await this.fileExists(skillMdPath)) {
            const content = await this.fs.promises.readFile(skillMdPath, "utf-8")
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
  ): { name: string, description: string } {
    let name = fallbackName
    let description = ""

    const lines = content.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (name === fallbackName) {
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

    const globalResult = await this.checkPathGroup(this.homeDir, tool.skillPaths)
    const projectResult = projectPath
      ? await this.checkPathGroup(projectPath, tool.projectPaths)
      : {
          exists: false,
          count: 0,
        }

    return {
      global: globalResult.exists,
      project: projectResult.exists,
      globalCount: globalResult.count,
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
  }
}
