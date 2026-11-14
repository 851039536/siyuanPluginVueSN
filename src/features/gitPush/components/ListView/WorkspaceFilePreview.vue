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
          ref="markdownEl"
          class="gp-md-content we-preview-md"
          @click="onMarkdownClick"
          v-html="markdownHtml"
        />
        <pre
          v-else-if="preview && preview.kind === 'text'"
          class="we-preview-code"
          :class="{ 'is-wrapped': softWrap }"
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
import { copyToClipboard, openExternalUrl } from "@/utils/domUtils"
import { formatFileSize } from "@/utils/format"
import { parseMarkdown } from "@/utils/mdRenderer"
import {
  classifyWorkspaceFile,
  openLocalPath,
  readWorkspaceFilePreview,
  readWorkspaceImageDataUrl,
  resolveWorkspacePath,
  resolveWorkspaceRelative,
  revealLocalPath,
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
  /** 外部刷新序号（「刷新文件列表」后递增，用于重读当前文件的磁盘内容） */
  reloadKey?: number
}>()

const emit = defineEmits<{
  /** Markdown 内点站内相对链接：请求在上层切换到该文件（同库浏览，不离开本弹窗） */
  navigate: [path: string]
}>()

/** 当前文件的预览结果（同步读盘，256 KB 以内） */
const preview = ref<WorkspaceFilePreview | null>(null)

function loadPreview() {
  preview.value = props.filePath && props.projectPath
    ? readWorkspaceFilePreview(props.projectPath, props.filePath)
    : null
}

// reloadKey：树刷新后磁盘内容可能已变（编辑器保存、分支切换），选中路径不变也要重读
watch(() => [props.projectPath, props.filePath, props.reloadKey ?? 0], loadPreview, { immediate: true })

/**
 * 文本预览是否软换行：仅在「存在超长行」时开启。
 * minified 文件（一整行几万字符）不换行就是一条几千 px 宽的横向滚动，
 * 屏幕上什么都看不到 —— 这种文件自动换行，正常代码仍保持不换行（对齐不乱）。
 */
const softWrap = computed(() => {
  const content = preview.value?.kind === "text" ? preview.value.content : undefined
  if (!content) return false
  return hasVeryLongLine(content)
})

/** 是否存在超过 limit 字符的行（单次扫描，命中即返回） */
function hasVeryLongLine(text: string, limit = 240): boolean {
  let lineLength = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      lineLength = 0
      continue
    }
    if (++lineLength > limit) return true
  }
  return false
}

/** Markdown 渲染（仅在选中 .md 时执行） */
const markdownHtml = computed(() => {
  if (preview.value?.kind !== "markdown" || !preview.value.content) return ""
  return parseMarkdown(preview.value.content, { codeHighlight: true })
})

// ── Markdown 站内资源后处理（图片内联 / 相对链接点击）──
// 为什么在渲染后改 DOM 而不是渲染前改写 HTML：
// ① 打包后 CSP 是 `img-src 'self' data: blob:`，`file://` 一律被拦；
// ② `sanitizeHtml` 会把 HTML 字符串里的 `data:` src 直接剥掉（安全边界，不放宽）。
// 所以唯一可行路径是：v-html 出 DOM → 从磁盘读图 → 赋 data URL。
const markdownEl = ref<HTMLElement | null>(null)
/** 已做过处理的「元素 + HTML」组合：同一份内容不重复读盘；
 *  元素身份参与判定，切走再切回（v-else-if 重建 DOM）时能重新内联。 */
let enrichedEl: HTMLElement | null = null
let enrichedHtml = ""

watch([markdownHtml, markdownEl], ([html, el]) => {
  if (!html || !el) return
  if (el === enrichedEl && html === enrichedHtml) return
  enrichedEl = el
  enrichedHtml = html
  enrichMarkdownAssets(el)
}, { immediate: true, flush: "post" })

/** 把相对 `<img src>` 换成 data URL；读不到的换成占位文本（不留破图图标） */
function enrichMarkdownAssets(root: HTMLElement) {
  if (!props.projectPath || !props.filePath) return
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? ""
    if (!src) continue
    // 绝对 URL / data: / 锚点：不是站内文件，原样保留（远程图片仍受 CSP 限制）
    const rel = resolveWorkspaceRelative(props.projectPath, props.filePath, src)
    if (!rel) continue
    const dataUrl = readWorkspaceImageDataUrl(props.projectPath, rel)
    if (dataUrl) {
      img.setAttribute("src", dataUrl)
      continue
    }
    const placeholder = document.createElement("span")
    placeholder.className = "we-md-asset-missing"
    placeholder.textContent = src
    placeholder.title = src
    img.replaceWith(placeholder)
  }
}

/**
 * Markdown 内链接点击：
 * - http(s) → 系统浏览器（默认行为会被主进程导航拦截，这里显式接管）；
 * - 站内 `.md` → 在上层切换预览文件（README 里链到 docs/xxx.md 是高频场景）；
 * - 其他站内文件 → 用默认程序打开；
 * - `#anchor` / `mailto:` 与其他站外协议 → 吞掉（消毒后无 id 可定位，非 http 也不便外开）。
 */
function onMarkdownClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement | null)?.closest("a")
  if (!anchor) return
  const href = anchor.getAttribute("href") ?? ""
  if (!href) return
  e.preventDefault()
  if (/^https?:\/\//i.test(href)) {
    void openExternalUrl(href)
    return
  }
  if (href.startsWith("#")) return
  const rel = resolveWorkspaceRelative(props.projectPath, props.filePath, href)
  if (!rel) return
  if (classifyWorkspaceFile(rel) === "markdown") {
    emit("navigate", rel)
    return
  }
  const abs = resolveWorkspacePath(props.projectPath, rel)
  if (abs) void openLocalPath(abs)
}

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

/** 在文件管理器中显示并选中该文件（无 shell 能力时降级为打开所在目录） */
function revealInFolder() {
  const absFile = props.projectPath ? resolveWorkspacePath(props.projectPath, props.filePath) : null
  if (absFile && revealLocalPath(absFile)) return
  const idx = props.filePath.lastIndexOf("/")
  const dirRel = idx === -1 ? "." : props.filePath.slice(0, idx)
  const absDir = props.projectPath ? resolveWorkspacePath(props.projectPath, dirRel) : null
  if (absDir) openLocalPath(absDir)
}
</script>
