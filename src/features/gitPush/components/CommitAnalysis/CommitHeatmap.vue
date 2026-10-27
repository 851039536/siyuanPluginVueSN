<!-- 提交热力图：GitHub 风格贡献图，周为列 × 7 天为行，格子按当日指标值分级着色（配色/周起始/范围/指标/分档方式由设置驱动）；点击格子查看当日提交 -->
<template>
  <div
    ref="rootEl"
    class="gpa-heat"
    :style="{ '--gpa-heat-weeks': String(totalWeeks), '--gpa-heat-cell': `${cellSizePx}px` }"
  >
    <div
      class="gpa-heat-scroll"
      @scroll="hideTip"
    >
      <!-- 月份标签行（gridColumn 对齐到对应周列首格） -->
      <div class="gpa-heat-months">
        <span
          v-for="m in monthLabels"
          :key="m.key"
          class="gpa-heat-month"
          :style="{ gridColumn: m.col }"
        >{{ m.text }}</span>
      </div>

      <div class="gpa-heat-body">
        <!-- 星期标签列（按 weekStart 显示第 1/3/5 行） -->
        <div class="gpa-heat-weekdays">
          <span
            v-for="w in weekdayLabels"
            :key="w"
            class="gpa-heat-weekday"
          >{{ w }}</span>
        </div>

        <!-- 周列 × 7 行网格（grid-auto-flow: column，末尾补齐完整周）。
             格子是 button：可点击钻取当日明细；整张网格只占一个 Tab 位（roving tabindex + 方向键移动）。
             外层用 role="group" 而非 grid：格子是原生 button，套 grid/gridcell 会破坏其按钮语义。 -->
        <div
          ref="gridEl"
          class="gpa-heat-grid"
          role="group"
          :aria-label="i18n.analysisHeatTitle"
          @keydown="onGridKeydown"
        >
          <button
            v-for="(cell, idx) in cells"
            :key="cell.date || `pad-${idx}`"
            type="button"
            class="gpa-heat-cell"
            :class="{ 'is-empty': !cell.date, 'is-selected': !!cell.date && cell.date === selectedDate }"
            :style="cell.style"
            :aria-label="cell.date ? cell.tooltip : undefined"
            :aria-pressed="cell.date ? cell.date === selectedDate : undefined"
            :tabindex="cell.date && idx === focusIndex ? 0 : -1"
            :data-idx="idx"
            @click="onCellClick(cell.date)"
            @mouseenter="showTip($event, cell)"
            @mouseleave="hideTip"
            @focus="showTip($event, cell)"
            @blur="hideTip"
          />
        </div>
      </div>

      <!-- 图例：少 [0~4 级] 多 + 当前分档口径说明 -->
      <div class="gpa-heat-legend">
        <!-- 图例文案："少" -->
        <span class="gpa-heat-legend-text">{{ i18n.analysisLess }}</span>
        <span
          v-for="lvl in legendCells"
          :key="lvl.level"
          class="gpa-heat-legend-cell"
          :style="lvl.style"
          :title="lvl.hint"
        />
        <!-- 图例文案："多" -->
        <span class="gpa-heat-legend-text">{{ i18n.analysisMore }}</span>
        <span
          class="gpa-heat-scale-hint"
          :title="scaleHintTitle"
        >{{ scaleHint }}</span>
      </div>
    </div>

    <!-- 自绘 tooltip（替代原生 title：即刻出现、可放多行、深色主题下样式可控；pointer-events 关掉避免遮住相邻格） -->
    <div
      v-if="tip"
      class="gpa-heat-tip"
      :class="{ 'is-below': tip.flip }"
      :style="{ left: `${tip.left}px`, top: `${tip.top}px` }"
      role="tooltip"
    >
      <span class="gpa-heat-tip-date">{{ tip.date }} · {{ tip.weekday }}</span>
      <span class="gpa-heat-tip-value">{{ tip.value }}</span>
      <span class="gpa-heat-tip-hint">{{ i18n.analysisHeatTipHint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommitHeatDensity, CommitHeatMetric, CommitHeatScaleMode } from "../../types"
import { computed, ref, watch } from "vue"
import { buildDayCell, formatLocalDate, heatCellColor } from "../../utils"
import { ANALYSIS_MONTH_KEYS, ANALYSIS_WEEKDAY_KEYS, COMMIT_HEAT_METRIC_META, HEAT_CELL_SIZES } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 日值映射（YYYY-MM-DD → 当日指标值，buildDayMetricMap 产出；指标可为提交数/项目数/作者数） */
  dayCounts: Map<string, number>
  /** 范围起止（YYYY-MM-DD，resolveAnalysisRange 格式化产出） */
  start: string
  end: string
  /** 每周第一天（1=周一, 0=周日） */
  weekStart: 0 | 1
  /** 热力主色（#RRGGBB） */
  color: string
  /** 热力档位阈值（首项 0；自适应或固定由父级决定，与日历视图共用同一份以保证同日同色） */
  thresholds: readonly number[]
  /** 当前分档方式（图例右侧口径说明） */
  scaleMode: CommitHeatScaleMode
  /** 当前指标口径（决定 tooltip 量词与图例文案） */
  metric: CommitHeatMetric
  /** 格子密度（12px / 14px；由 CSS 变量 --gpa-heat-cell 驱动整张网格） */
  density: CommitHeatDensity
  /** 已选中日期（YYYY-MM-DD，空串 = 未选中） */
  selectedDate: string
}>()

