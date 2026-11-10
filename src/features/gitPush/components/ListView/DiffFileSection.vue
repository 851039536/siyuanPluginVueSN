<!--
  gitPush 审阅流中的单个文件段：sticky 文件头（状态 / 路径 / 增删统计 / 范围切换 / 行内操作）+ 着色 diff。
  文件头固定在滚动容器顶部，连续浏览多个文件时始终知道"当前在看哪个文件"。
-->
<template>
  <section
    class="wt-stream-file"
    :data-path="file.path"
  >
    <!-- sticky 文件头：点击折叠 / 展开本文件（整段可点，按钮区拦截冒泡） -->
    <header
      class="wt-stream-head"
      role="button"
      tabindex="0"
      :aria-expanded="!collapsed"
      :aria-label="`${collapsed ? i18n.diffFileExpand : i18n.diffFileCollapse} — ${file.path}`"
      @click="collapsed = !collapsed"
      @keydown.enter.prevent="collapsed = !collapsed"
      @keydown.space.prevent="collapsed = !collapsed"
    >
      <Icon
        icon="mdi:chevron-right"
        height="12"
        class="wt-stream-chev"
        :class="{ 'is-open': !collapsed }"
      />
      <!-- 文件状态图标（与文件列表同源：图标名与字符均来自 FILE_STATUS_META） -->
      <span
        class="wt-file-status"
        :class="`wt-s-${file.status}`"
        :title="fileStatusTitle(file, i18n)"
      >
        <IconWrapper
          v-if="isIconFileStatus(file)"
          :name="fileStatusIconKey(file)"
          :size="12"
        />
        <template v-else>
          {{ fileStatusIcon(file) }}
        </template>
      </span>
      <span
        class="wt-stream-path"
        :title="file.path"
      >{{ file.path }}</span>
      <!-- 重命名 / 复制的原路径 -->
      <span
        v-if="file.oldPath"
        class="wt-diff-old"
        :title="file.oldPath"
      >← {{ file.oldPath }}</span>
      <!-- 增删统计：着色来自 diff 实际行数（与标题行同源），不在变更集里时留空 -->
      <span
        v-if="stats.add || stats.del"
        class="wt-diff-stats"
      >
        <span class="wt-stat-add">+{{ stats.add }}</span>
        <span class="wt-stat-del">−{{ stats.del }}</span>
      </span>

      <span class="wt-stream-head-actions">
        <!-- 范围切换：仅「已暂存 + 工作区又改动」的文件存在两份差异 -->
        <template v-if="canSwitchScope">
          <Button
            v-for="opt in SCOPE_OPTIONS"
            :key="opt.value"
            :variant="scope === opt.value ? 'primary' : 'ghost'"
            text
            size="xsmall"
            :aria-pressed="scope === opt.value"
            :title="i18n.diffScope"
            @click.stop="setScope(opt.value)"
          >
            {{ i18n[opt.labelKey] }}
          </Button>
          <Divider
            class="wt-diff-header-sep"
            layout="vertical"
          />
        </template>
        <!-- 暂存 / 取消暂存 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :icon="file.staged ? 'minusBoxOutline' : 'plusBoxOutline'"
          :disabled="gitOpLoading"
          :title="file.staged ? i18n.unstageFile : i18n.stageFile"
          @click.stop="emit('stageToggle', file)"
        />
        <!-- 丢弃更改 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          severity="danger"
          icon="undoVariant"
          :disabled="gitOpLoading"
          :title="discardTitle"
          @click.stop="emit('discard', file)"
        />
        <!-- 复制本文件差异全文 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :icon="copiedWhat === 'diff' ? 'check' : 'contentCopy'"
          :disabled="!diffText"
          :title="copiedWhat === 'diff' ? i18n.copied : i18n.copyDiff"
          @click.stop="handleCopyDiff"
        />
        <!-- 复制文件路径 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :icon="copiedWhat === 'path' ? 'check' : 'linkVariant'"
          :title="copiedWhat === 'path' ? i18n.copied : i18n.copyPath"
          @click.stop="handleCopyPath"
        />
      </span>
    </header>

    <!-- 正文：折叠时不渲染（大 diff 靠折叠整段省掉全部 DOM） -->
    <div
      v-if="!collapsed"
      class="wt-stream-body"
    >
      <!-- 加载中（仅未跟踪文件走单文件取数时出现，变更集命中的文件直接出内容） -->
      <div
        v-if="loading"
        class="wt-diff-content wt-diff-loading"
      >
        <Icon
          icon="mdi:loading"
          height="12"
          class="gp-spin"
        />
        <span>{{ i18n.loading }}</span>
      </div>
      <template v-else>
        <DiffLines
          v-model:layout="layout"
          v-model:show-line-numbers="showLineNumbers"
          v-model:only-changes="onlyChanges"
          :i18n="i18n"
          :lines="visibleLines"
          :show-bar="false"
          :gaps-expandable="canExpandGap"
          @expand="emit('expandContext')"
        />
        <!-- 单文件行数上限：超长 diff 先渲染前 N 行，其余按需增量展开（避免一屏几千行卡住滚动） -->
        <div
          v-if="hiddenCount > 0"
          class="wt-stream-more"
        >
          <Button
            variant="ghost"
            size="xsmall"
            dense
            @click="lineCap += STREAM_LINE_STEP"
          >
            {{ i18n.reportDiffTruncated.replace("{0}", String(hiddenCount)) }}
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
// gitPush 审阅流单文件段（自含折叠 / 范围切换 / 复制；行解析与渲染交给共享 DiffLines）
import type { FileChange } from "../../types"
import type { DiffLayout } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Divider from "@/components/Divider.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import {
  countDiffStats,
  fileStatusIcon,
  fileStatusIconKey,
  fileStatusTitle,
  filterOnlyChanges,
  isIconFileStatus,
  nextDiffContext,
  parseDiffLines,
} from "../../utils"
import DiffLines from "../common/DiffLines.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 本段对应的变更文件 */
  file: FileChange
  /** 当前查看的差异范围（暂存区 / 工作区，由弹窗统一持有） */
  scope: "staged" | "unstaged"
  /** 本段已展开的上下文档位（0 = git 默认 3 行；>0 表示按该行数重取过） */
  context: number
  /** 该文件在当前范围下的 diff 文本（缺失且未加载时为空串） */
  diffText: string
  /** 单文件取数在途标记（未跟踪文件回退路径） */
  loading: boolean
  gitOpLoading: boolean
}>()

