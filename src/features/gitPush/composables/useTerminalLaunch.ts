// 项目目录内的终端启动逻辑（扫描可用终端 / 在项目目录拉起新窗口）
import { ref } from "vue"
import {
  getNodeModules,
  getNodeProcessModules,
} from "@/utils/nodeModules"
import type { TerminalEntry } from "../types"

// Types（定义下沉至 types/storage.ts，此处 re-export 保持向后兼容）
export type { TerminalEntry } from "../types"

/**
 * 内置终端预设（仅 Windows，项目卡片终端菜单数据源）。
 * 启动策略参考 GitHub Desktop 的终端集成：GUI 类（wt / Git Bash）直接启动，
 * 控制台类 shell（PowerShell / CMD）必须经 `cmd /c start` 拉起新窗口——
 * detached 直启控制台程序不会分配新控制台（静默失败，实测点击无反应）；
 * 目录传递：wt / Git Bash 用启动参数，PowerShell / CMD 用 cwd 继承避免引号转义。
 */
export const TERMINAL_ENTRIES: TerminalEntry[] = [
  {
    name: "Windows Terminal",
    icon: "mdi:microsoft-windows",
    cmds: ["wt"],
    buildArgs: p => ["-d", p],
  },
  {
    name: "PowerShell",
    icon: "mdi:powershell",
    cmds: ["powershell"],
    knownPaths: ["%SystemRoot%/System32/WindowsPowerShell/v1.0/powershell.exe"],
    startWrapped: true,
    useCwd: true,
    buildArgs: () => ["-NoExit"],
  },
  {
    name: "CMD",
    icon: "mdi:console",
    cmds: ["cmd"],
    knownPaths: ["%SystemRoot%/System32/cmd.exe"],
    startWrapped: true,
    useCwd: true,
    buildArgs: () => ["/k"],
  },
  {
    name: "Git Bash",
    icon: "mdi:git",
    cmds: ["git-bash"],
    knownPaths: [
      "%ProgramFiles%/Git/git-bash.exe",
      "%LOCALAPPDATA%/Programs/Git/git-bash.exe",
    ],
    buildArgs: p => [`--cd=${p}`],
  },
]

export function useTerminalLaunch(options: {
  /** 打开文件夹的回退函数（终端启动失败时兜底） */
  openFolder: (path: string) => void
}) {
  const { openFolder } = options

  const detectedTerminals = ref<TerminalEntry[]>([])

  function resolvePath(raw: string): string | null {
    let resolved = raw
    const matches = raw.match(/%([^%]+)%/g)
    if (matches) {
      const env: Record<string, string | undefined> = {}
      try {
        const nodeModules = getNodeModules()
        if (nodeModules) {
          const proc = (globalThis as any).process
          if (proc?.env) { Object.assign(env, proc.env) }
        }
      } catch { /* ignore */ }
      for (const m of matches) {
        const key = m.slice(1, -1)
        const val = env[key]
        if (!val) return null
        resolved = resolved.replace(m, val)
      }
    }
    return resolved
  }

  /** 启动终端（detached，支持 cwd 指定项目目录） */
  function launchTerminal(cp: any, cmd: string, args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const child = cp.spawn(cmd, args, {
          cwd,
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        })
        child.on("error", (err: Error) => { reject(err) })
        child.on("spawn", () => {
          child.unref()
          resolve()
        })
        child.on("close", () => {})
      } catch (e) {
        reject(e)
      }
    })
  }

  function isCmdAvailable(cp: any, cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        let settled = false
        const child = cp.spawn(cmd, ["--version"], {
          stdio: "ignore",
          windowsHide: true,
          timeout: 3000,
        })
        child.on("error", () => {
          if (!settled) {
            settled = true
            // 任何 spawn 错误（ENOENT/EACCES/EPERM 等）都应视为命令不可用
            resolve(false)
          }
        })
        child.on("close", (code: number | null) => {
          if (!settled) {
            settled = true
            resolve(code === 0)
          }
        })
        child.unref()
      } catch {
        resolve(false)
      }
    })
  }

  /** 扫描当前可用的内置终端（cmds 探测 → knownPaths 存在性检测） */
  async function scanTerminals() {
    const cp = getNodeProcessModules()?.child_process
    if (!cp) { detectedTerminals.value = []; return }

    const fs = getNodeModules()?.fs
    const found: TerminalEntry[] = []
    for (const t of TERMINAL_ENTRIES) {
      let available = false
      for (const cmdName of t.cmds) {
        if (await isCmdAvailable(cp, cmdName)) { available = true; break }
      }
      if (!available && t.knownPaths?.length) {
        for (const rawPath of t.knownPaths) {
          const resolved = resolvePath(rawPath)
          if (resolved && fs?.existsSync(resolved)) { available = true; break }
        }
      }
      if (available) found.push(t)
    }
    detectedTerminals.value = found
  }

  /**
   * 在项目目录打开终端：候选启动命令 = cmds（PATH 探测）→ knownPaths（展开后存在性检测），
   * 依次尝试，全部失败回退打开文件夹。
   * 控制台类 shell（startWrapped）必须经 `cmd /c start "标题" <shell>` 拉起新窗口——
   * detached 直启控制台程序不分配新控制台窗口，会静默失败（点击无反应的根因）；
   * 目录经外层 cmd 的 cwd 继承，start 的子进程随之继承，规避路径引号转义问题。
   */
  async function handleOpenTerminal(path: string, terminal: TerminalEntry) {
    const nodeModules = getNodeProcessModules()
    const cp = nodeModules?.child_process
    if (!cp) { openFolder(path); return }

    const fs = getNodeModules()?.fs
    const args = terminal.buildArgs(path)
    const candidates: string[] = [...terminal.cmds]
    for (const rawPath of terminal.knownPaths ?? []) {
      const resolved = resolvePath(rawPath)
      if (resolved && fs?.existsSync(resolved)) candidates.push(resolved)
    }

    for (const cmd of candidates) {
      try {
        if (terminal.startWrapped) {
          await launchTerminal(cp, "cmd", ["/c", "start", "gitPush Terminal", cmd, ...args], path)
        } else {
          await launchTerminal(cp, cmd, args)
        }
        return
      } catch { /* 启动失败，尝试下一候选 */ }
    }
    openFolder(path)
  }

  return {
    detectedTerminals,
    scanTerminals,
    handleOpenTerminal,
  }
}
