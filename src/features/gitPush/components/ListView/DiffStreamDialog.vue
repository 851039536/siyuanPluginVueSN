<!--
  gitPush 改动审阅弹窗（多文件连续流）：
  左侧目录树索引 + 右侧全部文件自上而下连续排列，文件头 sticky 固定在顶部。
  替代原「单文件差异弹窗 + 变更目录树弹窗」两处入口 —— 树不再是独立功能，而是这条流的索引。
-->
<template>
  <Dialog
    class="wt-stream-dialog"
    :visible="true"
    size="large"
    :dismissable-mask="true"
    :closable="false"
    :aria-label="i18n.diffStreamTitle"
    @update:visible="$emit('close')"
  >
    <template #header="{ headerId }">
      <div
        ref="rootEl"
        class="wt-stream-header"
      >
        <div class="wt-diff-title-row">
          <Icon
            icon="mdi:file-compare"
            height="12"
          />
          <span
            :id="headerId"
            class="wt-diff-title"
          >{{ i18n.diffStreamTitle }}</span>
          <!-- 变更文件总数 + 暂存/未暂存分布 -->
          <span
            class="wt-stream-total"
            :title="i18n.commitFilesCount.replace('{0}', String(files.length))"
          >{{ files.length }}</span>
          <span
            v-if="stagedCount"
            class="wt-stream-count wt-stream-count--staged"
          >●{{ stagedCount }}</span>
          <span
            v-if="unstagedCount"
            class="wt-stream-count wt-stream-count--unstaged"
          >●{{ unstagedCount }}</span>
        </div>
        <div class="wt-diff-header-actions">
          <!-- 上一个 / 下一个文件（与 ← → 同义） -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="chevronLeft"
            :disabled="activeIndex <= 0"
            :title="i18n.prevFile"
            @click="stepFile(-1)"
          />
          <span class="wt-diff-pos">{{ activeIndex < 0 ? 0 : activeIndex + 1 }} / {{ streamFiles.length }}</span>
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="chevronRight"
            :disabled="activeIndex >= streamFiles.length - 1"
            :title="i18n.nextFile"
            @click="stepFile(1)"
          />
          <Divider
            class="wt-diff-header-sep"
            layout="vertical"
          />
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="close"
            :title="i18n.close"
            @click="$emit('close')"
          />
        </div>
      </div>
    </template>

    <!-- 左侧目录树索引 -->
    <DiffStreamSidebar
      :i18n="i18n"
      :files="files"
      :active-path="activePath"
      :stats="changesetStats"
      :git-op-loading="gitOpLoading"
      @focus="gotoFile"
      @stage-file="(path: string) => $emit('stageFile', path)"
      @unstage-file="(path: string) => $emit('unstageFile', path)"
      @stage-all="$emit('stageAll')"
      @unstage-all="$emit('unstageAll')"
    />

    <!-- 右侧连续流 -->
    <div class="wt-stream-main">
      <!-- 全局视图开关：一条工具条控制所有文件段（文件段自身不再各带一条） -->
      <DiffViewBar
        v-model:layout="layout"
        v-model:show-line-numbers="showLineNumbers"
        v-model:only-changes="onlyChanges"
        :i18n="i18n"
      />

      <!-- 变更集不可用：已退化为逐文件取数，给出可见原因（否则只是"变慢"且无从解释） -->
      <div
        v-if="changesetFailed"
        class="wt-stream-notice"
        role="status"
      >
        <Icon
          icon="mdi:alert-circle-outline"
          height="12"
        />
        <span>{{ i18n.diffChangesetUnavailable }}</span>
      </div>

      <div
        ref="scrollEl"
        class="wt-stream-scroll"
        @scroll.passive="handleScroll"
      >
        <!-- 变更集取数中（首屏一次性取全部 tracked 文件，未跟踪文件随后按段回退） -->
        <div
          v-if="changesetLoading && !hasAnyContent"
          class="wt-diff-content wt-diff-loading"
        >
          <Icon
            icon="mdi:loading"
            height="12"
            class="gp-spin"
          />
          <span>{{ i18n.loading }}</span>
        </div>

        <div
          v-else-if="!streamFiles.length"
          class="wt-diff-content wt-diff-empty"
        >
          {{ i18n.diffEmpty }}
        </div>

        <template v-else>
          <DiffFileSection
            v-for="file in visibleStreamFiles"
            :key="file.path"
            v-model:layout="layout"
            v-model:show-line-numbers="showLineNumbers"
            v-model:only-changes="onlyChanges"
            :i18n="i18n"
            :file="file"
            :scope="scopeOf(file)"
            :context="contextOf(file)"
            :diff-text="diffOf(file)"
            :loading="loadingOf(file)"
            :git-op-loading="gitOpLoading"
            @stage-toggle="handleSectionStageToggle"
            @discard="handleSectionDiscard"
            @scope-change="handleScopeChange"
            @expand-context="expandContext(file)"
          />
          <!-- 文件数分页：一次只挂前 N 个文件段，避免上百个文件同时建 DOM -->
          <LoadMoreButton
            v-if="streamHasMore"
            :i18n="i18n"
            :visible="visibleStreamFiles.length"
            :total="streamFiles.length"
            @load-more="loadMoreFiles"
          />
        </template>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
