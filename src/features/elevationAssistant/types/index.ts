/**
 * 提权助手 - 类型定义与 Dock 注册类
 */
import type { Plugin } from "siyuan"
import type { DockAppHandle } from "@/utils/vueAppHelper"
import { createVueDockApp } from "@/utils/vueAppHelper"
import ElevationAssistantPanel from "../index.vue"
import { WindowsShellService } from "../managers/WindowsShell"

export type ShortcutLocation = "desktop" | "programs" | "custom"

export type ManifestLevel =
  | "asInvoker"
  | "highestAvailable"
  | "requireAdministrator"
  | "unknown"

export type ElevationRecommendation =
  | "required"
  | "recommended"
  | "notRequired"
  | "unknown"

export type IntegrityLevel =
  | "low"
  | "medium"
  | "mediumPlus"
  | "high"
  | "system"
  | "protected"
  | "unknown"

/** PE 文件架构 */
export type PeArch = "x86" | "x64" | "arm64" | "unknown"

/** manifest 来源 */
export type ManifestSource = "embedded" | "external" | "none" | "unreadable"

/** 诊断结论原因码（单一来源，manifest 解析与 UI 展示共用） */
export type DiagnosisReasonCode =
  | "manifestRequireAdministrator"
  | "manifestHighestAvailable"
  | "manifestAsInvoker"
  | "manifestUiAccess"
  | "manifestMissing"
  | "unsupportedFile"
  | "readError"
  | "parseError"

/** 系统调用失败原因（PowerShell / 原生命令共用） */
export type ShellFailureKind = "env" | "timeout" | "powershell" | "unknown"

/** 快捷方式检测状态：未检测 / 存在 / 已丢失 / 文件无效 / 无法检测 */
export type ShortcutState = "unknown" | "exists" | "missing" | "invalid" | "error"

export interface ShortcutStatus {
  state: ShortcutState
  valid: boolean
  runAsAdmin: boolean
  error?: string
}

export interface ShortcutRecord {
  path: string
  location: ShortcutLocation
  runAsAdmin: boolean
  createdAt: number
}

export interface ElevationTool {
  id: string
  name: string
  path: string
  args: string
  workingDir: string
  /** 用户选择的快捷方式提权意图 */
  requireAdmin: boolean
  shortcuts: ShortcutRecord[]
  createdAt: number
  updatedAt: number
  lastRunAt?: number
}

export interface PermissionDiagnosis {
  checkedAt: number
  exists: boolean
  kind: "exe" | "other" | "missing" | "error"
  arch: PeArch
  size: number
  manifestSource: ManifestSource
  manifestLevel: ManifestLevel
  uiAccess: boolean
  requiresAdmin: boolean
  recommendedElevate: boolean
  recommendation: ElevationRecommendation
  reasonCode: DiagnosisReasonCode
  error?: string
}

export interface PrivilegeStatus {
  isAdmin: boolean
  integrity: IntegrityLevel
  integritySid: string
  user: string
  uacEnabled: boolean | null
  checkedAt: number
}

export type PrivilegeResult =
  | { ok: true, status: PrivilegeStatus }
  | { ok: false, kind: ShellFailureKind, message?: string }

export interface CreateShortcutParams {
  /** 不含 .lnk 后缀 */
  fileName: string
  targetPath: string
  args: string
  workingDir: string
  location: ShortcutLocation
  customDir: string
  runAsAdmin: boolean
  overwrite: boolean
}

export type ShortcutFailureKind =
  | "exists"
  | "invalid"
  | "location"
  | "limit"
  | ShellFailureKind

export type CreateShortcutOutcome =
  | { ok: true, path: string, runAsAdmin: boolean }
  | { ok: false, kind: ShortcutFailureKind, message?: string }

export type RunOutcome =
  | { ok: true, pid?: number }
  | {
    ok: false
    kind: "canceled" | ShellFailureKind
    message?: string
  }

/** 编辑器中维护的表单草稿 */
export interface ToolDraft {
  name: string
  path: string
  args: string
  workingDir: string
  requireAdmin: boolean
  location: ShortcutLocation
  customDir: string
}

/** 程序扫描来源 */
export type ProgramScanSource = "startMenu" | "desktop" | "appPaths" | "process"

export interface ProgramCandidate {
  name: string
  path: string
  source: ProgramScanSource
}

export type ProgramScanOutcome =
  | { ok: true, programs: ProgramCandidate[], truncated: boolean, warnings: string[] }
  | { ok: false, kind: ShellFailureKind, message?: string }

/** Dock 注册类：持有 shell 生命周期，插件卸载时统一 destroy */
export class ElevationAssistant {
  private plugin: Plugin
  private dock: DockAppHandle | null = null
  private readonly shell = new WindowsShellService()

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  public init(): void {
    this.registerIcon()
    const i18n = this.plugin.i18n?.elevationAssistant as unknown as Record<string, string> | undefined
    this.dock = createVueDockApp(this.plugin, ElevationAssistantPanel, {
      position: "RightTop",
      width: 460,
      icon: "iconElevationAssistant",
      title: i18n?.title || "提权助手",
      type: "elevationAssistant-dock",
      i18n: i18n || {},
      extraProps: {
        shell: this.shell,
      },
    })
  }

  public destroy(): void {
    this.dock?.unmount()
    this.dock = null
    this.shell.dispose()
  }

  private registerIcon(): void {
    this.plugin.addIcons(
      `<symbol id="iconElevationAssistant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></symbol>`,
    )
  }
}
