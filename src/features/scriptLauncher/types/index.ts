/**
 * 脚本启动器 - 类型定义和注册类
 */
import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import ScriptLauncherPanel from "../index.vue"
import { ScriptStorage } from "./storage"

export type ScriptLanguage = "python" | "bash" | "powershell" | "nodejs" | "batch" | "other"

export interface Script {
  id: string
  name: string
  language: ScriptLanguage
  category: string
  description: string
  fileName: string
  createdAt: number
  updatedAt: number
  lastRunAt?: number
}

export interface CreateScriptDTO {
  name: string
  language: ScriptLanguage
  category: string
  description: string
  content: string
}

export interface UpdateScriptDTO {
  name?: string
  language?: ScriptLanguage
  category?: string
  description?: string
  content?: string
}

export const SCRIPT_LANGUAGE_CONFIG: Record<ScriptLanguage, {
  label: string
  labelEn: string
  extension: string
  icon: string
  color: string
}> = {
  python: {
    label: "Python",
    labelEn: "Python",
    extension: ".py",
    icon: "mdi:language-python",
    color: "#3776AB",
  },
  bash: {
    label: "Bash",
    labelEn: "Bash",
    extension: ".sh",
    icon: "mdi:bash",
    color: "#4EAA25",
  },
  powershell: {
    label: "PowerShell",
    labelEn: "PowerShell",
    extension: ".ps1",
    icon: "mdi:powershell",
    color: "#5391FE",
  },
  nodejs: {
    label: "Node.js",
    labelEn: "Node.js",
    extension: ".js",
    icon: "mdi:nodejs",
    color: "#339933",
  },
  batch: {
    label: "Batch",
    labelEn: "Batch",
    extension: ".bat",
    icon: "mdi:console",
    color: "#8B8B8B",
  },
  other: {
    label: "Other",
    labelEn: "Other",
    extension: ".txt",
    icon: "mdi:file-code",
    color: "#6B7280",
  },
}

export interface I18n {
  panelTitle?: string
  addScript?: string
  editScript?: string
  deleteScript?: string
  runScript?: string
  refresh?: string
  searchPlaceholder?: string
  noScripts?: string
  name?: string
  language?: string
  category?: string
  description?: string
  content?: string
  selectLanguage?: string
  selectCategory?: string
  customCategory?: string
  cancel?: string
  save?: string
  close?: string
  confirmDelete?: string
  loadFailed?: string
  saveFailed?: string
  deleteSuccess?: string
  deleteFailed?: string
  createSuccess?: string
  updateSuccess?: string
  nameEmpty?: string
  nameDuplicate?: string
  allCategories?: string
  allLanguages?: string
  lastRun?: string
  neverRun?: string
  running?: string
  stdout?: string
  stderr?: string
  exitCode?: string
  outputTitle?: string
}

export class ScriptLauncher {
  private plugin: Plugin
  private storage: ScriptStorage

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new ScriptStorage(plugin, "")
  }

  public async init() {
    this.addDock()
    await this.storage.init()
  }

  private addDock() {
    createVueDockApp(this.plugin, ScriptLauncherPanel, {
      position: "RightTop",
      width: 420,
      icon: "mdi:script-text-outline",
      title: (this.plugin.i18n as any)?.scriptLauncher?.panelTitle || "脚本启动器",
      type: "scriptLauncher-dock",
      i18n: (this.plugin.i18n?.scriptLauncher as I18n) || ({} as I18n),
    })
  }

  public getStorage(): ScriptStorage {
    return this.storage
  }

  public destroy() {}
}
