/**
 * 脚本启动器 - 脚本执行组合式函数
 *
 * 两种执行模式：
 * - 系统默认程序打开（默认，类似双击本地文件）
 * - 内置监听模式（可选）：不显示 Windows 控制台窗体，由面板内显示启动信息、
 *   运行输出与停止按钮
 *
 * 进程账本（procHandles/liveEntries）与活跃面板注册（activeDeps）放在模块层：
 * Dock 面板关闭重建时句柄与输出闭包不随组件销毁，重开后 restore 复用同一
 * entry 对象——输出闭包、退出回调与面板展示始终指向同一对象，避免
 * 「真身/展示 entry 脱节」导致的输出静默丢失。
 */
import type { Ref } from "vue"
import type {
  RunningProcess,
  Script,
  ScriptLauncherSettings,
} from "../types"
import { getNodeProcessModules } from "@/utils/nodeModules"

/** 进程管理器类型（child_process.spawn 返回值的最小接口） */
type BufferLike = Uint8Array & { toString: (encoding?: string) => string }

interface SpawnedProcess {
  pid?: number
  stdout?: { on: (event: string, cb: (chunk: BufferLike) => void) => void }
  stderr?: { on: (event: string, cb: (chunk: BufferLike) => void) => void }
  onClose: (cb: (code: number | null) => void) => void
  onError: (cb: (err: unknown) => void) => void
  kill: (signal?: "SIGKILL") => boolean
}

/** 持久化接口（启动/停止/退出时同步落盘，重启后恢复查看） */
export interface ProcessPersistApi {
  load: () => Promise<RunningProcess[]>
  save: (processes: RunningProcess[]) => Promise<boolean>
}

/** 已启动的进程句柄注册表（以 RunningProcess.id 关联） */
const procHandles = new Map<string, SpawnedProcess>()

/** 仍可能产生事件（输出/退出）的 entry 注册表：面板重建后 restore 复用其对象 */
const liveEntries = new Map<string, RunningProcess>()

/** 当前面板实例的响应式上下文（面板卸载置 null，输出事件退化为静默累积） */
let activeDeps: {
  processes: Ref<RunningProcess[]>
  notify: () => void
  persist?: ProcessPersistApi
} | null = null

function notifyUi(): void {
  activeDeps?.notify()
}

/** 将当前面板进程列表落盘（面板已卸载时跳过，重开面板后 restore 按 PID 自愈） */
function persistUi(): void {
  if (!activeDeps?.persist) return
  activeDeps.persist.save(activeDeps.processes.value).catch(() => { /* 落盘失败不影响主流程 */ })
}

// 输出节流（模块级单定时器）：高频输出合并为最多每 120ms 一次 UI 刷新，
// 防止逐 chunk 重新赋值数组导致面板卡顿；退出/停止时强制刷新
let outputTimer: ReturnType<typeof setTimeout> | null = null
function scheduleNotify(): void {
  if (outputTimer) return
  outputTimer = setTimeout(() => {
    outputTimer = null
    notifyUi()
  }, 120)
}
function flushNotify(): void {
  if (outputTimer) {
    clearTimeout(outputTimer)
    outputTimer = null
  }
  notifyUi()
}

/** taskkill 输出前缀（非零退出/异常时的诊断标记，作为失败判定依据） */
const KILL_FAIL_PREFIX = "taskkill 失败"

/** 执行命令并捕获输出（异步，不阻塞渲染进程 UI 线程） */
function runCapture(node: NonNullable<ReturnType<typeof getNodeProcessModules>>, command: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      node.child_process.exec(command, { windowsHide: true }, (error: Error | null, stdout: string) => {
        if (error) resolve(`${KILL_FAIL_PREFIX}: ${error.message}`)
        else resolve(String(stdout || "").trim())
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      resolve(`${KILL_FAIL_PREFIX}: ${msg}`)
    }
  })
}

/** Windows 下 taskkill 结束进程树（异步），返回任务输出（供诊断） */
async function killTree(node: NonNullable<ReturnType<typeof getNodeProcessModules>>, pid: number): Promise<string> {
  return runCapture(node, `taskkill /PID ${pid} /T /F`)
}

