// 远程与本地一致性分析 — 批量比对所有项目各本地分支与各远程分支（存在性/领先/落后/分叉）
// 状态自包含：内部向 manager 取项目快照，不依赖父组件传 projects（弹窗自包含规则）
import type {
  ConsistencyProjectRow,
  ConsistencyState,
  ConsistencySummary,
  GitProject,
  GitPushManager,
  GitRemoteInfo,
} from "../types"
import { computed, onUnmounted, ref } from "vue"
import { resolveValidPath } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"

/** 从跟踪 ref（如 origin/feature/x）解析所属远程名：优先匹配已检测远程名的最长前缀，兜底取首段 */
function resolveRefRemote(ref: string, remoteNames: string[]): { remote: string, branch: string } {
  let best = ""
  for (const name of remoteNames) {
    if (ref.startsWith(`${name}/`) && name.length > best.length) {
      best = name
    }
  }
  if (best) {
    return { remote: best, branch: ref.slice(best.length + 1) }
  }
  const idx = ref.indexOf("/")
  return idx === -1 ? { remote: ref, branch: ref } : { remote: ref.slice(0, idx), branch: ref.slice(idx + 1) }
}

export function useConsistencyAudit(manager: GitPushManager) {
  const rows = ref<ConsistencyProjectRow[]>([])
  /** 是否正在批量分析 */
  const analyzing = ref(false)
  /** 是否已完成过至少一轮分析（区分"未分析"与"分析结果为空"） */
  const analyzed = ref(false)
  /** 分析前是否先 fetch 远程（默认开启，结果最准确） */
  const fetchFirst = ref(true)
  /** 仅显示存在问题的项目 */
  const issueOnly = ref(true)
  /** 进度：已处理 / 总项目数 */
  const progress = ref({ done: 0, total: 0 })
  /** 当前一轮分析的取消句柄 */
  let abortController: AbortController | null = null

  /** 对单个项目执行分析（路径无效/git 失败 → error 行） */
  async function auditProject(p: GitProject): Promise<ConsistencyProjectRow> {
    const row: ConsistencyProjectRow = {
      id: p.id,
      name: p.name,
      path: p.path,
      error: false,
      noRemote: false,
      noBranches: false,
      fetchErrors: {},
      branches: [],
    }

    const cwd = resolveValidPath(p)
    if (!cwd) {
      row.error = true
      return row
    }

    let remotes: GitRemoteInfo[]
    try {
      remotes = await manager.detectRemotes(cwd)
    } catch (e: unknown) {
      // 非 git 仓库 / 权限问题等
      console.warn(`[gitPush] 一致性分析：检测远程失败 ${p.name}:`, getErrorMessage(e))
      row.error = true
      return row
    }
    const remoteNames = [...new Set(remotes.map((r) => r.name))]
    if (remoteNames.length === 0) {
      row.noRemote = true
      return row
    }

    // 可选先 fetch（--prune 清理已删除远程分支的跟踪引用；失败记录并继续用缓存跟踪 ref）
    if (fetchFirst.value) {
      const signal = abortController?.signal
      await Promise.allSettled(remoteNames.map(async (name) => {
        try {
          await manager.fetchRemoteAt(cwd, name, { prune: true, signal })
        } catch (e: unknown) {
          row.fetchErrors[name] = getErrorMessage(e) || String(e)
        }
      }))
    }

    const [branches, trackingRefs] = await Promise.all([
      manager.getBranches(cwd),
      manager.getRemoteTrackingRefs(cwd),
    ])

    // fetch 失败且无任何缓存跟踪 ref 的远程不可信（缓存可能为空），跳过其比对避免误报
    const validRemoteNames = remoteNames.filter((name) => !row.fetchErrors[name] || trackingRefs.some((r) => r.startsWith(`${name}/`)))
    if (validRemoteNames.length === 0 && branches.length === 0) {
      row.noBranches = true
      return row
    }

    // 跟踪 ref 按远程分组（排除 fetch 失败且无缓存的远程）
    const refsByRemote = new Map<string, Set<string>>()
    for (const ref of trackingRefs) {
      const { remote, branch } = resolveRefRemote(ref, remoteNames)
      if (!validRemoteNames.includes(remote)) { continue }
      const set = refsByRemote.get(remote)
      if (set) { set.add(branch) }
      else { refsByRemote.set(remote, new Set([branch])) }
    }

    if (branches.length === 0 && trackingRefs.length === 0) {
      row.noBranches = true
      return row
    }

    // 本地分支 × 有效远程：存在性 + ahead/behind
    const matchedRefs = new Set<string>()
    for (const b of branches) {
      for (const remote of validRemoteNames) {
        if (!refsByRemote.get(remote)?.has(b.name)) {
          row.branches.push({ branch: b.name, current: b.current, remote, state: "localOnly", ahead: 0, behind: 0 })
          continue
        }
        matchedRefs.add(`${remote}/${b.name}`)
        try {
          const { ahead, behind } = await manager.countAheadBehind(cwd, `${remote}/${b.name}`, b.name)
          let state: ConsistencyState = "synced"
          if (ahead > 0 && behind > 0) { state = "diverged" }
          else if (ahead > 0) { state = "ahead" }
          else if (behind > 0) { state = "behind" }
          row.branches.push({ branch: b.name, current: b.current, remote, state, ahead, behind })
        } catch (e: unknown) {
          console.warn(`[gitPush] 一致性分析：rev-list 失败 ${p.name}/${b.name}@${remote}:`, getErrorMessage(e))
          row.branches.push({ branch: b.name, current: b.current, remote, state: "error", ahead: 0, behind: 0 })
        }
      }
    }

    // 远程独有分支（含陈旧远程残留跟踪 ref，提示可清理）
    for (const remote of validRemoteNames) {
      for (const branch of refsByRemote.get(remote) || []) {
        if (!matchedRefs.has(`${remote}/${branch}`)) {
          row.branches.push({ branch, current: false, remote, state: "remoteOnly", ahead: 0, behind: 0 })
        }
      }
    }

    return row
  }

  /** 批量分析全部项目（GitExecutor 双池限流自动排队，无需额外节流） */
  async function runAudit() {
    if (analyzing.value) { return }
    analyzing.value = true
    analyzed.value = false
    abortController = new AbortController()
    progress.value = { done: 0, total: 0 }
    try {
      // 分析期间项目增删不影响本轮：开始时快照
      const projects = await manager.getProjects()
      progress.value = { done: 0, total: projects.length }
      const settled = await Promise.allSettled(projects.map(async (p) => {
        const row = await auditProject(p)
        progress.value = { ...progress.value, done: progress.value.done + 1 }
        return row
      }))
      rows.value = settled
        .filter((r): r is PromiseFulfilledResult<ConsistencyProjectRow> => r.status === "fulfilled")
        .map((r) => r.value)
      analyzed.value = true
    } finally {
      analyzing.value = false
      abortController = null
    }
  }

  /** 取消进行中的分析（fetch 子进程 kill、排队 Promise reject） */
  function cancel() {
    abortController?.abort()
  }

  /** 组件卸载（弹窗关闭）时自动取消，避免僵尸 fetch 进程 */
  onUnmounted(cancel)

  /** 七态汇总计数（跨全部项目：项目级 error 行 + 各分支行） */
  const summary = computed<ConsistencySummary>(() => {
    const s: ConsistencySummary = { synced: 0, ahead: 0, behind: 0, diverged: 0, localOnly: 0, remoteOnly: 0, error: 0 }
    for (const row of rows.value) {
      if (row.error) { s.error++ }
      for (const b of row.branches) { s[b.state]++ }
    }
    return s
  })

  /** 项目是否存在任何问题（供"仅显示问题"过滤） */
  function hasIssue(row: ConsistencyProjectRow): boolean {
    return row.error || row.noRemote || row.noBranches
      || Object.keys(row.fetchErrors).length > 0
      || row.branches.some((b) => b.state !== "synced")
  }

  /** 过滤后的展示行：issueOnly 时仅保留问题项目，且其分支行仅保留非 synced 行 */
  const displayRows = computed<ConsistencyProjectRow[]>(() => {
    if (!issueOnly.value) { return rows.value }
    return rows.value.filter(hasIssue).map((row) => ({
      ...row,
      branches: row.branches.filter((b) => b.state !== "synced"),
    }))
  })

  return {
    rows,
    displayRows,
    analyzing,
    analyzed,
    fetchFirst,
    issueOnly,
    progress,
    summary,
    runAudit,
    cancel,
  }
}