// gitPush 改动审阅流（自含：changeset 取数、侧栏联动、滚动定位、关键字导航；
// 单文件操作仍 emit 回工作区面板，复用既有的暂存/丢弃确认链路）
import type { FileChange } from "../../types"
import type { DiffLayout } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Divider from "@/components/Divider.vue"
import { buildSectionedTreeRows, countRawDiffLines, diffCacheKey, nextDiffContext } from "../../utils"
import DiffViewBar from "../common/DiffViewBar.vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"
import DiffFileSection from "./DiffFileSection.vue"
import DiffStreamSidebar from "./DiffStreamSidebar.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部变更文件（已按「暂存优先 → 路径」排序） */
  files: FileChange[]
  /** 单文件 diff 缓存（未跟踪文件与回退路径共用） */
  fileDiffs: Record<string, string>
  /** 单文件取数在途标记（与 fileDiffs 同键） */
  diffLoading: Record<string, boolean>
  gitOpLoading: boolean
  /** 打开时要定位到的文件（从文件列表 / 目录树 / 文件浏览器点进来） */
  focusFile: FileChange | null
  /**
   * 取整个变更集的补丁（一次 git diff 覆盖全部 tracked 文件）。
   * 未跟踪文件不在结果中，由本组件对缺失路径回退 loadDiff。
   * 返回 `null` 表示取数失败（超 maxBuffer / git 报错），用于区分「空变更集」。
   */
  getChangeset: (staged: boolean, opts?: { force?: boolean }) => Promise<Record<string, string> | null>
}>()

const emit = defineEmits<{
  close: []
  stageFile: [path: string]
  unstageFile: [path: string]
  stageAll: []
  unstageAll: []
  stageToggle: [file: FileChange]
  discard: [file: FileChange]
  /** 单文件差异取数（未跟踪 / 变更集缺失时的回退） */
  loadDiff: [file: string, staged: boolean, opts?: { force?: boolean, status?: string, context?: number }]
}>()

/** 一次挂载的文件段数量 / 每次「加载更多」的步长 */
const STREAM_FILE_INITIAL = 20
const STREAM_FILE_STEP = 20

/** 视图偏好（全局共用一条工具条） */
const layout = defineModel<DiffLayout>("layout", { default: "auto" })
const showLineNumbers = defineModel<boolean>("showLineNumbers", { default: true })
const onlyChanges = defineModel<boolean>("onlyChanges", { default: false })

/**
 * 变更集不可用时的占位空映射。
 * 模块级常量（引用稳定）：refreshChangesets 靠引用相等判断「内容没变」，
 * 每次新建 `{}` 会让短路失效，退化成每轮刷新都全量重算统计、全部文件段重渲染。
 */
const EMPTY_CHANGESET: Record<string, string> = {}

/** 当前所在文件（滚动联动侧栏高亮，也是 ←/→ 的基准） */
const activePath = ref("")
/** 已挂载的文件段数量（分页） */
const streamLimit = ref(STREAM_FILE_INITIAL)
/**
 * 变更集补丁：两个范围各取一份，范围切换与首屏渲染都命中内存。
 *
 * 用 `shallowRef`：条目只整体替换、从不原地修改，深响应式会为上百个路径键各建一个 dep，
 * 而 `diffOf` / `loadingOf` 每帧都要按路径读一次 —— 这些读追踪全是白付的开销。
 */
