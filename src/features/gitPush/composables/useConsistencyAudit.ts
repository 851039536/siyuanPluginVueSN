// 远程与本地一致性分析 — 批量比对所有项目各本地分支与各远程分支（存在性/领先/落后/分叉）
// 状态自包含：内部向 manager 取项目快照，不依赖父组件传 projects（弹窗自包含规则）
import type {
  ConsistencyProjectRow,
  ConsistencyState,
  ConsistencySummary,
  GitProject,
  GitPushManager,
  ProjectLimit,
} from "../types"
import { computed, onUnmounted, ref } from "vue"
// 直连纯模块而非 "../utils" 桶：桶会经 platform/meta 拉入运行时 "siyuan"，
// 使本模块无法在 Node 单测环境加载（useConsistencyAudit.spec.ts 需要假 manager）
import { getProjectRemoteNames } from "../utils/platform"
import { resolveValidPath } from "../utils/project"
import { poolProcess } from "../utils/runtime"
import { getErrorMessage } from "@/utils/stringUtils"

/**
 * 一致性分析的项目并发上限。
 *
 * 分析是「用户主动点一次、盯着进度条」的长任务，但它和点卡片/暂存/提交共用
 * GitExecutor 的**同一个本地池**：原实现用 `Promise.allSettled` 把全部项目一次压进去，
 * 20 个项目会把本地池占满，期间界面明显变慢。取 2 是有意让出池子（analysis 不该抢占交互）。
 */
const AUDIT_PROJECT_CONCURRENCY = 2

