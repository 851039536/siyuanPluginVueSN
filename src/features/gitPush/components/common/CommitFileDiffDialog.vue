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

        <!-- 图例："+ 新增 / − 删除 / ⋯ 未变" -->
        <div class="wt-diff-legend">
          <span class="wt-legend-add">+ {{ i18n.legendAdd }}</span>
          <span class="wt-legend-del">− {{ i18n.legendDel }}</span>
          <span class="wt-legend-ctx">⋯ {{ i18n.legendCtx }}</span>
        </div>

        <!-- diff 内容区（加载中 / 空态 / 着色行） -->
        <div class="wt-diff-content">
          <div
            v-if="loading"
            class="cdf-loading"
          >
            <Icon
              icon="mdi:loading"
              height="12"
              class="gp-spin"
            />
            <span>{{ i18n.loading }}</span>
          </div>
          <div
            v-else-if="!lines.length"
            class="wt-diff-empty"
          >
            {{ i18n.diffEmpty }}
          </div>
          <template v-else>
            <div
              v-for="(line, i) in lines"
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
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush 提交内文件 diff 弹窗（自包含：按 hash+file 拉取补丁并着色展示，复用工作区 diff 视觉类）
import type { FileChange, GitProject } from "../../types"
import type { DiffLineType } from "../../utils"
import { parseDiffLines, resolveValidPath } from "../../utils"
import { Icon } from "@iconify/vue"
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue"
import { CARD_SERVICES_KEY } from "../../types"

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

// diff 行类型 → 行首符号（替代模板中的三元链）
const DIFF_SIGN: Record<DiffLineType, string> = {
  add: "+",
  del: "−",
  hunk: "@",
  ctx: " ",
  meta: " ",
}

/** 原始 diff 文本（按文件加载） */
const diffText = ref("")
const loading = ref(true)

/** 将 diff 文本解析为带类型/行号/词级分段的行数组 */
const lines = computed(() => parseDiffLines(diffText.value))

/** 增/删行数统计（标题行展示） */
const stats = computed(() => {
  let add = 0
  let del = 0
  for (const line of lines.value) {
    if (line.type === "add") add++
    else if (line.type === "del") del++
  }
  return { add, del }
})

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
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
  else if (e.key === "ArrowLeft") navigate(-1)
  else if (e.key === "ArrowRight") navigate(1)
}
onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void load()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})
</script>

<style lang="scss">
@use "../../styles/CommitFileDiffDialog.scss";
@use "../../styles/index.scss";
</style>
