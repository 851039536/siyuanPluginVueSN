/**
 * DatePicker 入口逻辑：弹层开合与定位、值形态适配、输入框交互（纯逻辑，无模板）
 * 由 DatePicker.vue 在 setup 中调用，模板只消费其返回值
 */
import type { Ref } from "vue"
import type {
  DatePickerSelectionMode,
  DatePickerValue,
  DisabledDates,
  DisabledOptions,
} from "./types"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import {
  formatDate,
  parseDate,
} from "./formatUtils"
import {
  buildDisabledOptions,
  buildModelValue,
  clampDate,
  isDateDisabled,
  normalizeRange,
  resolveModelDates,
  startOfDay,
} from "./utils"

/** 入口组件 props 中被本 composable 消费的字段（结构化子集，避免跨文件复用 defineProps 类型） */
export interface DatePickerSource {
  modelValue: DatePickerValue
  selectionMode: DatePickerSelectionMode
  dateFormat: string
  valueFormat: boolean
  disabled: boolean
  readonly: boolean
  manualInput: boolean
  placement: "top" | "bottom" | "auto"
  minDate: Date | null
  maxDate: Date | null
  disabledDates: DisabledDates | undefined
  disabledDays: number[]
  /** 占位文本（空串时按模式取默认中文文案） */
  placeholder: string
}

/** 入口组件需要对外派发的事件回调 */
export interface DatePickerEmitters {
  update: (value: DatePickerValue) => void
  change: (value: DatePickerValue) => void
  visibleChange: (visible: boolean) => void
  clear: () => void
  focus: (event: FocusEvent) => void
}

/** 面板实例暴露的焦点方法 */
export interface DatePickerPanelHandle {
  focusGrid: () => void
}

/** 面板高度估算值（仅用于弹层上下空间择向） */
const PANEL_ESTIMATED_HEIGHT = 300