/** Windows 下检查进程是否仍存活（异步） */
async function isProcessAlive(node: NonNullable<ReturnType<typeof getNodeProcessModules>>, pid: number): Promise<boolean> {
  const out = await runCapture(node, `tasklist /FI "PID eq ${pid}" /NH`)
  return !out.startsWith(KILL_FAIL_PREFIX) && out.includes(String(pid))
}

/** Windows 下隐藏控制台窗口的 spawn 选项（Node 在 win32 上据 windowsHide 加 CREATE_NO_WINDOW） */
function getSpawnOptions(): Record<string, unknown> | undefined {
  return getNodeProcessModules() ? { windowsHide: true } : undefined
}

/** 使用系统默认程序打开脚本（类似双击本地文件） */
function openWithDefaultApp(filePath: string): boolean {
  const node = getNodeProcessModules()
  if (!node) return false
  const platform = node.os.platform()
  let command: string
  if (platform === "win32") {
    command = `start "" "${filePath}"`
  } else if (platform === "darwin") {
    command = `open "${filePath}"`
  } else {
    command = `xdg-open "${filePath}"`
  }
  try {
    node.child_process.exec(command)
    return true
  } catch {
    return false
  }
}

/** 启动结果：失败时带原因码（env=环境不支持，spawn=进程创建失败） */
export interface LaunchResult {
  ok: boolean
  reason?: "env" | "spawn"
  detail?: string
}

/** 停止结果：失败时带原因码（env=环境不支持，notRunning=目标未运行，failed=终止无效） */
export interface StopResult {
  ok: boolean
  reason?: "env" | "notRunning" | "failed"
  detail?: string
}

