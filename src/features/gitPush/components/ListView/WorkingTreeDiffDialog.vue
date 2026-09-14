<!-- Git 差异查看弹窗：着色 diff + 词级高亮、文件切换导航、差异范围切换、弹窗内暂存/丢弃 -->
<template>
  <Teleport to="body">
    <div
      class="wt-diff-overlay"
      @click.self="$emit('close')"
    >
      <div
        class="wt-diff-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="file.path"
      >
        <div class="wt-diff-header">
          <div class="wt-diff-title-row">
            <Icon
              icon="mdi:file-compare"
              height="12"
            />
            <span
              class="wt-diff-title"
              :title="file.path"
            >{{ file.path }}</span>
            <!-- 重命名/复制的原路径（弱化展示） -->
            <span
              v-if="file.oldPath"
              class="wt-diff-old"
              :title="file.oldPath"
            >← {{ file.oldPath }}</span>
            <!-- 文件状态徽章（文案与列表状态 tooltip 同源） -->
            <span class="wt-diff-status">{{ statusLabel }}</span>
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
          <!-- 头部操作区：差异范围 / 文件导航 / 暂存切换 / 丢弃 / 复制 / 关闭 -->
          <div class="wt-diff-header-actions">
            <!-- 差异范围切换：仅「已暂存 + 工作区又改动」的文件存在两份差异 -->
            <template v-if="canSwitchScope">
              <Button
                v-for="opt in SCOPE_OPTIONS"
                :key="opt.value"
                :variant="scope === opt.value ? 'primary' : 'ghost'"
                text
                size="xsmall"
                :aria-pressed="scope === opt.value"
                :title="i18n.diffScope"
                @click="setScope(opt.value)"
              >
                {{ i18n[opt.labelKey] }}
              </Button>
              <span class="wt-diff-header-sep" />
            </template>
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
            <!-- 复制当前范围的差异全文（无内容时禁用） -->
            <Button
              variant="ghost"
              size="xsmall"
              :icon="copiedWhat === 'diff' ? 'check' : 'contentCopy'"
              :disabled="!diffText"
              :title="copiedWhat === 'diff' ? i18n.copied : i18n.copyDiff"
              @click="handleCopyDiff"
            />
            <!-- 复制文件路径 -->
            <Button
              variant="ghost"
              size="xsmall"
              :icon="copiedWhat === 'path' ? 'check' : 'linkVariant'"
              :title="copiedWhat === 'path' ? i18n.copied : i18n.copyPath"
              @click="handleCopyPath"
            />
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
        <!-- 加载中（异步 git diff 期间不展示图例，避免与「无差异」空态混淆） -->
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
        <!-- 图例 + 着色行（复用共享 DiffLines 片段） -->
        <DiffLines
          v-else
          :i18n="i18n"
          :lines="coloredDiffLines"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush 工作区文件差异弹窗（自含渲染/范围切换/复制/键盘导航，diff 文本由父层经缓存下发）
import type { FileChange } from "../../types"
import { countDiffStats, diffCacheKey, fileStatusText, parseDiffLines } from "../../utils"
import { copyToClipboard } from "@/utils/domUtils"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import DiffLines from "../common/DiffLines.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 当前查看的文件 */
  file: FileChange
  /** 排序后的完整文件列表（用于上一个/下一个导航） */
  files: FileChange[]
  fileDiffs: Record<string, string>
  /** 在途差异请求标记（与 fileDiffs 同键），用于区分「加载中」与「无差异」 */
  diffLoading: Record<string, boolean>
  gitOpLoading: boolean
}>()

const emit = defineEmits<{
  close: []
  navigate: [file: FileChange]
  stageToggle: []
  discard: []
  /** 切换差异范围（暂存区 / 工作区）时请求另一份差异（仅查看，不改暂存状态） */
  requestDiff: [staged: boolean]
}>()

/** 差异范围：staged = 暂存区（git diff --cached），unstaged = 工作区（相对 index） */
type DiffScope = "staged" | "unstaged"

