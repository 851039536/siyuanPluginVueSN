<!-- gitPush 提交文件弹窗：列出指定提交修改的文件（状态标记 + 路径 + 重命名旧路径），行内自取数据 -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="emit('close')"
    >
      <div class="gp-dialog gcf-dialog">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："修改的文件" -->
          <span class="gp-dialog-title">{{ i18n.commitFilesTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" height="10" />
          </button>
        </div>

        <div class="gp-dialog-body">
          <!-- 加载中 -->
          <div
            v-if="loading"
            class="gp-loading"
          >
            <Loader />
          </div>

          <template v-else>
            <!-- 项目信息 + 提交 hash + 文件计数 -->
            <div class="gcf-meta">
              <span class="gcf-project">{{ project?.name || target.projectName }}</span>
              <span class="gcf-hash">{{ target.hash }}</span>
              <span
                v-if="!error"
                class="gcf-count"
              >{{ i18n.commitFilesCount.replace("{0}", String(files.length)) }}</span>
            </div>

            <!-- 提交信息（弱化单行展示，悬停查看全文） -->
            <div
              v-if="target.message"
              class="gcf-message"
              :title="target.message"
            >{{ target.message }}</div>

            <!-- 加载失败提示 -->
            <div
              v-if="error"
              class="gcf-note gcf-note--error"
            >
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ error }}</span>
            </div>

            <!-- 空态（merge 提交 git show 默认不输出合并差异） -->
            <div
              v-else-if="files.length === 0"
              class="gcf-note"
            >
              <Icon icon="mdi:file-document-outline" height="12" />
              <span>{{ target.isMerge ? i18n.commitFilesEmptyMerge : i18n.commitFilesEmpty }}</span>
            </div>

            <!-- 文件列表 -->
            <div
              v-else
              class="gcf-list"
            >
              <div
                v-for="file in files"
                :key="`${file.status}:${file.path}`"
                class="gcf-row"
                :class="{ 'is-active': diffFile === file }"
                :title="i18n.commitFilesOpenDiff"
                @click="openDiff(file)"
              >
                <!-- 状态标记：复用 WorkingTreePanel 的 .wt-file-status/.wt-s-* 着色，hover 可见含义 -->
                <span
                  class="wt-file-status"
                  :class="`wt-s-${file.status}`"
                  :title="fileStatusTitle(file)"
                >
                  <IconWrapper
                    v-if="isIconFileStatus(file)"
                    :name="fileStatusIconKey(file)"
                    :size="11"
                  />
                  <template v-else>{{ fileStatusIcon(file) }}</template>
                </span>
                <span
                  class="wt-file-path"
                  :title="file.path"
                >{{ file.path }}</span>
                <!-- 重命名/复制时的旧路径 -->
                <span
                  v-if="file.oldPath"
                  class="gcf-old"
                  :title="file.oldPath"
                >← {{ file.oldPath }}</span>
              </div>
            </div>
          </template>
        </div>

        <div class="gp-dialog-footer">
          <div class="gp-grow" />
          <!-- 关闭 -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            @click="emit('close')"
          >
            <span>{{ i18n.close }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 文件修改差异弹窗（点击文件行打开，复用工作区 diff 着色渲染与行号） -->
  <CommitFileDiffDialog
    v-if="diffFile && project"
    :i18n="i18n"
    :project="project"
    :hash="target.hash"
    :file="diffFile"
    :files="files"
    @close="diffFile = null"
    @navigate="navigateDiff"
  />
</template>

<script setup lang="ts">
// gitPush 提交文件弹窗（自包含：按 target 拉取 git show --name-status 文件清单并展示状态/旧路径）
import type { CommitFixTarget, FileChange, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { inject, onMounted, onUnmounted, ref } from "vue"
import { CARD_SERVICES_KEY } from "../../types"
import { fileStatusIcon, fileStatusIconKey, fileStatusTitle, isIconFileStatus, resolveValidPath } from "../../utils"
import { getErrorMessage } from "@/utils/stringUtils"
import Loader from "@/components/Loader.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CommitFileDiffDialog from "./CommitFileDiffDialog.vue"

const props = defineProps<{
  i18n: Record<string, any>
  target: CommitFixTarget
}>()

const emit = defineEmits<{
  close: []
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

const project = ref<GitProject | null>(null)
const files = ref<FileChange[]>([])
const loading = ref(true)
/** 加载失败信息 */
const error = ref("")
/** 当前正在查看修改差异的文件（null = 未打开差异弹窗） */
const diffFile = ref<FileChange | null>(null)

/** 点击文件行：打开该文件在本次提交中的差异弹窗 */
function openDiff(file: FileChange) {
  if (!project.value) return
  diffFile.value = file
}

/** 差异弹窗内上下文件导航（更新当前查看目标） */
function navigateDiff(file: FileChange) {
  diffFile.value = file
}

/** Esc：优先关闭上层差异弹窗；无差异弹窗时才关闭当前提交文件弹窗 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && !diffFile.value) emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void init()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

/** 拉取项目信息并解析该提交涉及的文件清单（merge/空提交返回空数组，交由空态展示） */
async function init() {
  try {
    const p = await manager.getProjectById(props.target.projectId)
    project.value = p ?? null
    if (!p) return
    const path = resolveValidPath(p)
    if (!path) return
    files.value = await manager.getCommitFiles(path, props.target.hash)
  } catch (e: unknown) {
    console.error("[gitPush] 获取提交文件失败:", e)
    error.value = getErrorMessage(e) || props.i18n.commitFilesLoadFailed
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss">
@use "../../styles/CommitFilesDialog.scss";
@use "../../styles/index.scss";
</style>