export function useScriptLauncher(deps?: {
  settings?: Ref<ScriptLauncherSettings>
  processes?: Ref<RunningProcess[]>
  onProcessUpdated?: () => void
  persist?: ProcessPersistApi
}) {
  const settings = deps?.settings
  const processes = deps?.processes
  const onProcessUpdated = deps?.onProcessUpdated
  const persist = deps?.persist

  // 注册为当前活跃面板（Dock 重建时新实例覆盖旧实例）
  if (processes && onProcessUpdated) {
    activeDeps = { processes, notify: onProcessUpdated, persist }
  }

  /** 面板卸载时解除注册：输出事件静默累积到 entry，重开后由 restoreProcesses 接回 */
  const deactivate = () => {
    activeDeps = null
  }

  /**
   * 启动脚本
   * @param script 脚本元数据
   * @param filePath 脚本文件绝对路径
   */
  const launchScript = async (script: Script, filePath: string): Promise<LaunchResult> => {
    // 「其他」语言无固定解释器，交给系统默认程序打开（内置监听无法 spawn 任意文件）
    if (script.language === "other" || !settings?.value.builtinMonitor) {
      return openWithDefaultApp(filePath) ? { ok: true } : { ok: false, reason: "env" }
    }
    if (!processes || !onProcessUpdated) {
      return { ok: false, reason: "env" }
    }
    return startMonitored(script, filePath)
  }

  /** 内置监听模式：spawn 执行，隐藏窗口，记录输出，支持停止 */
  const startMonitored = async (script: Script, filePath: string): Promise<LaunchResult> => {
    const node = getNodeProcessModules()
    if (!node || !processes) return { ok: false, reason: "env" }

    const procs = processes
    const id = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const entry: RunningProcess = {
      id,
      scriptId: script.id,
      name: script.name,
      language: script.language,
      description: script.description || "",
      command: filePath,
      status: "running",
      startedAt: Date.now(),
      stdout: "",
      stderr: "",
    }
    procs.value = [entry, ...procs.value]
    liveEntries.set(id, entry)
    notifyUi()

    try {
      const child = spawnProcess(node, script, filePath, getSpawnOptions())
      if (!child) {
        liveEntries.delete(id)
        entry.status = "error"
        entry.finishedAt = Date.now()
        notifyUi()
        persistUi()
        return { ok: false, reason: "spawn" }
      }

      procHandles.set(id, child)
      entry.pid = child.pid
      notifyUi()
      persistUi()

      const appendStdout = (chunk: BufferLike) => {
        const text = chunk.toString("utf-8")
        const next = entry.stdout + text
        entry.stdout = next.length > 200_000 ? next.slice(-200_000) : next
        scheduleNotify()
      }
      const appendStderr = (chunk: BufferLike) => {
        const text = chunk.toString("utf-8")
        const next = entry.stderr + text
        entry.stderr = next.length > 100_000 ? next.slice(-100_000) : next
        scheduleNotify()
      }
      child.stdout?.on("data", appendStdout)
      child.stderr?.on("data", appendStderr)
      child.onClose((code) => {
        procHandles.delete(id)
        liveEntries.delete(id)
        // 手动停止（killed）的进程保持 killed 状态，不要被覆盖回 exited
        if (entry.status === "running") {
          entry.status = "exited"
          entry.exitCode = code
          entry.finishedAt = Date.now()
        }
        flushNotify()
        persistUi()
      })
      child.onError((err) => {
        procHandles.delete(id)
        liveEntries.delete(id)
        entry.status = "error"
        entry.finishedAt = Date.now()
        const detail = err instanceof Error ? err.message : err ? String(err) : ""
        entry.stderr = (`${entry.stderr}\n[进程启动失败${detail ? `: ${detail}` : ""}]`).trim()
        flushNotify()
        persistUi()
      })
      return { ok: true }
    } catch (error) {
      procHandles.delete(id)
      liveEntries.delete(id)
      entry.status = "error"
      entry.finishedAt = Date.now()
      notifyUi()
      persistUi()
      return {
        ok: false,
        reason: "spawn",
        detail: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /** 创建子进程（按脚本语言选择命令，直接执行脚本文件路径），适配为最小 SpawnedProcess 接口 */
  function spawnProcess(
    node: NonNullable<ReturnType<typeof getNodeProcessModules>>,
    script: Script,
    filePath: string,
    spawnOpts: Record<string, unknown> | undefined,
  ): SpawnedProcess | null {
    try {
      const {
        command,
        args,
      } = getCommandAndArgs(node, script, filePath)
      const raw = node.child_process.spawn(command, args, spawnOpts as never)
      return {
        pid: raw.pid,
        stdout: raw.stdout ?? undefined,
        stderr: raw.stderr ?? undefined,
        onClose: (cb) => raw.on("close", cb),
        onError: (cb) => raw.on("error", cb),
        kill: (signal) => raw.kill(signal),
      }
    } catch {
      return null
    }
  }

  /** 按语言构造执行命令与参数（窗口隐藏由 spawn 的 windowsHide/CREATE_NO_WINDOW + PowerShell -WindowStyle Hidden 保证） */
  function getCommandAndArgs(
    node: NonNullable<ReturnType<typeof getNodeProcessModules>>,
    script: Script,
    filePath: string,
  ): { command: string, args: string[] } {
    const isWin = node.os.platform() === "win32"
    switch (script.language) {
      case "python":
        // 用 python.exe 而非 pythonw：pythonw 无控制台窗口但也会吞掉 stdout，
        // 面板内置监听需要捕获输出；窗口隐藏由 spawn 的 CREATE_NO_WINDOW 保证
        return isWin
          ? {
              command: "python.exe",
              args: [filePath],
            }
          : {
              command: "python3",
              args: [filePath],
            }
      case "nodejs":
        return isWin
          ? {
              command: "node.exe",
              args: [filePath],
            }
          : {
              command: "node",
              args: [filePath],
            }
      case "powershell":
        return isWin
          ? {
              command: "powershell.exe",
              args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", filePath],
            }
          : {
              command: "pwsh",
              args: ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-File", filePath],
            }
      case "bash":
        return {
          command: "bash",
          args: [filePath],
        }
      case "batch":
        return isWin
          ? {
              command: "cmd.exe",
              args: ["/c", filePath],
            }
          : {
              command: "sh",
              args: [filePath],
            }
      default:
        // other 语言在 launchScript 已改走系统默认程序打开，正常不会到达
        return {
          command: filePath,
          args: [],
        }
    }
  }

  /** Windows 下 taskkill 结束进程树并按需二次确认（顺序：先杀树再句柄兜底，保证 /T 能找到全部后代） */
  async function killOnWindows(
    node: NonNullable<ReturnType<typeof getNodeProcessModules>>,
    pid: number,
    notes: string[],
  ): Promise<boolean> {
    const first = await killTree(node, pid)
    let winKillOk = !first.startsWith(KILL_FAIL_PREFIX)
    if (first) notes.push(first)

    // 确认是否仍存活，是则再杀一次
    if (winKillOk && await isProcessAlive(node, pid)) {
      const second = await killTree(node, pid)
      winKillOk = !second.startsWith(KILL_FAIL_PREFIX)
      if (second) notes.push(second)
    }
    return winKillOk
  }

  /** 停止运行中的进程（Windows 先 taskkill 整棵进程树，再 kill 句柄兜底） */
  const stopProcess = async (id: string): Promise<StopResult> => {
    const node = getNodeProcessModules()
    if (!node) {
      return { ok: false, reason: "env" }
    }
    const target = activeDeps?.processes.value.find((p) => p.id === id)
    if (!target || target.status !== "running") {
      return { ok: false, reason: "notRunning" }
    }

    const proc = procHandles.get(id)
    const pid = target.pid
    const notes: string[] = []
    let winKillOk = false

    if (node.os.platform() === "win32" && pid) {
      winKillOk = await killOnWindows(node, pid, notes)
    }

    // 句柄兜底（非 Windows 或 taskkill 失败时），记录 kill 是否成功
    let killOk = false
    if (proc?.kill) {
      try {
        killOk = proc.kill("SIGKILL")
      } catch {
        killOk = false
      }
    }

    procHandles.delete(id)

    // 终止成功判定：taskkill 或句柄 kill 任一生效即视为已终止；
    // 全部失败时保持 running（进程仍在跑，UI 不得显示已停止），由 close 事件兜底改状态
    const terminated = winKillOk || killOk
    if (terminated) {
      target.status = "killed"
      target.finishedAt = Date.now()
      if (notes.length > 0) {
        target.stderr = (`${target.stderr}\n[停止] ${notes.join(" | ")}`).trim()
      }
    } else {
      target.stderr = (`${target.stderr}\n[停止失败] ${notes.join(" | ") || "kill 调用无效"}`).trim()
    }
    notifyUi()
    persistUi()

    if (terminated) {
      return { ok: true }
    }
    return { ok: false, reason: "failed", detail: notes.join(" | ") || undefined }
  }

  /** 停止全部运行中的进程 */
  const stopAllProcesses = async (): Promise<number> => {
    const running = activeDeps?.processes.value.filter((p) => p.status === "running") ?? []
    let count = 0
    for (const p of running) {
      if ((await stopProcess(p.id)).ok) count++
    }
    return count
  }

  /**
   * 插件卸载 / 思源退出时：不再杀掉运行中的进程（它们会继续在后台跑），
   * 只清理句柄与事件账本并同步落盘，供下次启动恢复查看
   */
  const cleanupOnDestroy = () => {
    procHandles.clear()
    liveEntries.clear()
    persistUi()
  }

  /**
   * 重启思源 / 面板重建后恢复进程列表：
   * - 句柄仍在本会话的条目（面板重建）直接复用原 entry 对象，输出继续流入；
   * - 跨会话遗留条目用 tasklist 校验 PID——存活标记 persisted 显示为运行中（可停止），
   *   已不存在标记 exited（可关闭）；仅显示不重新接管
   */
  const restoreProcesses = async (): Promise<RunningProcess[]> => {
    const saved = await persist?.load().catch(() => [] as RunningProcess[]) || []
    if (saved.length === 0) return []

    const node = getNodeProcessModules()
    const isWin = !!node && node.os.platform() === "win32"

    // 并行校验 PID（异步不阻塞 UI；本会话仍持有句柄的条目必然存活，跳过探测）
    const aliveList = await Promise.all(saved.map(async (p) => {
      if (procHandles.has(p.id)) return true
      if (!isWin || !node || p.pid === undefined) return false
      return isProcessAlive(node, p.pid)
    }))

    return saved.map((p, i) => {
      // 面板重建（同会话）：复用活 entry——输出闭包与退出回调都指向它
      if (aliveList[i] && procHandles.has(p.id)) {
        const reused = liveEntries.get(p.id)
        if (reused) return reused
      }
      return {
        ...p,
        persisted: true,
        status: (aliveList[i] ? "running" : "exited") as RunningProcess["status"],
        // 非 Windows 无法校验 PID，一律标记 exited 避免误报运行中
        ...(!aliveList[i] && p.status === "running" ? { finishedAt: Date.now() } : {}),
      }
    })
  }

  return {
    launchScript,
    stopProcess,
    stopAllProcesses,
    cleanupOnDestroy,
    restoreProcesses,
    deactivate,
  }
}
