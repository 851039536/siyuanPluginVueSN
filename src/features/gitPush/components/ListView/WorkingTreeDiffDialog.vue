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
        <!-- 图例 + 着色行（复用共享 DiffLines 片段） -->
        <DiffLines
          :i18n="i18n"
          :lines="coloredDiffLines"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { FileChange } from "../../types"
import { countDiffStats, parseDiffLines } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  onUnmounted,
} from "vue"
import DiffLines from "../common/DiffLines.vue"

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

const diffText = computed(() => props.fileDiffs[`${props.file.staged ? "s" : "u"}::${props.file.path}`] || "")

/** 将 diff 文本解析为带类型/行号/词级分段的行数组 */
const coloredDiffLines = computed(() => parseDiffLines(diffText.value))

/** 增/删行数统计（标题行展示） */
const diffStats = computed(() => countDiffStats(coloredDiffLines.value))

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
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreeDiffDialog.scss";
</style>
