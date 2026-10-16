/**
 * 速记功能 — 待办列表 composable
 * 承载待办条目的响应式列表与 CRUD、逾期检测、一键顺延、按日期分组，
 * 并在 load 时执行每日自动顺延（昨日未完成逾期任务自动挪到今天）。
 * 日期基准经 now ref 统一持有（refreshNow 校准），面板常驻跨天后自动重算分组与逾期状态
 */
import type { Ref } from "vue"
import type { TodoItem } from "../types"
import type { QuickNoteStorage } from "../types/storage"
import {
  computed,
  ref,
} from "vue"
import {
  isOverdueAgainst,
  parseDateStr,
  rolloverOverdue,
  toDateStr,
} from "../pureUtils"
import { PRIORITY_META } from "../types"
import {
  createPersistLock,
  generateId,
} from "../utils"

/** 日期分组标签：今天 / 明天 / 本周 / 更远 */
export type DateGroup = "today" | "tomorrow" | "week" | "future"

/** 聚焦区条目（今日到期 + 逾期，overdue 标记供红色警示样式） */
export type TodoFocusItem = TodoItem & { overdue: boolean }

export function useTodoList(storage: QuickNoteStorage) {
  const todos: Ref<TodoItem[]> = ref([])

  /**
   * 当前时刻基准（分组与逾期状态派生依赖）。
   * 面板为 persistent Modal 常驻不销毁，computed 仅在 todos 变化时重算；
   * 跨天后需 refreshNow() 触发重算，否则「今天/明天」分组与逾期红字会停留在昨天
   */
  const now = ref(Date.now())

  /** 校准当前时刻基准（进入面板/切回待办 Tab 时调用，防止常驻跨天后日期基准过期） */
  const refreshNow = (): void => {
    now.value = Date.now()
  }

  /** 今天零点（所有日期比较共用的单次解析结果） */
  const todayStart = computed(() => parseDateStr(toDateStr(new Date(now.value))))

  /** 今天日期串（YYYY-MM-DD） */
  const todayStr = computed(() => toDateStr(new Date(now.value)))

  /** 从存储加载全部待办，并执行每日自动顺延 */
  const load = async () => {
    refreshNow()
    const data = await storage.data.loadOrDefault()
    const rolled = rolloverOverdue(data.todos, data.lastRolloverDate, now.value)
    todos.value = rolled.list
    if (rolled.changed) {
      await storage.data.save({
        ...data,
        todos: rolled.list,
        lastRolloverDate: rolled.lastRolloverDate,
      })
    }
  }

  /** 持久化当前待办列表（串行锁防止快速连续操作时 read-modify-write 读到旧数据） */
  const persist = createPersistLock(storage.data, (data) => ({
    ...data,
    todos: todos.value,
  }))

  /** 新增待办（空内容忽略） */
  const add = async (partial: {
    content: string
    priority?: TodoItem["priority"]
    dueDate?: string | null
    projectId?: string | null
  }) => {
    const content = partial.content.trim()
    if (!content) return
    const now = Date.now()
    const item: TodoItem = {
      id: generateId(),
      content,
      priority: partial.priority ?? "medium",
      dueDate: partial.dueDate ?? null,
      done: false,
      doneAt: null,
      projectId: partial.projectId ?? null,
      rolloverCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    todos.value = [item, ...todos.value]
    await persist()
  }

  /** 更新待办内容/优先级/截止日期/关联项目（content 与新增模式一致做 trim） */
  const update = async (id: string, patch: Partial<Pick<TodoItem, "content" | "priority" | "dueDate" | "projectId">>) => {
    const todo = todos.value.find((t) => t.id === id)
    if (!todo) return
    const normalized = patch.content !== undefined
      ? {
          ...patch,
          content: patch.content.trim(),
        }
      : patch
    Object.assign(todo, normalized, { updatedAt: Date.now() })
    await persist()
  }

  /** 勾选/取消勾选完成状态（首次完成记录 doneAt 供复盘统计） */
  const toggleDone = async (id: string) => {
    const todo = todos.value.find((t) => t.id === id)
    if (!todo) return
    todo.done = !todo.done
    todo.doneAt = todo.done ? Date.now() : null
    todo.updatedAt = Date.now()
    await persist()
  }

  /** 一键顺延到明天（累计顺延次数） */
  const rolloverToTomorrow = async (id: string) => {
    const todo = todos.value.find((t) => t.id === id)
    if (!todo) return
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    todo.dueDate = toDateStr(tomorrow)
    todo.rolloverCount += 1
    todo.updatedAt = Date.now()
    await persist()
  }

  /** 删除待办 */
  const remove = async (id: string) => {
    todos.value = todos.value.filter((t) => t.id !== id)
    await persist()
  }

  /** 是否已逾期：未完成且截止日期严格早于今天 */
  const isOverdue = (t: TodoItem): boolean => isOverdueAgainst(t, todayStart.value)

  /**
   * 「今天要处理的」聚焦区条目：今日到期 + 逾期未完成
   * （自动顺延会把逾期项截止日期改为今天，故按 dueDate <= today 合并筛选），逾期项排前。
   * 每条只解析一次截止日期，overdue 结果在 filter/map 间复用
   */
  const todayFocus = computed<TodoFocusItem[]>(() => {
    const today = todayStr.value
    const start = todayStart.value
    const focus: TodoFocusItem[] = []
    for (const t of todos.value) {
      if (t.done || !t.dueDate?.trim()) continue
      const overdue = isOverdueAgainst(t, start)
      if (!overdue && t.dueDate !== today) continue
      focus.push({
        ...t,
        overdue,
      })
    }
    return focus.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
    })
  })

  /** 未完成待办计数（最小化条徽标用） */
  const pendingCount = computed(() => todos.value.filter((t) => !t.done).length)

  /** 确定某待办所属日期分组 */
  const groupOf = (t: TodoItem): DateGroup => {
    if (!t.dueDate?.trim()) return "future"
    const due = parseDateStr(t.dueDate)
    const start = todayStart.value
    if (!due || !start) return "future"
    const diffDays = Math.round((due.getTime() - start.getTime()) / 86400000)
    if (diffDays <= 0) return "today"
    if (diffDays === 1) return "tomorrow"
    if (diffDays <= 7) return "week"
    return "future"
  }

  /** 未完成待办按日期分组（今天/明天/本周/更远），每组内按优先级+截止日期排序 */
  const groupedPending = computed(() => {
    const groups: Record<DateGroup, TodoItem[]> = {
      today: [],
      tomorrow: [],
      week: [],
      future: [],
    }
    todos.value
      .filter((t) => !t.done)
      .forEach((t) => {
        groups[groupOf(t)].push(t)
      })
    ;(Object.keys(groups) as DateGroup[]).forEach((g) => {
      groups[g].sort((a, b) => {
        const rankDiff = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
        if (rankDiff !== 0) return rankDiff
        return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
      })
    })
    return groups
  })

  /** 已完成待办列表（按完成时间倒序） */
  const doneTodos = computed(() =>
    todos.value
      .filter((t) => t.done)
      .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  )

  return {
    todos,
    todayFocus,
    pendingCount,
    groupedPending,
    doneTodos,
    load,
    add,
    update,
    toggleDone,
    rolloverToTomorrow,
    remove,
    isOverdue,
    refreshNow,
  }
}
