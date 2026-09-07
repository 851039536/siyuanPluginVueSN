<!-- gitPush 提交内文件 diff 弹窗：着色展示某提交对单个文件的修改（词级高亮 + 文件上下导航） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask cdf-overlay"
      @click.self="emit('close')"
    >
      <div class="cdf-dialog">
        <!-- 头部：文件路径 + 增删统计 + 导航/关闭 -->
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
            <!-- 重命名/复制旧路径 -->
            <span
              v-if="file.oldPath"
              class="cdf-old"
              :title="file.oldPath"
            >← {{ file.oldPath }}</span>
            <!-- 提交 hash 徽标 -->
            <span class="wt-diff-badge cdf-hash-badge">{{ hash }}</span>
            <!-- 增/删行数统计 -->
            <span
              v-if="stats.add || stats.del"
              class="wt-diff-stats"
            >
              <span class="wt-stat-add">+{{ stats.add }}</span>
              <span class="wt-stat-del">−{{ stats.del }}</span>
            </span>
          </div>
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
            <!-- 关闭 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="i18n.close"
              @click="emit('close')"
            >
              <Icon
                icon="mdi:close"
                height="12"
              />
            </button>
          </div>
        </div>

        <!-- 加载中（异步 git show 期间，图例暂不展示） -->
        <div
          v-if="loading"
          class="wt-diff-content cdf-loading"
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
          :lines="lines"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush 提交内文件 diff 弹窗（自包含：按 hash+file 拉取补丁并着色展示，复用共享 DiffLines 片段）
import type { FileChange, GitProject } from "../../types"
import { countDiffStats, parseDiffLines, resolveValidPath } from "../../utils"
import { Icon } from "@iconify/vue"
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue"
import { CARD_SERVICES_KEY } from "../../types"
import DiffLines from "./DiffLines.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 所属项目（diff 路径解析用） */
  project: GitProject
  /** 目标提交 hash（短 hash 可被 git 解析） */
  hash: string
  /** 当前查看的文件 */
  file: FileChange
  /** 提交涉及的完整文件列表（用于上一个/下一个导航） */
  files: FileChange[]
}>()

const emit = defineEmits<{
  close: []
  navigate: [file: FileChange]
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

/** 原始 diff 文本（按文件加载） */
const diffText = ref("")
const loading = ref(true)

/** 将 diff 文本解析为带类型/行号/词级分段的行数组 */
const lines = computed(() => parseDiffLines(diffText.value))

/** 增/删行数统计（标题行展示） */
const stats = computed(() => countDiffStats(lines.value))

/** 当前文件在列表中的下标（路径匹配；单个提交内路径唯一） */
const fileIndex = computed(() => props.files.findIndex((f) => f.path === props.file.path))

function navigate(delta: number) {
  const target = props.files[fileIndex.value + delta]
  if (target) emit("navigate", target)
}

/** 拉取该提交对当前文件的补丁 */
async function load() {
  loading.value = true
  try {
    const path = resolveValidPath(props.project)
    if (!path) {
      diffText.value = ""
      return
    }
    diffText.value = await manager.getCommitFilePatch(path, props.hash, props.file.path)
  } catch {
    diffText.value = ""
  } finally {
    loading.value = false
  }
}

// 上下文件切换时重新加载（组件保持挂载，watch 替代重建）
watch(() => props.file.path, () => { void load() })

// Esc 关闭 / ← → 切换文件（组件仅在打开时挂载，onMounted/onUnmounted 即等价于开关监听）
// 捕获阶段拦截并阻止继续派发，避免按键穿透触发下层弹窗（如提交文件/修正信息弹窗）的 Esc 监听
function handleKeydown(e: KeyboardEvent) {
  const handled = e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight"
  if (!handled) return
  e.stopImmediatePropagation()
  if (e.key === "Escape") emit("close")
  else if (e.key === "ArrowLeft") navigate(-1)
  else if (e.key === "ArrowRight") navigate(1)
}
onMounted(() => {
  window.addEventListener("keydown", handleKeydown, true)
  void load()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown, true)
})
</script>

<style lang="scss">
@use "../../styles/CommitFileDiffDialog.scss";
@use "../../styles/index.scss";
</style>