const emit = defineEmits<{
  /** 点击某日格子（再次点击同日取消选中由父级处理） */
  selectDay: [date: string]
}>()

/**
 * 周列 × 7 行单元格：起点回退到 weekStart 对齐，范围末尾补齐完整周（空单元格隐藏）。
 * 日格的样式与 tooltip 经 utils.buildDayCell 预计算（与日历视图同一口径、同一份阈值）。
 */
const cells = computed<{ date: string, count: number, tooltip: string, style: Record<string, string> }[]>(() => {
  const [sy, sm, sd] = props.start.split("-").map(Number)
  const [ey, em, ed] = props.end.split("-").map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  // 取模而非 while 自减：weekStart 若被异常值污染（设置来自持久化存储，非 0/1 时 while 永不满足）会死循环卡死页面
  const offset = (start.getDay() - props.weekStart + 7) % 7
  start.setDate(start.getDate() - offset)
  const list: { date: string, count: number, tooltip: string, style: Record<string, string> }[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const date = formatLocalDate(cursor)
    list.push(buildDayCell(props.i18n, date, props.dayCounts.get(date) || 0, props.color, {
      thresholds: props.thresholds,
      unitKey: COMMIT_HEAT_METRIC_META[props.metric].unitKey,
    }))
    cursor.setDate(cursor.getDate() + 1)
  }
  const remainder = list.length % 7
  for (let i = 0; i < (7 - remainder) % 7; i++) list.push({ date: "", count: 0, tooltip: "", style: {} })
  return list
})

const totalWeeks = computed(() => Math.ceil(cells.value.length / 7))

/** 格子边长（px）：密度档位唯一的尺寸来源，同时喂给 CSS 变量 --gpa-heat-cell */
const cellSizePx = computed(() => HEAT_CELL_SIZES[props.density])

// ── 自绘 tooltip（原生 title 约 1s 延迟、不能多行、深色主题下样式不可控）──

interface HeatTip {
  /** 相对 .gpa-heat 的定位（px） */
  left: number
  top: number
  /** true = 显示在格子下方（上方空间不足时翻转，避免被面板滚动区裁掉） */
  flip: boolean
  date: string
  weekday: string
  /** "3 次提交" / "2 个项目" */
  value: string
}

const rootEl = ref<HTMLElement | null>(null)
const tip = ref<HeatTip | null>(null)

/** 星期文案（按日期文本解析，避免 UTC 解析在西半球时区跨日偏移） */
function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return props.i18n[ANALYSIS_WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()]] || ""
}

/** 悬停/聚焦时定位 tooltip：用 rect 差值而非 offsetLeft——格子位于横向滚动容器内，offset 不随滚动位移 */
function showTip(e: Event, cell: { date: string, count: number }) {
  if (!cell.date || !rootEl.value) return
  const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const rootRect = rootEl.value.getBoundingClientRect()
  const center = cellRect.left - rootRect.left + cellRect.width / 2
  // tooltip 半宽的粗估值：仅用于贴边收敛，宁可略保守也不让它溢出面板
  const halfWidth = 64
  // 顶部空间不足（工具提示高约 56px）时翻到格子下方，否则会被 Dock 的滚动区裁掉
  const flip = cellRect.top - rootRect.top < 60
  tip.value = {
    left: Math.min(Math.max(center, halfWidth), Math.max(halfWidth, rootRect.width - halfWidth)),
    top: flip ? cellRect.bottom - rootRect.top + 4 : cellRect.top - rootRect.top - 4,
    flip,
    date: cell.date,
    weekday: weekdayOf(cell.date),
    value: `${cell.count} ${props.i18n[COMMIT_HEAT_METRIC_META[props.metric].unitKey] || ""}`,
  }
}

function hideTip() {
  tip.value = null
}

// 数据/设置变更后格子重建，旧 tooltip 指向的日期可能已不在此范围
watch(cells, hideTip)

