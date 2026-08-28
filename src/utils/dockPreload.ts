/**
 * 统一 Dock 预加载注册表
 * 集中管理 Dock 功能的启动预载/刷新入口与状态栏提示
 */
import { useStatusBarTask } from "@/features/statusBar/composables/useStatusBarTask"

/** 状态栏文案（功能注册时从 plugin.i18n.<feature> 提取） */
export interface DockPreloadLabels {
  refreshing: string
  done: string
  failed: string
}

/** Dock 预加载注册配置 */
export interface DockPreloadOptions {
  /** 唯一标识（同时作状态栏任务 id），如 "statistics" */
  id: string
  /** 状态栏图标（Iconify 已注册） */
  icon: string
  /** 状态栏文案（启动预载时面板未挂载，无法从 props 取 i18n，故注册时注入） */
  labels: DockPreloadLabels
  /** 数据刷新函数（功能模块级共享入口） */
  refresh: () => Promise<void>
}

/** 预载状态：idle=未执行 / loading=进行中 / ready=成功 / error=失败 */
export type DockPreloadState = "idle" | "loading" | "ready" | "error"

interface DockPreloadEntry {
  opts: DockPreloadOptions
  state: DockPreloadState
}

const registry = new Map<string, DockPreloadEntry>()

/**
 * 注册 Dock 预加载任务（幂等：重复注册仅覆盖配置，不重置已达成状态）
 * 由各 Dock 功能在 registerFeature 内部同步调用
 */
export function registerDockPreload(opts: DockPreloadOptions): void {
  const existing = registry.get(opts.id)
  if (existing) {
    existing.opts = opts
    return
  }
  registry.set(opts.id, { opts, state: "idle" })
}

/** 执行单个预载任务：状态流转 idle→loading→ready/error，带状态栏三态提示 */
async function runEntry(entry: DockPreloadEntry): Promise<void> {
  if (entry.state === "loading") return
  entry.state = "loading"
  const task = useStatusBarTask(entry.opts.id, entry.opts.icon)
  task.progress({ label: entry.opts.labels.refreshing })
  try {
    await entry.opts.refresh()
    entry.state = "ready"
    task.complete(entry.opts.labels.done)
  } catch (error) {
    console.error(`[dockPreload] ${entry.opts.id} 预加载失败:`, error)
    entry.state = "error"
    task.fail(entry.opts.labels.failed)
  }
}

/** 插件启动统一执行所有已注册预载（串行 await，避免多功能并发全量 SQL 查询） */
export async function runAllDockPreloads(): Promise<void> {
  for (const entry of registry.values()) {
    await runEntry(entry)
  }
}

/** 手动/定时刷新统一入口：进行中防重，带状态栏三态提示 */
export async function refreshDockPreload(id: string): Promise<void> {
  const entry = registry.get(id)
  if (!entry) return
  await runEntry(entry)
}

/** 面板 onMounted 分流查询：ready→直接用 / loading→等待 / idle|error→兜底刷新 */
export function getDockPreloadState(id: string): DockPreloadState {
  return registry.get(id)?.state ?? "idle"
}

/** 插件卸载清理注册表 */
export function clearDockPreloads(): void {
  registry.clear()
}