export function useConsistencyAudit(manager: GitPushManager) {
  const rows = ref<ConsistencyProjectRow[]>([])
  /** 是否正在批量分析 */
  const analyzing = ref(false)
  /** 是否已完成过至少一轮分析（区分"未分析"与"分析结果为空"；缓存恢复时同样置 true） */
  const analyzed = ref(false)
  /** 上次分析完成时间（ISO，弹窗展示"上次分析"文案） */
  const analyzedAt = ref("")
  /** 分析前是否先 fetch 远程（默认开启，结果最准确） */
  const fetchFirst = ref(true)
  /** 单次分析的项目数量上限（"all" = 全部项目；选择跨会话持久化） */
  const projectLimit = ref<ProjectLimit>("all")
  /** 仅显示存在问题的项目 */
  const issueOnly = ref(true)
  /** 进度：已处理 / 总项目数 */
  const progress = ref({ done: 0, total: 0 })
  /** 项目总数（弹窗空态判断用，加载缓存时快照） */
  const projectCount = ref(0)
  /** 当前一轮分析的取消句柄 */
  let abortController: AbortController | null = null

  // ── 结果持久化缓存（跨会话复用：打开弹窗直接展示上次结果，无需重复分析）──

  /** 缓存是否已尝试加载（防重复读盘 + 防与 runAudit 竞态） */
  let cacheLoaded = false

  /** 加载持久化缓存（有历史结果时恢复 rows/analyzedAt；顺带快照项目总数） */
  async function loadCache() {
    if (cacheLoaded) { return }
    cacheLoaded = true
    try {
      projectCount.value = (await manager.getProjects()).length
      const cache = await manager.storage.consistencyCache.loadOrDefault()
      // 分析中/已完成时跳过（用户可能先点了分析按钮），避免覆盖新结果
      if (!analyzing.value && !analyzed.value && cache.rows.length > 0) {
        rows.value = cache.rows
        analyzedAt.value = cache.analyzedAt
        analyzed.value = true
      }
      // 恢复项目数量选择（老版本缓存无此字段时保持默认 "all"）
      if (cache.projectLimit !== undefined) {
        projectLimit.value = cache.projectLimit
      }
    } catch (e: unknown) {
      console.warn("[gitPush] 一致性分析：加载缓存失败", getErrorMessage(e))
    }
  }
  void loadCache()

  /** 保存当前结果到持久化缓存 */
  async function saveCache() {
    try {
      await manager.storage.consistencyCache.save({
        analyzedAt: analyzedAt.value,
        projectLimit: projectLimit.value,
        rows: rows.value,
      })
    } catch (e: unknown) {
      console.warn("[gitPush] 一致性分析：保存缓存失败", getErrorMessage(e))
    }
  }

  /**
   * 对单个项目执行分析（路径无效/git 失败 → error 行）。
   *
   * 进程预算（P1-3 改造后）：
   *   · 远程名取项目记录里配好的平台远程，**不再每项目跑一次 `git remote -v`**
   *     （记录为空时才回落检测，见下）；
   *   · 本地分支 + 远程跟踪 ref 由**一次** `for-each-ref` 取齐（原先是两次）；
   *   · 远端 ref 与本地分支 sha 相同即「已同步」，直接跳过 `rev-list`（原实现每对都跑）。
   * 于是单项目本地进程数从 `3 + B×R` 降到 `2 + 仅真正有差异的 (分支, 远程) 对`。
   */
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

    // 远程名优先取项目记录（面板里配好的平台远程），避免每个项目多付一次 `git remote -v`
    let remoteNames = getProjectRemoteNames(p).map((r) => r.name)
    if (remoteNames.length === 0) {
      try {
        const remotes = await manager.detectRemotes(cwd)
        remoteNames = [...new Set(remotes.map((r) => r.name))]
      } catch (e: unknown) {
        // 非 git 仓库 / 权限问题等
        console.warn(`[gitPush] 一致性分析：检测远程失败 ${p.name}:`, getErrorMessage(e))
        row.error = true
        return row
      }
    }
    if (remoteNames.length === 0) {
      row.noRemote = true
      return row
    }

    // 可选先 fetch（--prune 清理已删除远程分支的跟踪引用；失败记录并继续用缓存跟踪 ref）
    if (fetchFirst.value) {
      const signal = abortController?.signal
      await Promise.allSettled(remoteNames.map(async (name) => {
        try {
          await manager.fetchRemoteAt(cwd, name, {
            prune: true,
            signal,
          })
        } catch (e: unknown) {
          row.fetchErrors[name] = getErrorMessage(e) || String(e)
        }
      }))
    }

    // 一次进程取齐「本地分支 + 远程跟踪 ref」，两边都带 sha 供相等短路
    const snapshot = await manager.getRefSnapshot(cwd, remoteNames)

    // fetch 失败且无任何缓存跟踪 ref 的远程不可信（缓存可能为空），跳过其比对避免误报
    const validRemoteNames = remoteNames.filter((name) => !row.fetchErrors[name] || snapshot.remoteRefs.some((r) => r.remote === name))
    const validRemoteSet = new Set(validRemoteNames)
    if (validRemoteNames.length === 0 && snapshot.branches.length === 0) {
      row.noBranches = true
      return row
    }

    // 跟踪 ref 按远程分组（排除 fetch 失败且无缓存的远程）
    const branchesByRemote = new Map<string, Set<string>>()
    for (const ref of snapshot.remoteRefs) {
      if (!validRemoteSet.has(ref.remote)) { continue }
      const set = branchesByRemote.get(ref.remote)
      if (set) { set.add(ref.branch) }
      else { branchesByRemote.set(ref.remote, new Set([ref.branch])) }
    }

    if (snapshot.branches.length === 0 && snapshot.remoteRefs.length === 0) {
      row.noBranches = true
      return row
    }

    /** 远程跟踪 ref 的 sha（`<remote>/<branch>` → sha），用于「相等即同步」短路 */
    const remoteShaByKey = new Map(snapshot.remoteRefs.map((ref) => [`${ref.remote}/${ref.branch}`, ref.sha]))

    // 本地分支 × 有效远程：存在性 + ahead/behind
    const matchedRefs = new Set<string>()
    for (const b of snapshot.branches) {
      for (const remote of validRemoteNames) {
        const key = `${remote}/${b.name}`
        if (!branchesByRemote.get(remote)?.has(b.name)) {
          row.branches.push({
            branch: b.name,
            current: b.current,
            remote,
            state: "localOnly",
            ahead: 0,
            behind: 0,
          })
          continue
        }
        matchedRefs.add(key)
        // 两侧 sha 相同 ⇒ 指向同一提交 ⇒ ahead=0、behind=0，无需跑 rev-list（省下绝大多数进程）
        if (remoteShaByKey.get(key) === b.sha) {
          row.branches.push({
            branch: b.name,
            current: b.current,
            remote,
            state: "synced",
            ahead: 0,
            behind: 0,
          })
          continue
        }
        try {
          const { ahead, behind } = await manager.countAheadBehind(cwd, key, b.name)
          let state: ConsistencyState = "synced"
          if (ahead > 0 && behind > 0) { state = "diverged" }
          else if (ahead > 0) { state = "ahead" }
          else if (behind > 0) { state = "behind" }
          row.branches.push({
            branch: b.name,
            current: b.current,
            remote,
            state,
            ahead,
            behind,
          })
        } catch (e: unknown) {
          console.warn(`[gitPush] 一致性分析：rev-list 失败 ${p.name}/${b.name}@${remote}:`, getErrorMessage(e))
          row.branches.push({
            branch: b.name,
            current: b.current,
            remote,
            state: "error",
            ahead: 0,
            behind: 0,
          })
        }
      }
    }

    // 远程独有分支（含陈旧远程残留跟踪 ref，提示可清理）
    for (const remote of validRemoteNames) {
      for (const branch of branchesByRemote.get(remote) || []) {
        if (!matchedRefs.has(`${remote}/${branch}`)) {
          row.branches.push({
            branch,
            current: false,
            remote,
            state: "remoteOnly",
            ahead: 0,
            behind: 0,
          })
        }
      }
    }

    return row
  }

  /**
   * 批量分析全部项目。
   *
   * 项目级并发限到 `AUDIT_PROJECT_CONCURRENCY`（原因见常量注释）；单项目失败不中断整轮，
   * 结果按 **targets 下标**回填（poolProcess 是乱序完成的，不能 push）。
   */
  async function runAudit() {
    if (analyzing.value) { return }
    analyzing.value = true
    analyzed.value = false
    abortController = new AbortController()
    progress.value = { done: 0, total: 0 }
    try {
      // 分析期间项目增删不影响本轮：开始时快照，并按数量上限截取前 N 个
      const projects = await manager.getProjects()
      const limited = projectLimit.value === "all" ? projects : projects.slice(0, projectLimit.value)
      progress.value = { done: 0, total: limited.length }
      const results: ConsistencyProjectRow[] = []
      await poolProcess(limited, AUDIT_PROJECT_CONCURRENCY, async (p, index) => {
        try {
          results[index] = await auditProject(p)
        } catch (e: unknown) {
          // auditProject 内部已兜住绝大多数失败；这里兜住意外异常，保证「一轮结果行数 = 项目数」
          console.warn(`[gitPush] 一致性分析：项目失败 ${p.name}:`, getErrorMessage(e))
          results[index] = {
            id: p.id,
            name: p.name,
            path: p.path,
            error: true,
            noRemote: false,
            noBranches: false,
            fetchErrors: {},
            branches: [],
          }
        } finally {
          progress.value.done++
        }
      })
      rows.value = results.filter((row): row is ConsistencyProjectRow => !!row)
      analyzedAt.value = new Date().toISOString()
      analyzed.value = true
      await saveCache()
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
    displayRows,
    analyzing,
    analyzed,
    analyzedAt,
    fetchFirst,
    projectLimit,
    issueOnly,
    progress,
    projectCount,
    summary,
    runAudit,
  }
}
