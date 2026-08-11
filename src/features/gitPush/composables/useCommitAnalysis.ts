// 提交分析 — 批量读取各项目提交日志，聚合时间分布/提交次数/内容类型/作者排行；行数统计视图独立并行抓取 numstat 生成代码行数排行
import type { Ref } from "vue"
import type {
  AuthorLineRankItem,
  CommitAnalysisEntry,
  CommitAnalysisStats,
  CommitAnalysisType,
  CommitAnalysisViewSettings,
  GitProject,
  GitPushManager,
  ProjectLineRankItem,
} from "../types"
import { computed, ref } from "vue"
import { DEFAULT_ANALYSIS_VIEW_SETTINGS } from "../types"
import {
  buildDailyCommitBuckets,
  parseCommitAnalysisType,
  rankByCount,
  resolveValidPath,
} from "../utils"
import { sumAuthorLines, sumProjectLines, type NumstatCommit } from "../reportMetrics"

/** 每项目抓取条数选项（仿 BranchCommitList.countOptions） */
export const COMMIT_COUNT_OPTIONS = [30, 50, 100, 200] as const

/** 项目排行上限 / 作者排行上限（超出只展示头部，避免长列表淹没关键信息） */
const PROJECT_RANK_LIMIT = 20
const AUTHOR_RANK_LIMIT = 10

