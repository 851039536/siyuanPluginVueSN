/**
 * Skills 查看器管理器
 * 扫描并读取 AI 编程工具的 Skills 配置文件
 * 兼容 Claude, CodeBuddy, Qoder, Trae
 */

export interface SkillInfo {
  name: string
  description: string
  content: string
  filePath: string
  tool: AIToolType
  fileSize: number
}

export type AIToolType = "claude" | "codebuddy" | "qoder" | "trae"

export interface AIToolConfig {
  id: AIToolType
  name: string
  icon: string
  color: string
  skillPaths: string[]
  projectPaths: string[]
}

export const AI_TOOLS: AIToolConfig[] = [
  {
    id: "claude",
    name: "Claude",
    icon: "🟠",
    color: "#D97757",
    skillPaths: [".claude/skills"],
    projectPaths: [".claude/skills"],
  },
  {
    id: "codebuddy",
    name: "CodeBuddy",
    icon: "🔵",
    color: "#4A90D9",
    skillPaths: [".codebuddy/skills"],
    projectPaths: [".codebuddy/skills"],
  },
  {
    id: "qoder",
    name: "Qoder",
    icon: "🟣",
    color: "#9B59B6",
    skillPaths: [".qoder/skills"],
    projectPaths: [".qoder/skills"],
  },
  {
    id: "trae",
    name: "Trae",
    icon: "🟢",
    color: "#27AE60",
    skillPaths: [".trae/skills"],
    projectPaths: [".trae/skills"],
  },
]

export class SkillsViewerManager {
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
  ): { name: string; description: string } {
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
  ): Promise<{ exists: boolean; count: number }> {
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
    return { exists, count }
  }

  async checkToolExists(tool: AIToolConfig, projectPath?: string): Promise<{
    global: boolean
    project: boolean
    globalCount: number
    projectCount: number
  }> {
    if (!this.available) return { global: false, project: false, globalCount: 0, projectCount: 0 }

    const globalResult = await this.checkPathGroup(this.homeDir, tool.skillPaths)
    const projectResult = projectPath
      ? await this.checkPathGroup(projectPath, tool.projectPaths)
      : { exists: false, count: 0 }

    return {
      global: globalResult.exists,
      project: projectResult.exists,
      globalCount: globalResult.count,
      projectCount: projectResult.count,
    }
  }

  async readSkillContent(filePath: string): Promise<string | null> {
    if (!this.available) return null
    try {
      return await this.fs.promises.readFile(filePath, "utf-8")
    } catch {
      return null
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

  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const size = bytes / k ** i
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  }

  destroy() {
    this.fs = null
    this.path = null
    this.available = false
  }
}
