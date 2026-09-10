/**
 * DatePicker 日期纯函数库：基础日期运算、网格生成、禁用判定与值形态转换
 * 不依赖 Vue 响应式；dateFormat 模板引擎见 formatUtils.ts
 */
import type {
  CalendarCell,
  CalendarCellContext,
  DatePickerSelectionMode,
  DatePickerValue,
  DisabledDates,
  DisabledOptions,
  PickerView,
} from "./types"
import {
  CALENDAR_COLS,
  CALENDAR_ROWS,
  YEAR_VIEW_SPAN,
} from "./types"
import { formatDate } from "./formatUtils"

// ========== 基础日期工具 ==========

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/** 归一到当日零点（保留本地时区语义） */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * 无时区的纯日期/日期时间字符串（YYYY-MM-DD 的任意省略形式）
 * 这类字符串必须按「本地时间」解析：原生 `new Date("2026-09-10")` 按 UTC 解析，
 * 在西半球时区会退到前一天，与 formatDate 的本地输出无法往返一致
 */
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/

/** 标准日期字符串 → 本地时间 Date（非该格式返回 null，交由原生解析兜底） */
function toLocalDate(value: string): Date | null {
  const matched = LOCAL_DATE_PATTERN.exec(value.trim())
  if (!matched) {
    return null
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = matched
  const local = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  return isValidDate(local) ? local : null
}

/** 宽松转 Date：接受 Date / 时间戳 / 字符串（无时区字符串按本地时间解析）；非法返回 null */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null
  }
  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null
  }
  if (typeof value === "string") {
    return toLocalDate(value) ?? toDate(new Date(value))
  }
  if (typeof value === "number") {
    const date = new Date(value)
    return isValidDate(date) ? date : null
  }
  return null
}

/** 月份加减（钉在当月 1 日，避免 1/31 加一月溢出到 3/3） */
export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** 年视图的十年跨度年份清单（2026 → 2020…2029） */
export function getDecadeYears(year: number): number[] {
  const start = Math.floor(year / YEAR_VIEW_SPAN) * YEAR_VIEW_SPAN
  return Array.from({ length: YEAR_VIEW_SPAN }, (_, index) => start + index)
}

// ========== 网格生成 ==========

/** 生成 6×7=42 个日期（含前后补位的非本月日期），首日按 firstDayOfWeek 对齐 */
export function getMonthGridDates(year: number, month: number, firstDayOfWeek: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  // 本月 1 日相对一周起始日的偏移（0~6），据此回退得到网格首日
  const offset = (firstOfMonth.getDay() - firstDayOfWeek + 7) % 7
  const gridStart = new Date(year, month, 1 - offset)
  const total = CALENDAR_ROWS * CALENDAR_COLS

  return Array.from({ length: total }, (_, index) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index),
  )
}

/** 由已选日期 + 悬停日期推导高亮区间（完成态取前两个；选择中取起点与悬停点） */
function resolveHighlightRange(selected: Date[], hoverDate: Date | null): [Date, Date] | null {
  if (selected.length >= 2) {
    return normalizeRange(selected[0], selected[1])
  }
  if (selected.length === 1 && hoverDate) {
    return normalizeRange(selected[0], hoverDate)
  }
  return null
}

/** 生成 42 格单元格元数据（一次性预计算：模板只读，同时作为 date 插槽的 scope 载荷） */
export function buildCalendarCells(context: CalendarCellContext): CalendarCell[] {
  const {
    year,
    month,
    firstDayOfWeek,
    selected,
    hoverDate,
    today,
    disabled,
  } = context
  const range = resolveHighlightRange(selected, hoverDate)
  const todayTime = startOfDay(today).getTime()
  const rangeStartTime = range ? range[0].getTime() : Number.NaN
  const rangeEndTime = range ? range[1].getTime() : Number.NaN

  return getMonthGridDates(year, month, firstDayOfWeek).map((date) => {
    const time = date.getTime()

    return {
      date,
      inCurrentMonth: date.getFullYear() === year && date.getMonth() === month,
      disabled: isDateDisabled(date, disabled),
      today: time === todayTime,
      selected: selected.some((item) => isSameDay(item, date)),
      inRange: !!range && time > rangeStartTime && time < rangeEndTime,
      rangeStart: !!range && time === rangeStartTime,
      rangeEnd: !!range && time === rangeEndTime,
    }
  })
}

// ========== 禁用判定 ==========

/**
 * 把数组形式的 disabledDates 预处理为「当日零点时间戳」集合
 * 将逐格 includes 的 O(n) 降为 O(1)（42 格 × n 次线性查找 → 42 次哈希查找）
 */
