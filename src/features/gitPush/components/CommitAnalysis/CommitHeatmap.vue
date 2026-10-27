<!-- 提交热力图：贡献图。粒度随跨度自动切换——
     日（周列 × 7 行）/ 周（单行条带）/ 月（年行 × 12 月），配色·周起始·指标·分档方式由设置驱动 -->
<template>
  <div
    ref="rootEl"
    class="gpa-heat"
    :data-grain="granularity"
    :style="{
      '--gpa-heat-cols': String(totalCols),
      '--gpa-heat-rows': String(totalRows),
      '--gpa-heat-cell': `${cellSizePx}px`,
    }"
  >
    <div
      class="gpa-heat-scroll"
      @scroll="hideTip"
    >
      <!-- 列标签行：日/周粒度=月份短名（列首格月份变化处落标签）；月粒度=1~12 月。
           外层与主体共用同一套栅格（有行标签时左侧留出同宽空位），避免用手写 padding 对齐 -->
      <div
        class="gpa-heat-head"
        :class="{ 'is-with-side': hasSideLabels }"
      >
        <span v-if="hasSideLabels" />
        <div class="gpa-heat-col-labels">
          <span
            v-for="l in colLabels"
            :key="l.key"
            class="gpa-heat-label"
            :style="{ gridColumn: l.col }"
          >{{ l.text }}</span>
        </div>
      </div>

      <div
        class="gpa-heat-body"
        :class="{ 'is-with-side': hasSideLabels }"
      >
        <!-- 行标签列：日粒度=第 1/3/5 个星期；月粒度=每年一行 -->
        <div
          v-if="hasSideLabels"
          class="gpa-heat-row-labels"
        >
          <span
            v-for="l in rowLabels"
            :key="l.key"
            class="gpa-heat-label"
            :style="{ gridRow: l.row }"
          >{{ l.text }}</span>
        </div>

        <!-- 格子网格：day/week 列优先（周列 / 单行条带），month 行优先（年行 × 12 月）。
             格子是 button：可拖动/点击框选；整张网格只占一个 Tab 位（roving tabindex + 方向键）。
             外层用 role="group" 而非 grid：格子是原生 button，套 grid/gridcell 会破坏其按钮语义。 -->
        <div
          ref="gridEl"
          class="gpa-heat-grid"
          :class="`is-${granularity}`"
          role="group"
          :aria-label="i18n.analysisHeatTitle"
          @keydown="onGridKeydown"
        >
          <button
            v-for="(cell, idx) in cells"
            :key="cell.start || `pad-${idx}`"
            type="button"
            class="gpa-heat-cell"
            :class="{
              'is-empty': !cell.start,
              'is-selected': !!cell.start && isEndpoint(cell),
              'is-in-range': !!cell.start && isInRange(cell),
            }"
            :style="cell.style"
            :aria-label="cell.start ? cell.tooltip : undefined"
            :aria-pressed="cell.start ? isInRange(cell) : undefined"
            :tabindex="cell.start && idx === focusIndex ? 0 : -1"
            :data-idx="idx"
            @mousedown="onCellDown(cell, $event)"
            @click="onCellClick(cell, $event)"
            @mouseenter="onCellEnter($event, cell)"
            @mouseleave="hideTip"
            @focus="showTip($event, cell)"
            @blur="hideTip"
          />
        </div>
      </div>

      <!-- 图例：少 [0~4 级] 多 + 当前口径说明（指标 · 分档 · 粒度） -->
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
      <span class="gpa-heat-tip-date">{{ tip.date }}</span>
      <span class="gpa-heat-tip-value">{{ tip.value }}</span>
      <span class="gpa-heat-tip-hint">{{ i18n.analysisHeatTipHint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommitHeatDensity, CommitHeatGranularity, CommitHeatMetric, CommitHeatScaleMode } from "../../types"
import type { HeatBucketSpan } from "../../utils"
import { computed, ref, watch } from "vue"
import { useDayDragSelect } from "../../composables/useDayDragSelect"
import { buildHeatBucketCell, buildHeatBuckets, heatCellColor } from "../../utils"
import { ANALYSIS_MONTH_KEYS, ANALYSIS_WEEKDAY_KEYS, COMMIT_HEAT_METRIC_META, HEAT_CELL_SIZES } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 格子值映射（桶首日 YYYY-MM-DD → 聚合值，buildHeatMetricMap 产出） */
  bucketCounts: Map<string, number>
  /** 显示范围起止（YYYY-MM-DD） */
  start: string
  end: string
  /** 格子粒度（由范围跨度决定，见 utils.resolveHeatGranularity） */
  granularity: CommitHeatGranularity
  /** 每周第一天（1=周一, 0=周日） */
  weekStart: 0 | 1
  /** 热力主色（#RRGGBB） */
  color: string
  /** 热力档位阈值（首项 0；自适应或固定由父级决定，与日历视图共用同一份） */
  thresholds: readonly number[]
  /** 当前分档方式（图例口径说明） */
  scaleMode: CommitHeatScaleMode
  /** 当前指标口径（决定 tooltip 量词与图例文案） */
  metric: CommitHeatMetric
  /** 格子密度（12px / 14px；由 CSS 变量 --gpa-heat-cell 驱动整张网格） */
  density: CommitHeatDensity
  /** 选中区间起（YYYY-MM-DD，空串 = 未选中；已归一化为 start ≤ end） */
  selStart: string
  /** 选中区间止（与 selStart 相同即单选一格） */
  selEnd: string
}>()

