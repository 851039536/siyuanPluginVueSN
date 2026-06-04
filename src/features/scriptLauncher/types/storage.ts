/**
 * 脚本启动器 - 数据存储层
 * 脚本内容直接存入 TypedStorage，不依赖文件系统持久化。
 * 仅在运行时生成临时文件执行，执行后自动清理。
 */
import type {
  CreateScriptDTO,
  Script,
  ScriptLanguage,
  UpdateScriptDTO,
} from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

function getNodeModules(): { fs: any, path: any } | null {
  try {
    const fs = require("node:fs")
    const path = require("node:path")
    return { fs, path }
  } catch {
    return null
  }
}

export class ScriptStorage {
  private storage: PluginStorage
  private scripts: TypedStorage<Script[]>
  private plugin: Plugin
  private readonly STORAGE_KEY = "scriptLauncher-scripts"

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new PluginStorage(plugin)
    this.scripts = new TypedStorage(this.storage, this.STORAGE_KEY, [])
  }

  async init(): Promise<void> { /* no-op */ }

  async getAll(): Promise<Script[]> {
    const data = await this.scripts.loadOrDefault()
    return data.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getById(id: string): Promise<Script | null> {
    const all = await this.getAll()
    return all.find((s) => s.id === id) || null
  }

  async isNameUnique(name: string, excludeId?: string): Promise<boolean> {
    const all = await this.getAll()
    return !all.some((s) => s.name === name && s.id !== excludeId)
  }

  async add(data: CreateScriptDTO): Promise<Script> {
    const isUnique = await this.isNameUnique(data.name)
    if (!isUnique) {
      throw new Error("Script name already exists")
    }

    const now = Date.now()
    const id = `script-${now}`

    const script: Script = {
      id,
      name: data.name,
      language: data.language,
      category: data.category || "默认",
      description: data.description || "",
      content: data.content || "",
      createdAt: now,
      updatedAt: now,
    }

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
      const isUnique = await this.isNameUnique(data.name, id)
      if (!isUnique) {
        throw new Error("Script name already exists")
      }
    }

    all[index] = {
      ...all[index],
      ...data,
      updatedAt: Date.now(),
    }

    await this.scripts.save(all)
    return true
  }

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll()
    const index = all.findIndex((s) => s.id === id)
    if (index === -1) return false

    const filtered = all.filter((s) => s.id !== id)
    await this.scripts.save(filtered)
    return true
  }

  async updateLastRun(id: string): Promise<void> {
    const all = await this.getAll()
    const index = all.findIndex((s) => s.id === id)
    if (index === -1) return
    all[index].lastRunAt = Date.now()
    await this.scripts.save(all)
  }

  /**
   * 将脚本内容写入临时文件，返回文件路径。调用方应在执行后删除。
   */
  writeTempFile(script: Script): string | null {
    const node = getNodeModules()
    if (!node) return null

    const ext = this.getExtension(script.language)
    // 优先使用系统临时目录
    let tmpDir: string
    try {
      const os = require("node:os")
      tmpDir = node.path.join(os.tmpdir(), "siyuan-scripts")
    } catch {
      tmpDir = node.path.join(".", "siyuan-scripts-tmp")
    }
    try {
      if (!node.fs.existsSync(tmpDir)) {
        node.fs.mkdirSync(tmpDir, { recursive: true })
      }
    } catch {
      // 目录创建失败，使用当前目录
      tmpDir = "."
    }

    const filePath = node.path.join(tmpDir, `${script.id}${ext}`)
    try {
      node.fs.writeFileSync(filePath, script.content, "utf-8")
      return filePath
    } catch (error) {
      console.error(`Failed to write temp script [${script.id}]:`, error)
      return null
    }
  }

  /**
   * 删除临时脚本文件
   */
  removeTempFile(filePath: string): void {
    const node = getNodeModules()
    if (!node) return
    try {
      if (node.fs.existsSync(filePath)) {
        node.fs.unlinkSync(filePath)
      }
    } catch {
      // 清理失败忽略
    }
  }

  private getExtension(language: ScriptLanguage): string {
    const map: Record<ScriptLanguage, string> = {
      python: ".py",
      bash: ".sh",
      powershell: ".ps1",
      nodejs: ".js",
      batch: ".bat",
      other: ".txt",
    }
    return map[language]
  }
}