const changesets = shallowRef<{ staged: Record<string, string>, unstaged: Record<string, string> }>({
  staged: EMPTY_CHANGESET,
  unstaged: EMPTY_CHANGESET,
})
/** 变更集取数中（仅首屏用于占位，后续刷新不闪白） */
const changesetLoading = ref(true)
/** 变更集是否取数失败（超 maxBuffer / git 报错）：已降级为逐文件加载，需要给用户一个可见原因 */
const changesetFailed = ref(false)
/** 用户手动切过范围的文件（path → 是否暂存区），未记录时按文件自身暂存态决定 */
const scopeOverride = ref<Record<string, boolean>>({})
/** 已展开上下文的文件（path → 上下文行数），缺省 = git 默认 3 行 */
const contextByPath = ref<Record<string, number>>({})

const rootEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)

/** 变更文件总数分布（标题栏展示） */
const stagedCount = computed(() => props.files.filter((f) => f.staged).length)
const unstagedCount = computed(() => props.files.filter((f) => !f.staged).length)

/**
 * 流的文件顺序 = 侧栏树的行顺序（已暂存区在前、目录分组与收纳顺序一致）。
 * 用空折叠集构建：侧栏折叠只影响索引，不影响右侧流的完整性。
 */
const streamFiles = computed<FileChange[]>(() => {
  const sectioned = [
    {
      section: "staged" as const,
      name: "",
      files: props.files.filter((f) => f.staged),
    },
    {
      section: "unstaged" as const,
      name: "",
      files: props.files.filter((f) => !f.staged),
    },
  ]
  return buildSectionedTreeRows(sectioned, new Set())
    .filter((row) => row.type === "file")
    .map((row) => (row as { file: FileChange }).file)
})

const visibleStreamFiles = computed(() => streamFiles.value.slice(0, streamLimit.value))
const streamHasMore = computed(() => streamLimit.value < streamFiles.value.length)

/**
 * 每个文件的增删行数（侧栏右侧那列 +N −N）。
 * 直接扫原始补丁的行首字符，不走 parseDiffLines —— 上百个文件只为拿一个数字，
 * 没必要建行对象、跑词级对齐。变更集变化时重算一次。
 */
const changesetStats = computed<Record<string, { add: number, del: number }>>(() => {
  const out: Record<string, { add: number, del: number }> = {}
  for (const scope of ["staged", "unstaged"] as const) {
    const map = changesets.value[scope]
    for (const [path, raw] of Object.entries(map)) {
      out[diffCacheKey(path, scope === "staged")] = countRawDiffLines(raw)
    }
  }
  return out
})

/** 是否已有任何可渲染内容（决定首屏是否显示整页加载态） */
const hasAnyContent = computed(() => Object.keys(changesets.value.staged).length > 0
  || Object.keys(changesets.value.unstaged).length > 0
  || Object.keys(props.fileDiffs).length > 0)

/** 当前文件在流中的下标（用于标题栏位置指示与 ←/→ 边界） */
const activeIndex = computed(() => streamFiles.value.findIndex((f) => f.path === activePath.value))

/** 文件当前查看的范围：手动切换优先，否则按文件自身暂存态 */
function scopeOf(file: FileChange): "staged" | "unstaged" {
  const forced = scopeOverride.value[file.path]
  if (forced !== undefined) return forced ? "staged" : "unstaged"
  return file.staged ? "staged" : "unstaged"
}

/** 该文件已展开的上下文档位（0 = git 默认 3 行） */
function contextOf(file: FileChange): number {
  return contextByPath.value[file.path] ?? 0
}

/**
 * 该文件在当前范围下的 diff 文本。
 * 展开过上下文的文件走「按档位单文件取数」的缓存键：变更集永远是默认上下文，
 * 两套内容分开存放，收起前后互不覆盖。
 */
function diffOf(file: FileChange): string {
  const scope = scopeOf(file)
  const staged = scope === "staged"
  const context = contextOf(file)
  if (context > 0) {
    const expanded = props.fileDiffs[diffCacheKey(file.path, staged, context)]
    if (expanded) return expanded
    // 展开档还没回来 / 取数失败：先退回变更集里的默认档内容，不要整段空白
    // （loadingOf 对同一场景返回 false，才不会把这份兜底内容挡住）
    const map = changesets.value[scope]
    return (file.path in map) ? map[file.path] : ""
  }
  const map = changesets.value[scope]
  if (file.path in map) return map[file.path]
  return props.fileDiffs[diffCacheKey(file.path, staged)] ?? ""
}