const emit = defineEmits<{
  /** 单击格子：extend=true（Shift）时以当前锚点为另一端扩展成区间 */
  pick: [span: HeatBucketSpan, extend: boolean]
  /** 拖拽起锚 */
  dragStart: [span: HeatBucketSpan]
  /** 拖拽掠过另一格 */
  dragTo: [span: HeatBucketSpan]
}>()

/** 一个格子：桶区间 + 值 + 预计算样式与 tooltip（占位格 start 为空串） */
interface HeatCell extends HeatBucketSpan {
  value: number
  style: Record<string, string>
  tooltip: string
}

/** 空占位格（补齐行列对齐用） */
function blankCell(): HeatCell {
  return { start: "", end: "", value: 0, style: {}, tooltip: "" }
}

/** 桶区间（按粒度切好，首尾可能被范围边界截断） */
const buckets = computed(() => buildHeatBuckets(props.granularity, props.start, props.end, props.weekStart))

/** 桶首日 → 桶区间（拖拽时把掠过格子的键还原成完整区间） */
const spanByKey = computed(() => {
  const map = new Map<string, HeatBucketSpan>()
  for (const b of buckets.value) map.set(b.start, b)
  return map
})

/** 格子网格（含为使行列对齐而补的占位格） */
const cells = computed<HeatCell[]>(() => {
  const unitKey = COMMIT_HEAT_METRIC_META[props.metric].unitKey
  const list: HeatCell[] = buckets.value.map((b) => buildHeatBucketCell(
    props.i18n,
    b,
    props.bucketCounts.get(b.start) || 0,
    props.color,
    props.granularity,
    { thresholds: props.thresholds, unitKey },
  ))

  if (props.granularity === "day") {
    // 日粒度：起点回退到 weekStart 对齐，末尾补齐完整周（缺一格网格就会错行）
    const [sy, sm, sd] = props.start.split("-").map(Number)
    const lead = (new Date(sy, sm - 1, sd).getDay() - props.weekStart + 7) % 7
    if (lead > 0) list.unshift(...Array.from({ length: lead }, blankCell))
    const tail = (7 - (list.length % 7)) % 7
    if (tail > 0) list.push(...Array.from({ length: tail }, blankCell))
  } else if (props.granularity === "month") {
    // 月粒度：首年补齐起始月之前的空位、末年补齐结束月之后的空位，使每年都是完整 12 列
    const lead = Number(props.start.slice(5, 7)) - 1
    if (lead > 0) list.unshift(...Array.from({ length: lead }, blankCell))
    const tail = (12 - (list.length % 12)) % 12
    if (tail > 0) list.push(...Array.from({ length: tail }, blankCell))
  }
  // 周粒度：单行条带，无需补齐
  return list
})

