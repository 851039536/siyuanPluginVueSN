<!-- gitPush 工作区文件预览（文本 / Markdown / 图片；二进制与超大文件只给元信息 + 外部打开） -->
<template>
  <div class="we-preview">
    <!-- 空态："选择左侧文件查看内容" -->
    <EmptyState
      v-if="!filePath"
      icon="mdi:file-search-outline"
      :text="i18n.workspaceFilesSelectHint"
    />

    <template v-else>
      <!-- 预览头：图标 + 路径 + 大小 + 操作（复制 / 定位 / 外部打开） -->
      <div class="we-preview-header">
        <Icon
          :icon="workspaceFileIcon(filePath)"
          height="12"
          class="we-preview-icon"
        />
        <span
          class="we-preview-path"
          :title="filePath"
        >{{ filePath }}</span>
        <span
          v-if="preview"
          class="we-preview-size"
        >{{ formatFileSize(preview.size) }}</span>
        <!-- 复制相对路径（反馈态："已复制"） -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :icon="copied ? 'check' : 'copy'"
          :title="copied ? i18n.workspaceFilesCopied : i18n.workspaceFilesCopyPath"
          @click="copyPath"
        />
        <!-- 在文件管理器中显示 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="folderOpen"
          :title="i18n.workspaceFilesReveal"
          @click="revealInFolder"
        />
        <!-- 用默认程序打开 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="openInNew"
          :title="i18n.workspaceFilesOpenDefault"
          @click="openDefault"
        />
      </div>

      <!-- 预览体（按 kind 分流；文本/Markdown 可直接阅读，其余给出原因与外部打开入口） -->
      <div class="we-preview-body">
        <template v-if="preview && preview.kind === 'image'">
          <img
            class="we-preview-image"
            :src="preview.dataUrl"
            :alt="filePath"
            :title="filePath"
          >
        </template>
        <!-- Markdown 渲染（parseMarkdown 已消毒；排版复用文档预览弹窗的 .gp-md-content） -->
        <article
          v-else-if="preview && preview.kind === 'markdown'"
          class="gp-md-content we-preview-md"
          v-html="markdownHtml"
        />
        <pre
          v-else-if="preview && preview.kind === 'text'"
          class="we-preview-code"
        >{{ preview.content }}</pre>
        <!-- 不可预览原因："二进制文件不支持预览" / "文件过大，不预览内容" / "文件不存在或已被删除" / "预览读取失败" -->
        <EmptyState
          v-else
          :icon="preview?.kind === 'binary' ? 'mdi:file-eye-outline' : 'mdi:file-alert-outline'"
          :text="fallbackText"
        >
          <template
            v-if="preview?.kind === 'oversized' || preview?.kind === 'binary'"
            #action
          >
            <!-- 按钮："用默认程序打开" -->
            <Button
              variant="ghost"
              size="xsmall"
              icon="openInNew"
              @click="openDefault"
            >
              {{ i18n.workspaceFilesOpenDefault }}
            </Button>
          </template>
        </EmptyState>
      </div>

      <!-- 截断提示："文件过大，仅显示前 256 KB" -->
      <div
        v-if="preview?.truncated"
        class="we-preview-foot"
      >
        <Icon
          icon="mdi:alert-circle-outline"
          height="12"
        />
        {{ i18n.workspaceFilesTruncated }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 工作区文件预览（只读；读取逻辑与大小上限在 utils/workspaceFile，组件只管展示与三个本地动作）
import type { WorkspaceFilePreview } from "../../utils"
import { Icon } from "@iconify/vue"
import { computed, ref, watch } from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import { formatFileSize } from "@/utils/format"
import { parseMarkdown } from "@/utils/mdRenderer"
import {
  openLocalPath,
  readWorkspaceFilePreview,
  resolveWorkspacePath,
  workspaceFileIcon,
} from "../../utils"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import Button from "@/components/Button.vue"
import EmptyState from "../common/EmptyState.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目根绝对路径（当前设备有效路径） */
  projectPath: string
  /** 当前选中文件（相对仓库根；空串 = 未选中） */
  filePath: string
}>()

/** 当前文件的预览结果（同步读盘，256 KB 以内） */
const preview = ref<WorkspaceFilePreview | null>(null)

function loadPreview() {
  preview.value = props.filePath && props.projectPath
    ? readWorkspaceFilePreview(props.projectPath, props.filePath)
    : null
}

watch(() => [props.projectPath, props.filePath], loadPreview, { immediate: true })

/** Markdown 渲染（仅在选中 .md 时执行） */
const markdownHtml = computed(() => {
  if (preview.value?.kind !== "markdown" || !preview.value.content) return ""
  return parseMarkdown(preview.value.content, { codeHighlight: true })
})

/** 不可预览时的原因文案（二进制 / 超大 / 已删除 / 读取失败） */
const fallbackText = computed(() => {
  switch (preview.value?.kind) {
    case "binary":
      return props.i18n.workspaceFilesBinary
    case "oversized":
      return props.i18n.workspaceFilesOversized
    case "missing":
      return props.i18n.workspaceFilesMissing
    default:
      return props.i18n.workspaceFilesReadFailed
  }
})

const { copied, notifyCopied } = useCopyFeedback()

/** 复制相对路径 */
async function copyPath() {
  if (!props.filePath) return
  const ok = await copyToClipboard(props.filePath)
  if (ok) notifyCopied()
}

/** 绝对路径（越界/Node 不可用返回 null） */
function absolutePath(): string | null {
  return props.projectPath ? resolveWorkspacePath(props.projectPath, props.filePath) : null
}

/** 用系统默认程序打开 */
function openDefault() {
  const abs = absolutePath()
  if (abs) openLocalPath(abs)
}

/** 在文件管理器中显示（打开所在目录；根级文件打开项目根） */
function revealInFolder() {
  const idx = props.filePath.lastIndexOf("/")
  const dirRel = idx === -1 ? "." : props.filePath.slice(0, idx)
  const abs = props.projectPath ? resolveWorkspacePath(props.projectPath, dirRel) : null
  if (abs) openLocalPath(abs)
}
</script>

<style lang="scss">
@use "../../styles/MarkdownPreviewDialog.scss";
</style>