const emit = defineEmits<{
  /** 暂存 / 取消暂存（父层按文件当前状态翻转） */
  stageToggle: [file: FileChange]
  discard: [file: FileChange]
  /** 切换差异范围（暂存区 / 工作区） */
  scopeChange: [file: FileChange, staged: boolean]
  /** 点击折叠条：请求该文件下一档上下文的 diff */
  expandContext: []
}>()

/** 视图偏好由弹窗统一持有，逐段透传（一条工具条控制所有文件段） */
const layout = defineModel<DiffLayout>("layout", { default: "auto" })
const showLineNumbers = defineModel<boolean>("showLineNumbers", { default: true })
const onlyChanges = defineModel<boolean>("onlyChanges", { default: false })

/** 本段折叠态（默认展开；大文件靠用户主动折叠或行数上限控制开销） */
const collapsed = ref(false)

/** 仅「已暂存 + 工作区又改动」的文件有两份差异可切 */
const canSwitchScope = computed(() => !!(props.file.staged && props.file.unstaged))

/** 还有更大的上下文档位可请求时，折叠条才显示展开入口 */
const canExpandGap = computed(() => nextDiffContext(props.context) !== null)

const SCOPE_OPTIONS: { value: "staged" | "unstaged", labelKey: string }[] = [
  {
    value: "staged",
    labelKey: "staged",
  },
  {
    value: "unstaged",
    labelKey: "unstaged",
  },
]

/** 单段初始渲染行数 / 每次「展开更多」的步长 */
const STREAM_LINE_INITIAL = 200
const STREAM_LINE_STEP = 500
const lineCap = ref(STREAM_LINE_INITIAL)

/** 解析后的全量行（供统计与截断计数） */
const allLines = computed(() => parseDiffLines(props.diffText))
/**
 * 「仅改动」必须在截断之前过滤：否则只显示「前 200 行里的改动」，
 * 而文件后半段的增删要一直点「展开更多」才会露出来。空结果回退全量（纯元数据变更不算无差异）。
 */
const filteredLines = computed(() => {
  if (!onlyChanges.value) return allLines.value
  const changed = filterOnlyChanges(allLines.value)
  return changed.length ? changed : allLines.value
})
/** 实际渲染的行（按上限截断） */
const visibleLines = computed(() => filteredLines.value.slice(0, lineCap.value))
/** 未渲染的行数（0 = 已全部展示） */
const hiddenCount = computed(() => Math.max(0, filteredLines.value.length - lineCap.value))
/** 增删统计（始终按全量行计算，与过滤/展开状态无关） */
const stats = computed(() => countDiffStats(allLines.value))

/** 丢弃按钮提示：按暂存/未跟踪状态区分文案 */
const discardTitle = computed(() =>
  props.file.staged
    ? props.i18n.unstageDiscard
    : props.file.status === "untracked" ? props.i18n.discardUntracked : props.i18n.discardChanges,
)

/** 复制反馈（2 秒后自动复位） */
const copiedWhat = ref<"diff" | "path" | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyText(text: string, what: "diff" | "path") {
  const ok = await copyToClipboard(text)
  if (!ok) return
  if (copyTimer) clearTimeout(copyTimer)
  copiedWhat.value = what
  copyTimer = setTimeout(() => {
    copiedWhat.value = null
    copyTimer = null
  }, 2000)
}

function handleCopyDiff() {
  if (!props.diffText) return
  void copyText(props.diffText, "diff")
}

function handleCopyPath() {
  void copyText(props.file.path, "path")
}

/** 切换范围：只改变本段查看对象，不改文件暂存状态（父层更新范围映射后本段内容随之下发） */
function setScope(next: "staged" | "unstaged") {
  if (props.scope === next) return
  emit("scopeChange", props.file, next === "staged")
}
</script>