/**
 * 该文件是否仍在取数中。
 * 变更集里没有该路径（未跟踪文件）时，用「缓存里连键都没有」也判为取数中——
 * 否则挂载到 emit loadDiff 之间的那一帧会闪一下「暂无差异内容」。
 */
function loadingOf(file: FileChange): boolean {
  const scope = scopeOf(file)
  const staged = scope === "staged"
  const context = contextOf(file)
  if (context > 0) {
    const key = diffCacheKey(file.path, staged, context)
    if (key in props.fileDiffs) return !!props.diffLoading[key]
    // 展开档未到但变更集里有默认档内容：不切骨架，先展示默认档（与 diffOf 的兜底同口径）
    const map = changesets.value[scope]
    return !(file.path in map)
  }
  const map = changesets.value[scope]
  if (file.path in map) return false
  const key = diffCacheKey(file.path, staged)
  if (!(key in props.fileDiffs)) return true
  return !!props.diffLoading[key]
}

/**
 * 变更集取数：两个范围并行取（4 个 git 进程 → 2 个），
 * 范围切换 / 首屏 / 单文件打开全部命中内存，不再逐文件 spawn。
 * force=false 时由数据层按工作区版本判断是否真的需要重取。
 *
 * ⚠️ 引用相等短路：树刷新（自动刷新 / 暂存 / 提交后）会再次调用本函数，但数据层按树版本
 * 命中同一份记录。原样再赋值一次会让 `changesetStats` 全量重算（两个范围每个文件 split 一遍）、
 * 全部文件段重渲染 —— 内容没变时这全是白付的开销。
 */
async function refreshChangesets(force = false) {
  try {
    const [unstagedRaw, stagedRaw] = await Promise.all([
      props.getChangeset(false, { force }),
      props.getChangeset(true, { force }),
    ])
    // null = 该范围取数失败（超 maxBuffer / git 报错），与「空变更集」区分
    changesetFailed.value = unstagedRaw === null || stagedRaw === null
    const next = {
      staged: stagedRaw ?? EMPTY_CHANGESET,
      unstaged: unstagedRaw ?? EMPTY_CHANGESET,
    }
    if (changesets.value.staged === next.staged && changesets.value.unstaged === next.unstaged) return
    changesets.value = next
  } catch {
    // 意外拒绝（数据层已把 git 失败包成 null，这里兜的是更上游的编程错误）：
    // 置为空映射而不是保留 null —— 空映射让 ensureMissingDiffs 按「变更集里没有该路径」
    // 逐文件回退 loadDiff，退化为逐个取但始终能看到内容。
    changesetFailed.value = true
    if (changesets.value.staged !== EMPTY_CHANGESET || changesets.value.unstaged !== EMPTY_CHANGESET) {
      changesets.value = {
        staged: EMPTY_CHANGESET,
        unstaged: EMPTY_CHANGESET,
      }
    }
  } finally {
    changesetLoading.value = false
  }
}

/**
 * 视图内滚动到指定文件：目标尚未挂载（超出分页）时先抬高上限再定位。
 * 侧栏点击、打开弹窗时的定位请求、←/→ 都走这里。
 */
async function gotoFile(file: FileChange) {
  const index = streamFiles.value.findIndex((f) => f.path === file.path)
  if (index < 0) return
  activePath.value = file.path
  if (index >= streamLimit.value) {
    streamLimit.value = index + 1
    await nextTick()
  }
  const target = findSectionEl(file.path)
  target?.scrollIntoView({ block: "start" })
}

/** 按 data-path 精确查找文件段（路径含特殊字符，不做选择器拼接） */
function findSectionEl(path: string): HTMLElement | null {
  const container = scrollEl.value
  if (!container) return null
  for (const node of container.querySelectorAll<HTMLElement>("[data-path]")) {
    if (node.dataset.path === path) return node
  }
  return null
}

/** ←/→ 切换到相邻文件（越过可视区就滚过去） */
function stepFile(delta: number) {
  const list = streamFiles.value
  if (!list.length) return
  const current = activeIndex.value < 0 ? (delta > 0 ? -1 : list.length) : activeIndex.value
  const next = Math.min(list.length - 1, Math.max(0, current + delta))
  void gotoFile(list[next])
}

