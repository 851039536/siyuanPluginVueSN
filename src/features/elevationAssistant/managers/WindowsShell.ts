/**
 * 提权助手 - Windows 系统适配层
 *
 * - 权限状态：whoami + reg query（原生命令，快且不受 PowerShell 执行策略影响）
 * - 快捷方式写入 / RunAs 启动：PowerShell，一律 `-EncodedCommand` + JSON(Base64) 参数，
 *   避免用户路径进入脚本字符串；子进程统一隐藏窗口并登记，插件卸载时可集中终止。
 */
import type { ChildProcess } from "node:child_process"
import type {
  CreateShortcutOutcome,
  CreateShortcutParams,
  PrivilegeResult,
  ProgramScanOutcome,
  RunOutcome,
  ShortcutFailureKind,
} from "../types"
import {
  getNodeModules,
  getNodeProcessModules,
} from "@/utils/nodeModules"
import {
  buildCreateShortcutScript,
  buildRunElevatedScript,
  buildScanProgramsScript,
  encodePowerShellCommand,
  isUacCanceled,
  mapIntegritySid,
  normalizeProgramScanPayload,
  parsePowerShellJson,
  parseWhoamiGroups,
} from "../utils"
import { hasLnkExtension } from "../utils/shortcut"
import { isAbsoluteWindowsPath } from "../utils/validation"

/** 权限检测超时（whoami/reg 正常 <1s；给高负载机器留余量但不宜过长，超时后 UI 可重试） */
const PRIVILEGE_TIMEOUT = 15_000
const SHORTCUT_TIMEOUT = 30_000
const RUN_TIMEOUT = 120_000
/** 扫本机程序涉及开始菜单递归、注册表与进程枚举，冷启动更慢 */
const SCAN_TIMEOUT = 60_000
const MAX_OUTPUT = 1024 * 1024
const SCAN_MAX_OUTPUT = 4 * 1024 * 1024

interface RawExecResult {
  stdout: string
  stderr: string
  error: Error | null
  timedOut: boolean
}

interface PowerShellExecResult {
  ok: boolean
  data?: unknown
  kind?: "env" | "timeout" | "powershell" | "unknown"
  message?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Windows 安装根目录（走 require 取 process.env，避免依赖全局 process） */
function systemRoot(): string | null {
  try {
    const proc = require("node:process") as { env?: Record<string, string | undefined> }
    return proc.env?.SystemRoot || proc.env?.WINDIR || null
  } catch {
    return null
  }
}

function normalizeFailureKind(value: unknown): ShortcutFailureKind {
  const kind = asString(value)
  if (
    kind === "exists"
    || kind === "invalid"
    || kind === "location"
    || kind === "env"
    || kind === "timeout"
    || kind === "powershell"
  ) {
    return kind
  }
  return "unknown"
}

export class WindowsShellService {
  private active = new Set<ChildProcess>()
  private disposed = false

  /** 当前环境是否支持本功能的系统操作 */
  isSupported(): boolean {
    const node = getNodeProcessModules()
    return !!node && node.os.platform() === "win32"
  }

  /**
   * 当前进程权限。
   *
   * 刻意**不走 PowerShell**：仅用于展示状态，`whoami` + `reg query` 两个原生命令
   * 约 0.5s 完成，避免 PowerShell 冷启动（实测可达数秒）拖慢面板首屏；
   * PowerShell 只保留给「必须它的」快捷方式写入与 RunAs 启动。
   *
   * isAdmin 由完整性级别推导：UAC 提权的管理员进程为 high，未提权的管理员
   * （拆分令牌）与标准用户均为 medium，UAC 关闭时管理员进程直接为 high。
   */
  async getPrivilegeStatus(): Promise<PrivilegeResult> {
    if (!this.isSupported()) {
      return {
        ok: false,
        kind: "env",
        message: "Windows is required",
      }
    }

    // 系统命令只走绝对路径：提权相关工具不接受当前目录/PATH 中的同名程序
    const whoami = this.resolveSystemExe("whoami.exe")
    if (!whoami) {
      return {
        ok: false,
        kind: "env",
        message: "whoami.exe not found in system directory",
      }
    }

    // 三条命令互不依赖：并行执行把最坏耗时从 3×15s 降到 15s
    const [groups, userResult, uacEnabled] = await Promise.all([
      this.execRaw(whoami, ["/groups", "/fo", "csv", "/nh"], PRIVILEGE_TIMEOUT),
      this.execRaw(whoami, [], PRIVILEGE_TIMEOUT),
      this.readUacEnabled(),
    ])
    if (groups.error) {
      return {
        ok: false,
        kind: groups.timedOut ? "timeout" : "powershell",
        message: groups.stderr.trim() || groups.error.message,
      }
    }

    const integritySid = parseWhoamiGroups(groups.stdout)
    if (!integritySid) {
      return {
        ok: false,
        kind: "unknown",
        message: "Unable to determine integrity level",
      }
    }
    const integrity = mapIntegritySid(integritySid)

    return {
      ok: true,
      status: {
        isAdmin: integrity === "high" || integrity === "system" || integrity === "protected",
        integrity,
        integritySid,
        user: userResult.stdout.trim(),
        uacEnabled,
        checkedAt: Date.now(),
      },
    }
  }