export function buildDisabledOptions(
  source: DisabledDates | undefined,
  base: Omit<DisabledOptions, "disabledTimestamps" | "disabledDatesFn">,
): DisabledOptions {
  if (Array.isArray(source)) {
    const disabledTimestamps = new Set<number>()
    for (const item of source) {
      const date = toDate(item)
      if (date) {
        disabledTimestamps.add(startOfDay(date).getTime())
      }
    }
    return { ...base, disabledTimestamps }
  }

  return {
    ...base,
    disabledDatesFn: typeof source === "function" ? source : undefined,
  }
}

/** 是否存在任何禁用约束（无约束时视图层可跳过全量遍历） */
export function hasDisabledConstraints(options: DisabledOptions): boolean {
  return !!options.minDate
    || !!options.maxDate
    || (options.disabledDays?.length ?? 0) > 0
    || (options.disabledTimestamps?.size ?? 0) > 0
    || typeof options.disabledDatesFn === "function"
}

/** 四类约束统一判定：minDate / maxDate / disabledDays / disabledDates（数组或函数） */
export function isDateDisabled(date: Date, options: DisabledOptions): boolean {
  const day = startOfDay(date)
  const time = day.getTime()

  if (options.minDate && time < startOfDay(options.minDate).getTime()) {
    return true
  }
  if (options.maxDate && time > startOfDay(options.maxDate).getTime()) {
    return true
  }
  if (options.disabledDays?.includes(day.getDay())) {
    return true
  }
  if (options.disabledTimestamps?.has(time)) {
    return true
  }
  if (options.disabledDatesFn?.(day)) {
    return true
  }
  return false
}

/** 该月是否整体不可选（月视图用） */
export function isMonthDisabled(year: number, month: number, options: DisabledOptions): boolean {
  if (!hasDisabledConstraints(options)) {
    return false
  }
  const days = getDaysInMonth(year, month)
  for (let day = 1; day <= days; day++) {
    if (!isDateDisabled(new Date(year, month, day), options)) {
      return false
    }
  }
  return true
}

/** 该年是否整体不可选（年视图用） */
export function isYearDisabled(year: number, options: DisabledOptions): boolean {
  if (!hasDisabledConstraints(options)) {
    return false
  }
  for (let month = 0; month < 12; month++) {
    if (!isMonthDisabled(year, month, options)) {
      return false
    }
  }
  return true
}

// ========== 区间与夹取 ==========

/** 起止排序 + 归零点，保证区间合法 */
export function normalizeRange(a: Date, b: Date): [Date, Date] {
  const first = startOfDay(a)
  const second = startOfDay(b)
  return first.getTime() <= second.getTime() ? [first, second] : [second, first]
}

/** 把日期夹取到 [minDate, maxDate] 内（「今天」快捷按钮用） */
export function clampDate(date: Date, options: DisabledOptions): Date {
  let result = startOfDay(date)
  if (options.minDate && result.getTime() < startOfDay(options.minDate).getTime()) {
    result = startOfDay(options.minDate)
  }
  if (options.maxDate && result.getTime() > startOfDay(options.maxDate).getTime()) {
    result = startOfDay(options.maxDate)
  }
  return result
}

// ========== 值形态转换 ==========

/** 把外部 modelValue 归一为内部 Date 数组（区间取前两个，非法项丢弃） */
export function resolveModelDates(value: DatePickerValue): Date[] {
  if (value === null || value === undefined) {
    return []
  }

  const list = Array.isArray(value) ? value : [value]
  return list.reduce<Date[]>((acc, item) => {
    const date = toDate(item)
    if (date) {
      acc.push(startOfDay(date))
    }
    return acc
  }, [])
}

/** 把内部 Date 数组按模式与 valueFormat 组装回 modelValue（空值统一返回 null） */
export function buildModelValue(
  dates: Date[],
  options: {
    selectionMode: DatePickerSelectionMode
    valueFormat: boolean
    dateFormat: string
  },
): DatePickerValue {
  if (dates.length === 0) {
    return null
  }

  const isRange = options.selectionMode === "range"
  const list = isRange ? dates.slice(0, 2) : dates.slice(0, 1)

  // 字符串与 Date 两条分支分别成组，避免 map 产生 (string | Date)[] 这类混合元素类型
  if (options.valueFormat) {
    const texts = list.map((date) => formatDate(date, options.dateFormat))
    return isRange ? texts : texts[0]
  }

  const days = list.map((date) => startOfDay(date))
  return isRange ? days : days[0]
}

/** 面板标题文案（日视图「2026 年 9 月」；月视图「2026 年」；年视图「2020 - 2029」） */
export function formatPanelTitle(view: PickerView, year: number, month: number): string {
  if (view === "date") {
    return `${year} 年 ${month + 1} 月`
  }
  if (view === "month") {
    return `${year} 年`
  }
  const years = getDecadeYears(year)
  return `${years[0]} - ${years[years.length - 1]}`
}