/** 滚动联动：以「顶部 40px 内最后一个已越过的文件段」为当前文件（侧栏高亮用） */
let scrollRaf = 0
function handleScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const container = scrollEl.value
    if (!container) return
    const containerTop = container.getBoundingClientRect().top
    let current = ""
    for (const node of container.querySelectorAll<HTMLElement>("[data-path]")) {
      if (node.getBoundingClientRect().top - containerTop <= 40) current = node.dataset.path ?? ""
      else break
    }
    if (current && current !== activePath.value) activePath.value = current
  })
}

/** 文件段内切换差异范围（只改查看对象，不改暂存状态） */
function handleScopeChange(file: FileChange, staged: boolean) {
  scopeOverride.value = {
    ...scopeOverride.value,
    [file.path]: staged,
  }
  // 展开过上下文的文件：范围变了就按新范围重取同一档位
  const context = contextOf(file)
  if (context > 0) {
    emit("loadDiff", file.path, staged, { status: file.status, context })
    return
  }
  // 该范围若不在变更集内（未跟踪等），回退单文件取数
  const map = changesets.value[staged ? "staged" : "unstaged"]
  if (!(file.path in map)) {
    emit("loadDiff", file.path, staged, { status: file.status })
  }
}

/**
 * 展开折叠条：把该文件的上下文按阶梯提高一档并重取。
 *
 * 只能整文件重取（`git diff -U<n>` 的粒度就是文件），所以点任意一处折叠条，
 * 同文件内的其他折叠条也会一起变短——这一点在按钮文案里明确成「展开更多上下文」而非「展开这 N 行」。
 */
function expandContext(file: FileChange) {
  const next = nextDiffContext(contextOf(file))
  if (next === null) return
  contextByPath.value = {
    ...contextByPath.value,
    [file.path]: next,
  }
  emit("loadDiff", file.path, scopeOf(file) === "staged", {
    status: file.status,
    context: next,
  })
}

/**
 * 未跟踪 / 变更集缺失的文件：挂载即回退单文件取数。
 * ① 变更集尚未到达（首屏还在取）时整批跳过 —— 否则首屏会对每个文件各 spawn 一个 git 进程，
 *    正好抵消「一次取全量」的收益；
 * ② 缓存里已有（含「空串 = 取数失败」的占位）就不再请求，避免渲染期反复 emit。
 */
function ensureMissingDiffs() {
  for (const file of visibleStreamFiles.value) {
    const staged = scopeOf(file) === "staged"
    const context = contextOf(file)
    // 展开过上下文的文件：内容只可能来自按档位的单文件取数
    if (context > 0) {
      const key = diffCacheKey(file.path, staged, context)
      if (key in props.fileDiffs) continue
      if (props.diffLoading[key]) continue
      emit("loadDiff", file.path, staged, { status: file.status, context })
      continue
    }
    // 变更集未到：此时「不在 map 里」不代表缺失，跳过，等取数完成后这里会再被触发一次
    if (changesetLoading.value) continue
    const map = changesets.value[scopeOf(file)]
    if (file.path in map) continue
    const key = diffCacheKey(file.path, staged)
    if (key in props.fileDiffs) continue
    // 已在途：同一轮 flush 里被重复触及时不再 emit 一次（否则同一个文件 spawn 两个 git 进程）
    if (props.diffLoading[key]) continue
    emit("loadDiff", file.path, staged, { status: file.status })
  }
}

// changesetLoading 也要监听：变更集为空/失败时 changesets 可能不发生引用变化，
// 只靠它无法触发第二轮；「取数结束」这个信号才是让逐文件回退真正启动的那个。
watch([visibleStreamFiles, changesets, contextByPath, changesetLoading], ensureMissingDiffs)

// 文件集合变化（暂存 / 丢弃 / 提交 / 外部改动刷新）→ 重取变更集（数据层按版本决定是否真的重跑）；
// 同时收起已展开的上下文：展开档位的内容是按旧版本取的，回到默认档才能跟着变更集一起刷新
watch(() => props.files, () => {
  if (Object.keys(contextByPath.value).length) contextByPath.value = {}
  void refreshChangesets()
})

/**
 * 打开时的定位请求。
 * 只在「目标路径变了」时才滚动：树刷新会把锚点文件换成新对象（同一路径），
 * 若按对象身份响应，用户刚滚到别处就会被拽回去。
 */