  /** 创建/覆盖快捷方式 */
  async createShortcut(params: CreateShortcutParams): Promise<CreateShortcutOutcome> {
    if (!this.isSupported()) {
      return {
        ok: false,
        kind: "env",
        message: "Windows is required",
      }
    }

    const executed = await this.execPowerShell(
      buildCreateShortcutScript(params),
      SHORTCUT_TIMEOUT,
    )
    if (!executed.ok) {
      return {
        ok: false,
        kind: executed.kind ?? "unknown",
        message: executed.message,
      }
    }

    const data = asRecord(executed.data)
    if (!data) {
      return {
        ok: false,
        kind: "unknown",
        message: "PowerShell returned no result",
      }
    }

    if (asBoolean(data.ok)) {
      const path = asString(data.path)
      // PowerShell 的输出同样不可盲信：必须是绝对路径且以 .lnk 结尾
      if (!isAbsoluteWindowsPath(path) || !hasLnkExtension(path)) {
        return {
          ok: false,
          kind: "invalid",
        }
      }
      return {
        ok: true,
        path,
        runAsAdmin: asBoolean(data.runAsAdmin),
      }
    }

    return {
      ok: false,
      kind: normalizeFailureKind(data.kind),
      message: asString(data.message),
    }
  }

  /** 以管理员身份运行目标程序 */
  async runAsAdmin(targetPath: string, args: string, workingDir: string): Promise<RunOutcome> {
    if (!this.isSupported()) {
      return {
        ok: false,
        kind: "env",
        message: "Windows is required",
      }
    }

    const executed = await this.execPowerShell(
      buildRunElevatedScript(targetPath, args, workingDir),
      RUN_TIMEOUT,
    )
    if (!executed.ok) {
      return {
        ok: false,
        kind: executed.kind ?? "unknown",
        message: executed.message,
      }
    }

    const data = asRecord(executed.data)
    if (!data) {
      return {
        ok: false,
        kind: "unknown",
        message: "PowerShell returned no result",
      }
    }

    if (asBoolean(data.ok)) {
      const pid = asNumberOrNull(data.pid)
      return {
        ok: true,
        ...(pid !== null ? { pid } : {}),
      }
    }

    const code = data.code
    const message = asString(data.message)
    if (isUacCanceled({
      code: typeof code === "number" || typeof code === "string" ? code : null,
      message,
    })) {
      return {
        ok: false,
        kind: "canceled",
        message,
      }
    }

    return {
      ok: false,
      kind: "powershell",
      message,
    }
  }

  /**
   * 扫描本机可加入工具列表的 exe（开始菜单 / 桌面 / App Paths / 运行中进程）。
   * 只读取路径，不执行目标程序、不写盘、不联网；结果在 JS 侧再次清洗与截断。
   */
  async scanPrograms(): Promise<ProgramScanOutcome> {
    if (!this.isSupported()) {
      return {
        ok: false,
        kind: "env",
        message: "Windows is required",
      }
    }

    const executed = await this.execPowerShell(
      buildScanProgramsScript(),
      SCAN_TIMEOUT,
      SCAN_MAX_OUTPUT,
    )
    if (!executed.ok) {
      return {
        ok: false,
        kind: executed.kind ?? "unknown",
        message: executed.message,
      }
    }
    return normalizeProgramScanPayload(executed.data)
  }

  /** 取消在途 PowerShell 调用（面板关闭时使用） */
  cancelActive(): void {
    for (const child of this.active) {
      try {
        child.kill()
      } catch {
        // 已退出或无法终止，忽略
      }
    }
    this.active.clear()
  }

