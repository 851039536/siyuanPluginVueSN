// gitPush 功能注册入口与图标注入
import type { Plugin } from "siyuan"
import { getFrontend } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { killOrphanPid } from "./managers/ScriptExecutor"
import { installScriptSessionPageGuard, scriptSessions } from "./managers/ScriptSessionStore"
import { GitPushManager } from "./types"

/** 会话 pid 落盘键（崩溃/强杀后 onunload 不执行，下次启动清扫遗留进程） */
const SCRIPT_PID_KEY = "script-session-pids"
/** 持久化订阅只挂一次（模块单例跨插件禁用/启用存活，重复挂载只会重复写盘） */
let pidPersistWired = false

/**
 * 注册 gitPush 功能。
 *
 * 实例在 register 内部自挂载到 `plugin.__gitPush`（由 `DESTROYABLE_KEYS` 统一 destroy），
 * 不向 `registerFeatures()` 返回实例——遵循 AGENTS.md「实例挂载与销毁模式」的单一范式。
 */
export function registerGitPush(plugin: Plugin): void {
  plugin.addIcons(
    `<symbol id="iconGitPush" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v5"/><path d="m9 8-3 3 3 3"/><path d="m15 8 3 3-3 3"/><path d="M7 16a5 5 0 0 0 10 0"/></symbol>`,
  )
  // 页面卸载兜底：刷新 UI / 关窗不保证触发插件 onunload，须自行监听销毁会话
  installScriptSessionPageGuard()

  const manager = new GitPushManager(plugin)
  // init 是异步的（storage / git 配置读取）；失败必须可观测，且不能留下半初始化实例
  void manager.init().catch((e: unknown) => {
    console.error("[gitPush] 初始化失败", e)
  })
  ;(plugin as any).__gitPush = manager

  // pid 落盘与启动清扫只由主窗口负责：浮动窗口的会话表是独立实例，
  // 若它也执行清扫/写盘，会误杀主窗口正在运行的会话并用空列表覆盖落盘 pid
  if (getFrontend() === "desktop") void initScriptPidPersistence(plugin)
}

/** 启动清扫上次遗留的会话进程（崩溃/强杀兜底），并把运行中 pid 持续落盘 */
async function initScriptPidPersistence(plugin: Plugin): Promise<void> {
  const storage = new PluginStorage(plugin)
  const saved = await storage.load<number[]>(SCRIPT_PID_KEY)
  if (Array.isArray(saved)) {
    const current = new Set(scriptSessions.listRunningPids())
    for (const pid of saved) {
      // 只补杀上次会话遗留的 pid，跳过本次已启动的（防 PID 复用撞上新会话）
      if (typeof pid === "number" && !current.has(pid)) killOrphanPid(pid)
    }
  }
  await storage.save(SCRIPT_PID_KEY, scriptSessions.listRunningPids())
  if (pidPersistWired) return
  pidPersistWired = true
  scriptSessions.onPidsChange(() => {
    void storage.save(SCRIPT_PID_KEY, scriptSessions.listRunningPids())
  })
}
