// 第 1 层探测：.git 文件系统监听（0 次 git 进程）
//
// 原理：不「问」git，而是让 git 自己「说」——它有变动时会改写 .git 下的文件，
// 监听这些文件的 mtime/事件即可近乎实时地感知变化，且**不产生任何子进程**。
// 这是唯一能同时做到「实时」与「零成本」的手段（实测每次 git 调用固定 ~210ms 进程启动费）。
//
// ⚠️ 覆盖边界（必须清楚，否则会误期待）：
//   能捕获：commit / checkout / 切分支 / fetch / push / merge / rebase / stash / reset
//   不能捕获：编辑器里修改了工作区文件（未暂存）
//             —— 这类改动不写 .git 任何文件，只能靠第 2 层轮询。
//
// ⚠️ 只监听**具体文件**而非递归监听目录：Windows 的 fs.watch 递归能力有限且不可靠，
//   而 gitdir 下的关键文件是固定集合，逐个监听更稳。
import type { FSWatcher } from "node:fs"
import { getNodeModules } from "@/utils/nodeModules"

/** 单项目监听状态 */
interface WatchEntry {
  /** 已建立的 watcher（可能挂多个路径，任一变化都触发） */
  watchers: FSWatcher[]
  /** 防抖定时器句柄 */
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * `.git` 关键文件监听器。
 *
 * 职责单一：检测到变化后回调 `onChange(projectId)`，**不自己发 git 命令**——
 * 是否重载、重载什么由调度器与调用方决定（避免第三条派发路径）。
 */
export class GitDirWatcher {
  /** 项目 id → 监听状态 */
  private entries = new Map<string, WatchEntry>()
  /** 事件合并窗口（ms） */
  private debounceMs: number
  /** 变化回调 */
  private onChange: (projectId: string) => void

  constructor(debounceMs: number, onChange: (projectId: string) => void) {
    this.debounceMs = debounceMs
    this.onChange = onChange
  }

  /** 更新防抖窗口（设置变更时调用，对已建立的监听立即生效） */
  setDebounceMs(ms: number): void {
    this.debounceMs = ms
  }

  /**
   * gitdir 下的关键监听目标（相对 gitdir 的路径）。
   *
   * 选择依据（哪些文件能反映「状态变了」）：
   *   HEAD            切分支 / detached 切换 / 复位
   *   index           暂存 / 取消暂存 / commit / checkout（工作区与 index 的分界）
   *   refs            本地分支提交推进（目录，含 heads/）；用目录而非具体文件，
   *                   否则新增分支文件时收不到事件
   *   packed-refs     引用被打包后 refs 下的文件会消失，改动落在本文件
   *   refs/remotes    远程跟踪引用（fetch / push 的直接产物 → 唯一能反映 behind 变化）
   *   ORIG_HEAD       reset / merge / rebase / pull 的痕迹
   *   MERGE_HEAD      merge 中断状态
   *   rebase-merge / rebase-apply  rebase 中断状态
   *
   * 注：文件与目录在 `fs.existsSync` / `fs.watch` 下处理方式一致，无需额外标志区分；
   * 不存在的目标（如 packed-refs 仅在 gc 后出现、rebase-merge 仅在 rebase 中出现）跳过即可。
   */
  private static readonly TARGETS: string[] = [
    "HEAD",
    "index",
    "refs",
    "packed-refs",
    "ORIG_HEAD",
    "MERGE_HEAD",
    "rebase-merge",
    "rebase-apply",
  ]

  /**
   * 开始监听某项目的 gitdir。
   *
   * @param projectId 项目 id
   * @param gitDir 已解析的 gitdir **绝对**路径（调用方经 `git rev-parse --absolute-git-dir` 解析，
   *               见 `WorktreeOps.getGitDir`）。⚠️ 必须是绝对路径：`--git-dir` 可能返回相对路径
   *               （如 `.git`），`path.join` 后会指向错误位置而使监听静默失效。
   *               用绝对形式同时使 worktree / submodule 的 gitdir 不在 `.git` 下的情形同样正确。
   * @returns 是否至少建立了一个监听（false = 环境不支持 / 路径不可用，调用方据此降级）
   */
  watch(projectId: string, gitDir: string): boolean {
    this.unwatch(projectId)
    const node = getNodeModules()
    if (!node) return false
    const { fs, path } = node

    const entry: WatchEntry = {
      watchers: [],
      timer: null,
    }

    for (const target of GitDirWatcher.TARGETS) {
      const abs = path.join(gitDir, target)
      try {
        // 不存在则跳过（如 packed-refs 仅在 gc 后出现、rebase-merge 仅 rebase 中出现）：
        // 这些是「可选存在」的文件，缺失属正常，不能因此判定整体失败
        if (!fs.existsSync(abs)) continue
        const watcher = fs.watch(abs, { persistent: false }, () => this.scheduleNotify(projectId))
        // watch 可能因权限/文件被删而抛错，也可能返回后立刻 emit error（如被监听文件删除），
        // 后者不处理会成为未捕获异常
        watcher.on("error", () => { /* 单点失效不影响其余监听；下轮 ensureWatch 会重建 */ })
        entry.watchers.push(watcher)
      } catch {
        // 单个目标失败不影响其余目标
      }
    }

    if (entry.watchers.length === 0) return false
    this.entries.set(projectId, entry)
    return true
  }

  /**
   * 判断某项目是否已在监听。
   * ⚠️ 仅代表「曾经建立成功」，watcher 可能因文件被删而静默失效，
   * 故调用方应周期性重建（见 `useGitProbe` 的重建逻辑）。
   */
  isWatching(projectId: string): boolean {
    return this.entries.has(projectId)
  }

  /** 已成功监听的项目数（诊断用） */
  get watchedCount(): number {
    return this.entries.size
  }

  /** 停止监听单个项目 */
  unwatch(projectId: string): void {
    const entry = this.entries.get(projectId)
    if (!entry) return
    if (entry.timer !== null) clearTimeout(entry.timer)
    for (const w of entry.watchers) {
      try { w.close() } catch { /* 已关闭 */ }
    }
    this.entries.delete(projectId)
  }

  /** 停止全部监听（插件卸载 / 面板销毁） */
  destroy(): void {
    for (const id of [...this.entries.keys()]) this.unwatch(id)
  }

  /**
   * 事件合并：git 一次操作会连续改写多个文件
   * （如 commit 同时动 index + refs/heads/xxx + logs/HEAD），
   * 必须合并成一次通知，否则一次 commit 会触发 3~5 轮重载。
   *
   * 已有待发定时器时不重置：持续事件（如长时间的 fetch 逐步写 refs）不应无限推迟通知。
   */
  private scheduleNotify(projectId: string): void {
    const entry = this.entries.get(projectId)
    if (!entry || entry.timer !== null) return
    entry.timer = setTimeout(() => {
      const cur = this.entries.get(projectId)
      if (!cur) return
      cur.timer = null
      this.onChange(projectId)
    }, this.debounceMs)
  }
}
