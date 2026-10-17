// 提交分析 — 批量读取各项目提交日志，聚合时间分布/提交次数/内容类型/作者排行；
// 行数排行改为「存量规模 + 生命周期」视图，只扫已跟踪文件行数与首/末次提交（不再抓全历史 numstat）
import type { Ref } from "vue"
import type { NumstatCommit } from "../reportMetrics"
import type {
  CommitAnalysisEntry,
  CommitAnalysisStats,
  CommitAnalysisType,
  CommitAnalysisViewSettings,
  CommitRuleCheckStats,
  CommitRuleConfig,
  GitProject,
  GitPushManager,
  LineStatsSummary,
  ProjectFetchFailure,
  ProjectLineRankItem,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { analyzeCommitRuleCompliance } from "../commitRuleChecker"
import { shouldIncludeFile } from "../reportMetrics"
import {
  clampDiffContextBudget,
  clampMaxBodyLineLength,
  clampMinSubjectLength,
  DEFAULT_ANALYSIS_VIEW_SETTINGS,
  DEFAULT_COMMIT_RULE_CONFIG,
  readCommitRuleConfig,
} from "../types"
import {
  buildDailyCommitBuckets,
  classifyFetchFailure,
  compareProjectLineRank,
  fetchFailureReason,
  parseCommitAnalysisType,
  poolProcess,
  ProjectFetchError,
  rankByCount,
  rankByCountWithTotal,
  resolveValidPath,
} from "../utils"

/** 每项目抓取条数选项（"all" = 全部提交，省略 git log -n 限制；仿 BranchCommitList.countOptions） */
export const COMMIT_COUNT_OPTIONS = [30, 50, 100, 200, 300, 500, "all"] as const
/** 提交抓取条数类型（数字 = 条数上限；"all" = 全部提交） */
export type CommitCount = number | "all"

/** 项目提交数排行上限 / 作者行数排行上限（仅提交数排行与作者行数排行截断；项目代码行数排行已显示全部，不再截断） */
const PROJECT_RANK_LIMIT = 20
const AUTHOR_RANK_LIMIT = 10

/** 行数统计可选的常见文件扩展名（配置弹窗多选排除列表，空数组 = 不过滤） */
export const LINE_STATS_EXTENSIONS = [
  ".ts",
  ".vue",
  ".js",
  ".jsx",
  ".tsx",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".html",
  ".cs",
  ".xaml",
  ".py",
  ".go",
  ".dll",
  ".sdb",
  ".pdb",
  ".ini",
  ".xml",
  ".log",
  ".txt",
  ".zip",
  ".7z",
  ".xuv",
] as const

/** 从项目排行累加全量合计（旧缓存无 summary 字段时的兼容兜底） */
function deriveSummary(ranking: ProjectLineRankItem[]): LineStatsSummary {
  // 旧缓存条目无 totalLines 字段时按 0 计入（存量降级兜底）
  const totalLines = ranking.reduce((s, r) => s + (r.totalLines ?? 0), 0)
  return {
    projectCount: ranking.length,
    fileCount: 0,
    totalLines,
  }
}

export function useCommitAnalysis(manager: GitPushManager, projects: Ref<GitProject[]>) {
  // ── 提交分析状态（提交分析 / 规则检查两视图共用）──
  /** 分析中标记（并发去重） */
  const analyzing = ref(false)
  /** 是否已完成过至少一轮分析（区分"未分析"与"分析结果为空"） */
  const analyzed = ref(false)
  /** 每项目抓取的提交条数（默认 100，可改 30/50/100/200/300/500 或 "all" 全部） */
  const commitCount = ref<CommitCount>(100)
  /** 上次提交分析完成时间（ISO） */
  const analyzedAt = ref("")

  // ── 行数统计状态（独立于提交分析：两个视图各有自己的进度与「上次分析」时间）──
  // 原实现三个视图共用同一组 analyzing/analyzed/analyzedAt，导致行数统计完成后会覆盖提交分析视图
  // 的「上次分析」时间（反之亦然）。此处按域拆开，两侧互不干扰。
  /** 行数统计分析中标记（并发去重，与提交分析各自独立） */
  const lineAnalyzing = ref(false)
  /** 行数统计是否已完成过至少一轮分析 */
  const lineAnalyzed = ref(false)
  /** 上次行数统计分析完成时间（ISO，单项目刷新不改动：语义为全量分析完成时间） */
  const lineAnalyzedAt = ref("")
  /** 跨项目合并的原始提交条目缓存 */
  const entries = ref<CommitAnalysisEntry[]>([])
  /** 提交分析失败的项目数（路径无效 throw 计入；规则检查/提交分析共用） */
  const failedCount = ref(0)
  /** 行数统计失败的项目数（与提交分析计数分槽，避免两个视图互相覆盖失败数） */
  const lineFailedCount = ref(0)
  /** 失败项目明细（项目名 + 路径 + 原因分类 + 原始报错；与 lineFailedCount 同源写入，供行数统计失败弹窗展示） */
  const fetchFailures = ref<ProjectFetchFailure[]>([])
  /** 是否已尝试过从存储载入提交分析缓存（防重复读盘） */
  let cacheLoaded = false
  /** 是否已尝试过从存储载入行数统计独立缓存（防重复读盘） */
  let lineStatsCacheLoaded = false
  /** 分析请求在「分析进行中」被拒绝后置位，供下次 ensureAnalysis 强制执行重跑（避免 loadCachedAnalysis 恢复 analyzed=true 吞掉重跑请求） */
  let pendingReanalyze = false
  /** 运行锁：提交分析与行数统计共用（二者都要跑 git 子进程，并发触发会造成进程风暴），非响应式 */
  let runBusy = false
  /** 热力图/日历显示设置（视图/范围/每周第一天/格子主色，持久化到 git-push-analysis-view） */
  const viewSettings = ref<CommitAnalysisViewSettings>({ ...DEFAULT_ANALYSIS_VIEW_SETTINGS })
  /** 项目代码行数排行（按总行数降序，行数统计视图分析后填充） */
  const projectLineRanking = ref<ProjectLineRankItem[]>([])
  /** 全量行数合计（基于全量项目数据独立累加，供顶部汇总卡片展示） */
  const lineStatsSummary = ref<LineStatsSummary>({
    projectCount: 0,
    fileCount: 0,
    totalLines: 0,
  })
  /** 行数详情弹窗单项目刷新中标记（防并发点击） */
  const lineDetailRefreshing = ref(false)
  /** per-project 原始 numstat 数据（仅内存不持久化；行数统计分析后填充，供项目详情弹窗消费，下次分析覆盖） */
  const perProjectNumstat = ref<Map<string, NumstatCommit[]>>(new Map())
  /** per-project 已跟踪文件的存量行数 Map<路径, 行数|null>（仅内存不持久化；行数统计分析后填充，供详情弹窗文件明细查存量；null=2MB/二进制/读失败/已删除） */
  const perProjectFileLines = ref<Map<string, Map<string, number | null>>>(new Map())

  /** 选中的文件扩展名过滤（空数组 = 不过滤所有文件，变更后即时持久化 + 下次分析生效） */
  const selectedExtensions = ref<string[]>([])
  /** 提交规则检查选中的过滤项目 ID（"" = 全部项目；仅过滤展示，分析仍覆盖全部项目，共享缓存零影响） */
  const ruleCheckProjectId = ref<string>("")
  /** 提交规则配置（最短描述阈值 + 可选规则开关；从规则偏好恢复，设置弹窗可修改） */
  const ruleConfig = ref<CommitRuleConfig>({ ...DEFAULT_COMMIT_RULE_CONFIG })

  /** 有效项目 id 集合（项目删除后缓存/内存中的残留数据统一按此过滤，避免各处重复构建 Set） */
  const validProjectIds = computed(() => new Set(projects.value.map((p) => p.id)))
  /** 是否已从存储载入提交规则检查偏好（防重复读盘） */
  let ruleCheckPrefsLoaded = false

  /** 从存储载入显示设置（与默认值逐字段合并，防旧数据缺字段导致渲染异常） */
  async function loadViewSettings() {
    const saved = await manager.storage.commitAnalysisView.loadOrDefault()
    viewSettings.value = {
      ...viewSettings.value,
      ...saved,
    }
  }

  /** 更新显示设置并持久化（面板每项改动即时调用） */
  async function updateViewSettings(patch: Partial<CommitAnalysisViewSettings>) {
    viewSettings.value = {
      ...viewSettings.value,
      ...patch,
    }
    await manager.storage.commitAnalysisView.save(viewSettings.value)
  }

  /**
   * 由各项目的 settled 扫描结果聚合项目行数排行与全量合计（仅统计 fulfilled 结果；totalLines/fileCount 为存量口径）。
   *
   * 口径变更说明：本视图已从「增删增量排行」调整为「存量规模 + 生命周期」视图，
   * 不再抓取全历史 numstat（列表不再展示新增/删除/净增），因此聚合只做三件事：
   * 汇总存量行数与文件数、按存量降序排序、携带首/末次提交时间。
   */
  function buildLineRankings(
    settled: PromiseSettledResult<{
      projectId: string
      totalLines: number
      fileCount: number
      firstCommit: string
      lastCommit: string
    }>[],
    nameById: Map<string, string>,
  ): { projectRanking: ProjectLineRankItem[], summary: LineStatsSummary } {
    let summaryTotalLines = 0
    let summaryFileCount = 0
    const all: ProjectLineRankItem[] = []
    for (const r of settled) {
      if (r.status !== "fulfilled") continue
      const {
        projectId,
        totalLines,
        fileCount,
        firstCommit,
        lastCommit,
      } = r.value
      summaryTotalLines += totalLines
      summaryFileCount += fileCount
      all.push({
        id: projectId,
        name: nameById.get(projectId) || projectId,
        totalLines,
        firstCommit,
        lastCommit,
      })
    }
    // 全部成功抓取的项目都进榜单（含 0 行项目，它们本身是真实的存量可比对象）。
    // 排序按总行数降序，故小项目自然沉到末尾，不会淹没头部。
    const projectRanking = all.sort(compareProjectLineRank)
    const summary: LineStatsSummary = {
      projectCount: projectRanking.length,
      fileCount: summaryFileCount,
      totalLines: summaryTotalLines,
    }
    return {
      projectRanking,
      summary,
    }
  }

  /**
   * 抓取单项目行数数据（全量分析与详情弹窗单项目刷新共用）。
   *
   * 只统计存量：已跟踪文件的实际行数 + 仓库首/末次提交时间。
   * 不再抓 numstat —— 列表已移除增删净列，全历史 numstat 抓取是行数统计最慢的一环且已无消费方。
   *
   * 增量复用由 manager.scanProjectLineStats 承担：HEAD 与 gitdir 未变时零 git、零读盘；
   * HEAD 变化时逐文件 statSync 比对 mtime/size，只重读变化的文件（详见 managers/lineScan.ts）。
   */
  async function fetchProjectLineStats(p: GitProject, _path: string) {
    return manager.scanProjectLineStats(p, (f) => shouldIncludeFile(f, selectedExtensions.value))
  }

  /**
   * 批量分析全部项目核心；needNumstat 时扫描存量行数生成行数排行。
   *
   * 并发策略（本轮优化重点，依据真机实测）：
   *
   * 1. **项目级并发池**而非 `Promise.allSettled` 一把梭。
   *    每个项目要串行发 2~3 次 git，若 N 个项目同时起跑，瞬时排队 = 2N，
   *    而 executor 池只有 GIT_CONCURRENCY_MAX 路 → 队列深、长尾明显。
   *    改为 `poolProcess` 限流：同时在飞的项目数 ≤ executor 容量，
   *    使每个项目的 git 调用几乎立即得到槽位，避免排队放大延迟。
   *
   * 2. **失败隔离**：poolProcess 里单个项目抛错不能中断整轮
   *    （原 allSettled 天然具备该语义），故每个项目内部 catch 后记录失败明细。
   *
   * 3. 结果按 targets 顺序回填（poolProcess 是乱序完成的），保证排行与
   *    `projects.value` 配置顺序一致，展示稳定不抖动。
   *
   * 注：**不把项目内并发压成串行**——`getRepoLifecycle` 内部那 2 次调用
   * 互相独立，并发发出去能省下一个进程启动的等待，实测优于串行。
   *
   * 两个域（提交分析 / 行数统计）共用同一把运行锁 runBusy（避免并发触发
   * git 子进程风暴），但进度与结果状态各自写入对应槽位
   * （analyzing+failedCount+analyzedAt 与 lineAnalyzing+lineFailedCount+lineAnalyzedAt）。
   *
   * @returns 是否实际执行（false = 分析进行中被拒绝，调用方据此决定是否需后续重试）
   */
  async function runCore(needNumstat: boolean, projectIds?: string[]): Promise<boolean> {
    if (runBusy) return false
    runBusy = true
    // 只有目标域进入「分析中」：另一域的进度指示不受影响
    if (needNumstat) lineAnalyzing.value = true
    else analyzing.value = true
    try {
      // 目标子集：仅保存后局部刷新（!needNumstat + 指定 projectIds）时只抓目标项目，其余情况全量
      const targets = projectIds?.length && !needNumstat
        ? projects.value.filter((p) => projectIds.includes(p.id))
        : projects.value
      // 子集目标全部不存在（项目已被删除）：无操作返回，避免 oldContribution 误判导致 failedCount 错误递减
      if (projectIds?.length && !needNumstat && targets.length === 0) {
        return true
      }

      /** 单项目抓取结果（含失败标记，供池外统一归类） */
      type ProjectResult =
        | { ok: true, projectId: string, entries: CommitAnalysisEntry[], totalLines: number, fileCount: number, firstCommit: string, lastCommit: string, fileLines: Map<string, number | null> }
        | { ok: false, reason: unknown }

      // 结果按 targets 下标写入（poolProcess 乱序完成，不能用 push）
      const results: ProjectResult[] = new Array(targets.length)

      const modules = getNodeFsPathOs()
      /** 单项目抓取（路径预检 + 按域取数据），失败抛出由调用方捕获 */
      const fetchOne = async (p: GitProject) => {
        const path = resolveValidPath(p)
        // 路径无效的项目直接 throw 计入失败
        // （预检绕过 getCommitLog 内部吞错的语义，避免静默缺席）
        if (modules && !modules.fs.existsSync(path)) {
          throw new ProjectFetchError("pathMissing", `Path not found: ${path}`)
        }
        // 行数统计：只扫存量（已跟踪文件行数 + 首/末次提交），不再抓全历史 numstat——
        // 列表已移除增删净列，numstat 抓取是最慢的一环且无消费方。
        // git 失败直接抛错计入 failedCount（不本地 try-catch 降级为空数据）
        if (needNumstat) {
          const {
            totalLines,
            fileCount,
            firstCommit,
            lastCommit,
            fileLines,
          } = await fetchProjectLineStats(p, path)
          return {
            entries: [] as CommitAnalysisEntry[],
            totalLines,
            fileCount,
            firstCommit,
            lastCommit,
            fileLines,
          }
        }
        // 提交分析：保持 getCommitLog 链路（内部吞错返回 []，路径预检已在上方兜底）。
        // 刻意不接本地索引：该分支需要 isMerge（规则检查豁免 merge 提交、
        // 修正/删除历史弹窗据此阻断），而 numstat 索引不携带父提交信息；
        // 且此分支只取提交元信息（无 --numstat），本身已是廉价命令。
        const log = await manager.getCommitLog(path, commitCount.value)
        return {
          entries: log.map((c) => ({
            projectId: p.id,
            projectName: p.name,
            hash: c.hash,
            message: c.message,
            author: c.author,
            date: c.date,
            isMerge: c.isMerge,
          })) as CommitAnalysisEntry[],
          totalLines: 0,
          fileCount: 0,
          firstCommit: "",
          lastCommit: "",
          fileLines: new Map<string, number | null>(),
        }
      }

      // 项目级并发池：并发度取 git 并发设置（executor 本地池容量），
      // 使每个项目内部的 git 调用都能立刻拿到槽位，避免 2N 深队列放大尾部延迟
      await poolProcess(targets, manager.getGitConcurrency(), async (p, i) => {
        try {
          const r = await fetchOne(p)
          results[i] = {
            ok: true,
            projectId: p.id,
            ...r,
          }
        } catch (e) {
          // 失败隔离：单项目异常不得中断整轮（等价原 allSettled 语义）
          results[i] = {
            ok: false,
            reason: e,
          }
        }
      })

      let fail = 0
      const flat: CommitAnalysisEntry[] = []
      // 本次运行的失败明细：与 targets 下标一一对应，失败项据此回填项目名与本次实际使用的路径
      const runFailures: ProjectFetchFailure[] = []
      results.forEach((r, i) => {
        const target = targets[i]
        if (!target) return
        if (!r || r.ok) {
          if (r?.ok) flat.push(...r.entries)
          return
        }
        fail++
        runFailures.push({
          projectId: target.id,
          projectName: target.name,
          path: resolveValidPath(target),
          // 路径预检失败自带分类（不经文案反推）；git 命令失败按其 stderr 关键字归类
          kind: r.reason instanceof ProjectFetchError ? r.reason.kind : classifyFetchFailure(r.reason),
          reason: fetchFailureReason(r.reason),
        })
      })
      // 供 buildLineRankings 消费的 settled 视图：把池结果映射成原 PromiseSettledResult 形状，
      // 使下游聚合逻辑零改动（保持「按 targets 顺序」的语义）
      const settled = results.map((r): PromiseSettledResult<{
        projectId: string
        totalLines: number
        fileCount: number
        firstCommit: string
        lastCommit: string
      }> => {
        if (r?.ok) {
          return {
            status: "fulfilled",
            value: {
              projectId: r.projectId,
              totalLines: r.totalLines,
              fileCount: r.fileCount,
              firstCommit: r.firstCommit,
              lastCommit: r.lastCommit,
            },
          }
        }
        return {
          status: "rejected",
          reason: r?.reason ?? new Error("未执行"),
        }
      })
      // 写回结果：提交分析与行数统计各自的状态槽位（互不覆盖对方的「上次分析」时间与失败数）
      const stamp = new Date().toISOString()
      if (needNumstat) {
        lineFailedCount.value = fail
        fetchFailures.value = runFailures
        lineAnalyzedAt.value = stamp
        lineAnalyzed.value = true
        // 行数统计重算项目排行（存量口径，无增删净聚合）
        const nameById = new Map(projects.value.map((p) => [p.id, p.name]))
        const {
          projectRanking,
          summary,
        } = buildLineRankings(settled, nameById)
        projectLineRanking.value = projectRanking
        lineStatsSummary.value = summary
        // per-project 已跟踪文件存量行数（供详情弹窗文件明细列查存量；numstat 已不再抓取，故作者明细为空）。
        // 直接从 results 取而非 settled：settled 是为聚合层构造的精简视图，不含 fileLines。
        const fileLinesMap = new Map<string, Map<string, number | null>>()
        for (const r of results) {
          if (r?.ok && r.fileLines.size > 0) {
            fileLinesMap.set(r.projectId, r.fileLines)
          }
        }
        perProjectNumstat.value = new Map()
        perProjectFileLines.value = fileLinesMap
        // 清理已删除项目的残留统计数据（防 SQLite 表随项目增减无界增长）
        await manager.pruneLineStats(projects.value.map((p) => p.id))
      } else {
        // 子集局部刷新（保存修正后）：按项目合并——移除目标项目旧条目（amend/rebase 后 hash 已变，整体替换）+ 追加新数据，其他项目保留
        const idSet = projectIds?.length ? new Set(projectIds) : new Set<string>()
        if (idSet.size > 0) {
          const prevEntries = entries.value
          // 目标项目旧失败贡献（缺席旧 entries 计 1）+ 本次新失败数（单项目 0/1），增量校正 failedCount
          const oldContribution = [...idSet].filter((id) => !prevEntries.some((e) => e.projectId === id)).length
          failedCount.value = failedCount.value - oldContribution + fail
          const merged = [...prevEntries.filter((e) => !idSet.has(e.projectId)), ...flat]
          // 按项目配置顺序重排，保持显示稳定
          const order = new Map(projects.value.map((p, i) => [p.id, i]))
          merged.sort((a, b) => (order.get(a.projectId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.projectId) ?? Number.MAX_SAFE_INTEGER))
          entries.value = merged
        } else {
          failedCount.value = fail
          entries.value = flat
        }
        analyzedAt.value = stamp
        analyzed.value = true
      }
      // 两个域共写同一份提交分析缓存（行数排行字段随需更新；提交分析分支沿用旧缓存的行数排行，避免覆盖行数视图已分析的数据）
      const oldCache = await manager.storage.commitAnalysisCache.loadOrDefault()
      await manager.storage.commitAnalysisCache.save({
        commitCount: commitCount.value,
        analyzedAt: analyzedAt.value || stamp,
        failedCount: failedCount.value,
        entries: entries.value,
        projectLineRanking: needNumstat ? projectLineRanking.value : (oldCache.projectLineRanking ?? []),
      })
      // 行数统计请求时同步写入独立行数统计缓存（与提交分析缓存解耦，行数视图优先读此槽位）
      if (needNumstat) {
        await manager.storage.lineStatsCache.save({
          analyzedAt: lineAnalyzedAt.value,
          failedCount: lineFailedCount.value,
          failures: fetchFailures.value,
          projectLineRanking: projectLineRanking.value,
          selectedExtensions: selectedExtensions.value,
          summary: lineStatsSummary.value,
        })
      }
    } finally {
      runBusy = false
      if (needNumstat) lineAnalyzing.value = false
      else analyzing.value = false
    }
    // 分析真正执行完成，撤销待重跑标记（仅全量模式消费；子集局部刷新不消费排队请求，避免覆盖其他保存的排队标记）
    if (!projectIds?.length) pendingReanalyze = false
    return true
  }

  /**
   * 提交分析（仅抓取 commit log 聚合提交维度；行数排行沿用缓存旧值，不重新抓 numstat）。
   * @param projectId 单项目 id 或 id 数组 = 仅局部重抓指定项目（修正保存/批量修复后的快速刷新）；不传 = 全量重跑。
   */
  async function runAnalysis(projectId?: string | string[]) {
    // 归一化：空数组回退 undefined，否则 runCore 的 `projectIds?.length` 判据会误走全量分支
    const ids = Array.isArray(projectId) ? projectId : projectId ? [projectId] : undefined
    const scoped = ids?.length ? ids : undefined
    const ran = await runCore(false, scoped)
    // 分析进行中被拒绝：全量请求置 analyzed=false 并标记待重跑；子集请求仅排队（保持界面数据，避免白屏）
    if (!ran) {
      if (scoped) {
        pendingReanalyze = true
        console.warn("[gitPush] 分析进行中，该项目局部刷新已排队待下次全量执行")
      } else {
        analyzed.value = false
        pendingReanalyze = true
        console.warn("[gitPush] 分析进行中，重新分析请求已排队待下次执行")
      }
    }
  }

  /** 行数统计（始终并行抓取 numstat 生成项目/作者行数排行并覆盖缓存行数数据） */
  async function runLineStatsAnalysis() {
    const ran = await runCore(true)
    if (!ran) {
      lineAnalyzed.value = false
      pendingReanalyze = true
      console.warn("[gitPush] 分析进行中，行数统计重跑请求已排队待下次执行")
    }
  }

  /**
   * 从存储载入上次提交分析结果（有有效条目时直接复用，不再重新分析）。
   * 旧版把行数排行一起存在此缓存里，故同时回填行数域（lineAnalyzed/lineAnalyzedAt），供升级用户的行数视图直接复用。
   */
  async function loadCachedAnalysis() {
    if (cacheLoaded) return
    cacheLoaded = true
    const cache = await manager.storage.commitAnalysisCache.loadOrDefault()
    if (cache.entries.length === 0) return
    // 过滤已删除项目的残留条目（项目删除后缓存不再展示其数据）
    const valid = cache.entries.filter((e) => validProjectIds.value.has(e.projectId))
    if (valid.length === 0) return
    commitCount.value = cache.commitCount
    failedCount.value = cache.failedCount
    analyzedAt.value = cache.analyzedAt
    entries.value = valid
    analyzed.value = true
    // 行数排行随缓存恢复（旧缓存无此字段时按空数组兜底；行数数据同样过滤已删除项目）
    projectLineRanking.value = (cache.projectLineRanking ?? []).filter((r) => validProjectIds.value.has(r.id))
    // commitAnalysisCache 不含 summary 字段，降级从排行累加（重新点「重新分析」后得到精确值）
    lineStatsSummary.value = deriveSummary(projectLineRanking.value)
    // 行数域同步视为已分析（同一份缓存承载了行数数据；时间戳沿用该缓存值）
    if (projectLineRanking.value.length > 0) {
      lineFailedCount.value = cache.failedCount
      lineAnalyzedAt.value = cache.analyzedAt
      lineAnalyzed.value = true
    }
  }

  /** 进入分析视图的统一入口：先尝试复用持久化缓存，无有效缓存时才重新分析；同时加载显示设置与规则检查项目偏好 */
  async function ensureAnalysis() {
    await loadViewSettings()
    await loadRuleCheckPrefs()
    await loadCachedAnalysis()
    // pendingReanalyze 优先于缓存复用，保证分析进行中被拒绝的重跑请求不被 loadCachedAnalysis 覆盖
    if ((pendingReanalyze || !analyzed.value || entries.value.length === 0) && !runBusy) {
      pendingReanalyze = false
      await runAnalysis()
    }
  }

  /** 行数统计视图专用缓存加载：优先读取独立槽位 git-push-line-stats-cache，无数据时回退到提交分析旧缓存的行数数据（兼容老版本升级用户）；行数排行同样过滤已删除项目 */
  async function loadLineStatsCache() {
    if (lineStatsCacheLoaded) return
    lineStatsCacheLoaded = true
    const cache = await manager.storage.lineStatsCache.loadOrDefault()
    // 无条件恢复扩展名过滤选择：无论行数排行缓存是否有数据都恢复勾选，保证重开面板/重启插件后选择不丢失（排行缓存为空仅影响行数数据，与过滤选择无关）
    selectedExtensions.value = cache.selectedExtensions ?? []
    // 独立槽位已有分析结果：直接恢复（无 entries，供行数视图独立复用）
    if (cache.projectLineRanking.length > 0) {
      lineFailedCount.value = cache.failedCount
      // 失败明细随缓存恢复（旧缓存无 failures 字段 → 空数组，仅计数可展示）；项目删除后其明细同步剔除
      fetchFailures.value = (cache.failures ?? []).filter((f) => validProjectIds.value.has(f.projectId))
      lineAnalyzedAt.value = cache.analyzedAt
      projectLineRanking.value = cache.projectLineRanking.filter((r) => validProjectIds.value.has(r.id))
      // 旧缓存无 summary / totalLines 字段时降级：summary 缺失从排行累加，totalLines 缺失补 0
      lineStatsSummary.value = cache.summary
        ? {
            ...cache.summary,
            totalLines: cache.summary.totalLines ?? 0,
          }
        : deriveSummary(projectLineRanking.value)
      lineAnalyzed.value = true
      return
    }
    // 独立槽位无数据：回退到提交分析旧缓存（老版本行数数据随 commitAnalysisCache 持久化）
    await loadCachedAnalysis()
  }

  /** 进入行数统计视图的统一入口：复用独立行数统计缓存（含上次行数排行），无有效缓存时需用户手动点击「开始行数分析」 */
  async function ensureLineStats() {
    await loadLineStatsCache()
  }

  /** 修改抓取条数后置为未分析并自动重跑（条数只影响提交分析域，不触发 numstat 抓取） */
  async function setCommitCount(n: CommitCount, needNumstat = false) {
    if (commitCount.value === n) return
    commitCount.value = n
    analyzed.value = false
    const ran = await runCore(needNumstat)
    // 分析进行中被拒绝：保持 analyzed=false 并标记待重跑，下次进入视图由 ensureAnalysis 强制执行
    if (!ran) {
      pendingReanalyze = true
      console.warn("[gitPush] 分析进行中，已按新条数排队待下次重跑")
    }
  }

  /** 更新扩展名过滤并即时持久化到行数统计缓存（弹窗确定后调用；下次分析按新过滤生效，切换视图后选择不丢失） */
  async function updateSelectedExtensions(exts: string[]) {
    selectedExtensions.value = exts
    const cache = await manager.storage.lineStatsCache.loadOrDefault()
    await manager.storage.lineStatsCache.save({
      ...cache,
      selectedExtensions: exts,
    })
  }

  /**
   * 单项目行数刷新（详情弹窗刷新按钮）：重扫该项目存量行数与首/末次提交，更新 per-project 内存缓存、
   * 项目排行对应条目（upsert 重排）与汇总合计。
   * 结果由 manager.scanProjectLineStats 直接落 SQLite，并同步写行数统计快照缓存供下次复用；
   * analyzedAt 语义为全量分析完成时间，不因单项目刷新改动。
   */
  async function refreshLineStatsProject(projectId: string) {
    if (lineDetailRefreshing.value || runBusy) return
    const p = projects.value.find((x) => x.id === projectId)
    if (!p) return
    lineDetailRefreshing.value = true
    try {
      const path = resolveValidPath(p)
      const modules = getNodeFsPathOs()
      if (modules && !modules.fs.existsSync(path)) {
        throw new ProjectFetchError("pathMissing", `Path not found: ${path}`)
      }
      // 强制重扫该项目（忽略 HEAD 未变的快路径），保证「刷新」按钮总能反映磁盘最新状态
      const {
        fileLines,
        totalLines,
        firstCommit,
        lastCommit,
      } = await manager.scanProjectLineStats(
        p,
        (f) => shouldIncludeFile(f, selectedExtensions.value),
        true,
      )
      perProjectFileLines.value.set(projectId, fileLines)
      perProjectNumstat.value.delete(projectId)
      // 项目排行 upsert：剔除旧条目后重插并按总行数降序重排（与 buildLineRankings 同口径），
      // 弹窗「当前总行数」chip 随之更新
      const old = projectLineRanking.value.find((r) => r.id === projectId)
      const entry: ProjectLineRankItem = {
        id: projectId,
        name: p.name,
        totalLines,
        firstCommit,
        lastCommit,
      }
      projectLineRanking.value = [
        ...projectLineRanking.value.filter((r) => r.id !== projectId),
        entry,
      ].sort(compareProjectLineRank)
      // 汇总合计校正（旧条目缺席视为 0 贡献）
      lineStatsSummary.value = {
        ...lineStatsSummary.value,
        totalLines: lineStatsSummary.value.totalLines + totalLines - (old?.totalLines ?? 0),
      }
      // 持久化到独立行数统计快照缓存（analyzedAt/扩展名沿用现有缓存值）
      const cache = await manager.storage.lineStatsCache.loadOrDefault()
      await manager.storage.lineStatsCache.save({
        ...cache,
        projectLineRanking: projectLineRanking.value,
        summary: lineStatsSummary.value,
      })
    } catch (e) {
      // 刷新失败仅控制台告警：不改全局 failedCount 口径（详情弹窗局部操作，重试成本低）
      console.warn("[gitPush] 单项目行数刷新失败", e)
    } finally {
      lineDetailRefreshing.value = false
    }
  }

  /** 从存储载入提交规则检查偏好（上次选中的过滤项目 + 规则配置；项目已删时由 effectiveRuleCheckProjectId 回退全部项目） */
  async function loadRuleCheckPrefs() {
    if (ruleCheckPrefsLoaded) return
    ruleCheckPrefsLoaded = true
    const saved = await manager.storage.ruleCheckPrefs.loadOrDefault()
    ruleCheckProjectId.value = saved.projectId
    // 旧数据缺字段时 readCommitRuleConfig 逐字段回退默认值（可选规则全开）
    ruleConfig.value = readCommitRuleConfig(saved)
  }

  /** 当前生效的规则检查过滤项目 ID（选中项目已删除时自动回退 ""，与 analysisStats 失效过滤语义一致） */
  const effectiveRuleCheckProjectId = computed(() => {
    if (!ruleCheckProjectId.value) return ""
    return projects.value.some((p) => p.id === ruleCheckProjectId.value) ? ruleCheckProjectId.value : ""
  })

  /** 切换提交规则检查过滤项目（"" = 全部项目；选择即时持久化；load-merge-save 保留 minSubjectLength） */
  async function setRuleCheckProject(id: string) {
    if (ruleCheckProjectId.value === id) return
    ruleCheckProjectId.value = id
    const saved = await manager.storage.ruleCheckPrefs.loadOrDefault()
    await manager.storage.ruleCheckPrefs.save({
      ...saved,
      projectId: id,
    })
  }

  /** 更新提交规则配置（patch 局部合并，阈值整数化钳位；load-merge-save 保留 projectId；下次规则检查按新配置判定） */
  async function updateCommitRuleConfig(patch: Partial<CommitRuleConfig>) {
    const merged: CommitRuleConfig = {
      ...ruleConfig.value,
      ...patch,
      minSubjectLength: patch.minSubjectLength !== undefined ? clampMinSubjectLength(patch.minSubjectLength) : ruleConfig.value.minSubjectLength,
      maxBodyLineLength: patch.maxBodyLineLength !== undefined ? clampMaxBodyLineLength(patch.maxBodyLineLength) : ruleConfig.value.maxBodyLineLength,
      diffContextBudget: patch.diffContextBudget !== undefined ? clampDiffContextBudget(patch.diffContextBudget) : ruleConfig.value.diffContextBudget,
    }
    if (JSON.stringify(merged) === JSON.stringify(ruleConfig.value)) return
    ruleConfig.value = merged
    const saved = await manager.storage.ruleCheckPrefs.loadOrDefault()
    await manager.storage.ruleCheckPrefs.save({
      ...saved,
      ...merged,
    })
  }

  /** 按 projectId 获取该项目的已跟踪文件存量行数 Map（仅内存，未分析或项目无文件时返回空 Map；值 null=2MB/二进制/读失败/已删除） */
  function getProjectFileLines(projectId: string): Map<string, number | null> {
    return perProjectFileLines.value.get(projectId) ?? new Map<string, number | null>()
  }

  /** 分析聚合视图（CommitAnalysisPanel 唯一数据 prop，新增维度只需改这里 + 类型 + 面板三处） */
  const analysisStats = computed<CommitAnalysisStats>(() => {
    // 实时过滤已删除项目的条目（项目删除后缓存/内存中的残留数据不参与统计与展示）
    const list = entries.value.filter((e) => validProjectIds.value.has(e.projectId))
    const nameById = new Map(projects.value.map((p) => [p.id, p.name]))
    // 排行取「截断后行 + 截断前分组数」：UI 据此在截断时提示「仅显示前 N 名（共 M 名）」，
    // 避免各行次数之和小于 totalCommits 时被误读为统计错误
    const projectRank = rankByCountWithTotal(list, (e) => e.projectId, PROJECT_RANK_LIMIT)
    const authorRank = rankByCountWithTotal(list, (e) => e.author, AUTHOR_RANK_LIMIT)
    return {
      totalCommits: list.length,
      projectCount: projects.value.length,
      analyzedCount: projects.value.length - failedCount.value,
      failedCount: failedCount.value,
      entries: list,
      dailyCommits: buildDailyCommitBuckets(list, 30),
      projectRanking: projectRank.rows.map((r) => ({
        id: r.key,
        name: nameById.get(r.key) || r.key,
        count: r.count,
      })),
      projectRankingTotal: projectRank.totalGroups,
      typeDistribution: rankByCount(list, (e) => parseCommitAnalysisType(e.message), 20).map((r) => ({
        type: r.key as CommitAnalysisType,
        count: r.count,
      })),
      authorRanking: authorRank.rows.map((r) => ({
        author: r.key,
        count: r.count,
      })),
      authorRankingTotal: authorRank.totalGroups,
    }
  })

  /** 提交规则检查聚合视图（复用 analysisStats 已过滤的有效条目；选中项目时仅对该项目聚合，未选中时全量；传入用户配置的最短描述阈值） */
  const commitRuleStats = computed<CommitRuleCheckStats>(() => {
    const scopedId = effectiveRuleCheckProjectId.value
    const entries = scopedId
      ? analysisStats.value.entries.filter((e) => e.projectId === scopedId)
      : analysisStats.value.entries
    return analyzeCommitRuleCompliance(entries, ruleConfig.value)
  })

  return {
    analysisStats,
    commitRuleStats,
    ruleCheckProjectId,
    effectiveRuleCheckProjectId,
    setRuleCheckProject,
    ruleConfig,
    updateCommitRuleConfig,
    analyzing,
    analyzed,
    analyzedAt,
    lineAnalyzing,
    lineAnalyzed,
    lineAnalyzedAt,
    failedCount,
    lineFailedCount,
    fetchFailures,
    commitCount,
    setCommitCount,
    runAnalysis,
    runLineStatsAnalysis,
    ensureAnalysis,
    ensureLineStats,
    loadRuleCheckPrefs,
    viewSettings,
    loadViewSettings,
    updateViewSettings,
    projectLineRanking,
    lineStatsSummary,
    selectedExtensions,
    updateSelectedExtensions,
    getProjectFileLines,
    refreshLineStatsProject,
    lineDetailRefreshing,
  }
}
