// gitPush 代码统计报告 — 选中项目/时间范围 + 索引驱动的数据抓取 + 报告聚合
//
// 数据新鲜度模型（本地提交索引的消费方）：
//   1. 进视图先用持久化的「上次报告结果」秒开，不等 git；
//   2. 同时后台跑一次索引刷新：HEAD 未变 → 零 git 扫描，直接复用索引内存数据；
//   3. 刷新完成后替换报告并落盘缓存，头部展示「数据时间」。
// 索引不可用时 getIndexedCommitLog 自动回退直接跑 git，行为与改造前一致。
import type { Ref } from "vue"
import type { NumstatCommit } from "../reportMetrics"
import type {
  CodeReportData,
  CodeReportPrefs,
  GitProject,
  GitPushManager,
  ReportRange,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import {
  buildEmptyReport,
  buildReportData,
} from "../reportMetrics"
import {
  DEFAULT_REPORT_PREFS,
  REPORT_RANGE_DAYS,
  REPORT_RANGE_LABEL_KEYS,
} from "../types"
import {
  findProject,
  relativeTime,
  resolveValidPath,
} from "../utils"

/** 从提交块推导"全部历史"范围标签所需的最早提交时间（无有效时间返回空串） */
function earliestCommitIso(commits: NumstatCommit[]): string {
  let earliest = ""
  let earliestMs = Number.POSITIVE_INFINITY
  for (const c of commits) {
    const ms = Date.parse(c.date)
    if (Number.isNaN(ms)) continue
    if (ms < earliestMs) {
      earliestMs = ms
      earliest = c.date
    }
  }
  return earliest
}

export function useCodeReport(manager: GitPushManager, projects: Ref<GitProject[]>, i18n: Record<string, any>) {
  /** 首次无缓存时的生成中标记（并发去重） */
  const running = ref(false)
  /** 后台静默刷新中标记（已有内容展示时的增量校验） */
  const refreshing = ref(false)
  /** 是否已生成过至少一轮（区分"未生成"与"无提交数据"） */
  const generated = ref(false)
  /** 选中项目 ID（空串 = 自动取首个项目） */
  const projectId = ref<string>("")
  /** 时间范围（默认近 6 个月） */
  const range = ref<ReportRange>(DEFAULT_REPORT_PREFS.range)
  /** 是否已从存储载入偏好（防重复读盘） */
  let prefsLoaded = false
  /** 是否已从存储载入报告结果缓存（防重复读盘） */
  let cacheLoaded = false
  /** 聚合后的报告数据（未生成时为空报告） */
  const reportData = ref<CodeReportData>(buildEmptyReport(""))
  /**
   * 本会话已校验过的「项目 + 范围」对。
   * 刻意**不含** reportData.generatedAt：那个值只在刷新跑完后才变，把它编进键会让键自我指涉——
   * 一旦写入就永远命中，同一会话内用户提交了新代码再切回报告视图也不会重新校验。
   * 同会话的新鲜度改由 indexVersion 承担（见 markStale）。
   */
  const verifiedKeys = new Set<string>()
  /** 有在途请求时被挡下的新请求（结束后补跑一次，避免切换项目/范围丢失刷新） */
  let pendingRerun = false
  /** 补跑请求是否可静默：只要有一笔被挡下的请求是显式（用户触发）的，补跑就必须非静默 */
  let pendingRerunSilent = true
  /** 索引数据变更计数（提交/历史重写等写操作后自增，使已校验键失效） */
  const indexVersion = ref(0)

  /** 当前校验键（项目 + 范围 + 索引版本；不含自我指涉的 generatedAt） */
  function verifyKey(): string {
    return `${currentProject.value?.id ?? ""}|${range.value}|${indexVersion.value}`
  }

  /**
   * 标记报告数据可能已过期（仓库发生写操作后由调用方触发）。
   * 仅做失效：清空已校验键并递增版本，使下次 ensureReport 重新校验并重算
   * （本函数自身不发起刷新，实际重算发生在下次进入报告视图时）。
   */
  function markStale() {
    indexVersion.value++
    verifiedKeys.clear()
  }

  /** 当前生效的项目（选中项优先，未选中或已删除回退首个项目；无项目返回 null） */
  const currentProject = computed<GitProject | null>(() => {
    if (projects.value.length === 0) return null
    const selected = findProject(projects, projectId.value)
    return selected ?? projects.value[0]
  })

  /** 从存储载入偏好（上次项目 + 时间范围；项目已删时回退首个） */
  async function loadPrefs() {
    if (prefsLoaded) return
    prefsLoaded = true
    const saved = await manager.storage.reportPrefs.loadOrDefault()
    range.value = REPORT_RANGE_LABEL_KEYS[saved.range] ? saved.range : DEFAULT_REPORT_PREFS.range
    projectId.value = saved.projectId
  }

  /** 持久化偏好（生成成功或切换范围时调用，恢复会话选择） */
  async function savePrefs() {
    const prefs: CodeReportPrefs = {
      projectId: currentProject.value?.id ?? "",
      range: range.value,
    }
    await manager.storage.reportPrefs.save(prefs)
  }

  /**
   * 载入上次报告结果（秒开）。
   * 仅在「缓存的项目与选中项目一致」**且「缓存的时间范围与当前范围一致」**时采用：
   * 缓存是针对特定范围算出来的，跨范围复用会让头部范围标签与图表内容不一致
   * （换项目后展示旧项目报告更会造成误读）。此时宁可直接生成（索引命中的情况下本身就很快）。
   */
  async function loadCachedReport() {
    if (cacheLoaded) return
    cacheLoaded = true
    const cache = await manager.storage.reportCache.loadOrDefault()
    const project = currentProject.value
    if (!cache.report || !project || cache.projectId !== project.id) return
    if (cache.range !== range.value) return
    reportData.value = cache.report
    generated.value = true
  }

  /**
   * 报告结果落盘（失败仅告警：缓存是纯加速手段，不应影响统计本身）。
   *
   * 键必须由调用方**显式传入**（在 await 之前捕获）：若此处读 `currentProject.value`，
   * 用户在本轮 await 期间切换项目/范围时，会把「旧项目算出的报告」写进「新项目的键」，
   * 之后 loadCachedReport 按 projectId 命中就把错误数据当成最新结果显示。
   */
  async function saveReportCache(report: CodeReportData, cacheProjectId: string, cacheRange: ReportRange) {
    try {
      await manager.storage.reportCache.save({
        projectId: cacheProjectId,
        range: cacheRange,
        generatedAt: report.generatedAt,
        report,
      })
    } catch (e) {
      console.warn("[gitPush] 报告结果缓存写入失败", e)
    }
  }

  /** 当前范围的范围标签（"全部历史"用数据内最早提交时间的相对文案，与改造前口径一致） */
  function rangeLabelFor(commits: NumstatCommit[]): string {
    if (range.value !== "all") return i18n[REPORT_RANGE_LABEL_KEYS[range.value]] || ""
    const first = earliestCommitIso(commits)
    return first ? relativeTime(first, i18n) : (i18n.reportRangeAll || "")
  }

  /**
   * 生成报告：索引命中则零 git 扫描，否则增量补抓后聚合。
   *
   * 失败语义分层（与改造前一致）：
   * - git 失败（路径无效/非仓库）→ 抛错 → 展示失败提示，且**不写缓存**（避免坏数据被反复加载）
   * - 命令成功但零提交（合法空仓库）→ ok:true 空数据，面板展示"暂无数据"
   *
   * @param opts.silent 后台刷新：已有内容时不切到"生成中"态，避免闪烁
   */
  async function runReport(opts?: { silent?: boolean }) {
    const project = currentProject.value
    if (!project) return
    const silent = opts?.silent ?? false
    // 本轮请求的键在 await 之前捕获：期间用户可能切换项目/范围，落缓存必须用「算这份数据时」的键
    const reqProjectId = project.id
    const reqRange = range.value
    if (running.value || refreshing.value) {
      // 已有在途请求：不能静默丢弃本次请求（否则 setRange/setProject 改了状态却不出新数据，
      // 头部范围与图表内容长期不一致）。标记待重跑，等当前请求结束后补一次。
      // 补跑的可静默性取「与」：任一笔被挡下的请求是显式的，补跑就必须非静默，
      // 否则用户触发的 setRange 会被静默吞掉，既不显示生成中态也不暴露错误。
      pendingRerun = true
      pendingRerunSilent = pendingRerunSilent && silent
      return
    }
    if (silent) refreshing.value = true
    else running.value = true
    try {
      const sinceDays = REPORT_RANGE_DAYS[reqRange]
      let commits: NumstatCommit[] = []
      let gitFailed = false
      try {
        const result = await manager.getIndexedCommitLog(project, { sinceDays })
        commits = result.commits
      } catch {
        gitFailed = true
      }
      // 请求期间用户已切换项目/范围 → 这份结果已过期，丢弃；待重跑逻辑会补算新键
      if (project.id !== reqProjectId || range.value !== reqRange) {
        pendingRerun = true
        return
      }
      if (gitFailed) {
        // 静默后台刷新失败时保留屏上已有内容：用户本来看着一份有效报告，
        // 不该因为一次后台校验失败就变成空白失败态（仅无任何内容时才展示失败）
        if (!silent || !generated.value) {
          reportData.value = buildEmptyReport(rangeLabelFor([]))
          generated.value = false
        }
        // 校验失败不记账：verifyKey 若在此加入，ensureReport 的早退分支会认为
        // 「本项目 + 范围 + 版本已校验」，此后永不重试，用户只能一直看着陈旧数据
      } else {
        reportData.value = buildReportData(project, commits, rangeLabelFor(commits))
        generated.value = true
        await saveReportCache(reportData.value, reqProjectId, reqRange)
        verifiedKeys.add(verifyKey())
      }
      await savePrefs()
    } finally {
      running.value = false
      refreshing.value = false
      // 在途期间有新请求被挡下：补跑一次（置于 finally，保证异常路径也能补上）
      if (pendingRerun) {
        pendingRerun = false
        const rerunSilent = pendingRerunSilent
        // 重置为「可静默」，使下一轮重新累积本轮被挡下请求的意图
        pendingRerunSilent = true
        void runReport({ silent: rerunSilent })
      }
    }
  }

  /** 切换时间范围：立即重算（索引命中时零 git），再跑一次 */
  async function setRange(r: ReportRange) {
    if (range.value === r) return
    range.value = r
    await runReport({ silent: generated.value })
  }

  /** 切换项目：清空内容避免串台，再走统一生成 */
  async function setProject(id: string) {
    if (projectId.value === id) return
    projectId.value = id
    generated.value = false
    reportData.value = buildEmptyReport("")
    await savePrefs()
    await runReport()
  }

  /**
   * 进入报告视图的统一入口：载入偏好与缓存 → 有缓存则立即出图并静默刷新，无缓存则直接生成。
   * 本会话已校验过的"项目 + 范围 + 报告版本"不重复刷新，避免反复切视图造成的重复扫描。
   */
  async function ensureReport() {
    await loadPrefs()
    await loadCachedReport()
    if (!generated.value) {
      await runReport()
      return
    }
    if (verifiedKeys.has(verifyKey())) return
    await runReport({ silent: true })
  }

  /**
   * 按当前项目 + 当前时间范围懒取文件补丁（文件详情弹窗打开时调用）。
   * 复用 manager 异步 git 通道，失败返回空串由弹窗隐藏区块，不阻塞报告生成。
   */
  async function fetchFilePatch(path: string): Promise<string> {
    const project = currentProject.value
    if (!project) return ""
    const cwd = resolveValidPath(project)
    const days = REPORT_RANGE_DAYS[range.value]
    try {
      return await manager.getFileHistoryPatch(cwd, path, days > 0 ? `${days} days ago` : "")
    } catch {
      return ""
    }
  }

  return {
    reportData,
    running,
    refreshing,
    generated,
    projectId,
    range,
    currentProject,
    runReport,
    setRange,
    setProject,
    ensureReport,
    fetchFilePatch,
    /** 仓库写操作后调用：使本会话已校验键失效，下次进报告视图会重新校验 */
    markStale,
  }
}
