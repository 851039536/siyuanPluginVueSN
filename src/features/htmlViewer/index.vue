<!-- HTML展示 - 主弹窗容器，编排各子组件 -->
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
                <h2>{{ t.title }}</h2>
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
                  size="xsmall"
                  @click="openSaveModal"
                >
                  {{ t.saveSnippet }}
                </Button>
                <Button
                  icon="close"
                  variant="ghost"
                  size="xsmall"
                  @click="closeDialog"
                />
              </div>
            </div>

            <!-- 内容区 -->
            <div class="dialog-body">
              <div class="content-area">
                <HtmlSourcePanel
                  v-if="viewMode === 'source' || viewMode === 'split'"
                  v-model="htmlContent"
                  :split="viewMode === 'split'"
                  :is-json-formatted="isJsonFormatted"
                  :i18n="t"
                  @copy-source="clipboard.copySource"
                  @copy-rendered="clipboard.copyRenderedContent"
                  @copy-text-table="clipboard.copyAsTextTable"
                  @format-html="formatHtml"
                  @normalize-widths="normalizeContentWidths"
                  @format-json="formatJsonContent"
                />
                <HtmlPreviewPanel
                  v-if="viewMode === 'preview' || viewMode === 'split'"
                  ref="previewPanelRef"
                  :preview-html="previewHtml"
                  :split="viewMode === 'split'"
                  :is-json-formatted="isJsonFormatted"
                  @copy-json-html="copyFormattedJsonHtml"
                  @copy-rendered="clipboard.copyRenderedContent"
                  @copy-text-table="clipboard.copyAsTextTable"
                  @copy-image="clipboard.copyAsImage"
                  @revert-json="isJsonFormatted = false"
                />
              </div>
            </div>

            <!-- 底部：片段库入口 -->
            <div class="dialog-footer">
              <Button
                variant="ghost"
                size="xsmall"
                @click="showSnippetLibrary = true"
              >
                <IconWrapper
                  name="folder"
                  :size="14"
                />
                {{ t.snippetLibrary }} ({{ snippetCount }})
              </Button>
              <div class="footer-info">
                <span
                  v-if="htmlContent"
                  class="content-size"
                >{{ contentSizeLabel }}</span>
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
import type { HtmlSnippet } from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { usePlugin } from "@/main"
import { copyToClipboard } from "@/utils/domUtils"
import { normalizeWidths } from "@/utils/htmlNormalizer"
import CategoryManager from "./components/CategoryManager.vue"
import HtmlPreviewPanel from "./components/HtmlPreviewPanel.vue"
import HtmlSourcePanel from "./components/HtmlSourcePanel.vue"
import SnippetEditModal from "./components/SnippetEditModal.vue"
import SnippetLibrary from "./components/SnippetLibrary.vue"
import { useClipboardActions } from "./composables/useClipboardActions"
import { useHtmlPreview } from "./composables/useHtmlPreview"
import { DEFAULT_CATEGORIES, HtmlViewerStorage } from "./types/storage"
import { isJsonString, jsonToHtml } from "./utils/jsonFormatter"

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

// i18n
const t = computed(() => (plugin.i18n as Record<string, any>)?.htmlViewer || {})

const modes = computed(() => [
  { key: "preview" as const, label: t.value.preview || "预览" },
  { key: "source" as const, label: t.value.source || "源码" },
  { key: "split" as const, label: t.value.split || "分栏" },
])
const viewMode = ref<"preview" | "source" | "split">("preview")

const htmlContent = ref("")
const { isJsonFormatted, previewHtml, clearPreviewTimer } = useHtmlPreview(htmlContent)

const previewPanelRef = ref<InstanceType<typeof HtmlPreviewPanel> | null>(null)
const getPreviewFrame = () => previewPanelRef.value?.iframeRef ?? null

const clipboard = useClipboardActions(() => htmlContent.value, getPreviewFrame)

// 弹窗状态
const showSnippetLibrary = ref(false)
const showEditModal = ref(false)
const showCategoryManager = ref(false)

const editingSnippet = ref<HtmlSnippet | null>(null)
const snippets = ref<HtmlSnippet[]>([])
const categories = ref([...DEFAULT_CATEGORIES])

