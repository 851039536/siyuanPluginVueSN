<!--
  gitPush diff 共享渲染片段：图例 + 视图开关（统一 / 并排 / 自适应、行号、仅改动）+ 着色行。
  供工作区差异弹窗与提交内差异弹窗复用；宿主只负责弹窗外壳与数据下发，不关心行怎么摆。
-->
<template>
  <!-- 视图栏（审阅流把这条提到弹窗顶部全局共用，由 showBar=false 关闭单个文件上的重复条） -->
  <DiffViewBar
    v-if="showBar"
    v-model:layout="layout"
    v-model:show-line-numbers="showLineNumbers"
    v-model:only-changes="onlyChanges"
    :i18n="i18n"
  />

  <!-- diff 内容区（空态 / 着色行） -->
  <div
    ref="contentEl"
    class="wt-diff-content"
  >
    <div
      v-if="!renderedLines.length"
      class="wt-diff-empty"
    >
      {{ i18n.diffEmpty }}
    </div>

    <!-- 并排视图：左右单元格按配对行对齐，hunk / meta / 折叠条跨整行 -->
    <template v-else-if="isSplit">
      <div
        v-for="(row, i) in splitRows"
        :key="i"
        class="wt-diff-row"
        :class="row.full ? `wt-diff-line wt-dl-${row.full.type}` : 'wt-dr-split'"
        :data-chg="isChangeRow(row) ? '1' : undefined"
      >
        <template v-if="row.full">
          <span
            v-if="row.full.type === 'gap'"
            class="wt-dl-gap-text"
          >{{ gapLabel(row.full) }}</span>
          <template v-else>
            <!-- 跨整行的 hunk/meta：只留一列行号占位，符号列才能与左侧单元格对齐 -->
            <span
              v-if="showLineNumbers"
              class="wt-dl-no"
            ></span>
            <span class="wt-dl-sign">{{ DIFF_SIGN[row.full.type] }}</span>
            <DiffLineText :line="row.full" />
          </template>
        </template>
        <template v-else>
          <!-- 左（旧文件）单元格 -->
          <div
            class="wt-ds-cell"
            :class="cellClasses(row.left)"
          >
            <span
              v-if="showLineNumbers"
              class="wt-dl-no"
            >{{ row.left?.oldNo ?? "" }}</span>
            <span class="wt-dl-sign">{{ row.left ? DIFF_SIGN[row.left.type] : "" }}</span>
            <DiffLineText
              v-if="row.left"
              :line="row.left"
            />
          </div>
          <!-- 右（新文件）单元格 -->
          <div
            class="wt-ds-cell"
            :class="cellClasses(row.right)"
          >
            <span
              v-if="showLineNumbers"
              class="wt-dl-no"
            >{{ row.right?.newNo ?? "" }}</span>
            <span class="wt-dl-sign">{{ row.right ? DIFF_SIGN[row.right.type] : "" }}</span>
            <DiffLineText
              v-if="row.right"
              :line="row.right"
            />
          </div>
        </template>
      </div>
    </template>

    <!-- 统一视图：旧/新行号双列 + 符号列 + 文本 -->
    <template v-else>
      <div
        v-for="(line, i) in renderedLines"
        :key="i"
        class="wt-diff-line"
        :class="`wt-dl-${line.type}`"
        :data-chg="line.type === 'add' || line.type === 'del' ? '1' : undefined"
      >
        <!-- 折叠条：两个 hunk 之间被 git 省略的未变行数 -->
        <span
          v-if="line.type === 'gap'"
          class="wt-dl-gap-text"
        >{{ gapLabel(line) }}</span>
        <template v-else>
          <!-- 旧/新文件行号双列（hunk/meta 行无行号，留空保持对齐） -->
          <span
            v-if="showLineNumbers"
            class="wt-dl-no"
          >{{ line.oldNo ?? "" }}</span>
          <span
            v-if="showLineNumbers"
            class="wt-dl-no"
          >{{ line.newNo ?? "" }}</span>
          <span class="wt-dl-sign">{{ DIFF_SIGN[line.type] }}</span>
          <DiffLineText :line="line" />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush diff 共享渲染片段（纯展示：视图开关 + 着色行，宿主负责 header 与容器布局）
import type { DiffLayout, DiffLine, DiffSplitRow } from "../../utils"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { DIFF_SIGN, filterOnlyChanges, isChangeLine, toSplitRows } from "../../utils"
import DiffLineText from "./DiffLineText.vue"
import DiffViewBar from "./DiffViewBar.vue"