/** 列数：日=周数；周=格数；月=固定 12 */
const totalCols = computed(() =>
  props.granularity === "day"
    ? Math.ceil(cells.value.length / 7)
    : props.granularity === "week" ? cells.value.length : 12,
)

/** 行数：日=7；周=1；月=年数 */
const totalRows = computed(() =>
  props.granularity === "day" ? 7 : props.granularity === "week" ? 1 : Math.ceil(cells.value.length / 12),
)

/** 是否有行标签列（周粒度是单行条带，没有行维） */
const hasSideLabels = computed(() => props.granularity !== "week")

/** 格子边长（px）：密度档位唯一的尺寸来源，同时喂给 CSS 变量 --gpa-heat-cell */
const cellSizePx = computed(() => HEAT_CELL_SIZES[props.density])

/** 某列的代表格子下标（用于落月份标签）：日粒度取该周第 1 行，周/月粒度取本列首格 */
function columnRepIndex(col: number): number {
  return props.granularity === "day" ? col * 7 : col
}

/** 列标签：日/周粒度按列首格月份变化落月份短名；月粒度固定 1~12 */
const colLabels = computed(() => {
  if (props.granularity === "month") {
    return Array.from({ length: 12 }, (_, i) => ({ key: `m${i}`, text: String(i + 1), col: i + 1 }))
  }
  const labels: { key: string, text: string, col: number }[] = []
  let lastMonth = -1
  for (let col = 0; col < totalCols.value; col++) {
    const cell = cells.value[columnRepIndex(col)]
    if (!cell || !cell.start) continue
    // 直接按 YYYY-MM-DD 文本取月份，避免 new Date 按 UTC 解析在西半球时区月初回退一月
    const m = Number(cell.start.slice(5, 7)) - 1
    if (m !== lastMonth) {
      labels.push({
        key: `${cell.start.slice(0, 7)}-${col}`,
        text: props.i18n[ANALYSIS_MONTH_KEYS[m]] || "",
        col: col + 1,
      })
      lastMonth = m
    }
  }
  return labels
})

/** 行标签：日粒度=weekStart 起的第 1/3/5 个星期；月粒度=每年一行 */
const rowLabels = computed(() => {
  if (props.granularity === "month") {
    const labels: { key: string, text: string, row: number }[] = []
    for (let row = 0; row < totalRows.value; row++) {
      // 首年首列可能是占位格，取该行第一个有日期的格子推年份
      const first = cells.value.slice(row * 12, row * 12 + 12).find((c) => !!c.start)
      if (first) labels.push({ key: `y${row}`, text: first.start.slice(0, 4), row: row + 1 })
    }
    return labels
  }
  const rows = [props.weekStart, (props.weekStart + 2) % 7, (props.weekStart + 4) % 7]
  return rows.map((d, i) => ({ key: `w${d}`, text: props.i18n[ANALYSIS_WEEKDAY_KEYS[d]] || "", row: i * 2 + 1 }))
})

// ── 选中态 ──

/** 是否为区间端点格：与选中区间的起止端对齐（周/月粒度下整格被视为端） */
function isEndpoint(cell: HeatBucketSpan): boolean {
  if (!props.selStart) return false
  return cell.start === props.selStart || cell.end === props.selEnd
}

/** 是否与选中区间有交集（闭区间；粒度比选区粗时部分重叠也算选中） */
function isInRange(cell: HeatBucketSpan): boolean {
  if (!props.selStart) return false
  return cell.end >= props.selStart && cell.start <= props.selEnd
}

