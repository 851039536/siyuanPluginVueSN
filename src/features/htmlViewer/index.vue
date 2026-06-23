<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="html-viewer-overlay"
        @click.self="closeDialog"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="html-viewer-dialog"
          >
            <!-- 头部 -->
            <div class="dialog-header">
              <div class="header-title">
                <IconWrapper
                  name="browser"
                  :size="22"
                />
                <h2>HTML 展示</h2>
              </div>
              <div class="header-actions">
                <div class="mode-switcher">
                  <button
                    v-for="m in modes"
                    :key="m.key"
                    class="mode-btn"
                    :class="{ active: viewMode === m.key }"
                    :title="m.label"
                    @click="viewMode = m.key"
                  >
                    {{ m.label }}
                  </button>
                </div>
                <Button
                  icon="add"
                  variant="primary"
                  size="small"
                  @click="openSaveModal"
                >
                  保存片段
                </Button>
                <Button
                  icon="close"
                  variant="ghost"
                  size="small"
                  @click="closeDialog"
                />
              </div>
            </div>

            <!-- 内容区 -->
            <div class="dialog-body">
              <!-- 视图切换区 -->
              <div class="content-area">
                <!-- 源码编辑 -->
                <div
                  v-if="viewMode === 'source' || viewMode === 'split'"
                  class="source-panel"
                  :class="{ 'split-mode': viewMode === 'split' }"
                >
                  <div class="panel-header">
                    <span>源码</span>
                    <div class="panel-actions">
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制源码"
                        @click="copySource"
                      />
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制渲染内容（带样式，适配公众号等平台）"
                        @click="copyRenderedContent"
                      >
                        带样式
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制为 Unicode 文本表格（适配B站等不支持table标签的平台）"
                        @click="copyAsTextTable"
                      >
                        文本表格
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        icon="edit"
                        title="格式化HTML"
                        @click="formatHtml"
                      />
                      <Button
                        variant="ghost"
                        size="small"
                        icon="regex"
                        title="适配手机宽度"
                        @click="normalizeContentWidths"
                      />
                      <Button
                        variant="ghost"
                        size="small"
                        :class="{ 'json-btn-active': isJsonFormatted }"
                        title="格式化JSON（公众号浅色背景）"
                        @click="formatJsonContent"
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                  <textarea
                    v-model="htmlContent"
                    class="html-source-editor"
                    placeholder="在此输入或粘贴HTML代码..."
                    spellcheck="false"
                  ></textarea>
                </div>

                <!-- 预览 -->
                <div
                  v-if="viewMode === 'preview' || viewMode === 'split'"
                  class="preview-panel"
                  :class="{ 'split-mode': viewMode === 'split' }"
                >
                  <div class="panel-header">
                    <span>预览</span>
                    <div class="panel-actions">
                      <Button
                        v-if="isJsonFormatted"
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制格式化JSON HTML"
                        @click="copyFormattedJsonHtml"
                      />
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制渲染内容（带样式，适配哔哩哔哩等平台）"
                        @click="copyRenderedContent"
                      >
                        带样式
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制为 Unicode 文本表格（适配B站等不支持table标签的平台）"
                        @click="copyAsTextTable"
                      >
                        文本表格
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制为图片"
                        @click="copyAsImage"
                      />
                    </div>
                  </div>
                  <div
                    v-if="isJsonFormatted"
                    class="json-format-badge"
                  >
                    <span class="json-badge-icon">{ }</span>
                    <span>JSON 格式化 · GitHub浅色主题 · 公众号可用</span>
                    <Button
                      variant="ghost"
                      size="small"
                      @click="isJsonFormatted = false"
                    >
                      还原
                    </Button>
                  </div>
                  <div class="html-preview-container">
                    <iframe
                      ref="previewFrame"
                      class="html-preview-iframe"
                      sandbox="allow-scripts allow-same-origin"
                      :srcdoc="previewHtml"
                    ></iframe>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部：片段库入口 -->
            <div class="dialog-footer">
              <Button
                variant="ghost"
                size="small"
                @click="showSnippetLibrary = true"
              >
                <IconWrapper
                  name="folder"
                  :size="14"
                />
                片段库 ({{ snippetCount }})
              </Button>
              <div class="footer-info">
                <span
                  v-if="htmlContent"
                  class="content-size"
                >{{ contentSize }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- 子组件弹窗 -->
  <SnippetEditModal
    v-model:visible="showEditModal"
    :snippet="editingSnippet"
    :categories="categories"
    :default-content="htmlContent"
    @save="handleSaveEdit"
  />
  <SnippetLibrary
    v-model:visible="showSnippetLibrary"
    :snippets="snippets"
    :categories="categories"
    @load-snippet="loadSnippet"
    @edit-snippet="editSnippet"
    @delete-snippet="deleteSnippet"
    @create-snippet="openCreateSnippet"
    @manage-categories="showCategoryManager = true"
  />
  <CategoryManager
    v-model:visible="showCategoryManager"
    :categories="categories"
    @add-category="addCategory"
    @delete-category="deleteCategory"
  />
</template>

<script setup lang="ts">
import type {
  HtmlCategory,
  HtmlSnippet,
} from "./types"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { usePlugin } from "@/main"
import {
  copyToClipboard,
  triggerDownload,
} from "@/utils/domUtils"
import CategoryManager from "./components/CategoryManager.vue"
import SnippetEditModal from "./components/SnippetEditModal.vue"
import SnippetLibrary from "./components/SnippetLibrary.vue"
import {
  DEFAULT_CATEGORIES,
  HtmlViewerStorage,
} from "./types/storage"
import {
  isJsonString,
  jsonToHtml,
} from "./utils/jsonFormatter"
import { normalizeWidths } from "./utils/normalizeWidths"

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "close"): void
}>()

