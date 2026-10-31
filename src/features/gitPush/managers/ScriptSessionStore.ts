// gitPush 脚本会话托管：进程与日志生命周期与弹窗解耦（关窗不杀进程，重开可回看）
import type { ProjectScript } from "../types/scripts"
import { runProjectScript } from "./ScriptExecutor"

export type ScriptSessionStatus = "running" | "exited" | "stopped"

/** 会话快照（只读；log 为物化字符串，内部按块存储仅在读取时拼接） */
export interface ScriptSession {
  id: string
  projectId: string
  script: ProjectScript
  status: ScriptSessionStatus
  pid: number | undefined
  exitCode: number | null
  startedAt: number
  endedAt: number | null
  log: string
}

/** 轻量会话状态（不含日志拼接，供高频渲染路径使用） */
export interface ScriptSessionState {
  script: ProjectScript
  status: ScriptSessionStatus
  pid: number | undefined
  exitCode: number | null
  endedAt: number | null
}

/** 执行器注入接口（与 ScriptExecutor.runProjectScript 同形，单测可替换为假实现） */
export type ScriptRunnerFn = (
  script: ProjectScript,
  opts: { onOutput: (chunk: string) => void, onExit: (code: number | null) => void },
) => { pid: number | undefined, kill: () => void } | null

export interface ScriptSessionStore {
  /** 启动一条脚本会话；同脚本已在跑则幂等返回现有会话；超出并发上限返回 null */
  start: (projectId: string, script: ProjectScript) => ScriptSession | null
  get: (projectId: string, scriptId: string) => ScriptSession | undefined
  /** 轻量状态（不含日志 join）：高频渲染路径用 */
  getState: (projectId: string, scriptId: string) => ScriptSessionState | undefined
  listByProject: (projectId: string) => ScriptSession[]
  hasRunningByProject: (projectId: string) => boolean
  /** 显式停止（杀进程树）；仅对 running 会话生效 */
  stop: (projectId: string, scriptId: string) => void
  /** 停止某项目的全部运行中会话（删除项目等场景收尾，防孤儿进程失去 UI 入口） */
  stopByProject: (projectId: string) => void
  clearLog: (projectId: string, scriptId: string) => void
  /** 注册全局变更回调（日志追加/状态迁移/淘汰），返回退订函数 */
  onChange: (cb: () => void) => () => void
  /** 仅在状态迁移（启动/停止/退出/淘汰）时通知；日志追加不触发（卡片角标等低频信号） */
  onStatusChange: (cb: () => void) => () => void
  /** 运行中会话的进程 pid（供持久化落盘与下次启动清扫） */
  listRunningPids: () => number[]
  /** 仅在 pid 集合变化（启动/停止/退出/清空）时通知；日志追加不触发（持久化订阅用） */
  onPidsChange: (cb: () => void) => () => void
  /** 插件卸载：杀掉全部运行中会话并清空（不留孤儿进程；订阅关系保留） */
  destroyAll: () => void
}

/** 日志上限（触发裁剪）与保留水位（裁头保尾） */
const LOG_CAP = 200_000
const LOG_KEEP = 150_000
/** 并发运行上限（防误操作开满机器；超出 start 返回 null） */
export const MAX_RUNNING_SCRIPTS = 8
/** 已结束会话保留数量（超出按结束时间淘汰最旧） */
const MAX_FINISHED = 3

interface SessionRec {
  id: string
  projectId: string
  script: ProjectScript
  status: ScriptSessionStatus
  pid: number | undefined
  exitCode: number | null
  startedAt: number
  endedAt: number | null
  logChunks: string[]
  logLen: number
  /** 日志代际：追加/清空时 +1，快照据此复用上次 join 结果 */
  logGen: number
  cachedLog: string
  cachedLogGen: number
}

