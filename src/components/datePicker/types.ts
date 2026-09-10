/**
 * DatePicker 共享类型与文案常量（入口组件与日历/月年面板共用，禁止重复定义）
 */

export type DatePickerSize = "xsmall" | "small" | "medium" | "large"

/** 面板视图：日网格 / 12 月宫格 / 十年跨度 */
export type PickerView = "date" | "month" | "year"

export type DatePickerSelectionMode = "single" | "range"

/** 输入侧接受 Date / 字符串（valueFormat 时）/ 区间数组；输出侧形态由 valueFormat 决定 */
export type DatePickerValue = Date | Date[] | string | string[] | null

/** 禁用日期：显式日期数组，或自定义判定函数 */
export type DisabledDates = Date[] | ((date: Date) => boolean)

/** 四类禁用约束收敛后的判定入参（网格层与视图层共用同一份） */
export interface DisabledOptions {
  minDate?: Date | null
  maxDate?: Date | null
  /** 禁用的星期几（0=周日 … 6=周六） */
  disabledDays?: number[]
  /** disabledDates 为数组时预处理出的「当日零点时间戳」集合 */
  disabledTimestamps?: Set<number>
  /** disabledDates 为函数时的判定回调 */
  disabledDatesFn?: (date: Date) => boolean
}

/** 单个日期单元格的完整元数据（一次性预计算，模板只读，同时作为 date 插槽的 scope 载荷） */
export interface CalendarCell {
  date: Date
  /** 是否属于当前显示月份（非本月日期弱化显示） */
  inCurrentMonth: boolean
  disabled: boolean
  today: boolean
  selected: boolean
  /** 位于区间内部（不含两端） */
  inRange: boolean
  rangeStart: boolean
  rangeEnd: boolean
}

/** 生成日期网格所需的上下文（全部由调用方注入，保证纯函数可测） */
export interface CalendarCellContext {
  /** 面板当前显示的年份 */
  year: number
  /** 面板当前显示的月份（0-11） */
  month: number
  /** 一周起始日（0=周日 … 6=周六） */
  firstDayOfWeek: number
  /** 已选日期（0/1/2 个；仅 1 个时为区间选择中的起点） */
  selected: Date[]
  /** 区间预览的悬停日期 */
  hoverDate: Date | null
  /** 今日（调用方传入，避免纯函数内部读取系统时钟） */
  today: Date
  disabled: DisabledOptions
}

/** 格式化模板中「星期名 / 月份名」两套文案的取值来源 */
export interface FormatLabels {
  weekdayShort: string[]
  weekdayFull: string[]
  monthShort: string[]
  monthFull: string[]
}

// ========== 文案常量（中文优先，调用方可用同名 props 覆盖） ==========

/** 星期短名（表头与 `D` 令牌），索引 0 = 周日 */
export const WEEKDAY_LABELS: string[] = ["日", "一", "二", "三", "四", "五", "六"]

/** 星期全名（`DD` 令牌），索引 0 = 周日 */
export const WEEKDAY_FULL_LABELS: string[] = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
]

/** 月份短名（月视图宫格与 `M` 令牌），索引 0 = 一月 */
export const MONTH_LABELS: string[] = [
  "1 月",
  "2 月",
  "3 月",
  "4 月",
  "5 月",
  "6 月",
  "7 月",
  "8 月",
  "9 月",
  "10 月",
  "11 月",
  "12 月",
]

/** 月份全名（`MM` 令牌），索引 0 = 一月 */
export const MONTH_FULL_LABELS: string[] = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
]

/** 格式化模板的默认文案取值 */
export const DEFAULT_FORMAT_LABELS: FormatLabels = {
  weekdayShort: WEEKDAY_LABELS,
  weekdayFull: WEEKDAY_FULL_LABELS,
  monthShort: MONTH_LABELS,
  monthFull: MONTH_FULL_LABELS,
}

// ========== 布局常量 ==========

/** 日期网格固定 6 行 × 7 列 = 42 格 */
export const CALENDAR_ROWS = 6
export const CALENDAR_COLS = 7

/** 年视图一次的跨度（十年） */
export const YEAR_VIEW_SPAN = 10

/** 面板无障碍文案（导航按钮与弹层命名，中文默认值可整体覆盖） */
export interface DatePickerAriaLabels {
  /** 日历按钮与弹层的可访问名称（PrimeVue 的 chooseDate 语义） */
  chooseDate: string
  prevMonth: string
  nextMonth: string
  prevYear: string
  nextYear: string
  prevDecade: string
  nextDecade: string
  prevCentury: string
  nextCentury: string
}

export const DEFAULT_ARIA_LABELS: DatePickerAriaLabels = {
  chooseDate: "选择日期",
  prevMonth: "上个月",
  nextMonth: "下个月",
  prevYear: "上一年",
  nextYear: "下一年",
  prevDecade: "上一个十年",
  nextDecade: "下一个十年",
  prevCentury: "上一个世纪",
  nextCentury: "下一个世纪",
}
