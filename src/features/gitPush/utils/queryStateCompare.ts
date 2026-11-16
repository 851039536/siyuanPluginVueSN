// 查询结果「值是否相同」判定（P1-5）
//
// 为什么需要：`pushStatuses` / `workingTrees` 是**快照**语义 —— 下游（卡片 diff 缓存、
// `useGitStats` 的聚合 computed、`watch(workingTrees[id])`）全都按**引用变化**判断「要不要重算」。
// 后台探测如果每轮都写入一个新对象，即便仓库什么都没变，也会：
//   · 让每张卡触发 watcher → `diffTreeVersion++` → 单文件 diff / changeset 缓存整体过期；
//   · 让 `projectStats` 这类聚合 computed 被反复求值；
//   · 表现为「刷新时界面抖一下」，而进程数其实并没有增加。
//
// 判据取「用户可见维度」：文件列表按 path/status/staged/unstaged/oldPath 逐项比。
// 文件数通常很小（几十到几百），O(F) 字符串比较远低于一次 git 进程（~210ms），
// 所以这里的比较是纯赚。
import type { PushStatusInfo, WorkingTreeInfo } from "../types/storage"

/** 推送状态是否存在用户可见差异（prev 缺失时视为「不同」，必须写入） */
export function isSamePushStatus(prev: PushStatusInfo | undefined, next: PushStatusInfo): boolean {
  if (!prev) return false
  if (prev.branch !== next.branch || prev.needsPush !== next.needsPush) return false
  const prevKeys = Object.keys(prev.remotes)
  const nextKeys = Object.keys(next.remotes)
  if (prevKeys.length !== nextKeys.length) return false
  for (const key of nextKeys) {
    const a = prev.remotes[key]
    const b = next.remotes[key]
    // 远程消失/新增即视为变化（noUpstream / error / unknown 三态语义不得被忽略）
    if (!a) return false
    if (a.ahead !== b.ahead || a.behind !== b.behind || a.noUpstream !== b.noUpstream) return false
    if ((a.error ?? "") !== (b.error ?? "")) return false
  }
  return true
}

/** 工作区状态是否存在用户可见差异（文件列表按顺序逐项比） */
export function isSameWorkingTree(prev: WorkingTreeInfo | undefined, next: WorkingTreeInfo): boolean {
  if (!prev) return false
  if (prev.branch !== next.branch || prev.hasChanges !== next.hasChanges) return false
  if (prev.stagedCount !== next.stagedCount
    || prev.unstagedCount !== next.unstagedCount
    || prev.untrackedCount !== next.untrackedCount) return false
  if (prev.files.length !== next.files.length) return false
  for (let i = 0; i < next.files.length; i++) {
    const a = prev.files[i]
    const b = next.files[i]
    if (a.path !== b.path || a.status !== b.status || a.staged !== b.staged) return false
    // 可选字段按「缺省 = false/空串」归一，避免 undefined 与 false 被当成差异
    if ((a.unstaged === true) !== (b.unstaged === true)) return false
    if ((a.oldPath ?? "") !== (b.oldPath ?? "")) return false
  }
  return true
}
