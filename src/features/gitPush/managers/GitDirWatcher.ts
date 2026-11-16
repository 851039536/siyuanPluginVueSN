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
// ⚠️ 为什么优先 `fs.watch(gitDir, { recursive: true })` 而不是逐个文件：
//   非递归监听 `refs` 只能收到「其直接子目录项」的变化，收不到 `refs/heads/main`、
//   `refs/remotes/origin/main` 这类**文件内容**的变化 —— 而 fetch / push / commit 改的正是它们。
//   递归监听一次覆盖整棵 gitdir，也不怕 git 版本新增文件。Windows / macOS 支持；
//   平台不支持时（部分 Linux）回退到显式目标列表，深层 ref 变化交给第 2 层轮询兜底
//   （轮询的 index/HEAD 预筛会命中，最坏延迟一个轮询周期）。
import type { FSWatcher } from "node:fs"
import { getNodeModules } from "@/utils/nodeModules"

/** 单项目监听状态 */
interface WatchEntry {
  /** 已建立的 watcher（递归一个，或回退时的多个） */
  watchers: FSWatcher[]
  /** 防抖定时器句柄 */
  timer: ReturnType<typeof setTimeout> | null
  /**
   * 防抖窗口内累积的变化路径（相对 gitdir、posix 分隔符）。
   * 事件**必须**按路径分类再上抛，否则「任何事件都标脏全部域」会让一次 fetch
   * 触发每张卡 3 个查询（见 gitDirDomains.ts）。
   */
  pending: Set<string>
}

/**
 * `.git` 关键文件监听器。
 *
 * 职责单一：检测到变化后回调 `onChange(projectId, changedPaths)`，**不自己发 git 命令**——
 * 是否重载、重载什么由调度器与调用方决定（避免第三条派发路径）。
 */
export class GitDirWatcher {
  /** 项目 id → 监听状态 */
  private entries = new Map<string, WatchEntry>()
  /** 事件合并窗口（ms） */
  private debounceMs: number
  /** 变化回调（第 2 参为防抖窗口内累积的变化路径） */
  private onChange: (projectId: string, changedPaths: string[]) => void

  constructor(debounceMs: number, onChange: (projectId: string, changedPaths: string[]) => void) {
    this.debounceMs = debounceMs
    this.onChange = onChange
  }

  /** 更新防抖窗口（设置变更时调用，对已建立的监听立即生效） */
  setDebounceMs(ms: number): void {
    this.debounceMs = ms
  }

  /**
   * gitdir 下的关键监听目标（相对 gitdir 的路径）——**仅在递归监听不可用时**使用。
   *
   * 选择依据（哪些文件能反映「状态变了」）：
   *   HEAD            切分支 / detached 切换 / 复位
   *   index           暂存 / 取消暂存 / commit / checkout（工作区与 index 的分界）
   *   refs            引用根目录（含 heads / remotes / tags 这些子目录的增删）
   *   refs/heads      本地分支文件（**直接子项**，故非递归也能收到 main 的改写）
   *   refs/remotes    远程跟踪引用目录（fetch / push 产物；注意其下还有一层远程名目录）
   *   refs/tags       Tag 增删
   *   packed-refs     引用被打包后 refs 下的文件会消失，改动落在本文件
   *   FETCH_HEAD      fetch 的落盘痕迹（即使 refs 未变也能标识一次 fetch）
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
    "refs/heads",
    "refs/remotes",
    "refs/tags",
    "packed-refs",
    "FETCH_HEAD",
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
      pending: new Set(),
    }

    // 首选递归监听：一次覆盖 refs/heads/main、refs/remotes/origin/main 这类深层路径。
    // 平台不支持时 fs.watch 会同步抛错（ERR_FEATURE_UNAVAILABLE_ON_PLATFORM），回退到显式目标。
    let recursive = false
    try {
      const watcher = fs.watch(gitDir, { persistent: false, recursive: true }, (_event, filename) => {
        this.scheduleNotify(projectId, normalizeRelPath(filename))
      })
      watcher.on("error", () => { /* 单点失效不影响其余监听；下轮 ensureWatch 会重建 */ })
      entry.watchers.push(watcher)
      recursive = true
    } catch {
      recursive = false
    }

    if (!recursive) {
      for (const target of GitDirWatcher.TARGETS) {
        const abs = path.join(gitDir, target)
        try {
          // 不存在则跳过（如 packed-refs 仅在 gc 后出现、rebase-merge 仅 rebase 中出现）：
          // 这些是「可选存在」的文件，缺失属正常，不能因此判定整体失败
          if (!fs.existsSync(abs)) continue
          const watcher = fs.watch(abs, { persistent: false }, (_event, filename) => {
            // 非递归时 filename 是「相对于被监听目录」的，必须带上 target 前缀才能分类
            const rel = normalizeRelPath(filename)
            this.scheduleNotify(projectId, rel ? `${target}/${rel}` : target)
          })
          // watch 可能因权限/文件被删而抛错，也可能返回后立刻 emit error（如被监听文件删除），
          // 后者不处理会成为未捕获异常
          watcher.on("error", () => { /* 单点失效不影响其余监听；下轮 ensureWatch 会重建 */ })
          entry.watchers.push(watcher)
        } catch {
          // 单个目标失败不影响其余目标
        }
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
   * 合并期间**累积变化路径**而不是只记「有变化」：上层要按路径分类决定重载哪些域
   * （fetch 只影响 pushStatus，commit 才影响 log/branches）。
   *
   * 已有待发定时器时不重置：持续事件（如长时间的 fetch 逐步写 refs）不应无限推迟通知。
   */
  private scheduleNotify(projectId: string, relPath: string): void {
    const entry = this.entries.get(projectId)
    if (!entry) return
    entry.pending.add(relPath)
    if (entry.timer !== null) return
    entry.timer = setTimeout(() => {
      const cur = this.entries.get(projectId)
      if (!cur) return
      cur.timer = null
      const changed = [...cur.pending]
      cur.pending.clear()
      this.onChange(projectId, changed)
    }, this.debounceMs)
  }
}

/**
 * 归一化 fs.watch 给的 filename：可能是 Buffer、可能带反斜杠、可能为 null。
 * 统一成 posix 分隔符的相对路径（分类函数只认这种形态）；null → 空串（上层按「无法判定」保守处理）。
 */
function normalizeRelPath(filename: string | Buffer | null): string {
  if (filename === null) return ""
  const raw = typeof filename === "string" ? filename : filename.toString()
  return raw.replace(/\\/g, "/").replace(/^\.\//, "")
}