function snapshot(rec: SessionRec): ScriptSession {
  if (rec.cachedLogGen !== rec.logGen) {
    rec.cachedLog = rec.logChunks.join("")
    rec.cachedLogGen = rec.logGen
  }
  return {
    id: rec.id,
    projectId: rec.projectId,
    script: rec.script,
    status: rec.status,
    pid: rec.pid,
    exitCode: rec.exitCode,
    startedAt: rec.startedAt,
    endedAt: rec.endedAt,
    log: rec.cachedLog,
  }
}

/** 轻量状态投影（不触碰日志，供卡片角标 / 行状态等高频路径） */
function toState(rec: SessionRec): ScriptSessionState {
  return {
    script: rec.script,
    status: rec.status,
    pid: rec.pid,
    exitCode: rec.exitCode,
    endedAt: rec.endedAt,
  }
}

export function createScriptSessionStore(runner: ScriptRunnerFn): ScriptSessionStore {
  const recs = new Map<string, SessionRec>()
  const handles = new Map<string, { pid: number | undefined, kill: () => void }>()
  const listeners = new Set<() => void>()
  const statusListeners = new Set<() => void>()
  const pidListeners = new Set<() => void>()

  const key = (projectId: string, scriptId: string) => `${projectId}\u0000${scriptId}`
  const notifyAll = (set: Set<() => void>) => {
    for (const cb of [...set]) {
      try { cb() } catch { /* 单个订阅者异常不影响其余 */ }
    }
  }
  const notify = () => notifyAll(listeners)
  const notifyStatus = () => notifyAll(statusListeners)
  const notifyPids = () => notifyAll(pidListeners)
  const runningCount = () => {
    let n = 0
    for (const rec of recs.values()) {
      if (rec.status === "running") n++
    }
    return n
  }
  /** 每个项目各自保留最近 MAX_FINISHED 个已结束会话（避免别的项目结束会话挤掉当前查看的输出） */
  const evict = () => {
    const finishedByProject = new Map<string, SessionRec[]>()
    for (const rec of recs.values()) {
      if (rec.status === "running") continue
      const list = finishedByProject.get(rec.projectId) ?? []
      list.push(rec)
      finishedByProject.set(rec.projectId, list)
    }
    for (const list of finishedByProject.values()) {
      list.sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt))
      while (list.length > MAX_FINISHED) {
        const old = list.shift()!
        recs.delete(key(old.projectId, old.script.id))
      }
    }
  }
  /** 块缓冲 + 裁头保尾：避免高频输出下整段字符串反复拷贝 */
  const appendLog = (rec: SessionRec, chunk: string) => {
    rec.logChunks.push(chunk)
    rec.logLen += chunk.length
    rec.logGen++
    while (rec.logLen > LOG_CAP && rec.logChunks.length > 1) {
      rec.logLen -= rec.logChunks.shift()!.length
    }
    if (rec.logChunks.length === 1 && rec.logLen > LOG_CAP) {
      rec.logChunks[0] = rec.logChunks[0].slice(rec.logLen - LOG_KEEP)
      rec.logLen = LOG_KEEP
    }
  }
  /** 停止单条运行中会话（stop / stopByProject 共用） */
  const stopRec = (rec: SessionRec) => {
    if (rec.status !== "running") return
    const k = key(rec.projectId, rec.script.id)
    rec.status = "stopped"
    rec.endedAt = Date.now()
    const handle = handles.get(k)
    if (handles.delete(k)) notifyPids()
    try { handle?.kill() } catch { /* 已退出 */ }
    evict()
    notifyStatus()
    notify()
  }

  return {
    start(projectId, script) {
      const k = key(projectId, script.id)
      const existing = recs.get(k)
      if (existing?.status === "running") return snapshot(existing)
      evict()
      if (runningCount() >= MAX_RUNNING_SCRIPTS) return null
      const rec: SessionRec = {
        id: k,
        projectId,
        script,
        status: "running",
        pid: undefined,
        exitCode: null,
        startedAt: Date.now(),
        endedAt: null,
        logChunks: [],
        logLen: 0,
        logGen: 0,
        cachedLog: "",
        cachedLogGen: -1,
      }
      recs.set(k, rec)
      const handle = runner(script, {
        onOutput: (chunk) => {
          // rec 身份校验：旧进程在重跑后的迟到事件不得写入新会话
          const cur = recs.get(k)
          if (cur !== rec || rec.status !== "running") return
          appendLog(rec, chunk)
          notify()
        },
        onExit: (code) => {
          const cur = recs.get(k)
          if (cur !== rec || rec.status !== "running") return
          rec.status = "exited"
          rec.exitCode = code
          rec.endedAt = Date.now()
          if (handles.delete(k)) notifyPids()
          evict()
          notifyStatus()
          notify()
        },
      })
      if (handle) {
        rec.pid = handle.pid
        handles.set(k, handle)
        notifyPids()
      } else if (rec.status === "running") {
        // 执行器未回调 onExit 就返回 null：兜底收尾，避免会话永远停在 running 占并发位
        rec.status = "exited"
        rec.exitCode = -1
        rec.endedAt = Date.now()
        evict()
      }
      notifyStatus()
      notify()
      return snapshot(rec)
    },
    get(projectId, scriptId) {
      const rec = recs.get(key(projectId, scriptId))
      return rec ? snapshot(rec) : undefined
    },
    getState(projectId, scriptId) {
      const rec = recs.get(key(projectId, scriptId))
      return rec ? toState(rec) : undefined
    },
    listByProject(projectId) {
      return [...recs.values()]
        .filter((r) => r.projectId === projectId)
        .sort((a, b) => a.startedAt - b.startedAt)
        .map(snapshot)
    },
    hasRunningByProject(projectId) {
      for (const rec of recs.values()) {
        if (rec.projectId === projectId && rec.status === "running") return true
      }
      return false
    },
    stop(projectId, scriptId) {
      const rec = recs.get(key(projectId, scriptId))
      if (rec) stopRec(rec)
    },
    stopByProject(projectId) {
      const targets = [...recs.values()]
        .filter((r) => r.projectId === projectId && r.status === "running")
      for (const rec of targets) stopRec(rec)
    },
    clearLog(projectId, scriptId) {
      const rec = recs.get(key(projectId, scriptId))
      if (!rec) return
      rec.logChunks = []
      rec.logLen = 0
      rec.logGen++
      notify()
    },
    onChange(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    onStatusChange(cb) {
      statusListeners.add(cb)
      return () => { statusListeners.delete(cb) }
    },
    listRunningPids() {
      const pids: number[] = []
      for (const handle of handles.values()) {
        if (typeof handle.pid === "number" && handle.pid > 0) pids.push(handle.pid)
      }
      return pids
    },
    onPidsChange(cb) {
      pidListeners.add(cb)
      return () => { pidListeners.delete(cb) }
    },
    destroyAll() {
      for (const handle of handles.values()) {
        try { handle.kill() } catch { /* 已退出 */ }
      }
      const hadRunning = handles.size > 0
      handles.clear()
      recs.clear()
      // 订阅关系保留（模块单例跨插件禁用/启用存活）；仅重置数据
      if (hadRunning) notifyPids()
      notifyStatus()
      notify()
    },
  }
}

/** 全插件唯一会话表（真实 spawn；插件卸载经 GitPushManager.destroy → destroyAll 杀进程） */
export const scriptSessions: ScriptSessionStore = createScriptSessionStore(runProjectScript)

let pageGuardInstalled = false

/**
 * 页面卸载兜底：思源刷新 UI（reloadUI/livereload）与关窗**不保证**触发插件 onunload，
 * 必须自行监听 beforeunload/pagehide 杀会话。配合 pid 落盘清扫，覆盖三条路径：
 * 正常卸载（onunload）/ 页面刷新与关窗（beforeunload）/ 崩溃强杀（下次启动清扫）。
 */
export function installScriptSessionPageGuard(): void {
  if (pageGuardInstalled || typeof window === "undefined") return
  pageGuardInstalled = true
  const handler = () => { scriptSessions.destroyAll() }
  window.addEventListener("beforeunload", handler)
  window.addEventListener("pagehide", handler)
}
