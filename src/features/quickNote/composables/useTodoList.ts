/**
 * 速记功能 — 待办列表 composable
 * 承载待办条目的响应式列表与 CRUD、逾期检测、一键顺延、按日期分组，
 * 并在 load 时执行每日自动顺延（昨日未完成逾期任务自动挪到今天）
 */
import type { Ref } from "vue"
import type { QuickNoteStorage } from "../types/storage"
import type { TodoItem } from "../types"
import { computed, ref } from "vue"
import { generateId } from "../utils"
import { PRIORITY_META } from "../types"

/** 毫秒时间戳 → 本地日期 YYYY-MM-DD（自动顺延与分组比较用） */
function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** 字符串 YYYY-MM-DD → Date（当天零点），解析失败返回 null */
function parseDateStr(str: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** 日期分组标签：今天 / 明天 / 本周 / 更远 */
export type DateGroup = "today" | "tomorrow" | "week" | "future"

export function useTodoList(storage: QuickNoteStorage) {
  const todos: Ref<TodoItem[]> = ref([])

  /** 从存储加载全部待办，并执行每日自动顺延 */
  const load = async () => {
    const data = await storage.data.loadOrDefault()
    const rolled = rolloverOverdue(data.todos, data.lastRolloverDate)
    todos.value = rolled.list
    if (rolled.changed) {
      await storage.data.save({
        ...data,
        todos: rolled.list,
        lastRolloverDate: rolled.lastRolloverDate,
      })
    }
  }

  /** 写入串行锁：防止快速连续操作时 read-modify-write 读到旧数据 */
  let _saveLock: Promise<void> = Promise.resolve()

  /** 持久化当前待办列表（动作级保存，串行化写操作） */
  const persist = async () => {
    _saveLock = _saveLock
      .catch(() => undefined)
      .then(async () => {
        const data = await storage.data.loadOrDefault()
        await storage.data.save({ ...data, todos: todos.value })
      })
    await _saveLock
  }

  /**
   * 每日自动顺延：若上次顺延日期非今天，将已过期未完成的任务截止日期顺延到今天，
   * 并累计顺延次数。返回是否变更以决定是否需要持久化
   */
  const rolloverOverdue = (
    list: TodoItem[],
    lastRolloverDate: string | null,
  ): { list: TodoItem[], lastRolloverDate: string, changed: boolean } => {
    const today = toDateStr(new Date())
    if (lastRolloverDate === today) {
      return { list, lastRolloverDate: today, changed: false }
    }
    const todayStart = parseDateStr(today)
    let changed = false
    const next = list.map((t) => {
      // 已逾期（截止日期早于今天）且未完成 → 顺延到今天
      if (!t.done && t.dueDate) {
        const due = parseDateStr(t.dueDate)
        if (due && todayStart && due < todayStart) {
          changed = true
          return {
            ...t,
            dueDate: today,
            rolloverCount: t.rolloverCount + 1,
            updatedAt: Date.now(),
          }
        }
      }
      return t
    })
    return { list: next, lastRolloverDate: today, changed }
  }

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

  /** 更新待办内容/优先级/截止日期/关联项目 */
  const update = async (id: string, patch: Partial<Pick<TodoItem, "content" | "priority" | "dueDate" | "projectId">>) => {
    const todo = todos.value.find((t) => t.id === id)
    if (!todo) return
    Object.assign(todo, patch, { updatedAt: Date.now() })
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
  const isOverdue = (t: TodoItem): boolean => {
    if (t.done || !t.dueDate?.trim()) return false
    const due = parseDateStr(t.dueDate)
    if (!due) return false
    const todayStart = parseDateStr(toDateStr(new Date()))
    return todayStart ? due < todayStart : false
  }

  /** 逾期未完成待办（顶部「今天要处理的」聚焦区用，按优先级排序） */
  const overdueTodos = computed(() =>
    todos.value
      .filter((t) => isOverdue(t))
      .sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank),
  )

  /** 未完成待办计数（最小化条徽标用） */
  const pendingCount = computed(() => todos.value.filter((t) => !t.done).length)

  /** 确定某待办所属日期分组 */
  const groupOf = (t: TodoItem): DateGroup => {
    if (!t.dueDate?.trim()) return "future"
    const due = parseDateStr(t.dueDate)
    const todayStart = parseDateStr(toDateStr(new Date()))
    if (!due || !todayStart) return "future"
    const diffDays = Math.round((due.getTime() - todayStart.getTime()) / 86400000)
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
    overdueTodos,
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
    groupOf,
  }
}