const plugin = usePlugin()
const storage = new HtmlViewerStorage(plugin)

// 视图模式
const modes = [
  {
    key: "preview" as const,
    label: "预览",
  },
  {
    key: "source" as const,
    label: "源码",
  },
  {
    key: "split" as const,
    label: "分栏",
  },
]
const viewMode = ref<"preview" | "source" | "split">("preview")

// HTML内容
const htmlContent = ref("")
const previewFrame = ref<HTMLIFrameElement | null>(null)

// 弹窗状态
const showSnippetLibrary = ref(false)
const showEditModal = ref(false)
const showCategoryManager = ref(false)

// 片段库状态
const editingSnippet = ref<HtmlSnippet | null>(null)
const snippets = ref<HtmlSnippet[]>([])
const categories = ref<HtmlCategory[]>([...DEFAULT_CATEGORIES])

// JSON 格式化状态
const isJsonFormatted = ref(false)

const BASE_STYLES = [
  '<style>',
  'code,pre,kbd,samp{font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace}',
  'code{background:#f6f8fa;padding:2px 4px;border-radius:3px;font-size:0.9em}',
  'pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;line-height:1.5}',
  'pre code{background:none;padding:0;font-size:inherit}',
  'table{border-collapse:collapse;width:100%}',
  'td,th{border:1px solid #dfe2e5;padding:6px 13px}',
  'th{background:#f6f8fa;font-weight:600}',
  '</style>',
].join('')

/**
 * 直接内联样式映射表
 * 不依赖 styleSheets.cssRules API（iframe sandbox 下可能静默失败）
 * 通过字符串操作直接注入 style="" 属性，确保复制到哔哩哔哩等平台时样式不丢失
 */
const INLINE_STYLE_MAP: Record<string, string> = {
  code:
    'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;background:#f6f8fa;padding:2px 4px;border-radius:3px;font-size:0.9em',
  pre:
    'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;line-height:1.5',
  kbd: 'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace',
  samp: 'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace',
  table: 'border-collapse:collapse;width:100%',
  th: 'border:1px solid #dfe2e5;padding:6px 13px;background:#f6f8fa;font-weight:600',
  td: 'border:1px solid #dfe2e5;padding:6px 13px',
}

