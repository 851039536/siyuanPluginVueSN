<!-- Git 差异查看弹窗：着色 diff + 词级高亮、文件切换导航、弹窗内暂存/丢弃 -->
<template>
  <Teleport to="body">
    <div
      class="wt-diff-overlay"
      @click.self="$emit('close')"
    >
      <div class="wt-diff-dialog">
        <div class="wt-diff-header">
          <div class="wt-diff-title-row">
            <Icon
              icon="mdi:file-compare"
              height="12"
            />
            <span class="wt-diff-title">{{ file.path }}</span>
            <!-- 暂存状态徽章："已暂存"/"未暂存" -->
            <span class="wt-diff-badge">{{ file.staged ? i18n.staged : i18n.unstaged }}</span>
            <!-- 增/删行数统计 -->
            <span
              v-if="diffStats.add || diffStats.del"
              class="wt-diff-stats"
            >
              <span class="wt-stat-add">+{{ diffStats.add }}</span>
              <span class="wt-stat-del">−{{ diffStats.del }}</span>
            </span>
          </div>
          <!-- 头部操作区：文件导航 / 暂存切换 / 丢弃 / 关闭 -->
          <div class="wt-diff-header-actions">
            <!-- 上一个文件 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="fileIndex <= 0"
              :title="i18n.prevFile"
              @click="navigate(-1)"
            >
              <Icon
                icon="mdi:chevron-left"
                height="12"
              />
            </button>
            <!-- 文件位置指示（如 3 / 12） -->
            <span class="wt-diff-pos">{{ fileIndex + 1 }} / {{ files.length }}</span>
            <!-- 下一个文件 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="fileIndex >= files.length - 1"
              :title="i18n.nextFile"
              @click="navigate(1)"
            >
              <Icon
                icon="mdi:chevron-right"
                height="12"
              />
            </button>
            <span class="wt-diff-header-sep" />
            <!-- 暂存/取消暂存当前文件 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="gitOpLoading"
              :title="file.staged ? i18n.unstageFile : i18n.stageFile"
              @click="$emit('stageToggle')"
            >
              <Icon
                :icon="gitOpLoading ? 'mdi:loading' : file.staged ? 'mdi:minus-box-outline' : 'mdi:plus-box-outline'"
                :class="{ 'gp-spin': gitOpLoading }"
                height="12"
              />
            </button>
            <!-- 丢弃当前文件更改（提示文案按暂存/未跟踪状态区分） -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm wt-diff-discard"
              :disabled="gitOpLoading"
              :title="discardTitle"
              @click="$emit('discard')"
            >
              <Icon
                icon="mdi:undo-variant"
                height="12"
              />
            </button>
            <span class="wt-diff-header-sep" />
            <!-- 关闭弹窗 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="i18n.close"
              @click="$emit('close')"
            >
              <Icon
                icon="mdi:close"
                height="12"
              />
            </button>
          </div>
        </div>
        <!-- 图例："+ 新增 / − 删除 / ⋯ 未变" -->
        <div class="wt-diff-legend">
          <span class="wt-legend-add">+ {{ i18n.legendAdd }}</span>
          <span class="wt-legend-del">− {{ i18n.legendDel }}</span>
          <span class="wt-legend-ctx">⋯ {{ i18n.legendCtx }}</span>
        </div>
        <div class="wt-diff-content">
          <!-- 空态：差异尚未加载完成或无内容（如二进制文件） -->
          <div
            v-if="!coloredDiffLines.length"
            class="wt-diff-empty"
          >
            {{ i18n.diffEmpty }}
          </div>
          <div
            v-for="(line, i) in coloredDiffLines"
            :key="i"
            class="wt-diff-line"
            :class="`wt-dl-${line.type}`"
          >
            <!-- 旧/新文件行号双列（hunk/meta 行无行号，留空保持对齐） -->
            <span class="wt-dl-no">{{ line.oldNo ?? "" }}</span>
            <span class="wt-dl-no">{{ line.newNo ?? "" }}</span>
            <span class="wt-dl-sign">{{ DIFF_SIGN[line.type] }}</span>
            <span class="wt-dl-text">
              <!-- 词级差异：配对成功的行按分段渲染，变化片段加深底色 -->
              <template v-if="line.segments">
                <span
                  v-for="(seg, j) in line.segments"
                  :key="j"
                  :class="{ 'wt-dl-seg-changed': seg.changed }"
                >{{ seg.text }}</span>
              </template>
              <template v-else>{{ line.text }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { FileChange } from "../../types"
import type { DiffLineType } from "../../utils"
import { parseDiffLines } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  onUnmounted,
} from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 当前查看的文件 */
  file: FileChange
  /** 排序后的完整文件列表（用于上一个/下一个导航） */
  files: FileChange[]
  fileDiffs: Record<string, string>
  gitOpLoading: boolean
}>()

const emit = defineEmits<{
  close: []
  navigate: [file: FileChange]
  stageToggle: []
  discard: []
}>()

// diff 行类型 → 行首符号（替代模板中的三元链）
const DIFF_SIGN: Record<DiffLineType, string> = {
  add: "+",
  del: "−",
  hunk: "@",
  ctx: " ",
  meta: " ",
}

const diffText = computed(() => props.fileDiffs[`${props.file.staged ? "s" : "u"}::${props.file.path}`] || "")

/** 将 diff 文本解析为带类型/行号/词级分段的行数组 */
const coloredDiffLines = computed(() => parseDiffLines(diffText.value))

/** 增/删行数统计（标题行展示） */
const diffStats = computed(() => {
  let add = 0
  let del = 0
  for (const line of coloredDiffLines.value) {
    if (line.type === "add") add++
    else if (line.type === "del") del++
  }
  return { add, del }
})

/** 当前文件在列表中的下标（路径 + 暂存状态双键匹配） */
const fileIndex = computed(() => props.files.findIndex((f) => f.path === props.file.path && f.staged === props.file.staged))

/** 丢弃按钮提示：按暂存/未跟踪状态区分文案 */
const discardTitle = computed(() =>
  props.file.staged
    ? props.i18n.unstageDiscard
    : props.file.status === "untracked" ? props.i18n.discardUntracked : props.i18n.discardChanges,
)

function navigate(delta: number) {
  const target = props.files[fileIndex.value + delta]
  if (target) emit("navigate", target)
}

// Esc 关闭 / ← → 切换文件（组件仅在弹窗打开时挂载，onMounted/onUnmounted 即等价于开关监听）
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
  else if (e.key === "ArrowLeft") navigate(-1)
  else if (e.key === "ArrowRight") navigate(1)
}
onMounted(() => window.addEventListener("keydown", handleKeydown))
onUnmounted(() => window.removeEventListener("keydown", handleKeydown))
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/variables" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreeDiffDialog.scss";
</style>
