/**
 * 脚本启动器 - 脚本执行组合式函数
 *
 * 两种执行模式：
 * - 系统默认程序打开（默认，类似双击本地文件）
 * - 内置监听模式（可选）：不显示 Windows 控制台窗体，由面板内显示启动信息、
 *   运行输出与停止按钮
 */
import type { Ref } from "vue"
import type {
  RunningProcess,
  Script,
  ScriptLauncherSettings,
} from "../types"
import {
  getElectronRemoteShell,
  getNodeFsPathOs,
  getNodeProcessModules,
} from "@/utils/nodeModules"

/** 进程管理器类型（child_process.spawn 返回值的最小接口） */
type BufferLike = Uint8Array & { toString: (encoding?: string) => string }

interface SpawnedProcess {
  pid?: number
  stdout?: { on: (event: string, cb: (chunk: BufferLike) => void) => void }
  stderr?: { on: (event: string, cb: (chunk: BufferLike) => void) => void }
  on: (event: string, cb: (code: number | null) => void) => void
  kill: (signal?: string) => boolean
}

/** 已启动的进程句柄注册表（以 RunningProcess.id 关联） */
const procHandles = new Map<string, SpawnedProcess>()

/** Windows 下隐藏控制台窗口的 spawn 选项 */
function getSpawnOptions(): Record<string, unknown> | undefined {
  const node = getNodeProcessModules()
  if (!node) return undefined
  const opts: Record<string, unknown> = {
    windowsHide: true,
  }
  if (node.os.platform() === "win32") {
    opts.windowsVerbatimArguments = false
    // detached:true 在 Windows 上会让子进程新建独立控制台窗口（反而弹出窗体），
    // 这里改用 CREATE_NO_WINDOW 标志彻底隐藏新进程的控制台
    opts.detached = false
    // CREATE_NO_WINDOW = 0x08000000
    opts.windowsHide = true
  }
  return opts
}

