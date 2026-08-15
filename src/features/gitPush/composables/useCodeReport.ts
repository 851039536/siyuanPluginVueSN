// gitPush 代码统计报告 — 选中项目/时间范围 + git 数据抓取 + 报告聚合（仿 useCommitAnalysis 模式）
import type { Ref } from "vue"
import type {
  CodeReportData,
  CodeReportPrefs,
  GitProject,
  GitPushManager,
  ReportRange,
} from "../types"
import { computed, ref } from "vue"
import { DEFAULT_REPORT_PREFS, REPORT_RANGE_LABEL_KEYS } from "../types"
import { buildEmptyReport, buildReportData, sinceForRange, DEBT_MIN_MOD_COUNT } from "../reportMetrics"
import type { NumstatCommit } from "../reportMetrics"
import { relativeTime, resolveValidPath } from "../utils"

export function useCodeReport(manager: GitPushManager, projects: Ref<GitProject[]>, i18n: Record<string, any>) {
  /** 生成中标记（并发去重） */
  const running = ref(false)
  /** 是否已生成过至少一轮（区分"未生成"与"无提交数据"） */
  const generated = ref(false)
  /** 上次生成时间（ISO，供面板展示"生成时间"） */
  const generatedAt = ref("")
  /** 选中项目 ID（空串 = 自动取首个项目） */
  const projectId = ref<string>("")
  /** 时间范围（默认近 6 个月） */
  const range = ref<ReportRange>(DEFAULT_REPORT_PREFS.range)
  /** 技术债务门槛（修改次数低于该值不列为债务；默认 3，数据层可配置，UI 控件后续接线） */
  const debtMinModCount = ref<number>(DEBT_MIN_MOD_COUNT)
  /** 是否已从存储载入偏好（防重复读盘） */
  let prefsLoaded = false
  /** 聚合后的报告数据（未生成时为空报告） */
  const reportData = ref<CodeReportData>(buildEmptyReport(
    { id: "", name: "" } as GitProject,
    "",
  ))

  /** 当前生效的项目（选中项优先，未选中或已删除回退首个项目；无项目返回 null） */
  const currentProject = computed<GitProject | null>(() => {
    if (projects.value.length === 0) return null
    const selected = projects.value.find((p) => p.id === projectId.value)
    return selected ?? projects.value[0]
  })

  /** 从存储载入偏好（上次项目 + 时间范围；项目已删时回退首个） */
  async function loadPrefs() {
    if (prefsLoaded) return
    prefsLoaded = true
    const saved = await manager.storage.reportPrefs.loadOrDefault()
    range.value = REPORT_RANGE_LABEL_KEYS[saved.range] ? saved.range : DEFAULT_REPORT_PREFS.range
    projectId.value = saved.projectId
    // 债务门槛：旧存储无该字段时回退默认值，并钳位到 [1, 99] 防脏数据
    const minCount = Math.round(saved.debtMinModCount ?? DEBT_MIN_MOD_COUNT)
    debtMinModCount.value = Math.max(1, Math.min(99, minCount))
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
   * 生成报告：读取 numstat 提交日志 → 聚合评分 → 持久化偏好。
   * 区分两种失败语义：git 命令失败（路径无效/非仓库）→ ok:false 展示失败提示；
   * 命令成功但零提交（合法空仓库）→ ok:true 空数据，由面板展示"暂无数据"。
   */
  async function runReport() {
    const project = currentProject.value
    if (!project || running.value) return
    running.value = true
    try {
      const cwd = resolveValidPath(project)
      const since = sinceForRange(range.value)
      let commits: NumstatCommit[] = []
      let gitFailed = false
      try {
        commits = await manager.getNumstatLog(cwd, since)
      } catch {
        gitFailed = true
      }
      // git 失败时跳过首提交日期查询（无需额外 git 调用）
      const firstDate = gitFailed ? "" : await manager.getFirstCommitDate(cwd).catch(() => "")
      // 全部历史时用首提交日期生成时间范围标签（如 "5 months ago"），按本地语言 i18n 格式化
      const rangeLabel = range.value === "all"
        ? (firstDate ? relativeTime(firstDate, i18n) : i18n.reportRangeAll || "")
        : (i18n[REPORT_RANGE_LABEL_KEYS[range.value]] || "")
      reportData.value = gitFailed
        ? buildEmptyReport(project, rangeLabel)
        : buildReportData(project, commits, rangeLabel, debtMinModCount.value)
      generatedAt.value = new Date().toISOString()
      // 失败（ok:false）不标记为已生成，下次进入视图可自动重试
      generated.value = !gitFailed
      await savePrefs()
    } finally {
      running.value = false
    }
  }

  /** 切换时间范围后自动重跑 */
  async function setRange(r: ReportRange) {
    if (range.value === r) return
    range.value = r
    generated.value = false
    await runReport()
  }

  /** 切换项目后自动重跑 */
  async function setProject(id: string) {
    if (projectId.value === id) return
    projectId.value = id
    generated.value = false
    await runReport()
  }

  /** 进入报告视图的统一入口：先载入偏好，再自动生成一次 */
  async function ensureReport() {
    await loadPrefs()
    if (!generated.value && !running.value) await runReport()
  }

  return {
    reportData,
    running,
    generated,
    generatedAt,
    projectId,
    range,
    debtMinModCount,
    currentProject,
    runReport,
    setRange,
    setProject,
    ensureReport,
  }
}
