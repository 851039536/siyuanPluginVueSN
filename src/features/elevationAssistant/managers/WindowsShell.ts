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
  RunOutcome,
  ShortcutFailureKind,
} from "../types"
import { getNodeModules, getNodeProcessModules } from "@/utils/nodeModules"
import {
  buildCreateShortcutScript,
  buildRunElevatedScript,
  encodePowerShellCommand,
  isUacCanceled,
  mapIntegritySid,
  parsePowerShellJson,
  parseWhoamiGroups,
} from "../utils"

/** 权限检测超时（whoami/reg 正常 <1s；给高负载机器留余量但不宜过长，超时后 UI 可重试） */
const PRIVILEGE_TIMEOUT = 15_000
const SHORTCUT_TIMEOUT = 30_000
const RUN_TIMEOUT = 120_000
const MAX_OUTPUT = 1024 * 1024

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

    const groups = await this.execRaw(
      "whoami.exe",
      ["/groups", "/fo", "csv", "/nh"],
      PRIVILEGE_TIMEOUT,
    )
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

    const userResult = await this.execRaw("whoami.exe", [], PRIVILEGE_TIMEOUT)
    const uacEnabled = await this.readUacEnabled()

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
      return {
        ok: true,
        path: asString(data.path),
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
    const result = await this.execRaw(
      "reg.exe",
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

  private async execPowerShell(script: string, timeoutMs: number): Promise<PowerShellExecResult> {
    if (this.disposed) {
      return {
        ok: false,
        kind: "env",
        message: "Service disposed",
      }
    }
    const exe = this.resolvePowerShellPath()
    const encoded = encodePowerShellCommand(script)
    const result = await this.execRaw(
      exe,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      timeoutMs,
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

  private execRaw(exe: string, args: string[], timeoutMs: number): Promise<RawExecResult> {
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
            maxBuffer: MAX_OUTPUT,
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

  private resolvePowerShellPath(): string {
    const node = getNodeModules()
    if (!node) return "powershell.exe"
    const root = process.env.SystemRoot || process.env.WINDIR
    if (!root) return "powershell.exe"
    const candidate = node.path.join(
      root,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    )
    try {
      return node.fs.existsSync(candidate) ? candidate : "powershell.exe"
    } catch {
      return "powershell.exe"
    }
  }
}