/** 图例色块（0~4 级）：style 预计算 + 各级下界 tooltip（自适应档的下界随数据与指标变化，不能写死） */
const legendCells = computed(() => {
  const unit = props.i18n[COMMIT_HEAT_METRIC_META[props.metric].unitKey] || ""
  return [0, 1, 2, 3, 4].map((level) => ({
    level,
    style: { background: heatCellColor(level, props.color) },
    hint: level === 0
      ? ""
      : String(props.i18n.analysisHeatLevelRange || "")
          .replace("{0}", String(props.thresholds[level] ?? ""))
          .replace("{1}", unit),
  }))
})

/** 图例右侧口径说明：「项目数 · 自适应」——既交代格子表达什么，也交代深浅怎么分 */
const scaleHint = computed(() => {
  const meta = COMMIT_HEAT_METRIC_META[props.metric]
  const mode = props.scaleMode === "auto" ? props.i18n.analysisHeatScaleAuto : props.i18n.analysisHeatScaleFixed
  return `${props.i18n[meta.labelKey] || ""} · ${mode || ""}`
})

/** 口径说明的完整版（hover 展示，避免长文案挤压图例行） */
const scaleHintTitle = computed(() =>
  props.scaleMode === "auto" ? props.i18n.analysisHeatScaleAutoHint : props.i18n.analysisHeatScaleFixedHint,
)

/** 月份标签：周首格月份变化处落标签（key 含年月保证跨年范围去重） */
const monthLabels = computed(() => {
  const labels: { key: string, text: string, col: number }[] = []
  let lastMonth = -1
  for (let week = 0; week < totalWeeks.value; week++) {
    const cell = cells.value[week * 7]
    if (!cell || !cell.date) continue
    // 直接按 YYYY-MM-DD 文本取月份，避免 new Date 按 UTC 解析在西半球时区月初回退一月
    const m = Number(cell.date.slice(5, 7)) - 1
    if (m !== lastMonth) {
      labels.push({
        key: `${cell.date.slice(0, 7)}-${week}`,
        text: props.i18n[ANALYSIS_MONTH_KEYS[m]] || "",
        col: week + 1,
      })
      lastMonth = m
    }
  }
  return labels
})

/** 左侧星期标签：weekStart 起的第 1/3/5 行（如 周一/周三/周五 或 周日/周二/周四） */
const weekdayLabels = computed(() => {
  const rows = [props.weekStart, (props.weekStart + 2) % 7, (props.weekStart + 4) % 7]
  return rows.map((d) => props.i18n[ANALYSIS_WEEKDAY_KEYS[d]] || "")
})

// ── 键盘可达：整张网格只占一个 Tab 位，方向键在格间移动焦点（365 个格子各自入 Tab 序会毁掉键盘体验）──

const gridEl = ref<HTMLElement | null>(null)

/** 焦点格下标（roving tabindex 的锚点） */
const focusIndex = ref(-1)

/** 最后一个有日期的格子下标（今日或范围内最后一天） */
function lastDatedIndex(list: { date: string }[]): number {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date) return i
  return -1
}

watch(cells, (list) => {
  // 范围/周起始变化后格子重建：原焦点格仍有效就保留，否则回落到最后一天
  if (focusIndex.value >= 0 && list[focusIndex.value]?.date) return
  focusIndex.value = lastDatedIndex(list)
}, { immediate: true })

/** 方向键：左/右跨周（∓7），上/下跨星期（∓1），Home/End 跳首尾；遇补齐空格继续按同方向找 */
function onGridKeydown(e: KeyboardEvent) {
  const step = e.key === "ArrowLeft"
    ? -7
    : e.key === "ArrowRight"
      ? 7
      : e.key === "ArrowUp"
        ? -1
        : e.key === "ArrowDown" ? 1 : 0
  const list = cells.value
  let target = -1
  if (step !== 0) {
    for (let i = focusIndex.value + step; i >= 0 && i < list.length; i += step) {
      if (list[i].date) {
        target = i
        break
      }
    }
  } else if (e.key === "Home") {
    target = list.findIndex((c) => !!c.date)
  } else if (e.key === "End") {
    target = lastDatedIndex(list)
  } else {
    return
  }
  e.preventDefault()
  if (target < 0) return
  focusIndex.value = target
  gridEl.value?.querySelector<HTMLElement>(`[data-idx="${target}"]`)?.focus()
}

/** 点击格子：空占位格不响应（is-empty 已 pointer-events: none，此处再兜一层） */
function onCellClick(date: string) {
  if (date) emit("selectDay", date)
}
</script>

<style lang="scss">
@use "../../styles/CommitHeatmap.scss";
@use "../../styles/index.scss";
</style>
