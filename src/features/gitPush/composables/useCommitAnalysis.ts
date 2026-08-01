// 提交分析 — 批量读取各项目提交日志，聚合时间分布/提交次数/内容类型/作者排行
import type { Ref } from "vue"
import type {
  CommitAnalysisEntry,
  CommitAnalysisStats,
  CommitAnalysisType,
  CommitAnalysisViewSettings,
  GitProject,
  GitPushManager,
} from "../types"
import { computed, ref } from "vue"
import { DEFAULT_ANALYSIS_VIEW_SETTINGS } from "../types"
import {
  buildDailyCommitBuckets,
  parseCommitAnalysisType,
  rankByCount,
  resolveValidPath,
} from "../utils"

/** 每项目抓取条数选项（仿 BranchCommitList.countOptions） */
export const COMMIT_COUNT_OPTIONS = [30, 50, 100, 200] as const

/** 项目排行上限 / 作者排行上限（超出只展示头部，避免长列表淹没关键信息） */
const PROJECT_RANK_LIMIT = 20
const AUTHOR_RANK_LIMIT = 10

export function useCommitAnalysis(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 分析中标记（并发去重） */
  const analyzing = ref(false)
  /** 是否已完成过至少一轮分析（区分“未分析”与“分析结果为空”） */
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

  /** 批量分析全部项目（GitExecutor 自带并发限流，无需额外节流）；成功后持久化结果供下次复用 */
  async function runAnalysis() {
    if (analyzing.value) return
    analyzing.value = true
    try {
      const settled = await Promise.allSettled(projects.value.map(async (p) => {
        const log = await manager.getCommitLog(resolveValidPath(p), commitCount.value)
        return log.map((c) => ({
          projectId: p.id,
          projectName: p.name,
          hash: c.hash,
          message: c.message,
          author: c.author,
          date: c.date,
        }))
      }))
      let fail = 0
      const flat: CommitAnalysisEntry[] = []
      settled.forEach((r) => {
        if (r.status === "fulfilled") flat.push(...r.value)
        else fail++
      })
      entries.value = flat
      failedCount.value = fail
      analyzedAt.value = new Date().toISOString()
      analyzed.value = true
      await manager.storage.commitAnalysisCache.save({
        commitCount: commitCount.value,
        analyzedAt: analyzedAt.value,
        failedCount: fail,
        entries: flat,
      })
    } finally {
      analyzing.value = false
    }
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
    analyzed.value = true
  }

  /** 进入分析视图的统一入口：先尝试复用持久化缓存，无有效缓存时才重新分析；同时加载显示设置 */
  async function ensureAnalysis() {
    await loadViewSettings()
    await loadCachedAnalysis()
    if (!analyzed.value && !analyzing.value) await runAnalysis()
  }

  /** 修改抓取条数后置为未分析并自动重跑 */
  async function setCommitCount(n: number) {
    if (commitCount.value === n) return
    commitCount.value = n
    analyzed.value = false
    await runAnalysis()
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
    }
  })

  return {
    analysisStats,
    analyzing,
    analyzed,
    analyzedAt,
    commitCount,
    setCommitCount,
    runAnalysis,
    ensureAnalysis,
    viewSettings,
    updateViewSettings,
  }
}