/** 清洗 SiYuan 专属属性/包裹元素 + 注入内联样式，返回可直接粘贴的干净 HTML */
function cleanAndInlineStyles(html: string): string {
  let result = html
  // 移除 <script> 标签（安全）
  result = result.replace(/<script[\s\S]*?<\/script>/gi, '')
  // 移除 SiYuan 专属包裹元素
  result = result.replace(/<\/?protyle-[\w-][^>]*>/gi, '')
  result = result.replace(/<\/?div[^>]*data-node-id[^>]*>/gi, '')
  // 移除所有 data-* 属性
  result = result.replace(/\s+data-[\w-]+="[^"]*"/gi, '')
  // 注入内联样式到各标签
  for (const [tag, styles] of Object.entries(INLINE_STYLE_MAP)) {
    result = result.replace(new RegExp(`<${tag}([^>]*?)>`, 'gi'), (_, attrs: string) => {
      const existingMatch = attrs.match(/style="([^"]*)"/i)
      const cleaned = attrs.replace(/\s*style="[^"]*"/i, '')
      const combined = existingMatch ? `${styles};${existingMatch[1]}` : styles
      return `<${tag}${cleaned} style="${combined}">`
    })
  }
  // 给 table 注入 border/cellspacing 属性（兼容哔哩哔哩等不支持 inline style 的编辑器）
  result = result.replace(/<table([^>]*)>/gi, (_, attrs: string) => {
    let cleaned = attrs.replace(/\s*border="[^"]*"/i, '').replace(/\s*cellspacing="[^"]*"/i, '')
    return `<table${cleaned} border="1" cellspacing="0">`
  })
  return result
}

/**
 * iframe 内 Ctrl+C 拦截脚本
 * 用与 cleanAndInlineStyles 相同的映射表，确保 iframe 内复制也自动内联样式
 */
const COPY_INTERCEPT_SCRIPT = `<script>
(function(){
  var S={
    code:'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;background:#f6f8fa;padding:2px 4px;border-radius:3px;font-size:0.9em',
    pre:'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;line-height:1.5',
    kbd:'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace',
    samp:'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace',
    table:'border-collapse:collapse;width:100%',
    th:'border:1px solid #dfe2e5;padding:6px 13px;background:#f6f8fa;font-weight:600',
    td:'border:1px solid #dfe2e5;padding:6px 13px'
  };
  function apply(){
    for(var t in S){
      var els=document.querySelectorAll(t);
      for(var i=0;i<els.length;i++){
        var e=els[i];if(!e.style)continue;
        var ps=S[t].split(';');
        for(var j=0;j<ps.length;j++){
          var kv=ps[j].split(':');
          if(kv.length===2&&!e.style.getPropertyValue(kv[0].trim()))
            e.style.setProperty(kv[0].trim(),kv[1].trim());
        }
      }
    }
  }
  document.addEventListener('copy',function(e){
    try{
      apply();
      var h='';
      var ss=document.querySelectorAll('style');
      for(var i=0;i<ss.length;i++)h+=ss[i].outerHTML;
      h+=document.body.innerHTML;
      e.clipboardData.setData('text/html',h);
      e.clipboardData.setData('text/plain',document.body.innerText);
      e.preventDefault();
    }catch(ex){}
  });
})();
  <` + '/script>'

