/**
 * 脚本启动器 - 数据存储层
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
    return {
      fs,
      path,
    }
  } catch {
    return null
  }
}

function getScriptDir(dataDir: string): string | null {
  if (!dataDir) return null
  const node = getNodeModules()
  if (!node) return null
  return node.path.join(dataDir, "scripts")
}

function ensureScriptDir(dataDir: string): boolean {
  const dir = getScriptDir(dataDir)
  if (!dir) return false
  const node = getNodeModules()
  if (!node) return false
  try {
    if (!node.fs.existsSync(dir)) {
      node.fs.mkdirSync(dir, { recursive: true })
    }
    return true
  } catch {
    return false
  }
}

export class ScriptStorage {
  private storage: PluginStorage
  private scripts: TypedStorage<Script[]>
  private plugin: Plugin
  private dataDir: string
  private readonly STORAGE_KEY = "scriptLauncher-scripts"

  constructor(plugin: Plugin, dataDir: string) {
    this.plugin = plugin
    this.dataDir = dataDir
    this.storage = new PluginStorage(plugin)
    this.scripts = new TypedStorage(this.storage, this.STORAGE_KEY, [])
  }

  async init(): Promise<void> {
    ensureScriptDir(this.dataDir)
  }

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
    const { extension } = this.getLanguageConfig(data.language)
    const fileName = `${id}${extension}`

    const script: Script = {
      id,
      name: data.name,
      language: data.language,
      category: data.category || "默认",
      description: data.description || "",
      fileName,
      createdAt: now,
      updatedAt: now,
    }

    const all = await this.getAll()
    all.push(script)
    await this.scripts.save(all)
    await this.saveScriptFile(id, data.content, data.language)

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

    const oldLanguage = all[index].language
    const newLanguage = data.language || oldLanguage

    all[index] = {
      ...all[index],
      ...data,
      updatedAt: Date.now(),
    }

    if (data.language && data.language !== oldLanguage) {
      const { extension } = this.getLanguageConfig(newLanguage)
      const newFileName = `${id}${extension}`
      all[index].fileName = newFileName

      const content = await this.loadScriptFile(id, oldLanguage)
      if (content !== null) {
        await this.deleteScriptFile(id, oldLanguage)
        await this.saveScriptFile(id, content, newLanguage)
      }
    }

    if (data.content !== undefined) {
      await this.saveScriptFile(id, data.content, newLanguage)
    }

    await this.scripts.save(all)
    return true
  }

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll()
    const index = all.findIndex((s) => s.id === id)
    if (index === -1) return false

    const script = all[index]
    const filtered = all.filter((s) => s.id !== id)
    await this.scripts.save(filtered)
    await this.deleteScriptFile(id, script.language)
    return true
  }

  async updateLastRun(id: string): Promise<void> {
    const all = await this.getAll()
    const index = all.findIndex((s) => s.id === id)
    if (index === -1) return
    all[index].lastRunAt = Date.now()
    await this.scripts.save(all)
  }

  async saveScriptFile(id: string, content: string, language: ScriptLanguage): Promise<boolean> {
    const dir = getScriptDir(this.dataDir)
    if (!dir) return false
    const node = getNodeModules()
    if (!node) return false

    const { extension } = this.getLanguageConfig(language)
    const filePath = node.path.join(dir, `${id}${extension}`)

    try {
      node.fs.writeFileSync(filePath, content, "utf-8")
      return true
    } catch (error) {
      console.error(`Failed to save script file [${id}]:`, error)
      return false
    }
  }

  async loadScriptFile(id: string, language: ScriptLanguage): Promise<string | null> {
    const dir = getScriptDir(this.dataDir)
    if (!dir) return null
    const node = getNodeModules()
    if (!node) return null

    const { extension } = this.getLanguageConfig(language)
    const filePath = node.path.join(dir, `${id}${extension}`)

    try {
      if (!node.fs.existsSync(filePath)) return null
      return node.fs.readFileSync(filePath, "utf-8")
    } catch (error) {
      console.error(`Failed to load script file [${id}]:`, error)
      return null
    }
  }

  async deleteScriptFile(id: string, language: ScriptLanguage): Promise<boolean> {
    const dir = getScriptDir(this.dataDir)
    if (!dir) return false
    const node = getNodeModules()
    if (!node) return false

    const { extension } = this.getLanguageConfig(language)
    const filePath = node.path.join(dir, `${id}${extension}`)

    try {
      if (node.fs.existsSync(filePath)) {
        node.fs.unlinkSync(filePath)
      }
      return true
    } catch (error) {
      console.error(`Failed to delete script file [${id}]:`, error)
      return false
    }
  }

  getScriptFilePath(id: string, language: ScriptLanguage): string | null {
    const dir = getScriptDir(this.dataDir)
    if (!dir) return null
    const node = getNodeModules()
    if (!node) return null

    const { extension } = this.getLanguageConfig(language)
    return node.path.join(dir, `${id}${extension}`)
  }

  private getLanguageConfig(language: ScriptLanguage) {
    const config = {
      python: { extension: ".py" },
      bash: { extension: ".sh" },
      powershell: { extension: ".ps1" },
      nodejs: { extension: ".js" },
      batch: { extension: ".bat" },
      other: { extension: ".txt" },
    } as const
    return config[language]
  }
}
