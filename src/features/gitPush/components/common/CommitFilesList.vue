<!-- gitPush 提交内文件清单面板：加载展示某提交修改的文件并支持点击查看差异（无遮罩，供多个弹窗内嵌复用） -->
<template>
  <div class="gcl-wrap">
    <!-- 小节标题（宿主可传）+ 文件计数 -->
    <div
      v-if="!loading && !error && files.length"
      class="gcl-head"
    >
      <span
        v-if="headingText"
        class="gcl-head-label"
      >{{ headingText }}</span>
      <span
        class="gcl-count"
        :class="{ 'gcl-count--alone': !headingText }"
      >{{ i18n.commitFilesCount.replace("{0}", String(files.length)) }}</span>
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="gcl-state"
    >
      <Icon
        icon="mdi:loading"
        height="12"
        class="gp-spin"
      />
      <span>{{ i18n.loading }}</span>
    </div>

    <!-- 加载失败提示 -->
    <div
      v-else-if="error"
      class="gcl-note gcl-note--error"
    >
      <Icon icon="mdi:alert-circle-outline" height="12" />
      <span>{{ error }}</span>
    </div>

    <!-- 空态（merge 提交 git show 默认不输出合并差异等） -->
    <div
      v-else-if="files.length === 0"
      class="gcl-note"
    >
      <Icon icon="mdi:file-document-outline" height="12" />
      <span>{{ emptyText || i18n.commitFilesEmpty }}</span>
    </div>

    <!-- 文件列表（整行可点击打开差异弹窗） -->
    <div
      v-else
      class="gcl-list"
      :style="{ '--gcl-list-max-height': `${listHeight}px` }"
    >
      <div
        v-for="file in files"
        :key="`${file.status}:${file.path}`"
        class="gcl-row"
        :class="{ 'is-active': diffFile === file }"
        :title="i18n.commitFilesOpenDiff"
        @click="openDiff(file)"
      >
        <!-- 状态标记：复用 WorkingTreePanel 的 .wt-file-status/.wt-s-* 着色 -->
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
          class="gcl-old"
          :title="file.oldPath"
        >← {{ file.oldPath }}</span>
      </div>
    </div>
  </div>

  <!-- 文件修改差异弹窗（点击文件行打开，复用工作区 diff 着色渲染） -->
  <CommitFileDiffDialog
    v-if="diffFile"
    :i18n="i18n"
    :project="project"
    :hash="hash"
    :file="diffFile"
    :files="files"
    @close="diffFile = null"
    @navigate="navigateDiff"
  />
</template>

<script setup lang="ts">
// gitPush 提交内文件清单面板（自包含：拉取 git show --name-status 清单；点击行打开提交内 diff 弹窗）
import type { FileChange, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { inject, onMounted, ref } from "vue"
import { CARD_SERVICES_KEY } from "../../types"
import { fileStatusIcon, fileStatusIconKey, fileStatusTitle, isIconFileStatus, resolveValidPath } from "../../utils"
import { getErrorMessage } from "@/utils/stringUtils"
import IconWrapper from "@/components/IconWrapper.vue"
import CommitFileDiffDialog from "./CommitFileDiffDialog.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 所属项目（路径解析用） */
  project: GitProject
  /** 目标提交 hash */
  hash: string
  /** 小节标题（如"修改的文件"）；为空时不显示标题行 */
  headingText?: string
  /** 空态文案覆盖（如 merge 提交专门提示），缺省用通用"无文件变更" */
  emptyText?: string
  /** 列表滚动区高度（px），宿主按弹窗空间控制；缺省 240 */
  listHeight?: number
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

const files = ref<FileChange[]>([])
const loading = ref(true)
/** 加载失败信息 */
const error = ref("")
/** 当前正在查看修改差异的文件（null = 未打开差异弹窗） */
const diffFile = ref<FileChange | null>(null)

/** 点击文件行：打开该文件在本次提交中的差异弹窗 */
function openDiff(file: FileChange) {
  diffFile.value = file
}

/** 差异弹窗内上下文件导航（更新当前查看目标） */
function navigateDiff(file: FileChange) {
  diffFile.value = file
}

/** 拉取该提交涉及的文件清单（merge/空提交返回空数组，交由空态展示） */
async function load() {
  loading.value = true
  error.value = ""
  try {
    const path = resolveValidPath(props.project)
    if (!path) {
      files.value = []
      return
    }
    files.value = await manager.getCommitFiles(path, props.hash)
  } catch (e: unknown) {
    console.error("[gitPush] 获取提交文件失败:", e)
    error.value = getErrorMessage(e) || props.i18n.commitFilesLoadFailed
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style lang="scss">
@use "../../styles/CommitFilesList.scss";
@use "../../styles/index.scss";
</style>