let lastFocusPath = ""
watch(
  () => props.focusFile,
  (file) => {
    if (!file || file.path === lastFocusPath) return
    lastFocusPath = file.path
    void gotoFile(file)
  },
  { immediate: true },
)

/** 流的分页「加载更多」（模板中不直接给 ref 赋值） */
function loadMoreFiles() {
  streamLimit.value += STREAM_FILE_STEP
}

onMounted(() => {
  void refreshChangesets()
  // 没有指定定位文件时，标题栏位置指示以第一个文件为基准（不滚动）
  if (!props.focusFile && streamFiles.value.length) activePath.value = streamFiles.value[0].path
  window.addEventListener("keydown", handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown, true)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})

/** 布局快捷键（1 统一 / 2 并排 / 0 自适应） */
const LAYOUT_BY_KEY: Record<string, DiffLayout> = {
  1: "unified",
  2: "split",
  0: "auto",
}

/** 改动行游标（整个流内按 DOM 顺序计，-1 = 未定位） */
let changeCursor = -1
let cursorEl: HTMLElement | null = null

function resetChangeCursor() {
  cursorEl?.classList.remove("wt-dl-cursor")
  cursorEl = null
  changeCursor = -1
}

/** `]` / `[` 跳到下一处 / 上一处改动（跨文件段连续，落在当前已挂载的 DOM 上） */
function jumpChange(delta: number) {
  const container = scrollEl.value
  if (!container) return
  const rows = Array.from(container.querySelectorAll<HTMLElement>(".wt-diff-content [data-chg]"))
  if (!rows.length) return
  const next = changeCursor < 0
    ? (delta > 0 ? 0 : rows.length - 1)
    : Math.min(rows.length - 1, Math.max(0, changeCursor + delta))
  const atEdge = next === changeCursor
  changeCursor = next
  if (atEdge && cursorEl) return
  cursorEl?.classList.remove("wt-dl-cursor")
  cursorEl = rows[next]
  cursorEl.classList.add("wt-dl-cursor")
  cursorEl.scrollIntoView({ block: "center" })
}

/**
 * 非最上层弹窗不抢按键：多张卡片各自打开审阅流时，
 * 多个实例都会挂 window 捕获监听，首个注册者会把键全吞掉。
 * 共享 Dialog 未提供弹窗栈，按「谁的根节点在文档中最后出现」近似判定层级。
 */
function isTopmostDialog(): boolean {
  const masks = document.querySelectorAll(".si-dialog-mask")
  if (masks.length <= 1) return true
  const mine = rootEl.value?.closest(".si-dialog-mask")
  return !mine || masks[masks.length - 1] === mine
}

/**
 * 事件目标是否为可编辑控件（输入框 / 多行文本 / contenteditable）。
 * 这类元素里的按键归它们自己：本弹窗的侧栏筛选框就在同一遮罩内，
 * 若在此处吞掉，输入 `1`/`2`/`0` 会顺手切布局、`←`/`→` 会顺手翻文件。
 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (isEditableTarget(e.target)) return
  if (!isTopmostDialog()) return
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.stopImmediatePropagation()
    stepFile(e.key === "ArrowLeft" ? -1 : 1)
    return
  }
  if (e.key === "]" || e.key === "[") {
    e.stopImmediatePropagation()
    jumpChange(e.key === "]" ? 1 : -1)
    return
  }
  const preset = LAYOUT_BY_KEY[e.key]
  if (preset) {
    e.stopImmediatePropagation()
    layout.value = preset
  }
}

// 布局切换会重建行 DOM（统一与并排结构不同），按下标定位的游标随之失效
watch(layout, resetChangeCursor)

/** 文件段内操作转发（模板里不写带类型的行内箭头，避免可读性下降） */
function handleSectionStageToggle(file: FileChange) {
  // 暂存状态翻转后旧的「手动范围」不再成立（另一侧的 diff 内容已被并入），清掉让它回到跟随文件状态
  if (file.path in scopeOverride.value) {
    const next = { ...scopeOverride.value }
    delete next[file.path]
    scopeOverride.value = next
  }
  emit("stageToggle", file)
}

function handleSectionDiscard(file: FileChange) {
  emit("discard", file)
}
</script>

<style lang="scss">
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/DiffStream.scss";
</style>
