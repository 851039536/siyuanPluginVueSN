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

/** 创建脚本的入参（Script 可编辑字段 + 内容） */
export type CreateScriptDTO = Pick<Script, "name" | "language" | "category" | "description"> & {
  content: string
}

/** 更新脚本的入参（全部字段可选） */
export type UpdateScriptDTO = Partial<CreateScriptDTO>

/**
 * 脚本启动器可选设置
 * - builtinMonitor: 内置监听模式，启动后不显示系统控制台窗口，
 *   在面板内显示运行状态与输出，并支持停止进程
 */
export interface ScriptLauncherSettings {
  /** 内置监听模式（隐藏控制台窗口，面板内显示输出） */
  builtinMonitor: boolean
  /** 内置监听面板是否展开显示 */
  monitorExpanded: boolean
}

export const DEFAULT_SCRIPT_LAUNCHER_SETTINGS: ScriptLauncherSettings = {
  builtinMonitor: false,
  monitorExpanded: true,
}

/** 内置监听运行中的进程条目 */
export interface RunningProcess {
  id: string
  /** 子进程 PID（Windows 下用于 taskkill 结束进程树） */
  pid?: number
  scriptId: string
  name: string
  language: ScriptLanguage
  description: string
  command: string
  status: "running" | "exited" | "killed" | "error"
  startedAt: number
  finishedAt?: number
  exitCode?: number | null
  stdout: string
  stderr: string
  /** 是否来自上次会话持久化恢复（思源重启后遗留进程） */
  persisted?: boolean
}

export const SCRIPT_LANGUAGE_CONFIG: Record<ScriptLanguage, {
  label: string
  extension: string
  icon: string
  color: string
}> = {
  python: {
    label: "Python",
    extension: ".py",
    icon: "mdi:language-python",
    color: "#3776AB",
  },
  bash: {
    label: "Bash",
    extension: ".sh",
    icon: "mdi:bash",
    color: "#4EAA25",
  },
  powershell: {
    label: "PowerShell",
    extension: ".ps1",
    icon: "mdi:powershell",
    color: "#5391FE",
  },
  nodejs: {
    label: "Node.js",
    extension: ".js",
    icon: "mdi:nodejs",
    color: "#339933",
  },
  batch: {
    label: "Batch",
    extension: ".bat",
    icon: "mdi:console",
    color: "#8B8B8B",
  },
  other: {
    label: "Other",
    extension: ".txt",
    icon: "mdi:file-code",
    color: "#6B7280",
  },
}

export interface I18n {
  panelTitle?: string
  description?: string
  addScript?: string
  importScript?: string
  editScript?: string
  deleteScript?: string
  runScript?: string
  refresh?: string
  searchPlaceholder?: string
  noScripts?: string
  name?: string
  language?: string
  category?: string
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
  allCategories?: string
  allLanguages?: string
  neverRun?: string
  exitCode?: string
  /** 内置监听开关 */
  builtinMonitor?: string
  builtinMonitorDesc?: string
  /** 运行监控区标题/状态 */
  monitorTitle?: string
  monitorCollapse?: string
  monitorExpand?: string
  stopProcess?: string
  processStopped?: string
  processExited?: string
  emptyMonitor?: string
  clearOutput?: string
  noProcessOutput?: string
  windowHiddenHint?: string
  /** 上次会话遗留进程提示 */
  restoredProcess?: string
  /** 遗留进程徽标 */
  restoredBadge?: string
  /** 进程状态标签 */
  statusRunning?: string
  statusExited?: string
  statusKilled?: string
  statusError?: string
  /** 主面板提示 */
  envNotSupported?: string
  openFailed?: string
  scriptPathNotFound?: string
  launchFailedEnvNotSupported?: string
  importSuccess?: string
  importFailed?: string
}

export class ScriptLauncher {
  private plugin: Plugin
  private storage: ScriptStorage
  private onDestroy: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new ScriptStorage(plugin, "")
  }

  public async init() {
    this.registerIcon()
    this.addDock()
    await this.storage.init()
  }

  /** 注册自定义 SVG 图标（思源内置图标系统） */
  private registerIcon() {
    this.plugin.addIcons(`<symbol id="iconScriptLauncher" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></symbol>`)
  }

  private addDock() {
    createVueDockApp(this.plugin, ScriptLauncherPanel, {
      position: "RightTop",
      width: 420,
      icon: "iconScriptLauncher",
      title: (this.plugin.i18n as any)?.scriptLauncher?.panelTitle || "脚本启动器",
      type: "scriptLauncher-dock",
      i18n: (this.plugin.i18n?.scriptLauncher as I18n) || ({} as I18n),
    })
  }

  /** 插件卸载时释放内置监听注册的清理钩子（运行中进程的退出兜底） */
  public destroy() {
    this.onDestroy?.()
    this.onDestroy = null
  }

  /** 供 useScriptRunner 注册卸载清理钩子（运行中进程的退出兜底） */
  public setOnDestroy(handler: () => void) {
    this.onDestroy = handler
  }
}