function wrapWithBaseStyles(content: string): string {
  if (/<\/body>/i.test(content)) {
    return content.replace(/<\/body>/i, `${BASE_STYLES}${COPY_INTERCEPT_SCRIPT}</body>`)
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${BASE_STYLES}${COPY_INTERCEPT_SCRIPT}${content}</body></html>`
}

// 预览HTML（带JSON格式化支持 + debounce 防抖）
const previewHtml = ref("")
let previewTimer: ReturnType<typeof setTimeout> | null = null

function buildPreviewHtml(): string {
  let content = htmlContent.value
  if (isJsonFormatted.value && content.trim()) {
    const result = jsonToHtml(content)
    if (!result.error) {
      content = result.html
    }
  }
  return wrapWithBaseStyles(content)
}

watch(
  [htmlContent, isJsonFormatted],
  () => {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      previewHtml.value = buildPreviewHtml()
    }, 300)
  },
  { immediate: true },
)

// JSON格式化内容（公众号浅色背景主题）
function formatJsonContent() {
  if (!htmlContent.value.trim()) {
    showMessage("没有可格式化的内容", 2000, "info")
    return
  }
  if (isJsonFormatted.value) {
    isJsonFormatted.value = false
    showMessage("已还原为原始内容", 2000, "info")
    return
  }
  if (!isJsonString(htmlContent.value)) {
    showMessage("内容不是有效的JSON格式", 2000, "error")
    return
  }
  isJsonFormatted.value = true
  showMessage("JSON 已格式化 · GitHub浅色主题", 2000, "info")
}

// 复制格式化后的JSON HTML
async function copyFormattedJsonHtml() {
  const result = jsonToHtml(htmlContent.value)
  if (result.error) {
    showMessage(result.error, 2000, "error")
    return
  }
  const ok = await copyToClipboard(result.html)
  showMessage(ok ? "格式化JSON HTML已复制，可直接粘贴到公众号" : "复制失败", 2000, ok ? "info" : "error")
}

// 内容大小
const contentSize = computed(() => {
  const bytes = new Blob([htmlContent.value]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

// 片段数量
const snippetCount = computed(() => snippets.value.length)

// 复制源码
async function copySource() {
  const ok = await copyToClipboard(htmlContent.value)
  showMessage(ok ? "源码已复制" : "复制失败", 2000, ok ? "info" : "error")
}

/**
 * 复制渲染内容（保留样式，适配哔哩哔哩/公众号等平台）
 * 直接对源 HTML 做字符串清洗 + 内联样式注入，不依赖 iframe DOM
 * 解决 iframe sandbox 下 styleSheets.cssRules 静默失败的问题
 */
async function copyRenderedContent() {
  const source = htmlContent.value
  if (!source.trim()) {
    showMessage("没有可复制的内容", 2000, "info")
    return
  }

  // 1. 清洗 SiYuan 专属内容 + 注入内联样式
  const cleanedHtml = cleanAndInlineStyles(source)
  // 2. 拼接 <style> 标签（兜底：内联无法处理的伪类/媒体查询）
  const finalHtml = `${BASE_STYLES}${cleanedHtml}`
  // 3. 提取纯文本
  const text = source.replace(/<[^>]*>/g, '').trim()

  try {
    const htmlBlob = new Blob([finalHtml], { type: "text/html" })
    const textBlob = new Blob([text], { type: "text/plain" })
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ])
    showMessage("已复制渲染内容（带样式）", 2000, "info")
  } catch {
    // 降级：用 copyToClipboard 写入纯 HTML 源码
    const ok = await copyToClipboard(finalHtml)
    showMessage(ok ? "已复制（富文本剪贴板不可用，已复制HTML源码）" : "复制失败", 2000, ok ? "info" : "error")
  }
}

/**
 * Unicode 文本表格生成器
 * 将 HTML table 转换为 Unicode box-drawing 文本表格
 * 用于不支持 <table> 标签的平台（如哔哩哔哩专栏编辑器）
 */
function getDisplayWidth(str: string): number {
  let width = 0
  for (const char of str) {
    const code = char.codePointAt(0)!
    // CJK 全角字符宽度为 2
    if (
      (code >= 0x4E00 && code <= 0x9FFF) // CJK Unified
      || (code >= 0x3000 && code <= 0x303F) // CJK Punctuation
      || (code >= 0xFF00 && code <= 0xFFEF) // Fullwidth Forms
      || (code >= 0x3400 && code <= 0x4DBF) // CJK Extension A
      || (code >= 0xAC00 && code <= 0xD7AF) // Hangul
      || (code >= 0x3040 && code <= 0x30FF) // Hiragana/Katakana
      || code >= 0x20000 // CJK Extension B+
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

function padEndCJK(str: string, targetWidth: number): string {
  const currentWidth = getDisplayWidth(str)
  const padding = Math.max(0, targetWidth - currentWidth)
  return str + " ".repeat(padding)
}

function htmlToTextTable(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  const tables = doc.querySelectorAll("table")
  if (tables.length === 0) return ""

  const results: string[] = []
  for (const table of tables) {
    const rows: string[][] = []
    let maxCols = 0
    for (const tr of table.querySelectorAll("tr")) {
      const cells: string[] = []
      for (const cell of tr.querySelectorAll("th, td")) {
        cells.push((cell.textContent || "").trim().replace(/\s+/g, " "))
      }
      if (cells.length > maxCols) maxCols = cells.length
      rows.push(cells)
    }
    if (rows.length === 0 || maxCols === 0) continue

    // 计算每列最大显示宽度（最小 4）
    const colWidths: number[] = new Array(maxCols).fill(4)
    for (const row of rows) {
      for (let c = 0; c < row.length; c++) {
        colWidths[c] = Math.max(colWidths[c], getDisplayWidth(row[c]))
      }
    }
    // 限制单列最大宽度 40
    for (let c = 0; c < maxCols; c++) colWidths[c] = Math.min(colWidths[c], 40)

    const lines: string[] = []
    // 顶部分隔线
    const topSep = colWidths.map((w) => "─".repeat(w + 2)).join("┬")
    lines.push(`┌${topSep}┐`)

    rows.forEach((row, idx) => {
      const padded = Array.from({ length: maxCols }, (_, c) => {
        const text = row[c] || ""
        const w = colWidths[c]
        const displayW = getDisplayWidth(text)
        if (displayW > w) {
          // 截断过长文本
          let truncated = ""
          let tw = 0
          for (const ch of text) {
            const cw = ch.codePointAt(0)! >= 0x4E00 ? 2 : 1
            if (tw + cw > w - 1) break
            truncated += ch
            tw += cw
          }
          return ` ${padEndCJK(`${truncated}…`, w)} `
        }
        return ` ${padEndCJK(text, w)} `
      })
      lines.push(`│${padded.join("│")}│`)

      // 第一行（表头）后加分隔线
      if (idx === 0) {
        const headSep = colWidths.map((w) => "─".repeat(w + 2)).join("┼")
        lines.push(`├${headSep}┤`)
      }
    })
    // 底部分隔线
    const botSep = colWidths.map((w) => "─".repeat(w + 2)).join("┴")
    lines.push(`└${botSep}┘`)

    results.push(lines.join("\n"))
  }
  return results.join("\n\n")
}

/** 复制为 Unicode 文本表格（适配B站等不支持 table 标签的平台） */
async function copyAsTextTable() {
  const source = htmlContent.value
  if (!source.trim()) {
    showMessage("没有可复制的内容", 2000, "info")
    return
  }
  const text = htmlToTextTable(source)
  if (!text) {
    showMessage("当前内容中未检测到表格", 2000, "info")
    return
  }
  const ok = await copyToClipboard(text)
  showMessage(ok ? "已复制文本表格（适用于B站等平台）" : "复制失败", 2000, ok ? "info" : "error")
}

// 简单格式化HTML
function formatHtml() {
  try {
    let formatted = htmlContent.value
    // 简单缩进格式化
    let indent = 0
    formatted = formatted.replace(/></g, ">\n<")
    const lines = formatted.split("\n")
    const result: string[] = []
    for (let line of lines) {
      line = line.trim()
      if (!line) continue
      if (line.match(/^<\/(.*?)>/) && indent > 0) {
        indent--
      }
      result.push("  ".repeat(indent) + line)
      if (line.match(/^<([a-z][a-z0-9]*)([\s>])/i) && !line.match(/\/>/) && !line.match(/^<(br|hr|img|input|meta|link)[\s>/]/i)) {
        indent++
      }
    }
    htmlContent.value = result.join("\n")
    showMessage("格式化完成", 2000, "info")
  } catch {
    showMessage("格式化失败", 2000, "error")
  }
}

// 净化内容固定宽度（适配手机发布）
function normalizeContentWidths() {
  if (!htmlContent.value.trim()) {
    showMessage("没有可处理的内容", 2000, "info")
    return
  }

  const result = normalizeWidths(htmlContent.value)

  if (result.changedCount === 0) {
    showMessage("未发现需修复的固定宽度", 2000, "info")
    return
  }

  htmlContent.value = result.html
  showMessage(
    `已修复 ${result.changedCount} 处固定宽度，适配手机端`,
    2500,
    "info",
  )
}

// 复制预览为图片
async function copyAsImage() {
  const iframe = previewFrame.value
  if (!iframe || !iframe.contentDocument?.body) {
    showMessage("没有可复制的内容", 2000, "info")
    return
  }

  let canvas: HTMLCanvasElement | null = null
  try {
    await nextTick()
    canvas = await html2canvas(iframe.contentDocument.body, {
      useCORS: true,
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    })

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error("Canvas toBlob 失败"))
      }, "image/png")
    })

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ])

    showMessage("已复制为图片", 2000, "info")
  } catch (error) {
    console.error("复制为图片失败:", error)
    // 兜底：复用已渲染的 canvas 下载图片
    if (canvas) {
      triggerDownload(canvas.toDataURL("image/png"), `html-preview-${Date.now()}.png`)
      showMessage("已下载为图片（剪贴板不可用）", 2000, "info")
    } else {
      showMessage("复制失败", 2000, "error")
    }
  }
}

// 打开保存弹窗（通过 SnippetEditModal 新建）
function openSaveModal() {
  if (!htmlContent.value.trim()) {
    showMessage("没有可保存的内容", 2000, "info")
    return
  }
  editingSnippet.value = null
  showEditModal.value = true
}

// 加载片段到主预览
function loadSnippet(snippet: HtmlSnippet) {
  htmlContent.value = snippet.content
  viewMode.value = "preview"
  showSnippetLibrary.value = false
  showMessage(`已加载「${snippet.name}」`, 2000, "info")
}

// 打开新建片段
function openCreateSnippet() {
  editingSnippet.value = null
  showEditModal.value = true
}

// 编辑片段
function editSnippet(snippet: HtmlSnippet) {
  editingSnippet.value = snippet
  showEditModal.value = true
}

// 保存编辑（子组件回调）
async function handleSaveEdit(payload: { id?: string, name: string, category: string, content?: string }) {
  try {
    if (payload.id) {
      await storage.updateSnippet(payload.id, {
        name: payload.name,
        category: payload.category,
        content: payload.content,
      })
      showMessage("片段已更新", 2000, "info")
    } else {
      await storage.addSnippet({
        name: payload.name,
        category: payload.category,
        content: payload.content ?? htmlContent.value,
      })
      showMessage("片段已创建", 2000, "info")
    }
    await loadSnippets()
  } catch (error) {
    console.error("保存片段失败:", error)
    showMessage("保存失败", 2000, "error")
  }
}

// 删除片段
async function deleteSnippet(id: string) {
  const snippet = snippets.value.find((s) => s.id === id)
  if (!snippet) return
  const confirmed = window.confirm(`确定要删除片段「${snippet.name}」吗？此操作不可恢复。`)
  if (!confirmed) return
  try {
    await storage.deleteSnippet(id)
    await loadSnippets()
    showMessage("片段已删除", 2000, "info")
  } catch (error) {
    console.error("删除片段失败:", error)
    showMessage("删除失败", 2000, "error")
  }
}

async function addCategory(payload: { name: string, color: string }) {
  if (categories.value.some((c) => c.name === payload.name)) {
    showMessage("分类已存在", 2000, "error")
    return
  }
  const category: HtmlCategory = {
    id: Date.now().toString(),
    name: payload.name,
    color: payload.color,
  }
  categories.value.push(category)
  await saveCategories()
  showMessage("分类已添加", 2000, "info")
}

async function deleteCategory(categoryId: string) {
  if (categoryId === "default") {
    showMessage("默认分类不能删除", 2000, "error")
    return
  }
  const hasSnippets = snippets.value.some((s) => s.category === categoryId)
  if (hasSnippets) {
    showMessage("该分类下有片段，无法删除", 2000, "error")
    return
  }
  categories.value = categories.value.filter((c) => c.id !== categoryId)
  await saveCategories()
  showMessage("分类已删除", 2000, "info")
}

// 数据加载
async function loadSnippets() {
  try {
    snippets.value = await storage.loadSnippets()
  } catch (error) {
    console.error("加载片段失败:", error)
    snippets.value = []
  }
}

async function loadCategories() {
  try {
    categories.value = await storage.loadCategories()
  } catch (error) {
    console.error("加载分类失败:", error)
  }
}

async function saveCategories() {
  try {
    await storage.saveCategories(categories.value)
  } catch (error) {
    console.error("保存分类失败:", error)
  }
}

// 关闭弹窗
function closeDialog() {
  htmlContent.value = ""
  viewMode.value = "preview"
  emit("update:visible", false)
  emit("close")
}

// 键盘事件
function handleKeyDown(event: KeyboardEvent) {
  if (!props.visible) return
  if (event.key === "Escape") {
    if (showCategoryManager.value) {
      showCategoryManager.value = false
    } else if (showEditModal.value) {
      showEditModal.value = false
      editingSnippet.value = null
    } else if (showSnippetLibrary.value) {
      showSnippetLibrary.value = false
    } else {
      closeDialog()
    }
  }
}

// 监听自定义事件：右键菜单打开
function handleOpenHtmlViewer(event: CustomEvent) {
  const { content } = event.detail || {}
  if (content) {
    htmlContent.value = content
    viewMode.value = "preview"
  }
}

// 监听visible变化
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await loadSnippets()
      await loadCategories()
    }
  },
)

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown)
  window.addEventListener("openHtmlViewer", handleOpenHtmlViewer as EventListener)
})

onUnmounted(() => {
  if (previewTimer) clearTimeout(previewTimer)
  document.removeEventListener("keydown", handleKeyDown)
  window.removeEventListener("openHtmlViewer", handleOpenHtmlViewer as EventListener)
})
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
