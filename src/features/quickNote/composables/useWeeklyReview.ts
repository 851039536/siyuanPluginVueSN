/**
 * 速记功能 — 每周复盘 composable
 * 纯计算派生：统计本周完成事项数、优先级分布（环形图数据）、项目精力分布（条形图数据）、
 * 卡点汇总清单。不产生额外存储，数据完全由待办/项目派生
 */
import type { Ref } from "vue"
import type { ProjectItem, TodoItem } from "../types"
import { computed, ref } from "vue"
import { PRIORITY_META, STATUS_META } from "../types"

/**
 * 图表数据项结构（与 Chart.vue 的 ChartData 对齐）
 * .ts 文件无法导入 .vue 的命名类型导出，此处依赖结构类型与 WeeklyReview.vue 的 ChartData[] prop 契约兼容
 */
type ChartDatum = {
  label: string
  value: number
  color?: string
}

/** 卡点汇总条目 */
export interface BlockSummary {
  projectId: string
  projectName: string
  blocker: string
}

/** 周起始时间戳刷新间隔（毫秒）：每 60s 校准一次，避免面板常驻跨周后统计锁死在上一周 */
const WEEK_START_REFRESH_MS = 60_000

/** 计算本周起始时间戳（周一零点） */
function getWeekStart(): number {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay() // 周一为 1，周日为 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.getTime()
}

export function useWeeklyReview(
  todosRef: Ref<TodoItem[]>,
  projectsRef: Ref<ProjectItem[]>,
) {
  /** 本周起始时间戳（周一零点），由 startWatch 周期刷新以支持跨周切换 */
  const weekStart = ref(getWeekStart())

  /** 周期刷新定时器句柄（null = 未启动） */
  let watchTimer: ReturnType<typeof setInterval> | null = null

  /** 启动周期刷新：每 60s 校准本周起始时间，面板挂载时调用 */
  const startWatch = () => {
    if (watchTimer) return
    watchTimer = setInterval(() => {
      weekStart.value = getWeekStart()
    }, WEEK_START_REFRESH_MS)
  }

  /** 停止周期刷新并清理定时器，面板卸载时调用 */
  const stopWatch = () => {
    if (watchTimer) {
      clearInterval(watchTimer)
      watchTimer = null
    }
  }

  /** 本周完成的事项（doneAt 落在本周） */
  const completedThisWeek = computed(() =>
    todosRef.value.filter((t) => t.done && t.doneAt && t.doneAt >= weekStart.value),
  )

  /** 本周完成事项总数 */
  const weekTotal = computed(() => completedThisWeek.value.length)

  /** 优先级分布（环形图数据）：紧急/高/中/低各完成数 */
  const priorityDistribution = computed<ChartDatum[]>(() => {
    const priorities = (Object.keys(PRIORITY_META) as Array<keyof typeof PRIORITY_META>)
    return priorities.map((p) => ({
      label: p, // 由图表层经 i18n 转文案
      value: completedThisWeek.value.filter((t) => t.priority === p).length,
      color: PRIORITY_META[p].color,
    }))
  })

  /** 项目精力分布（条形图数据）：各项目关联待办完成数（本周） */
  const projectEffort = computed<ChartDatum[]>(() => {
    return projectsRef.value.map((proj) => ({
      label: proj.name,
      value: completedThisWeek.value.filter((t) => t.projectId === proj.id).length,
      color: STATUS_META[proj.status]?.color ?? STATUS_META.active.color,
    }))
  })

  /** 卡点汇总清单：所有有卡点描述的项目 */
  const blockSummary = computed<BlockSummary[]>(() =>
    projectsRef.value
      .filter((p) => p.blockers && p.blockers.trim())
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        blocker: p.blockers,
      })),
  )

  return {
    weekTotal,
    priorityDistribution,
    projectEffort,
    blockSummary,
    startWatch,
    stopWatch,
  }
}
