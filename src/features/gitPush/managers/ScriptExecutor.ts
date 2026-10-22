// gitPush 项目脚本执行器：spawn 子进程、码制自识别输出回调与进程树终止
import type { ProjectScript } from "../types/scripts"
import { getNodeProcessModules } from "@/utils/nodeModules"
import { formatCommandLine } from "../utils/scriptScan"
import { createScriptOutputDecoder } from "../utils/scriptDecode"

/** 运行中进程句柄（停止 = 杀进程树） */
export interface ScriptRunHandle {
  pid: number | undefined
  kill: () => void
}

/** 执行回调：输出逐块回传（已按码制解码并清理 ANSI）；退出码 null 表示被信号终止 */
export interface ScriptRunOptions {
  onOutput: (chunk: string) => void
  onExit: (code: number | null) => void
}

/** 子进程最小接口（child_process.spawn 返回值） */
interface SpawnedProcess {
  pid?: number
  stdout?: { on: (event: string, cb: (chunk: BufferLike) => void) => void } | null
  stderr?: { on: (event: string, cb: (chunk: BufferLike) => void) => void } | null
  on: (event: string, cb: (...args: unknown[]) => void) => void
  kill: (signal?: string) => boolean
}

type BufferLike = Uint8Array & { toString: (encoding?: string) => string }

/**
 * 在项目根运行一条识别出的脚本/命令。
 * Windows 下 npm/pnpm/yarn/dotnet 的 shim 需经 shell 解析，统一 shell:true + 参数引用；
 * 停止时 Windows 走 taskkill /T 杀整棵进程树（否则 cmd→node→dev server 会残留孤儿进程）。
 */
export function runProjectScript(script: ProjectScript, opts: ScriptRunOptions): ScriptRunHandle | null {
  const node = getNodeProcessModules()
  if (!node) {
    opts.onExit(-1)
    return null
  }
  const { child_process, os } = node
  const isWin = os.platform() === "win32"
  const cmdline = formatCommandLine(script.command, script.args)
  let child: SpawnedProcess
  try {
    child = child_process.spawn(cmdline, {
      cwd: script.cwd,
      shell: true,
      windowsHide: true,
    }) as unknown as SpawnedProcess
  } catch (err) {
    opts.onOutput(`${String(err)}\n`)
    opts.onExit(-1)
    return null
  }

  // 输出链路：原始字节 → 码制自识别解码 → 清理 ANSI → 回调；
  // killed/settled 双闸防「停止后仍灌输出」与 error+exit 双事件重复收尾
  const decoder = createScriptOutputDecoder()
  let killed = false
  let settled = false
  const emit = (chunk: BufferLike) => {
    if (killed || settled) return
    const text = decoder.push(chunk)
    if (text) opts.onOutput(text)
  }
  const settle = (code: number | null) => {
    if (settled) return
    settled = true
    if (!killed) {
      const rest = decoder.flush()
      if (rest) opts.onOutput(rest)
    }
    opts.onExit(code)
  }
  child.stdout?.on("data", emit)
  child.stderr?.on("data", emit)
  child.on("error", (err: unknown) => {
    if (!settled && !killed) opts.onOutput(`${String(err)}\n`)
    settle(-1)
  })
  child.on("exit", (code: unknown) => {
    settle(typeof code === "number" ? code : null)
  })

  return {
    pid: child.pid,
    kill: () => {
      killed = true
      if (!child.pid) {
        try { child.kill() } catch { /* 已退出 */ }
        return
      }
      if (isWin) {
        try {
          child_process.execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => { /* 异步兜底 */ })
        } catch {
          try { child.kill() } catch { /* 已退出 */ }
        }
      } else {
        try { child.kill("SIGTERM") } catch { /* 已退出 */ }
      }
    },
  }
}