// ── 拖拽 / 点击 ──

/** 拖拽选区间（状态机在 composable 里：按下起锚 → 掠过扩展 → mouseup 收尾并抑制补发的 click） */
const drag = useDayDragSelect({
  // composable 只传日期键，桶区间由 spanByKey 还原（日粒度下两者等价）
  onStart: (key) => emit("dragStart", spanByKey.value.get(key) || { start: key, end: key }),
  onExtend: (key) => emit("dragTo", spanByKey.value.get(key) || { start: key, end: key }),
})

/** 空占位格没有桶区间，拖拽/点击一律忽略 */
function spanOf(cell: HeatBucketSpan): HeatBucketSpan | null {
  return cell.start ? { start: cell.start, end: cell.end } : null
}

function onCellDown(cell: HeatBucketSpan, e: MouseEvent) {
  const span = spanOf(cell)
  if (!span) return
  drag.onDown(span.start, e)
}

function onCellClick(cell: HeatBucketSpan, e: MouseEvent) {
  const span = spanOf(cell)
  if (!span) return
  // 拖拽收尾时浏览器补发的 click：丢掉，否则「拖回起点」会把刚选好的区间又取消
  if (drag.suppressClick.value) return
  emit("pick", span, e.shiftKey)
}

/** 掠过格子：拖拽中扩展区间，否则显示 tooltip */
function onCellEnter(e: Event, cell: HeatCell) {
  if (drag.dragging.value) {
    if (cell.start) drag.onEnter(cell.start)
    hideTip()
    return
  }
  showTip(e, cell)
}

// ── 自绘 tooltip（原生 title 约 1s 延迟、不能多行、深色主题下样式不可控）──

interface HeatTip {
  /** 相对 .gpa-heat 的定位（px） */
  left: number
  top: number
  /** true = 显示在格子下方（上方空间不足时翻转，避免被面板滚动区裁掉） */
  flip: boolean
  /** 日期 / 日期区间 */
  date: string
  /** "3 次提交" / "2 个项目" */
  value: string
}

const rootEl = ref<HTMLElement | null>(null)
const tip = ref<HeatTip | null>(null)

/** 星期文案（按日期文本解析，避免 UTC 解析在西半球时区跨日偏移）；日粒度 tooltip 第一行带星期 */
function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return props.i18n[ANALYSIS_WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()]] || ""
}

/** 悬停/聚焦时定位 tooltip：用 rect 差值而非 offsetLeft——格子位于横向滚动容器内，offset 不随滚动位移 */
function showTip(e: Event, cell: HeatCell) {
  // 拖拽中不弹浮层：它会盖住正被掠过的格子，且区间在实时变化，读数没有意义
  if (!cell.start || !rootEl.value || drag.dragging.value) return
  const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const rootRect = rootEl.value.getBoundingClientRect()
  const center = cellRect.left - rootRect.left + cellRect.width / 2
  // tooltip 半宽的粗估值：仅用于贴边收敛，宁可略保守也不让它溢出面板
  const halfWidth = 72
  // 顶部空间不足（工具提示高约 56px）时翻到格子下方，否则会被 Dock 的滚动区裁掉
  const flip = cellRect.top - rootRect.top < 60
  tip.value = {
    left: Math.min(Math.max(center, halfWidth), Math.max(halfWidth, rootRect.width - halfWidth)),
    top: flip ? cellRect.bottom - rootRect.top + 4 : cellRect.top - rootRect.top - 4,
    flip,
    date: cell.start === cell.end ? `${cell.start} · ${weekdayOf(cell.start)}` : `${cell.start} – ${cell.end}`,
    value: `${cell.value} ${props.i18n[COMMIT_HEAT_METRIC_META[props.metric].unitKey] || ""}`,
  }
}