export function useDatePicker(deps: {
  props: DatePickerSource
  emit: DatePickerEmitters
  inputRef: Ref<HTMLInputElement | undefined>
  wrapperRef: Ref<HTMLElement | undefined>
  panelRef: Ref<DatePickerPanelHandle | undefined>
}) {
  const {
    props,
    emit,
    inputRef,
    wrapperRef,
    panelRef,
  } = deps

  const isOpen = ref(false)
  const resolvedPlacement = ref<"top" | "bottom">("bottom")
  /** 今日（随每次打开刷新，避免跨零点后陈旧） */
  const today = ref(startOfDay(new Date()))
  const liveText = ref("")
  /** 关闭面板后主动交还焦点给输入框时的抑制标记（否则 focus 事件会立刻重新打开面板） */
  const skipFocusOpen = ref(false)

  /** 四类禁用约束收敛为单一判定入参（数组形式预处理为 Set，O(n) → O(1)） */
  const disabledOptions = computed<DisabledOptions>(() => buildDisabledOptions(props.disabledDates, {
    minDate: props.minDate,
    maxDate: props.maxDate,
    disabledDays: props.disabledDays,
  }))

  const selectedDates = computed<Date[]>(() => resolveModelDates(props.modelValue))
  const isRange = computed(() => props.selectionMode === "range")
  const hasValue = computed(() => selectedDates.value.length > 0)

  const resolvedPlaceholder = computed(() =>
    props.placeholder || (isRange.value ? "请选择日期范围" : "请选择日期"),
  )

  const displayText = computed(() => {
    const dates = selectedDates.value
    if (dates.length === 0) {
      return ""
    }
    if (!isRange.value) {
      return formatDate(dates[0], props.dateFormat)
    }
    const start = formatDate(dates[0], props.dateFormat)
    // 仅选了起点时以「— 」示意区间未完成
    return dates.length > 1
      ? `${start} — ${formatDate(dates[1], props.dateFormat)}`
      : `${start} — `
  })

  /** 隐藏 aria-live 播报区文案（选中结果变化时更新） */
  const buildLiveText = (dates: Date[]) =>
    dates
      .map((date) => `${formatDate(date, "yy-mm-dd")} ${formatDate(date, "DD")}`)
      .join(" 至 ")

  const resolvePlacement = () => {
    if (props.placement !== "auto" || !wrapperRef.value) {
      resolvedPlacement.value = props.placement === "top" ? "top" : "bottom"
      return
    }

    const rect = wrapperRef.value.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow >= PANEL_ESTIMATED_HEIGHT) {
      resolvedPlacement.value = "bottom"
      return
    }
    if (spaceAbove >= PANEL_ESTIMATED_HEIGHT) {
      resolvedPlacement.value = "top"
      return
    }
    resolvedPlacement.value = spaceBelow >= spaceAbove ? "bottom" : "top"
  }

  /** 提交新的日期数组（统一走值形态适配，避免各调用点重复组装） */
  const commit = (dates: Date[]) => {
    const value = buildModelValue(dates, {
      selectionMode: props.selectionMode,
      valueFormat: props.valueFormat,
      dateFormat: props.dateFormat,
    })
    emit.update(value)
    emit.change(value)
    liveText.value = buildLiveText(dates)
  }

  const openPanel = (focusGrid = false) => {
    if (props.disabled) {
      return
    }

    today.value = startOfDay(new Date())
    isOpen.value = true
    emit.visibleChange(true)

    nextTick(() => {
      resolvePlacement()
      if (focusGrid) {
        panelRef.value?.focusGrid()
      }
    })
  }

  const closePanel = () => {
    if (!isOpen.value) {
      return
    }
    isOpen.value = false
    emit.visibleChange(false)
  }

  /** 关闭面板并把焦点交还输入框（带抑制标记，避免 focus 立即重开面板） */
  const closePanelAndRefocus = () => {
    closePanel()
    skipFocusOpen.value = true
    inputRef.value?.focus()
    nextTick(() => {
      skipFocusOpen.value = false
    })
  }

  const togglePanel = () => {
    if (isOpen.value) {
      closePanelAndRefocus()
      return
    }
    openPanel(true)
  }

  const handleEscape = () => {
    if (!isOpen.value) {
      return
    }
    closePanelAndRefocus()
  }

  const handleInputFocus = (event: FocusEvent) => {
    emit.focus(event)
    if (!skipFocusOpen.value && !isOpen.value) {
      openPanel(false)
    }
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (props.disabled) {
      return
    }
    if (event.key === "Escape") {
      handleEscape()
      return
    }
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      return
    }
    // 手输模式下把按键留给原生输入流程（Enter/change 提交解析结果）
    if (!isRange.value && props.manualInput && !props.readonly) {
      return
    }

    event.preventDefault()
    if (!isOpen.value) {
      openPanel(false)
    }
    nextTick(() => panelRef.value?.focusGrid())
  }

  /** 手输解析（仅单选模式生效）：失败则回滚为上一个有效显示值 */
  const handleManualInput = (event: Event) => {
    const element = event.target as HTMLInputElement
    const text = element.value.trim()

    if (text === displayText.value.trim()) {
      return
    }
    if (!text) {
      handleClear()
      return
    }

    const parsed = parseDate(text, props.dateFormat)
    if (!parsed || isDateDisabled(parsed, disabledOptions.value)) {
      element.value = displayText.value
      return
    }

    commit([parsed])
  }

  const handleDateSelect = (date: Date) => {
    const day = startOfDay(date)

    if (!isRange.value) {
      commit([day])
      closePanelAndRefocus()
      return
    }

    const current = selectedDates.value
    // 无选中或区间已完成 → 以本次点击重新开始选择
    if (current.length !== 1) {
      commit([day])
      return
    }

    commit(normalizeRange(current[0], day))
    closePanelAndRefocus()
  }

  const handleSelectToday = () => {
    const date = clampDate(today.value, disabledOptions.value)
    // 夹取后仍被禁用（如 disabledDays 命中今天）则不响应，避免提交非法值
    if (isDateDisabled(date, disabledOptions.value)) {
      return
    }
    handleDateSelect(date)
  }

  const handleClear = () => {
    commit([])
    emit.clear()
    closePanelAndRefocus()
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
      closePanel()
    }
  }

  onMounted(() => {
    document.addEventListener("click", handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside)
  })

  return {
    isOpen,
    resolvedPlacement,
    today,
    liveText,
    disabledOptions,
    selectedDates,
    isRange,
    hasValue,
    displayText,
    resolvedPlaceholder,
    openPanel,
    closePanel,
    togglePanel,
    handleEscape,
    handleInputFocus,
    handleInputKeydown,
    handleManualInput,
    handleDateSelect,
    handleSelectToday,
    handleClear,
  }
}
