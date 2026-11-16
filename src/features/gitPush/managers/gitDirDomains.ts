// `.git` 变化路径 → 需要重载的查询域（P1-1）
//
// 为什么必须分类：文件监听补上 `refs/heads` / `refs/remotes` 后，一次 `git fetch` 会改动
// `refs/remotes/*` 与 `FETCH_HEAD`；如果沿用「任何事件都标脏六个域」的旧做法，每张可见卡片
// 会跟着重载 log + branches + stash（3 个进程/卡），把「实时」换成新的进程风暴。
//
// 判据只看 gitdir 内的相对路径（posix 分隔符）。无法识别的一律回落到**全部域**：
// 宁可多查一次，也不能漏掉一次点击就能看见的变化。
import type { ProjectQueryKind } from "../types/queryScheduler"

/** 无法判定时的保守集合（宁可多查一次，不可漏报） */
const ALL_KINDS: ProjectQueryKind[] = [
  "pushStatus",
  "workingTree",
  "log",
  "branches",
  "stash",
  "tags",
  "conflicts",
]

/** 本地引用推进（提交 / reset / 分支增删）：日志、分支、stash 快照都可能变，ahead 也会变 */
const LOCAL_REF_KINDS: ProjectQueryKind[] = ["pushStatus", "workingTree", "log", "branches", "stash"]

/** 远程跟踪引用推进（fetch / push）：只影响 ahead/behind 快照 */
const REMOTE_REF_KINDS: ProjectQueryKind[] = ["pushStatus"]

/** 合并/rebase 中断状态：冲突列表 + 工作区（未合并文件）+ ahead 都可能变 */
const SEQ_STATE_KINDS: ProjectQueryKind[] = ["pushStatus", "workingTree", "conflicts"]

/**
 * git 内部噪音路径（与任何展示域都无关），必须**显式忽略**：
 * 递归监听整棵 gitdir 后，一次 fetch 会写 `objects/pack/*`、`logs/refs/remotes/*`，
 * 若按「未识别即全标」处理，一次 fetch 就退化成「重载全部域」——正是 P1-1 要避免的进程风暴。
 */
const IGNORED_PREFIXES = [
  "objects/",
  "logs/",
  "hooks/",
  "info/",
  "lfs/",
  "modules/",
  "worktrees/",
  "rr-cache/",
  "svn/",
]

/** 同上，但按文件名精确匹配（编辑器/临时状态文件，不承载 refs 语义） */
const IGNORED_FILES = new Set([
  "COMMIT_EDITMSG",
  "SQUASH_MSG",
  "TAG_EDITMSG",
  "MERGE_MSG",
  "description",
  "gc.log",
  "shallow",
  "config.worktree",
])

/**
 * 把一批变化路径映射为待重载的域集合（去重、顺序稳定）。
 *
 * @param changedPaths 相对 gitdir 的路径（`refs/heads/main`、`index`、`HEAD` …）；
 *                     空数组（平台未给 filename）按「无法判定」处理
 */
export function classifyGitDirChanges(changedPaths: string[]): ProjectQueryKind[] {
  if (changedPaths.length === 0) return [...ALL_KINDS]
  const kinds = new Set<ProjectQueryKind>()
  for (const raw of changedPaths) {
    // 归一：反斜杠 → 正斜杠、去掉 "./" 前缀与结尾斜杠
    // （递归监听上报目录时**不带**结尾斜杠，例如 `refs/remotes`、`objects/13`，
    //   不能靠「是否以 / 结尾」判断它是目录）
    const path = raw.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "")
    if (path === "") {
      for (const kind of ALL_KINDS) kinds.add(kind)
      continue
    }
    // 噪音路径：直接忽略（见 IGNORED_PREFIXES/IGNORED_FILES 说明）
    if (IGNORED_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix))) continue
    if (IGNORED_FILES.has(path)) continue
    // 临时锁文件（`refs/heads/main.lock`、`index.lock`）：真正的目标文件紧随其后写入，
    // 忽略它们可以避免同一次操作产生两轮分类（实际文件那一次已经足够）
    if (path.endsWith(".lock")) continue
    // 远程跟踪引用 / fetch 产物：fetch、push、pull 的直接痕迹
    if (path === "refs/remotes" || path.startsWith("refs/remotes/") || path === "FETCH_HEAD") {
      for (const kind of REMOTE_REF_KINDS) kinds.add(kind)
      continue
    }
    // 本地引用（提交推进 / 分支增删）与 HEAD（切分支 / detached）
    if (path === "HEAD" || path === "refs/heads" || path.startsWith("refs/heads/")) {
      for (const kind of LOCAL_REF_KINDS) kinds.add(kind)
      continue
    }
    // stash 引用：只影响 stash 列表与工作区
    if (path === "refs/stash" || path.startsWith("refs/stash/")) {
      kinds.add("stash")
      kinds.add("workingTree")
      continue
    }
    // tag 增删
    if (path === "refs/tags" || path.startsWith("refs/tags/")) {
      kinds.add("tags")
      continue
    }
    // staging 变化：只影响工作区摘要（**刻意不标 log/branches/stash**：
    // `git add` 不改变提交历史与分支，旧实现顺手标脏三个域，等于每次暂存都多跑 3 个进程）
    if (path === "index") {
      kinds.add("workingTree")
      continue
    }
    // 合并 / rebase / reset / cherry-pick 的痕迹
    if (path === "MERGE_HEAD" || path === "ORIG_HEAD" || path === "AUTO_MERGE"
      || path === "CHERRY_PICK_HEAD" || path === "REVERT_HEAD"
      || path.startsWith("rebase-merge") || path.startsWith("rebase-apply")) {
      for (const kind of SEQ_STATE_KINDS) kinds.add(kind)
      continue
    }
    // 引用根目录本身的「子目录增删」事件（例如首次 fetch 创建 refs/remotes/origin）：
    // 同一次操作必然还会上报具体的 ref 文件路径（refs/remotes/origin/main），
    // 由那些路径给出精确分类即可；把 refs 根目录当成「本地+远程全变」会让一次 fetch
    // 顺带重载日志/分支/stash —— 正是要消除的进程放大。
    if (path === "refs") continue
    // 引用打包：refs 下文件消失、内容落到 packed-refs（本地与远程都可能变）
    if (path === "packed-refs") {
      for (const kind of LOCAL_REF_KINDS) kinds.add(kind)
      for (const kind of REMOTE_REF_KINDS) kinds.add(kind)
      continue
    }
    // 未识别路径（git 新版本新增的文件、config 改动等）：保守全标
    for (const kind of ALL_KINDS) kinds.add(kind)
  }
  return [...kinds]
}