const snippetCount = computed(() => snippets.value.length)
const contentSizeLabel = computed(() => {
  const bytes = new Blob([htmlContent.value]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

// --- 格式化操作 ---
function formatHtml() {
  try {
    let formatted = htmlContent.value
    let indent = 0
    formatted = formatted.replace(/></g, ">\n<")
    const lines = formatted.split("\n")
    const result: string[] = []
    for (let line of lines) {
      line = line.trim()
      if (!line) continue
      if (line.match(/^<\/(.*?)>/) && indent > 0) indent--
      result.push("  ".repeat(indent) + line)
      if (line.match(/^<([a-z][a-z0-9]*)([\s>])/i) && !line.match(/\/>/) && !line.match(/^<(br|hr|img|input|meta|link)[\s>/]/i)) indent++
    }
    htmlContent.value = result.join("\n")
    showMessage("格式化完成", 2000, "info")
  } catch {
    showMessage("格式化失败", 2000, "error")
  }
}

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
  showMessage(`已修复 ${result.changedCount} 处固定宽度，适配手机端`, 2500, "info")
}

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

async function copyFormattedJsonHtml() {
  const result = jsonToHtml(htmlContent.value)
  if (result.error) {
    showMessage(result.error, 2000, "error")
    return
  }
  const ok = await copyToClipboard(result.html)
  showMessage(ok ? "格式化JSON HTML已复制，可直接粘贴到公众号" : "复制失败", 2000, ok ? "info" : "error")
}

// --- 片段 CRUD ---
function openSaveModal() {
  if (!htmlContent.value.trim()) {
    showMessage("没有可保存的内容", 2000, "info")
    return
  }
  editingSnippet.value = null
  showEditModal.value = true
}

function loadSnippet(snippet: HtmlSnippet) {
  htmlContent.value = snippet.content
  viewMode.value = "preview"
  showSnippetLibrary.value = false
  showMessage(`已加载「${snippet.name}」`, 2000, "info")
}

function openCreateSnippet() {
  editingSnippet.value = null
  showEditModal.value = true
}

function editSnippet(snippet: HtmlSnippet) {
  editingSnippet.value = snippet
  showEditModal.value = true
}

async function handleSaveEdit(payload: { id?: string; name: string; category: string; content?: string }) {
  try {
    if (payload.id) {
      await storage.updateSnippet(payload.id, { name: payload.name, category: payload.category, content: payload.content })
      showMessage("片段已更新", 2000, "info")
    } else {
      await storage.addSnippet({ name: payload.name, category: payload.category, content: payload.content ?? htmlContent.value })
      showMessage("片段已创建", 2000, "info")
    }
    await loadSnippets()
  } catch (error) {
    console.error("保存片段失败:", error)
    showMessage("保存失败", 2000, "error")
  }
}

async function deleteSnippet(id: string) {
  const snippet = snippets.value.find((s) => s.id === id)
  if (!snippet) return
  if (!window.confirm(`确定要删除片段「${snippet.name}」吗？此操作不可恢复。`)) return
  try {
    await storage.deleteSnippet(id)
    await loadSnippets()
    showMessage("片段已删除", 2000, "info")
  } catch (error) {
    console.error("删除片段失败:", error)
    showMessage("删除失败", 2000, "error")
  }
}

// --- 分类 CRUD ---
async function addCategory(payload: { name: string; color: string }) {
  if (categories.value.some((c) => c.name === payload.name)) {
    showMessage("分类已存在", 2000, "error")
    return
  }
  categories.value.push({ id: Date.now().toString(), name: payload.name, color: payload.color })
  await saveCategories()
  showMessage("分类已添加", 2000, "info")
}

async function deleteCategory(categoryId: string) {
  if (categoryId === "default") { showMessage("默认分类不能删除", 2000, "error"); return }
  if (snippets.value.some((s) => s.category === categoryId)) {
    showMessage("该分类下有片段，无法删除", 2000, "error")
    return
  }
  categories.value = categories.value.filter((c) => c.id !== categoryId)
  await saveCategories()
  showMessage("分类已删除", 2000, "info")
}

async function loadSnippets() {
  try { snippets.value = await storage.loadSnippets() } catch (error) { console.error("加载片段失败:", error); snippets.value = [] }
}

async function loadCategories() {
  try { categories.value = await storage.loadCategories() } catch (error) { console.error("加载分类失败:", error) }
}

async function saveCategories() {
  try { await storage.saveCategories(categories.value) } catch (error) { console.error("保存分类失败:", error) }
}

function closeDialog() {
  htmlContent.value = ""
  viewMode.value = "preview"
  emit("update:visible", false)
  emit("close")
}

function handleKeyDown(event: KeyboardEvent) {
  if (!props.visible) return
  if (event.key === "Escape") {
    if (showCategoryManager.value) showCategoryManager.value = false
    else if (showEditModal.value) { showEditModal.value = false; editingSnippet.value = null }
    else if (showSnippetLibrary.value) showSnippetLibrary.value = false
    else closeDialog()
  }
}

function handleOpenHtmlViewer(event: CustomEvent) {
  const { content } = event.detail || {}
  if (content) { htmlContent.value = content; viewMode.value = "preview" }
}

watch(() => props.visible, async (newVal) => {
  if (newVal) { await loadSnippets(); await loadCategories() }
})

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown)
  window.addEventListener("openHtmlViewer", handleOpenHtmlViewer as EventListener)
})

onUnmounted(() => {
  clearPreviewTimer()
  document.removeEventListener("keydown", handleKeyDown)
  window.removeEventListener("openHtmlViewer", handleOpenHtmlViewer as EventListener)
})
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
