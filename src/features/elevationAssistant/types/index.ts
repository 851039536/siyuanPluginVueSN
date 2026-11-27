/**
 * 提权助手 - 类型定义与 Dock 注册类
 */
import type { Plugin } from "siyuan"
import type { DockAppHandle } from "@/utils/vueAppHelper"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { WindowsShellService } from "../managers/WindowsShell"
import ElevationAssistantPanel from "../index.vue"

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
  arch: "x86" | "x64" | "arm64" | "unknown"
  size: number
  manifestSource: "embedded" | "external" | "none" | "unreadable"
  manifestLevel: ManifestLevel
  uiAccess: boolean
  requiresAdmin: boolean
  recommendedElevate: boolean
  recommendation: ElevationRecommendation
  reasonCode:
    | "manifestRequireAdministrator"
    | "manifestHighestAvailable"
    | "manifestAsInvoker"
    | "manifestUiAccess"
    | "manifestMissing"
    | "externalManifest"
    | "unsupportedFile"
    | "readError"
    | "parseError"
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
  | { ok: false, kind: "env" | "timeout" | "powershell" | "unknown", message?: string }

export interface CreateShortcutParams {
  /** 不含 .lnk 后缀 */
  fileName: string
  targetPath: string
  args: string
  workingDir: string
  description: string
  location: ShortcutLocation
  customDir: string
  runAsAdmin: boolean
  overwrite: boolean
}

export type ShortcutFailureKind =
  | "exists"
  | "invalid"
  | "location"
  | "env"
  | "timeout"
  | "powershell"
  | "unknown"

export type CreateShortcutOutcome =
  | { ok: true, path: string, runAsAdmin: boolean }
  | { ok: false, kind: ShortcutFailureKind, message?: string }

export type RunOutcome =
  | { ok: true, pid?: number }
  | {
      ok: false
      kind: "canceled" | "env" | "timeout" | "powershell" | "unknown"
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

/** i18n 分片（平铺键，参照 scriptLauncher） */
export type ElevationAssistantI18n = Record<string, string>

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
    const i18n = this.plugin.i18n?.elevationAssistant as unknown as ElevationAssistantI18n | undefined
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