/** 使用系统默认程序打开脚本（类似双击本地文件） */
function openWithDefaultApp(_script: Script, filePath: string): boolean {
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

/** 获取 Electron shell（用于打开目录等） */
function getShell() {
  return getElectronRemoteShell()
}

export interface ProcessPersistApi {
  load: () => Promise<RunningProcess[]>
  save: (processes: RunningProcess[]) => Promise<boolean>
  clear: () => Promise<boolean>
}

export function useScriptLauncher(deps?: {
  settings?: Ref<ScriptLauncherSettings>
  processes?: Ref<RunningProcess[]>
  onProcessUpdated?: () => void
  /** 运行中进程持久化接口（启动/停止/退出时同步落盘，重启后恢复查看） */
  persist?: ProcessPersistApi
}) {
  const settings = deps?.settings
  const processes = deps?.processes
  const onProcessUpdated = deps?.onProcessUpdated
  const persist = deps?.persist

  /**
   * 启动脚本
   * @param script 脚本元数据
   * @param filePath 脚本文件绝对路径
   * @param content 脚本内容（内置监听模式可选的注入内容；未提供时使用文件路径执行）
   */
  const launchScript = async (script: Script, filePath: string, content?: string): Promise<boolean> => {
    if (!settings?.value.builtinMonitor) {
      return openWithDefaultApp(script, filePath)
    }
    if (!processes || !onProcessUpdated) {
      return false
    }
    return startMonitored(script, filePath, content)
  }

  /** 内置监听模式：spawn 执行，隐藏窗口，记录输出，支持停止 */
  const startMonitored = async (script: Script, filePath: string, content?: string): Promise<boolean> => {
    const node = getNodeProcessModules()
    if (!node || !processes || !onProcessUpdated) return false

    const procs = processes
    const notify = onProcessUpdated
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
    notify()

    // 输出节流：高频输出时合并为最多每 120ms 触发一次 UI 更新，
    // 防止逐 chunk 重新赋值数组导致面板卡顿；退出/停止时强制刷新
    let outputTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleNotify = () => {
      if (outputTimer) return
      outputTimer = setTimeout(() => {
        outputTimer = null
        notify()
      }, 120)
    }
    const flushNotify = () => {
      if (outputTimer) {
        clearTimeout(outputTimer)
        outputTimer = null
      }
      notify()
    }

    try {
      const spawnOpts = getSpawnOptions()
      const child = spawnProcess(node, script, filePath, content, spawnOpts)
      if (!child) {
        updateEntry(id, {
          status: "error",
          finishedAt: Date.now(),
        })
        notify()
        return false
      }

      procHandles.set(id, child)
      updateEntry(id, { pid: child.pid })
      notify()
      persistProcesses()

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
      child.on("close", (code) => {
        procHandles.delete(id)
        // 手动停止（killed）的进程保持 killed 状态，不要被覆盖回 exited
        if (entry.status === "running") {
          entry.status = "exited"
          entry.exitCode = code
          entry.finishedAt = Date.now()
        }
        flushNotify()
        persistProcesses()
      })
      child.on("error", () => {
        procHandles.delete(id)
        entry.status = "error"
        entry.finishedAt = Date.now()
        entry.stderr = (`${entry.stderr}\n[进程启动失败]`).trim()
        flushNotify()
        persistProcesses()
      })
      return true
    } catch {
      procHandles.delete(id)
      updateEntry(id, {
        status: "error",
        finishedAt: Date.now(),
      })
      notify()
      return false
    }
  }

  /** 创建子进程（按脚本语言选择命令；content 提供时写入临时文件执行） */
  function spawnProcess(
    node: NonNullable<ReturnType<typeof getNodeProcessModules>>,
    script: Script,
    filePath: string,
    content: string | undefined,
    spawnOpts: Record<string, unknown> | undefined,
  ): SpawnedProcess | null {
    try {
      const target = content !== undefined && content !== ""
        ? writeTempScript(script, content) || filePath
        : filePath
      const {
        command,
        args,
      } = getCommandAndArgs(node, script, target)
      return node.child_process.spawn(command, args, spawnOpts as never) as SpawnedProcess
    } catch {
      return null
    }
  }

  /** 将内容写入临时脚本文件并返回路径 */
  function writeTempScript(script: Script, content: string): string | null {
    const node = getNodeFsPathOs()
    if (!node) return null
    const ext = getExtension(script.language)
    try {
      const tmpDir = node.path.join(node.os.tmpdir(), "siyuan-scripts")
      if (!node.fs.existsSync(tmpDir)) node.fs.mkdirSync(tmpDir, { recursive: true })
      const tmpPath = node.path.join(tmpDir, `${script.id}-${Date.now()}${ext}`)
      node.fs.writeFileSync(tmpPath, content, "utf-8")
      return tmpPath
    } catch {
      return null
    }
  }

  /** 按语言构造执行命令与参数（窗口隐藏由 spawn 的 CREATE_NO_WINDOW + PowerShell -WindowStyle Hidden 保证） */
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
        return {
          command: filePath,
          args: [],
        }
    }
  }

  /** 更新某个进程条目（保持引用，仅变更字段） */
  function updateEntry(id: string, patch: Partial<RunningProcess>) {
    if (!processes) return
    const target = processes.value.find((p) => p.id === id)
    if (target) Object.assign(target, patch)
  }

  /** Windows 下 taskkill 结束进程树（同步），返回任务输出（供诊断） */
  function killTreeSync(
    node: NonNullable<ReturnType<typeof getNodeProcessModules>>,
    pid: number,
  ): string {
    try {
      const out = node.child_process.execSync(
        `taskkill /PID ${pid} /T /F`,
        {
          encoding: "utf-8",
          windowsHide: true,
        },
      )
      return String(out || "").trim()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // 非零退出：可能进程已不存在（已被终止）或权限不足
      return `taskkill 失败: ${msg}`
    }
  }

  /** Windows 下检查进程是否仍存活 */
  function isProcessAliveSync(
    node: NonNullable<ReturnType<typeof getNodeProcessModules>>,
    pid: number,
  ): boolean {
    try {
      const out = node.child_process.execSync(
        `tasklist /FI "PID eq ${pid}" /NH`,
        {
          encoding: "utf-8",
          windowsHide: true,
        },
      )
      return String(out || "").includes(String(pid))
    } catch {
      return false
    }
  }

  /** 停止运行中的进程（Windows 先 taskkill 整棵进程树，再 kill 句柄兜底） */
  const stopProcess = (id: string): { ok: boolean, message?: string } => {
    const node = getNodeProcessModules()
    if (!node || !processes) {
      return {
        ok: false,
        message: "当前环境不支持",
      }
    }
    const target = processes.value.find((p) => p.id === id)
    if (!target || target.status !== "running") {
      return {
        ok: false,
        message: "进程未在运行",
      }
    }

    const proc = procHandles.get(id)
    const pid = target.pid
    const notes: string[] = []
    let winKillOk = false

    if (node.os.platform() === "win32" && pid) {
      // 1) 先杀整棵树（此时父进程还在，/T 能找到全部后代进程），
      //    再 kill 句柄兜底 —— 顺序不能反，否则父进程先死，树关系丢失，
      //    孙进程变成孤儿无法被 /T 找到
      const first = killTreeSync(node, pid)
      winKillOk = !first.startsWith("taskkill 失败")
      if (first) notes.push(first)

      // 2) 确认是否仍存活，是则再杀一次
      if (winKillOk && isProcessAliveSync(node, pid)) {
        const second = killTreeSync(node, pid)
        winKillOk = !second.startsWith("taskkill 失败")
        if (second) notes.push(second)
      }
    }

    // 3) 句柄兜底（非 Windows 或 taskkill 失败时）
    if (proc?.kill) {
      try {
        proc.kill("SIGKILL")
      } catch { /* 忽略 */ }
    }

    procHandles.delete(id)
    target.status = "killed"
    target.finishedAt = Date.now()
    if (notes.length > 0) {
      target.stderr = (`${target.stderr}\n[停止] ${notes.join(" | ")}`).trim()
    }
    onProcessUpdated?.()
    persistProcesses()
    return winKillOk
      ? { ok: true }
      : {
          ok: true,
          message: notes.join(" | "),
        }
  }

  /** 停止全部运行中的进程 */
  const stopAllProcesses = (): number => {
    if (!processes) return 0
    let count = 0
    for (const p of processes.value.filter((p) => p.status === "running")) {
      if (stopProcess(p.id).ok) count++
    }
    return count
  }

  /** 将当前运行中进程列表同步落盘（重启后可恢复查看） */
  const persistProcesses = () => {
    if (!persist || !processes) return
    persist.save(processes.value).catch(() => { /* 落盘失败不影响主流程 */ })
  }

  /**
   * 插件卸载 / 思源退出时：不再杀掉运行中的进程（它们会继续在后台跑），
   * 只清理句柄并同步落盘，供下次启动恢复查看
   */
  const cleanupOnDestroy = () => {
    procHandles.clear()
    persistProcesses()
  }

  /**
   * 重启思源后恢复上次会话遗留的进程：
   * 用 tasklist 校验 PID 是否仍存活——存活标记 persisted 显示为运行中（可停止），
   * 已不存在标记 exited（可关闭）；仅显示不重新接管
   */
  const restoreProcesses = async (): Promise<RunningProcess[]> => {
    const saved = await persist?.load().catch(() => [] as RunningProcess[]) || []
    if (saved.length === 0) return []

    const node = getNodeProcessModules()
    const restored: RunningProcess[] = saved.map((p) => {
      const alive = !!node
        && node.os.platform() === "win32"
        && p.pid !== undefined
        && isProcessAliveSync(node, p.pid)
      return {
        ...p,
        persisted: true,
        status: alive ? "running" : "exited",
        // 非 Windows 无法校验 PID，一律标记 exited 避免误报运行中
        ...(!alive && p.status === "running" ? { finishedAt: Date.now() } : {}),
      }
    })
    return restored
  }

  return {
    launchScript,
    stopProcess,
    stopAllProcesses,
    cleanupOnDestroy,
    restoreProcesses,
    getShell,
  }
}

/** 语言 → 临时文件扩展名 */
function getExtension(language: Script["language"]): string {
  const map: Record<Script["language"], string> = {
    python: ".py",
    bash: ".sh",
    powershell: ".ps1",
    nodejs: ".js",
    batch: ".bat",
    other: ".txt",
  }
  return map[language]
}
