/**
 * 脚本启动器 - 文件驱动存储层（思源 API 版）
 *
 * 所有文件操作通过 plugin.putFile / plugin.getFile + HTTP API，
 * 路径相对于 workspace data/ 目录。
 * 元数据通过 TypedStorage 持久化。
 */
import type {
  CreateScriptDTO,
  Script,
  ScriptLanguage,
  UpdateScriptDTO,
} from "./index"
import { Plugin } from "siyuan"
import { getFile, putFile, removeFile } from "@/api"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

const SC_DIR = "data/storage/sc"

function getNodeModules(): { fs: any, path: any, os: any } | null {
  try {
    const fs = require("node:fs")
    const path = require("node:path")
    const os = require("node:os")
    return { fs, path, os }
  } catch {
    return null
  }
}

function detectLanguage(fileName: string): ScriptLanguage {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, ScriptLanguage> = {
    py: "python", pyw: "python",
    sh: "bash", bash: "bash",
    ps1: "powershell",
    js: "nodejs", mjs: "nodejs",
    bat: "batch", cmd: "batch",
  }
  return map[ext] || "other"
}

export class ScriptStorage {
  private storage: PluginStorage
  private scripts: TypedStorage<Script[]>
  private plugin: Plugin
  private readonly STORAGE_KEY = "scriptLauncher-scripts"

  constructor(plugin: Plugin, _dataDir: string) {
    this.plugin = plugin
    this.storage = new PluginStorage(plugin)
    this.scripts = new TypedStorage(this.storage, this.STORAGE_KEY, [])
  }

  async init(): Promise<void> { /* no-op */ }

  // ========== 文件操作（思源 api.ts） ==========

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

  // ========== CRUD ==========

  async getAll(): Promise<Script[]> {
    const data = await this.scripts.loadOrDefault()
    return data.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async isNameUnique(name: string, excludeId?: string): Promise<boolean> {
    const all = await this.getAll()
    return !all.some((s) => s.name === name && s.id !== excludeId)
  }

  async add(data: CreateScriptDTO): Promise<Script> {
    if (!(await this.isNameUnique(data.name))) throw new Error("Script name already exists")

    const now = Date.now()
    const ext = this.getExtension(data.language)
    const fileName = `${data.name}${ext}`

    const script: Script = {
      id: `script-${now}`, name: data.name, language: data.language,
      category: data.category || "默认", description: data.description || "",
      fileName, createdAt: now, updatedAt: now,
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

    if (data.name && data.name !== all[index].name) {
      if (!(await this.isNameUnique(data.name, id))) throw new Error("Script name already exists")
    }

    if (data.content !== undefined) {
      await this.putContent(all[index].fileName, data.content)
    }

    all[index] = { ...all[index], ...data, updatedAt: Date.now() }
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

  /** 导入脚本：接收文件名和内容，通过 API 写入 sc 目录 */
  async importFileContent(fileName: string, content: string): Promise<Script> {
    await this.putContent(fileName, content)

    const lang = detectLanguage(fileName)
    const name = fileName.replace(/\.[^.]+$/, "")
    const now = Date.now()

    const script: Script = {
      id: `script-${now}`, name, language: lang, category: "默认",
      description: `导入自 ${fileName}`, fileName, createdAt: now, updatedAt: now,
    }

    const all = await this.getAll()
    all.push(script)
    await this.scripts.save(all)
    return script
  }

  // ========== 内容读写 ==========

  async loadContent(fileName: string): Promise<string | null> {
    return this.getContent(fileName)
  }

  // ========== 运行 ==========

  /** 将脚本内容写入临时文件并返回路径（用于执行），用完需调用 removeTempFile */
  writeTempFile(script: Script, content: string): string | null {
    const node = getNodeModules()
    if (!node) return null
    const ext = this.getExtension(script.language)
    try {
      const tmpDir = node.path.join(node.os.tmpdir(), "siyuan-scripts")
      if (!node.fs.existsSync(tmpDir)) node.fs.mkdirSync(tmpDir, { recursive: true })
      const tmpPath = node.path.join(tmpDir, `${script.id}${ext}`)
      node.fs.writeFileSync(tmpPath, content, "utf-8")
      return tmpPath
    } catch { return null }
  }

  removeTempFile(filePath: string): void {
    const node = getNodeModules()
    if (!node) return
    try { if (node.fs.existsSync(filePath)) node.fs.unlinkSync(filePath) } catch { /* ignore */ }
  }

  private getExtension(language: ScriptLanguage): string {
    const map: Record<ScriptLanguage, string> = {
      python: ".py", bash: ".sh", powershell: ".ps1", nodejs: ".js", batch: ".bat", other: ".txt",
    }
    return map[language]
  }
}