  /** 插件卸载时释放全部资源 */
  dispose(): void {
    this.disposed = true
    this.cancelActive()
  }

  /** 读取 UAC 总开关（EnableLUA）；读不到返回 null（不阻塞状态展示） */
  private async readUacEnabled(): Promise<boolean | null> {
    const reg = this.resolveSystemExe("reg.exe")
    if (!reg) return null
    const result = await this.execRaw(
      reg,
      [
        "query",
        "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
        "/v",
        "EnableLUA",
      ],
      PRIVILEGE_TIMEOUT,
    )
    if (result.error) return null
    const match = /EnableLUA\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(result.stdout)
    if (!match) return null
    return Number.parseInt(match[1], 16) !== 0
  }

  private async execPowerShell(
    script: string,
    timeoutMs: number,
    maxBuffer = MAX_OUTPUT,
  ): Promise<PowerShellExecResult> {
    if (this.disposed) {
      return {
        ok: false,
        kind: "env",
        message: "Service disposed",
      }
    }
    const exe = this.resolvePowerShellPath()
    if (!exe) {
      return {
        ok: false,
        kind: "env",
        message: "powershell.exe not found in system directory",
      }
    }
    const encoded = encodePowerShellCommand(script)
    const result = await this.execRaw(
      exe,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      timeoutMs,
      maxBuffer,
    )

    if (result.error) {
      const parsed = parsePowerShellJson(result.stdout)
      if (parsed) {
        return {
          ok: true,
          data: parsed,
        }
      }
      return {
        ok: false,
        kind: result.timedOut ? "timeout" : "powershell",
        message: result.stderr.trim() || result.error.message,
      }
    }

    const parsed = parsePowerShellJson(result.stdout)
    if (!parsed) {
      return {
        ok: false,
        kind: "unknown",
        message: result.stderr.trim() || "Unable to parse PowerShell output",
      }
    }
    return {
      ok: true,
      data: parsed,
    }
  }

  private execRaw(
    exe: string,
    args: string[],
    timeoutMs: number,
    maxBuffer = MAX_OUTPUT,
  ): Promise<RawExecResult> {
    if (this.disposed) {
      return Promise.resolve({
        stdout: "",
        stderr: "",
        error: new Error("Service disposed"),
        timedOut: false,
      })
    }
    const node = getNodeProcessModules()
    if (!node) {
      return Promise.resolve({
        stdout: "",
        stderr: "",
        error: new Error("Node.js child_process is unavailable"),
        timedOut: false,
      })
    }

    return new Promise((resolve) => {
      let child: ChildProcess | null = null
      try {
        child = node.child_process.execFile(
          exe,
          args,
          {
            windowsHide: true,
            timeout: timeoutMs,
            maxBuffer,
            encoding: "utf8",
          },
          (error: Error | null, stdout: string, stderr: string) => {
            if (child) this.active.delete(child)
            const killed = !!(error as (Error & { killed?: boolean }) | null)?.killed
            resolve({
              stdout: String(stdout || ""),
              stderr: String(stderr || ""),
              error: error || null,
              timedOut: killed,
            })
          },
        )
        if (child) this.active.add(child)
      } catch (error) {
        resolve({
          stdout: "",
          stderr: "",
          error: error instanceof Error ? error : new Error(String(error)),
          timedOut: false,
        })
      }
    })
  }

  /**
   * 解析 `%SystemRoot%\\System32\\<name>`（32 位进程回退 Sysnative）。
   * 只返回绝对路径；找不到时返回 null，绝不回退到 PATH，避免同名程序劫持。
   */
  private resolveSystemExe(name: string): string | null {
    const node = getNodeModules()
    const root = systemRoot()
    if (!node || !root) return null
    const candidates = [
      node.path.join(root, "System32", name),
      node.path.join(root, "Sysnative", name),
    ]
    for (const candidate of candidates) {
      try {
        if (node.fs.existsSync(candidate)) return candidate
      } catch {
        // 单个候选不可访问时继续尝试下一个
      }
    }
    return null
  }

  private resolvePowerShellPath(): string | null {
    const node = getNodeModules()
    const root = systemRoot()
    if (!node || !root) return null
    const candidate = node.path.join(
      root,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    )
    try {
      return node.fs.existsSync(candidate) ? candidate : null
    } catch {
      return null
    }
  }
}
