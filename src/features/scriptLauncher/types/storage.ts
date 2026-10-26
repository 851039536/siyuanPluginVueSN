/**
 * 脚本启动器 - 文件驱动存储层（思源 API 版）
 *
 * 所有文件操作通过 plugin.putFile / plugin.getFile + HTTP API，
 * 路径相对于 workspace data/ 目录。
 * 元数据通过 TypedStorage 持久化。
 */
import type { Plugin } from "siyuan"
import type {
  CreateScriptDTO,
  RunningProcess,
  Script,
  ScriptLauncherSettings,
  UpdateScriptDTO,
} from "./index"
import { getFile, getWorkspaceDir, putFile, removeFile } from "@/api"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import {
  DEFAULT_SCRIPT_LAUNCHER_SETTINGS,
  SCRIPT_LANGUAGE_CONFIG,
} from "./index"
import { createScriptId, detectLanguage, hasIllegalFileNameChars } from "../utils"

const SC_DIR = "data/storage/sc"

export class ScriptStorage {
  private storage: PluginStorage
  private scripts: TypedStorage<Script[]>
  private settings: TypedStorage<ScriptLauncherSettings>
  private runningProcesses: TypedStorage<RunningProcess[]>
  private readonly STORAGE_KEY = "scriptLauncher-scripts"
  private readonly SETTINGS_KEY = "scriptLauncher-settings"
  private readonly PROCESSES_KEY = "scriptLauncher-running-processes"
  private cachedWorkspaceRoot: string | null = null

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
    this.scripts = new TypedStorage(this.storage, this.STORAGE_KEY, [])
    this.settings = new TypedStorage(this.storage, this.SETTINGS_KEY, DEFAULT_SCRIPT_LAUNCHER_SETTINGS)
    this.runningProcesses = new TypedStorage(this.storage, this.PROCESSES_KEY, [])
  }

  // ========== 运行中进程持久化（思源重启后恢复查看） ==========

  /** 加载上次会话持久化的进程记录 */
  async loadRunningProcesses(): Promise<RunningProcess[]> {
    return this.runningProcesses.loadOrDefault()
  }

  /** 保存运行中进程记录（启动/停止/退出时同步落盘） */
  async saveRunningProcesses(processes: RunningProcess[]): Promise<boolean> {
    return this.runningProcesses.save(processes)
  }

  /** 获取工作区根目录（通过思源 API） — public，供外部使用 */
  async getWorkspaceRoot(): Promise<string | null> {
    if (this.cachedWorkspaceRoot) return this.cachedWorkspaceRoot
    try {
      const ws = await getWorkspaceDir()
      if (ws) this.cachedWorkspaceRoot = ws
      return ws || null
    } catch { return null }
  }

  /** 获取脚本文件的绝对路径（用于直接执行） */
  async getScriptPath(fileName: string): Promise<string | null> {
    const wsRoot = await this.getWorkspaceRoot()
    if (!wsRoot) return null
    const node = getNodeFsPathOs()
    if (!node) return null
    return node.path.join(wsRoot, this.scPath(fileName))
  }

  private scPath(fileName: string): string {
    return `${SC_DIR}/${fileName}`
  }

  private async putContent(fileName: string, content: string): Promise<void> {
    const file = new File([content], fileName, { type: "text/plain" })
    await putFile(this.scPath(fileName), false, file)
  }

  private async getContent(fileName: string): Promise<string | null> {
    try {
      const blob = await getFile(this.scPath(fileName))
      if (!blob) return null
      return await blob.text()
    } catch {
      return null
    }
  }

  private async removeContent(fileName: string): Promise<void> {
    try {
      await removeFile(this.scPath(fileName))
    } catch { /* 忽略 */ }
  }

  // ========== 设置 ==========

  /** 加载启动器设置（内置监听开关等） */
  async loadSettings(): Promise<ScriptLauncherSettings> {
    return this.settings.loadOrDefault()
  }

  /** 保存启动器设置 */
  async saveSettings(data: ScriptLauncherSettings): Promise<boolean> {
    return this.settings.save(data)
  }

  // ========== CRUD ==========

  async getAll(): Promise<Script[]> {
    const data = await this.scripts.loadOrDefault()
    return data.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async isNameUnique(name: string, excludeId?: string): Promise<boolean> {
    const all = await this.getAll()
    return !all.some((s) => s.name === name && s.id !== excludeId)
  }

  /** 由名称与语言推导磁盘文件名（语言变更时扩展名跟随变化） */
  private buildFileName(name: string, language: Script["language"]): string {
    return `${name}${SCRIPT_LANGUAGE_CONFIG[language].extension}`
  }

  async add(data: CreateScriptDTO): Promise<Script> {
    if (hasIllegalFileNameChars(data.name)) throw new Error("Script name contains illegal characters: \\ / : * ? \" < > |")
    if (!(await this.isNameUnique(data.name))) throw new Error("Script name already exists")

    const now = Date.now()
    const fileName = this.buildFileName(data.name, data.language)

    const script: Script = {
      id: createScriptId(),
      name: data.name,
      language: data.language,
      category: data.category || "默认",
      description: data.description || "",
      fileName,
      createdAt: now,
      updatedAt: now,
    }

    await this.putContent(fileName, data.content || "")

    const all = await this.getAll()
    all.push(script)
    await this.scripts.save(all)
    return script
  }

  async update(id: string, data: UpdateScriptDTO): Promise<boolean> {
    const all = await this.getAll()
    const index = all.findIndex((s) => s.id === id)
    if (index === -1) return false
    const current = all[index]

    const nextName = data.name ?? current.name
    const nextLanguage = data.language ?? current.language

    if (nextName !== current.name) {
      if (hasIllegalFileNameChars(nextName)) throw new Error("Script name contains illegal characters: \\ / : * ? \" < > |")
      if (!(await this.isNameUnique(nextName, id))) throw new Error("Script name already exists")
    }

    // 名称/语言变化时同步重算 fileName（扩展名跟随语言），并迁移磁盘文件，
    // 避免「用 node.exe 执行 .py」的解释器错配与脚本名/文件名脱钩
    const nextFileName = this.buildFileName(nextName, nextLanguage)
    const renamed = nextFileName !== current.fileName

    if (renamed) {
      const content = data.content !== undefined
        ? data.content
        : (await this.getContent(current.fileName)) ?? ""
      await this.putContent(nextFileName, content)
      await this.removeContent(current.fileName)
    } else if (data.content !== undefined) {
      await this.putContent(current.fileName, data.content)
    }

    // 显式构造元数据：不把 data.content 展开进元数据（内容只落磁盘文件），
    // 并顺带清掉旧版本误存进元数据的 content 字段
    all[index] = {
      id: current.id,
      name: nextName,
      language: nextLanguage,
      category: data.category ?? current.category,
      description: data.description ?? current.description,
      fileName: nextFileName,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      lastRunAt: current.lastRunAt,
    }
    await this.scripts.save(all)
    return true
  }

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll()
    const script = all.find((s) => s.id === id)
    if (!script) return false

    await this.removeContent(script.fileName)
    await this.scripts.save(all.filter((s) => s.id !== id))
    return true
  }

  async updateLastRun(id: string): Promise<void> {
    const all = await this.getAll()
    const index = all.findIndex((s) => s.id === id)
    if (index === -1) return
    all[index].lastRunAt = Date.now()
    await this.scripts.save(all)
  }

  // ========== 导入 ==========

  /** 导入脚本：接收文件名和内容，通过 API 写入 sc 目录；重复导入只更新既有条目 */
  async importFileContent(fileName: string, content: string): Promise<Script> {
    const all = await this.getAll()
    const existing = all.find((s) => s.fileName === fileName)

    if (existing) {
      // 重复导入：覆盖文件内容并刷新元数据，不新增重复条目
      await this.putContent(fileName, content)
      existing.description = `导入自 ${fileName}`
      existing.updatedAt = Date.now()
      await this.scripts.save(all)
      return existing
    }

    await this.putContent(fileName, content)

    const lang = detectLanguage(fileName)
    const name = fileName.replace(/\.[^.]+$/, "")
    const now = Date.now()

    const script: Script = {
      id: createScriptId(),
      name,
      language: lang,
      category: "默认",
      description: `导入自 ${fileName}`,
      fileName,
      createdAt: now,
      updatedAt: now,
    }

    all.push(script)
    await this.scripts.save(all)
    return script
  }

  // ========== 内容读写 ==========

  async loadContent(fileName: string): Promise<string | null> {
    return this.getContent(fileName)
  }
}