function hideTip() {
  tip.value = null
}

// 数据/设置变更后格子重建，旧 tooltip 指向的格子可能已不在此范围
watch(cells, hideTip)

/** 图例色块（0~4 级）：style 预计算 + 各级下界 tooltip（自适应档的下界随数据、指标与粒度变化，不能写死） */
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

/** 图例右侧口径说明：「项目数 · 自适应 · 按月」——交代格子表达什么、深浅怎么分、一格有多久 */
const scaleHint = computed(() => {
  const meta = COMMIT_HEAT_METRIC_META[props.metric]
  const mode = props.scaleMode === "auto" ? props.i18n.analysisHeatScaleAuto : props.i18n.analysisHeatScaleFixed
  const grainValue = {
    day: props.i18n.analysisHeatGrainDay,
    week: props.i18n.analysisHeatGrainWeek,
    month: props.i18n.analysisHeatGrainMonth,
  }[props.granularity]
  return [props.i18n[meta.labelKey], mode, grainValue].filter(Boolean).join(" · ")
})

/** 口径说明的完整版（hover 展示，避免长文案挤压图例行） */
const scaleHintTitle = computed(() =>
  props.scaleMode === "auto" ? props.i18n.analysisHeatScaleAutoHint : props.i18n.analysisHeatScaleFixedHint,
)

// ── 键盘可达：整张网格只占一个 Tab 位，方向键在格间移动焦点（371 个格子各自入 Tab 序会毁掉键盘体验）──

const gridEl = ref<HTMLElement | null>(null)

/** 焦点格下标（roving tabindex 的锚点） */
const focusIndex = ref(-1)

/** 最后一个有日期的格子下标 */
function lastFilledIndex(list: { start: string }[]): number {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].start) return i
  return -1
}

watch(cells, (list) => {
  // 范围/粒度/周起始变化后格子重建：原焦点格仍有效就保留，否则回落到最后一天
  if (focusIndex.value >= 0 && list[focusIndex.value]?.start) return
  focusIndex.value = lastFilledIndex(list)
}, { immediate: true })

/**
 * 方向键步长按粒度折算：日粒度 ←→ 跨周（∓7）、↑↓ 跨星期（∓1）；
 * 周粒度只有一维条带（∓1）；月粒度 ←→ 跨月（∓1）、↑↓ 跨年（∓12）。
 * Shift + 方向键 = 把区间另一端推到新焦点（与 Shift+点击 同一语义，键盘也能框选）。
 */
function stepOf(key: string): number {
  const horizontal = props.granularity === "day" ? 7 : 1
  const vertical = props.granularity === "day" ? 1 : props.granularity === "month" ? 12 : 0
  if (key === "ArrowLeft") return -horizontal
  if (key === "ArrowRight") return horizontal
  if (key === "ArrowUp") return -vertical
  if (key === "ArrowDown") return vertical
  return 0
}

function onGridKeydown(e: KeyboardEvent) {
  const step = stepOf(e.key)
  const list = cells.value
  let target = -1
  if (step !== 0) {
    // 遇补齐的占位格继续按同方向找，不让焦点停在空位上
    for (let i = focusIndex.value + step; i >= 0 && i < list.length; i += step) {
      if (list[i].start) {
        target = i
        break
      }
    }
  } else if (e.key === "Home") {
    target = list.findIndex((c) => !!c.start)
  } else if (e.key === "End") {
    target = lastFilledIndex(list)
  } else {
    return
  }
  e.preventDefault()
  if (target < 0) return
  focusIndex.value = target
  gridEl.value?.querySelector<HTMLElement>(`[data-idx="${target}"]`)?.focus()
  const cell = list[target]
  if (e.shiftKey && cell.start) emit("pick", { start: cell.start, end: cell.end }, true)
}
</script>

<style lang="scss">
@use "../../styles/CommitHeatmap.scss";
@use "../../styles/index.scss";
</style>