/** 复制成功后的反馈保持时长 */
const COPY_FEEDBACK_MS = 2000

/** 范围切换选项（labelKey 复用「已暂存 / 未暂存」既有文案键） */
const SCOPE_OPTIONS: { value: DiffScope, labelKey: string }[] = [
  { value: "staged", labelKey: "staged" },
  { value: "unstaged", labelKey: "unstaged" },
]

/** 仅「已暂存且工作区又改动」的文件存在两份差异，可切换查看 */
const canSwitchScope = computed(() => !!(props.file.staged && props.file.unstaged))

/** 当前查看的差异范围（初值取文件所在侧，文件身份变化时由 watch 重置） */
const scope = ref<DiffScope>(props.file.staged ? "staged" : "unstaged")

/** 当前范围的缓存键（与 fileDiffs / diffLoading 共用同一键空间） */
const diffKey = computed(() => diffCacheKey(props.file.path, scope.value === "staged"))

const diffText = computed(() => props.fileDiffs[diffKey.value] || "")

/** 在途请求标记（命中缓存时为假，已缓存文件二次打开不会闪加载态） */
const loading = computed(() => !!props.diffLoading[diffKey.value])

/** 将 diff 文本解析为带类型/行号/词级分段的行数组 */
const coloredDiffLines = computed(() => parseDiffLines(diffText.value))

/** 增/删行数统计（标题行展示） */
const diffStats = computed(() => countDiffStats(coloredDiffLines.value))

/** 文件状态文案（与列表状态 tooltip 同源，文案经 i18n 解析） */
const statusLabel = computed(() => fileStatusText(props.file, props.i18n))

/** 当前文件在列表中的下标：先按「路径 + 暂存状态」精确匹配，暂存状态刚翻转而列表未刷新时按路径回退 */
const fileIndex = computed(() => {
  const exact = props.files.findIndex((f) => f.path === props.file.path && f.staged === props.file.staged)
  if (exact >= 0) return exact
  return props.files.findIndex((f) => f.path === props.file.path)
})

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

/** 切换差异范围（只改变查看对象，不改变文件的暂存状态） */
function setScope(next: DiffScope) {
  if (scope.value === next) return
  scope.value = next
  emit("requestDiff", next === "staged")
}

// ── 复制（差异全文 / 文件路径）：统一走 copyToClipboard，成功后有 2 秒对勾反馈 ──
const copiedWhat = ref<"diff" | "path" | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copyText(text: string, what: "diff" | "path") {
  const ok = await copyToClipboard(text)
  if (!ok) return
  // 先清旧定时器，避免连续点击时旧定时器提前掐灭新反馈
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedWhat.value = what
  copiedTimer = setTimeout(() => { copiedWhat.value = null }, COPY_FEEDBACK_MS)
}

function handleCopyDiff() {
  if (!diffText.value) return
  void copyText(diffText.value, "diff")
}

function handleCopyPath() {
  void copyText(props.file.path, "path")
}

// 文件身份变化（导航切换 / 暂存状态翻转）时重置范围，避免停留在已无内容的 scope 上
watch(
  () => [props.file.path, props.file.staged, props.file.unstaged],
  () => { scope.value = props.file.staged ? "staged" : "unstaged" },
)

// Esc 关闭 / ← → 切换文件（组件仅在弹窗打开时挂载，onMounted/onUnmounted 即等价于开关监听）
// 捕获阶段拦截并阻止继续派发，避免按键穿透触发下层弹窗的 Esc 监听（对齐 CommitFileDiffDialog）
function handleKeydown(e: KeyboardEvent) {
  const handled = e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight"
  if (!handled) return
  e.stopImmediatePropagation()
  if (e.key === "Escape") emit("close")
  else if (e.key === "ArrowLeft") navigate(-1)
  else navigate(1)
}

onMounted(() => window.addEventListener("keydown", handleKeydown, true))
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown, true)
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreeDiffDialog.scss";
</style>
