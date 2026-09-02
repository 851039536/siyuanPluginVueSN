/**
 * 速记功能 — 每周复盘 composable
 * 周切换纯派生模型：按 weekOffset（0=本周，递增为历史周）从待办 doneAt 实时回溯
 * 任意周的完成数/环比/日均/优先级分布/项目精力分布，无快照存储；
 * 卡点汇总为实时状态（blockers 无历史时间线），仅展示当前快照
 */
import type { Ref } from "vue"
import type { ChartData } from "@/components/chart.types"
import type { ProjectItem, TodoItem } from "../types"
import { computed, ref } from "vue"
import { PRIORITY_META, STATUS_META } from "../types"

/** 卡点汇总条目 */
export interface BlockSummary {
  projectId: string
  projectName: string
  blocker: string
}

/** 历史回溯周数上限（weekOffset 最大值：本周 + 最多回溯 7 周） */
const MAX_HISTORY_WEEKS = 7

const WEEK_MS = 7 * 86_400_000

/** 指定周偏移的周一零点时间戳（offset=0 本周，1 上周…）；now 为当前时刻基准 */
function getWeekStart(offset: number, now: number): number {
  const date = new Date(now)
  const day = date.getDay() === 0 ? 7 : date.getDay() // 周一为 1，周日为 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday.getTime()
}

export function useWeeklyReview(
  todosRef: Ref<TodoItem[]>,
  projectsRef: Ref<ProjectItem[]>,
) {
  /** 当前时刻基准（refreshNow 在进入复盘 Tab 时校准，防止面板常驻跨天后周界过期） */
  const now = ref(Date.now())

  /** 周偏移：0 = 本周，1 = 上周 … 最大 MAX_HISTORY_WEEKS */
  const weekOffset = ref(0)

  /** 校准当前时刻基准（周界随真实日期漂移），进入复盘 Tab 时调用 */
  const refreshNow = () => {
    now.value = Date.now()
  }

  /** 选中周的周一零点（含） */
  const weekStart = computed(() => getWeekStart(weekOffset.value, now.value))

  /** 选中周的结束边界（下一周一零点，不含） */
  const weekEnd = computed(() => weekStart.value + WEEK_MS)

  /** 选中周完成的事项（doneAt 落在 [weekStart, weekEnd) 区间） */
  const completedInRange = computed(() =>
    todosRef.value.filter((t) => t.done && t.doneAt && t.doneAt >= weekStart.value && t.doneAt < weekEnd.value),
  )

  /** 选中周完成事项总数 */
  const weekTotal = computed(() => completedInRange.value.length)

  /** 上一周完成事项总数（环比对比基准） */
  const prevWeekTotal = computed(() =>
    todosRef.value.filter((t) => {
      if (!t.done || !t.doneAt) return false
      const prevStart = weekStart.value - WEEK_MS
      return t.doneAt >= prevStart && t.doneAt < weekStart.value
    }).length,
  )

  /** 环比趋势：选中周完成数 - 上周完成数（正=上升，负=下降，0=持平） */
  const trend = computed(() => weekTotal.value - prevWeekTotal.value)

  /** 日均完成数（保留 1 位小数） */
  const weekAvg = computed(() => Math.round((weekTotal.value / 7) * 10) / 10)

  /** 优先级分布（环形图数据）：选中周各优先级完成数 */
  const priorityDistribution = computed<ChartData[]>(() => {
    const priorities = (Object.keys(PRIORITY_META) as Array<keyof typeof PRIORITY_META>)
    return priorities.map((p) => ({
      label: p, // 由图表层经 i18n 转文案
      value: completedInRange.value.filter((t) => t.priority === p).length,
      color: PRIORITY_META[p].color,
    }))
  })

  /** 项目精力分布（条形图数据）：选中周各项目关联待办完成数 */
  const projectEffort = computed<ChartData[]>(() => {
    return projectsRef.value.map((proj) => ({
      label: proj.name,
      value: completedInRange.value.filter((t) => t.projectId === proj.id).length,
      color: STATUS_META[proj.status]?.color ?? STATUS_META.active.color,
    }))
  })

  /** 卡点汇总清单：所有有卡点描述的项目（实时状态，无历史） */
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
    weekOffset,
    maxWeekOffset: MAX_HISTORY_WEEKS,
    weekStart,
    weekEnd,
    weekTotal,
    prevWeekTotal,
    trend,
    weekAvg,
    priorityDistribution,
    projectEffort,
    blockSummary,
    refreshNow,
  }
}
