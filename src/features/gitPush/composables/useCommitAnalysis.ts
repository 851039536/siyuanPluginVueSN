// 提交分析 — 批量读取各项目提交日志，聚合时间分布/提交次数/项目排行；
// 行数排行改为「存量规模 + 生命周期」视图，只扫已跟踪文件行数与首/末次提交（不再抓全历史 numstat）
import type { Ref } from "vue"
import type {
  CommitAnalysisEntry,
  CommitAnalysisStats,
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
import { COMMIT_LOG_ALL_LIMIT } from "../types/meta"
import {
  classifyFetchFailure,
  compareProjectLineRank,
  fetchFailureReason,
  isCommitLogTruncated,
  poolProcess,
  ProjectFetchError,
  resolveAnalysisProjectCounts,
  resolveValidPath,
} from "../utils"
import { diffHeadProjects } from "../utils/analysisFreshness"

/**
 * 提交抓取条数类型（数字 = 条数上限；"all" = 全部提交）。
 * 工具条已不再提供条数选择（固定按「全部提交」抓取），保留数字分支仅为兼容旧缓存结构。
 */
export type CommitCount = number | "all"

/** 当前固定的抓取口径：每项目全部提交（实际受 COMMIT_LOG_ALL_LIMIT 保护上限约束，超限走截断提示） */
const COMMIT_COUNT_FIXED: CommitCount = "all"

/** HEAD 探测防抖：距上次探测不足 60s 的重复进入概览不再探测（Tab 切换/重开面板的高频路径） */
const HEAD_PROBE_MIN_INTERVAL_MS = 60_000

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
  /** 每项目抓取的提交条数（固定 "all"：工具条已移除条数选择，统计口径一律全量） */
  const commitCount = ref<CommitCount>(COMMIT_COUNT_FIXED)
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
  /** 达到抓取上限的项目 id（概览截断提示用；随缓存持久化） */
  const truncatedProjectIds = ref<string[]>([])
  /** per-project 分析时的 HEAD hash（新鲜度判定；非响应式，随缓存持久化） */
  let cachedHeads: Record<string, string> = {}
  /** 上次 HEAD 探测时间（毫秒；防抖用） */
  let lastHeadProbeAt = 0
  /**
   * 已分析过的项目 id（提交域）。**刻意与 entries 分开记账**：空提交仓库（0 条提交）
   * 分析成功但产不出任何 entry，若从 entries 反推会被误判成「失败」。
   */
  const analyzedProjectIds = ref<Set<string>>(new Set())
  /** 提交分析失败的项目 id（与 analyzedProjectIds 互斥；两个集合的交集由 resolveAnalysisProjectCounts 收敛） */
  const failedProjectIds = ref<Set<string>>(new Set())
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
  /** 热力图显示设置（范围/每周第一天/格子主色/指标/密度/分级方式，持久化到 git-push-analysis-view） */
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
  async function runCore(
    needNumstat: boolean,
    projectIds?: string[],
    onStage?: (stage: "analysisAggregate") => void,
  ): Promise<boolean> {
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
      // 子集目标全部不存在（项目已被删除）：无操作返回，避免把已删项目写进「已分析 / 失败」记账
      if (projectIds?.length && !needNumstat && targets.length === 0) {
        return true
      }

      /** 单项目抓取结果（含失败标记，供池外统一归类） */
      type ProjectResult =
        | { ok: true, projectId: string, entries: CommitAnalysisEntry[], truncated: boolean, headOid: string, totalLines: number, fileCount: number, firstCommit: string, lastCommit: string, fileLines: Map<string, number | null> }
        | { ok: false, reason: unknown }

      // 结果按 targets 下标写入（poolProcess 乱序完成，不能用 push）
      const results: ProjectResult[] = new Array(targets.length)

      const modules = getNodeFsPathOs()
      /** 单项目抓取（路径预检 + 按域取数据），失败抛出由调用方捕获 */
      const fetchOne = async (p: GitProject) => {
        const path = resolveValidPath(p)
        // 路径无效的项目直接 throw 计入失败
        // （先做路径预检是为了给出 pathMissing 这种可读原因；getCommitLog 现在失败也会抛出，
        //   两者不冲突：预检命中就省掉一次注定失败的 git 进程）
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
            truncated: false,
            headOid: "",
            totalLines,
            fileCount,
            firstCommit,
            lastCommit,
            fileLines,
          }
        }
        // 提交分析：走 getCommitLog（读失败会抛出，由本函数上方的调用方计入 failedCount，
        // 不再静默缺数据 —— 路径预检只是省掉一次注定失败的命令）。
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
          // 达到上限即视为可能截断（恰好 5000 条时无法区分是否全量，按截断提示更诚实）
          truncated: commitCount.value === "all" && isCommitLogTruncated(log.length, COMMIT_LOG_ALL_LIMIT),
          // 首条即 HEAD：抓取时顺带记录快照，新鲜度判定零额外 git 调用
          headOid: log[0]?.hash ?? "",
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

      // 项目级抓取全部结束，进入聚合/落盘；这是真实阶段边界，不是等待返回值后才补的展示
      onStage?.("analysisAggregate")

      let fail = 0
      const flat: CommitAnalysisEntry[] = []
      /** 本轮成功项目的 HEAD 快照（提交域；行数域不更新，保持旧值） */
      const headUpdates: Record<string, string> = {}
      /** 本轮达到抓取上限的项目 id */
      const runTruncated: string[] = []
      // 本次运行的失败明细：与 targets 下标一一对应，失败项据此回填项目名与本次实际使用的路径
      const runFailures: ProjectFetchFailure[] = []
      // 用下标 for 循环而非 forEach：forEach 会**跳过稀疏数组的空洞**，
      // 若某个槽位没被写入（任务被跳过/异常逃逸），该项目会同时消失在
      // flat 与 runFailures 里且 fail 不变 —— 静默缺席是最难排查的一类 bug。
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        if (!target) continue
        const r = results[i]
        if (r?.ok) {
          flat.push(...r.entries)
          if (!needNumstat) {
            headUpdates[target.id] = r.headOid
            if (r.truncated) runTruncated.push(target.id)
          }
          continue
        }
        // 未写入结果与显式失败同样计入失败，绝不静默跳过
        fail++
        const reason = r ? r.reason : new Error(`结果未写入（下标 ${i}）`)
        runFailures.push({
          projectId: target.id,
          projectName: target.name,
          path: resolveValidPath(target),
          // 路径预检失败自带分类（不经文案反推）；git 命令失败按其 stderr 关键字归类
          kind: reason instanceof ProjectFetchError ? reason.kind : classifyFetchFailure(reason),
          reason: fetchFailureReason(reason),
        })
      }
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
      })      // 写回结果：提交分析与行数统计各自的状态槽位（互不覆盖对方的「上次分析」时间与失败数）
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
        perProjectFileLines.value = fileLinesMap
        // 清理已删除项目的残留统计数据（防行数统计槽随项目增减无界增长）
        await manager.pruneLineStats(projects.value.map((p) => p.id))
      } else {
        // 子集局部刷新（保存修正后）：按项目合并——移除目标项目旧条目（amend/rebase 后 hash 已变，整体替换）+ 追加新数据，其他项目保留
        const idSet = projectIds?.length ? new Set(projectIds) : new Set<string>()
        if (idSet.size > 0) {
          const prevEntries = entries.value
          // 分析与失败按项目 id 记账：先把目标项目从两个集合里摘掉，再按本轮结果回填。
          // 不复用「旧贡献加减」的增量算式 —— 它与当前项目集合无关，删项目/加项目都会漂。
          const nextAnalyzed = new Set(analyzedProjectIds.value)
          const nextFailed = new Set(failedProjectIds.value)
          for (const id of idSet) {
            nextAnalyzed.delete(id)
            nextFailed.delete(id)
          }
          for (let i = 0; i < targets.length; i++) {
            if (results[i]?.ok) nextAnalyzed.add(targets[i].id)
          }
          for (const f of runFailures) nextFailed.add(f.projectId)
          analyzedProjectIds.value = nextAnalyzed
          failedProjectIds.value = nextFailed
          const merged = [...prevEntries.filter((e) => !idSet.has(e.projectId)), ...flat]
          // 按项目配置顺序重排，保持显示稳定
          const order = new Map(projects.value.map((p, i) => [p.id, i]))
          merged.sort((a, b) => (order.get(a.projectId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.projectId) ?? Number.MAX_SAFE_INTEGER))
          entries.value = merged
          // 截断标记与 HEAD 快照：只替换目标项目，其余项目沿用上次结果
          const targetIds = new Set(targets.map((t) => t.id))
          truncatedProjectIds.value = [
            ...truncatedProjectIds.value.filter((id) => !targetIds.has(id)),
            ...runTruncated,
          ]
          cachedHeads = { ...cachedHeads, ...headUpdates }
        } else {
          // 全量：分析与失败都以本轮 targets 为准（既覆盖「上次分析过的项目被删」也覆盖「新加项目未分析」）
          analyzedProjectIds.value = new Set(
            targets.filter((_, i) => results[i]?.ok).map((t) => t.id),
          )
          failedProjectIds.value = new Set(runFailures.map((f) => f.projectId))
          entries.value = flat
          truncatedProjectIds.value = runTruncated
          // 全量覆盖：抓取失败的项目从快照中移除（HEAD 未知，下次探测按「未知」处理）
          cachedHeads = headUpdates
        }
        analyzedAt.value = stamp
        analyzed.value = true
      }
      // 两个域共写同一份提交分析缓存（行数排行字段随需更新；提交分析分支沿用旧缓存的行数排行，避免覆盖行数视图已分析的数据）
      const oldCache = await manager.storage.commitAnalysisCache.loadOrDefault()
      await manager.storage.commitAnalysisCache.save({
        commitCount: commitCount.value,
        analyzedAt: analyzedAt.value || stamp,
        failedCount: failedProjectIds.value.size,
        entries: entries.value,
        projectLineRanking: needNumstat ? projectLineRanking.value : (oldCache.projectLineRanking ?? []),
        // 行数域不动提交域字段：沿用旧缓存（提交域运行时以内存值覆盖）
        truncatedProjectIds: needNumstat ? (oldCache.truncatedProjectIds ?? []) : truncatedProjectIds.value,
        heads: needNumstat ? (oldCache.heads ?? {}) : cachedHeads,
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
   * @returns 是否实际执行（false = 分析进行中被拒绝，请求已排队）
   */
  async function runAnalysis(
    projectId?: string | string[],
    onStage?: (stage: "analysisAggregate") => void,
  ): Promise<boolean> {
    // 归一化：空数组回退 undefined，否则 runCore 的 `projectIds?.length` 判据会误走全量分支
    const ids = Array.isArray(projectId) ? projectId : projectId ? [projectId] : undefined
    const scoped = ids?.length ? ids : undefined
    const ran = await runCore(false, scoped, onStage)
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
    return ran
  }

  /** 行数统计（始终并行抓取 numstat 生成项目/作者行数排行并覆盖缓存行数数据）；返回是否实际执行 */
  async function runLineStatsAnalysis(onStage?: (stage: "analysisAggregate") => void): Promise<boolean> {
    const ran = await runCore(true, undefined, onStage)
    if (!ran) {
      lineAnalyzed.value = false
      pendingReanalyze = true
      console.warn("[gitPush] 分析进行中，行数统计重跑请求已排队待下次执行")
    }
    return ran
  }

  /**
   * 从存储载入上次提交分析结果（有有效条目时直接复用，不再重新分析）。
   * 旧版把行数排行一起存在此缓存里，故同时回填行数域（lineAnalyzed/lineAnalyzedAt），供升级用户的行数视图直接复用。
   *
   * 条数口径已固定为「全部提交」：缓存里的 commitCount 若是按 N 条截断的旧值，
   * 说明 entries 覆盖不完整（KPI/趋势/热力图会少算），此时**不恢复提交域**（保持未分析，
   * 由 ensureAnalysis 用全量口径重跑一次）；行数排行与条数无关，照常恢复。
   */
  async function loadCachedAnalysis() {
    if (cacheLoaded) return
    cacheLoaded = true
    const cache = await manager.storage.commitAnalysisCache.loadOrDefault()
    commitCount.value = COMMIT_COUNT_FIXED
    // 截断标记与 HEAD 快照随缓存恢复（旧缓存缺字段按空兜底；已删除项目剔除）
    truncatedProjectIds.value = (cache.truncatedProjectIds ?? []).filter((id) => validProjectIds.value.has(id))
    cachedHeads = cache.heads ?? {}
    if (cache.entries.length === 0) return
    // 过滤已删除项目的残留条目（项目删除后缓存不再展示其数据）
    const valid = cache.entries.filter((e) => validProjectIds.value.has(e.projectId))
    if (valid.length === 0) return
    /** 旧缓存是否产生于「按条数截断」的分析（口径不全，不可直接展示） */
    const cappedLegacy = cache.commitCount !== COMMIT_COUNT_FIXED
    if (!cappedLegacy) {
      // 缓存只存了「失败数」这个数字，没存失败的是谁；用成功侧的痕迹反推：
      //   已分析 = entries 覆盖的项目 ∪ heads 覆盖的项目（空提交仓库没有 entries，但有 HEAD 键）
      // 旧缓存无 heads 字段时退化为「entries 覆盖的项目」，不会把有数据的项目误报成失败。
      // 局部变量刻意不叫 analyzed：外层同名 ref 表示「本轮是否已分析」，会被遮蔽
      const analyzedIds = new Set<string>()
      for (const e of valid) {
        if (validProjectIds.value.has(e.projectId)) analyzedIds.add(e.projectId)
      }
      for (const id of Object.keys(cache.heads ?? {})) {
        if (validProjectIds.value.has(id)) analyzedIds.add(id)
      }
      analyzedProjectIds.value = analyzedIds
      failedProjectIds.value = new Set(
        [...validProjectIds.value].filter((id) => !analyzedIds.has(id)),
      )
      analyzedAt.value = cache.analyzedAt
      entries.value = valid
      analyzed.value = true
    }
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

  /**
   * 缓存新鲜度刷新：并发探测各项目 HEAD，与缓存快照比对，只对 HEAD 变化的项目走子集重抓。
   * 探测失败/旧缓存无快照一律不判定（不阻断缓存展示）；60s 内重复进入视图直接跳过。
   */
  async function refreshStaleProjects() {
    if (runBusy || !analyzed.value || entries.value.length === 0) return
    if (Date.now() - lastHeadProbeAt < HEAD_PROBE_MIN_INTERVAL_MS) return
    lastHeadProbeAt = Date.now()
    const heads: Record<string, string> = {}
    await poolProcess(projects.value, manager.getGitConcurrency(), async (p) => {
      heads[p.id] = await manager.getHeadOid(resolveValidPath(p)).catch(() => "")
    })
    const stale = diffHeadProjects(cachedHeads, heads, projects.value.map((p) => p.id))
    if (stale.length > 0) {
      console.info(`[gitPush] 提交分析缓存过期，局部重抓 ${stale.length} 个项目`)
      await runAnalysis(stale)
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
      return
    }
    await refreshStaleProjects()
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
   * 结果由 manager.scanProjectLineStats 直接落 JSON 槽，并同步写行数统计快照缓存供下次复用；
   * analyzedAt 语义为全量分析完成时间，不因单项目刷新改动。
   * @returns 是否实际执行（false = 已在刷新/分析中或项目不存在，未发起扫描）
   */
  async function refreshLineStatsProject(projectId: string, onStage?: () => void): Promise<boolean> {
    if (lineDetailRefreshing.value || runBusy) return false
    const p = projects.value.find((x) => x.id === projectId)
    if (!p) return false
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
      // 单项目扫描结束，开始更新排行/汇总/缓存
      onStage?.()
      perProjectFileLines.value.set(projectId, fileLines)
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
      return true
    } catch (e) {
      // 刷新失败仅控制台告警：不改全局 failedCount 口径（详情弹窗局部操作，重试成本低）
      console.warn("[gitPush] 单项目行数刷新失败", e)
      return true
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
    // 旧数据缺字段时 readCommitRuleConfig 逐字段回退默认值（与生成/修正弹窗同一口径）
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

  /** 分析聚合视图（提交分析面板唯一数据 prop；排行与趋势图由面板按显示范围从 entries 派生） */
  const analysisStats = computed<CommitAnalysisStats>(() => {
    // 实时过滤已删除项目的条目（项目删除后缓存/内存中的残留数据不参与统计与展示）
    const list = entries.value.filter((e) => validProjectIds.value.has(e.projectId))
    const counts = resolveAnalysisProjectCounts(
      analyzedProjectIds.value,
      failedProjectIds.value,
      validProjectIds.value,
    )
    return {
      totalCommits: list.length,
      projectCount: projects.value.length,
      analyzedCount: counts.analyzedCount,
      failedCount: counts.failedCount,
      entries: list,
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
    lineFailedCount,
    fetchFailures,
    truncatedProjectIds,
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