export function useCommitAnalysis(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 分析中标记（并发去重） */
  const analyzing = ref(false)
  /** 是否已完成过至少一轮分析（区分"未分析"与"分析结果为空"） */
  const analyzed = ref(false)
  /** 每项目抓取的提交条数（默认 100，可改 30/50/100/200） */
  const commitCount = ref<number>(100)
  /** 上次分析完成时间（ISO，缓存加载/分析完成后回填，供面板展示） */
  const analyzedAt = ref("")
  /** 跨项目合并的原始提交条目缓存 */
  const entries = ref<CommitAnalysisEntry[]>([])
  /** 分析失败的项目数（路径无效/git 失败，getCommitLog 内部吞错时按空数组计） */
  const failedCount = ref(0)
  /** 是否已尝试过从存储载入缓存（防重复读盘） */
  let cacheLoaded = false
  /** 热力图/日历显示设置（视图/范围/每周第一天/格子主色，持久化到 git-push-analysis-view） */
  const viewSettings = ref<CommitAnalysisViewSettings>({ ...DEFAULT_ANALYSIS_VIEW_SETTINGS })
  /** 项目代码行数排行（按新增行降序，行数统计视图分析后填充） */
  const projectLineRanking = ref<ProjectLineRankItem[]>([])
  /** 作者代码行数排行（按新增行降序，行数统计视图分析后填充） */
  const authorLineRanking = ref<AuthorLineRankItem[]>([])

  /** 从存储载入显示设置（与默认值逐字段合并，防旧数据缺字段导致渲染异常） */
  async function loadViewSettings() {
    const saved = await manager.storage.commitAnalysisView.loadOrDefault()
    viewSettings.value = { ...viewSettings.value, ...saved }
  }

  /** 更新显示设置并持久化（面板每项改动即时调用） */
  async function updateViewSettings(patch: Partial<CommitAnalysisViewSettings>) {
    viewSettings.value = { ...viewSettings.value, ...patch }
    await manager.storage.commitAnalysisView.save(viewSettings.value)
  }

  /** 由各项目的 settled 结果聚合项目/作者行数排行（仅统计含 numstat 的 fulfilled 结果） */
  function buildLineRankings(
    settled: PromiseSettledResult<{ projectId: string, projectName: string, entries: CommitAnalysisEntry[], numstat: NumstatCommit[] }>[],
    nameById: Map<string, string>,
  ): { projectRanking: ProjectLineRankItem[], authorRanking: AuthorLineRankItem[] } {
    const projectLines = new Map<string, { added: number, deleted: number }>()
    const authorLines = new Map<string, { added: number, deleted: number }>()
    settled.forEach((r) => {
      if (r.status !== "fulfilled") return
      const { projectId, numstat } = r.value
      const psum = sumProjectLines(numstat)
      const prevP = projectLines.get(projectId)
      projectLines.set(projectId, {
        added: (prevP?.added ?? 0) + psum.added,
        deleted: (prevP?.deleted ?? 0) + psum.deleted,
      })
      for (const [author, agg] of sumAuthorLines(numstat)) {
        const prevA = authorLines.get(author)
        authorLines.set(author, {
          added: (prevA?.added ?? 0) + agg.added,
          deleted: (prevA?.deleted ?? 0) + agg.deleted,
        })
      }
    })
    // 按新增行降序，同新增量再按净增降序；剔除无行数变化的项目/作者
    const projectRanking = [...projectLines.entries()]
      .filter(([, agg]) => agg.added + agg.deleted > 0)
      .map(([id, agg]) => ({
        id,
        name: nameById.get(id) || id,
        added: agg.added,
        deleted: agg.deleted,
        net: agg.added - agg.deleted,
      }))
      .sort((a, b) => b.added - a.added || b.net - a.net)
      .slice(0, PROJECT_RANK_LIMIT)
    const authorRanking = [...authorLines.entries()]
      .filter(([, agg]) => agg.added + agg.deleted > 0)
      .map(([author, agg]) => ({
        author,
        added: agg.added,
        deleted: agg.deleted,
        net: agg.added - agg.deleted,
      }))
      .sort((a, b) => b.added - a.added || b.net - a.net)
      .slice(0, AUTHOR_RANK_LIMIT)
    return { projectRanking, authorRanking }
  }

  /** 批量分析全部项目核心（GitExecutor 自带并发限流，无需额外节流）；needNumstat 时并行抓取 numstat 生成行数排行，成功后持久化结果供下次复用 */
  async function runCore(needNumstat: boolean) {
    if (analyzing.value) return
    analyzing.value = true
    try {
      const settled = await Promise.allSettled(projects.value.map(async (p) => {
        const path = resolveValidPath(p)
        const log = await manager.getCommitLog(path, commitCount.value)
        const itemEntries = log.map((c) => ({
          projectId: p.id,
          projectName: p.name,
          hash: c.hash,
          message: c.message,
          author: c.author,
          date: c.date,
        }))
        // 行数统计时并行抓取 numstat（失败不阻塞主流程，按空数据降级）
        let numstat: NumstatCommit[] = []
        if (needNumstat) {
          try {
            numstat = await manager.getNumstatLog(path, undefined, commitCount.value)
          } catch {
            numstat = []
          }
        }
        return { projectId: p.id, projectName: p.name, entries: itemEntries, numstat }
      }))
      let fail = 0
      const flat: CommitAnalysisEntry[] = []
      settled.forEach((r) => {
        if (r.status === "fulfilled") flat.push(...r.value.entries)
        else fail++
      })
      entries.value = flat
      failedCount.value = fail
      analyzedAt.value = new Date().toISOString()
      analyzed.value = true
      // 行数统计请求才重算排行；提交分析不触碰已有排行，保留缓存中的行数数据供行数视图复用
      if (needNumstat) {
        const nameById = new Map(projects.value.map((p) => [p.id, p.name]))
        const { projectRanking, authorRanking } = buildLineRankings(settled, nameById)
        projectLineRanking.value = projectRanking
        authorLineRanking.value = authorRanking
      }
      // 提交分析保存缓存时沿用旧缓存的行数排行，避免覆盖行数视图已分析的数据
      const oldCache = await manager.storage.commitAnalysisCache.loadOrDefault()
      await manager.storage.commitAnalysisCache.save({
        commitCount: commitCount.value,
        analyzedAt: analyzedAt.value,
        failedCount: fail,
        entries: flat,
        projectLineRanking: needNumstat ? projectLineRanking.value : (oldCache.projectLineRanking ?? []),
        authorLineRanking: needNumstat ? authorLineRanking.value : (oldCache.authorLineRanking ?? []),
      })
    } finally {
      analyzing.value = false
    }
  }

  /** 提交分析（仅抓取 commit log 聚合提交维度；行数排行沿用缓存旧值，不重新抓 numstat） */
  async function runAnalysis() {
    await runCore(false)
  }

  /** 行数统计（始终并行抓取 numstat 生成项目/作者行数排行并覆盖缓存行数数据） */
  async function runLineStatsAnalysis() {
    await runCore(true)
  }

  /** 从存储载入上次分析结果（有有效条目时直接复用，不再重新分析） */
  async function loadCachedAnalysis() {
    if (cacheLoaded) return
    cacheLoaded = true
    const cache = await manager.storage.commitAnalysisCache.loadOrDefault()
    if (cache.entries.length === 0) return
    // 过滤已删除项目的残留条目（项目删除后缓存不再展示其数据）
    const validIds = new Set(projects.value.map((p) => p.id))
    const valid = cache.entries.filter((e) => validIds.has(e.projectId))
    if (valid.length === 0) return
    commitCount.value = cache.commitCount
    failedCount.value = cache.failedCount
    analyzedAt.value = cache.analyzedAt
    entries.value = valid
    // 行数排行随缓存恢复（旧缓存无此字段时按空数组兜底；行数数据同样过滤已删除项目）
    projectLineRanking.value = (cache.projectLineRanking ?? []).filter((r) => validIds.has(r.id))
    authorLineRanking.value = cache.authorLineRanking ?? []
    analyzed.value = true
  }

  /** 进入分析视图的统一入口：先尝试复用持久化缓存，无有效缓存时才重新分析；同时加载显示设置 */
  async function ensureAnalysis() {
    await loadViewSettings()
    await loadCachedAnalysis()
    if (!analyzed.value && !analyzing.value) await runAnalysis()
  }

  /** 进入行数统计视图的统一入口：复用持久化缓存（含上次行数排行），无有效缓存时需用户手动点击「开始行数分析」 */
  async function ensureLineStats() {
    await loadCachedAnalysis()
  }

  /** 修改抓取条数后置为未分析并自动重跑；needNumstat 表示来自行数统计视图，重跑时同步抓 numstat 刷新行数排行 */
  async function setCommitCount(n: number, needNumstat = false) {
    if (commitCount.value === n) return
    commitCount.value = n
    analyzed.value = false
    await runCore(needNumstat)
  }

  /** 分析聚合视图（CommitAnalysisPanel 唯一数据 prop，新增维度只需改这里 + 类型 + 面板三处） */
  const analysisStats = computed<CommitAnalysisStats>(() => {
    // 实时过滤已删除项目的条目（项目删除后缓存/内存中的残留数据不参与统计与展示）
    const validIds = new Set(projects.value.map((p) => p.id))
    const list = entries.value.filter((e) => validIds.has(e.projectId))
    const nameById = new Map(projects.value.map((p) => [p.id, p.name]))
    return {
      totalCommits: list.length,
      projectCount: projects.value.length,
      analyzedCount: projects.value.length - failedCount.value,
      failedCount: failedCount.value,
      entries: list,
      dailyCommits: buildDailyCommitBuckets(list, 30),
      projectRanking: rankByCount(list, (e) => e.projectId, PROJECT_RANK_LIMIT).map((r) => ({
        id: r.key,
        name: nameById.get(r.key) || r.key,
        count: r.count,
      })),
      typeDistribution: rankByCount(list, (e) => parseCommitAnalysisType(e.message), 20).map((r) => ({
        type: r.key as CommitAnalysisType,
        count: r.count,
      })),
      authorRanking: rankByCount(list, (e) => e.author, AUTHOR_RANK_LIMIT).map((r) => ({
        author: r.key,
        count: r.count,
      })),
      projectLineRanking: projectLineRanking.value.filter((r) => validIds.has(r.id)),
      authorLineRanking: authorLineRanking.value,
    }
  })

  return {
    analysisStats,
    analyzing,
    analyzed,
    analyzedAt,
    failedCount,
    commitCount,
    setCommitCount,
    runAnalysis,
    runLineStatsAnalysis,
    ensureAnalysis,
    ensureLineStats,
    viewSettings,
    updateViewSettings,
    projectLineRanking,
    authorLineRanking,
  }
}