const props = withDefaults(defineProps<{
  i18n: Record<string, any>
  /** 已解析的 diff 行数组（由宿主经 parseDiffLines 产出） */
  lines: DiffLine[]
  /** 是否渲染顶部的图例 + 视图开关（审阅流多处并排时由宿主在弹窗顶部统一提供） */
  showBar?: boolean
}>(), { showBar: true })

/** 视图布局（自适应 = 按可用宽度在统一 / 并排之间切换） */
const layout = defineModel<DiffLayout>("layout", { default: "auto" })
/** 是否显示行号列 */
const showLineNumbers = defineModel<boolean>("showLineNumbers", { default: true })
/** 仅改动：隐去未变行与折叠条（过滤在宿主的分页之前完成，此处只做开关状态） */
const onlyChanges = defineModel<boolean>("onlyChanges", { default: false })

/**
 * 并排视图的最小可用宽度：每列低于约 440px 时代码折行严重，
 * 并排反而比统一视图更难读，此时自适应回退为统一。
 */
const SPLIT_MIN_WIDTH = 880
/**
 * 进出并排的阈值差（迟滞）。
 * 并排行数变化会改变内容区高度、进而让纵向滚动条出现或消失，宽度随之往复抖动——
 * 单一阈值会让布局在边界上反复翻转，故进入与退出的门槛错开。
 */
const SPLIT_HYSTERESIS = 48

/** diff 内容区根节点（尺寸探测用） */
const contentEl = ref<HTMLElement | null>(null)
/** 内容区可用宽度（自适应布局据此决定统一 / 并排） */
const availableWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = contentEl.value
  if (!el) return
  // 先同步读一次：挂载即定型，避免自适应布局在首帧先按 0 宽度渲染成统一视图再跳变
  availableWidth.value = el.clientWidth
  if (typeof ResizeObserver === "undefined") return
  resizeObserver = new ResizeObserver((entries) => {
    availableWidth.value = entries[0]?.contentRect.width ?? el.clientWidth
  })
  resizeObserver.observe(el)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

/** 自适应布局下的并排启用态（带迟滞，见 SPLIT_HYSTERESIS） */
const splitActive = ref(false)

watch(availableWidth, (width) => {
  if (splitActive.value) {
    if (width < SPLIT_MIN_WIDTH - SPLIT_HYSTERESIS) splitActive.value = false
  } else if (width >= SPLIT_MIN_WIDTH) {
    splitActive.value = true
  }
}, { immediate: true })

/** 是否走并排渲染（显式选择优先，auto 按可用宽度判定） */
const isSplit = computed(() =>
  layout.value === "split" || (layout.value === "auto" && splitActive.value),
)

/**
 * 参与渲染的行。宿主可能已按「仅改动」过滤过（工作区弹窗在分页前过滤以保证计数准确），
 * 这里再过滤一次是同口径的空操作；提交内弹窗直接把原始行传进来，由这里完成过滤。
 * 纯元数据变更（仅改文件模式 / 重命名）没有增删行，回退为全量，避免误报「无差异」。
 */
const renderedLines = computed(() => {
  if (!onlyChanges.value) return props.lines
  const changed = filterOnlyChanges(props.lines)
  return changed.length ? changed : props.lines
})

/** 并排行序列（统一行按 del/add 块配对重排） */
const splitRows = computed<DiffSplitRow[]>(() => toSplitRows(renderedLines.value))

/** 并排单元格的着色类（空位走 wt-ds-empty 的占位底色；hunk/meta/gap 永远跨整行，不进单元格） */
function cellClasses(line: DiffLine | undefined): Record<string, boolean> {
  return {
    "wt-ds-empty": !line,
    "wt-dl-ctx": line?.type === "ctx",
    "wt-dl-add": line?.type === "add",
    "wt-dl-del": line?.type === "del",
  }
}

/** 该行是否构成一次改动（改动跳转定位用，与统一视图的 data-chg 同口径） */
function isChangeRow(row: DiffSplitRow): boolean {
  return isChangeLine(row.left) || isChangeLine(row.right)
}

/** 折叠条文案（"⋯ N 行未变"） */
function gapLabel(line: DiffLine): string {
  return String(props.i18n.diffGapLines ?? "{0}").replace("{0}", String(line.gapCount ?? 0))
}
</script>

<style lang="scss">
@use "../../styles/DiffView.scss";
</style>
