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
                  icon="image"
                  variant="ghost"
                  size="small"
                  @click="showArticleCover(coverInitialTitle)"
                >
                  AI 封面
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

  <!-- 保存片段弹窗 -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showSaveModal"
        class="html-viewer-overlay modal-overlay"
        @click="closeSaveModal"
      >
        <Transition name="scale">
          <div
            v-if="showSaveModal"
            class="html-viewer-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>保存HTML片段</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeSaveModal"
              />
            </div>
            <div class="dialog-body">
              <form
                class="save-form"
                @submit.prevent="handleSaveSnippet"
              >
                <div class="form-group">
                  <Input
                    v-model="saveForm.name"
                    label="名称"
                    type="text"
                    placeholder="请输入片段名称"
                    required
                  />
                </div>
                <div class="form-group">
                  <Select
                    v-model="saveForm.category"
                    label="分类"
                    :options="categoryOptions"
                    required
                  />
                </div>
                <div class="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="closeSaveModal"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    :disabled="!saveForm.name.trim()"
                  >
                    保存
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- 片段库弹窗 -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showSnippetLibrary"
        class="html-viewer-overlay modal-overlay"
        @click="closeSnippetLibrary"
      >
        <Transition name="scale">
          <div
            v-if="showSnippetLibrary"
            class="html-viewer-dialog"
            @click.stop
          >
            <div class="dialog-header">
              <div class="header-title">
                <IconWrapper
                  name="folder"
                  :size="22"
                />
                <h2>HTML 片段库</h2>
              </div>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeSnippetLibrary"
              />
            </div>
            <div class="dialog-body">
              <!-- 分类筛选 -->
              <div class="category-filter">
                <div class="category-chips">
                  <button
                    v-for="cat in [{
                      id: 'all',
                      name: '全部',
                      color: '#b0aea5',
                    }, ...categories]"
                    :key="cat.id"
                    class="category-chip"
                    :class="{ active: selectedCategory === cat.id }"
                    :style="{ '--cat-color': cat.color }"
                    @click="selectedCategory = cat.id"
                  >
                    <span
                      class="chip-dot"
                      :style="{ backgroundColor: cat.color }"
                    ></span>
                    {{ cat.name }}
                  </button>
                </div>
                <Button
                  icon="settings"
                  variant="ghost"
                  size="small"
                  title="管理分类"
                  @click="showCategoryManager = true"
                />
              </div>

              <!-- 搜索 -->
              <div class="snippet-controls">
                <IconWrapper
                  name="search"
                  :size="16"
                  class="search-icon"
                />
                <Input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索片段名称..."
                  size="small"
                />
                <Button
                  icon="add"
                  variant="primary"
                  size="small"
                  @click="openCreateSnippet"
                >
                  新建片段
                </Button>
              </div>

              <!-- 片段列表 -->
              <div class="snippet-grid">
                <div
                  v-for="snippet in filteredSnippets"
                  :key="snippet.id"
                  class="snippet-card"
                >
                  <div class="snippet-header">
                    <h3>{{ snippet.name }}</h3>
                    <span
                      class="snippet-category-tag"
                      :style="{
                        backgroundColor: `${getCategoryById(snippet.category)?.color}20`,
                        color: getCategoryById(snippet.category)?.color,
                      }"
                    >
                      {{ getCategoryById(snippet.category)?.name || '未分类' }}
                    </span>
                  </div>
                  <div class="snippet-preview-mini">
                    <iframe
                      class="mini-preview-iframe"
                      sandbox="allow-scripts"
                      :srcdoc="getPreviewHtml(snippet.content)"
                    ></iframe>
                  </div>
                  <div class="snippet-meta">
                    <span class="snippet-time">{{ formatTime(snippet.updatedAt) }}</span>
                  </div>
                  <div class="snippet-actions">
                    <Button
                      variant="ghost"
                      size="small"
                      @click="loadSnippet(snippet)"
                    >
                      加载
                    </Button>
                    <Button
                      variant="ghost"
                      size="small"
                      @click="editSnippet(snippet)"
                    >
                      编辑
                    </Button>
                    <Button
                      icon="delete"
                      variant="ghost"
                      size="small"
                      title="删除"
                      @click="deleteSnippet(snippet.id)"
                    />
                  </div>
                </div>

                <div
                  v-if="filteredSnippets.length === 0"
                  class="no-snippets"
                >
                  {{ searchQuery ? '未找到匹配的片段' : '暂无HTML片段，点击新建' }}
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- 编辑片段弹窗 -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showEditModal"
        class="html-viewer-overlay modal-overlay"
        @click="closeEditModal"
      >
        <Transition name="scale">
          <div
            v-if="showEditModal"
            class="html-viewer-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>{{ editingSnippet ? '编辑片段' : '新建片段' }}</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeEditModal"
              />
            </div>
            <div class="dialog-body">
              <form
                class="edit-form"
                @submit.prevent="handleSaveEdit"
              >
                <div class="form-group">
                  <Input
                    v-model="editForm.name"
                    label="名称"
                    type="text"
                    placeholder="请输入片段名称"
                    required
                  />
                </div>
                <div class="form-group">
                  <Select
                    v-model="editForm.category"
                    label="分类"
                    :options="categoryOptions"
                    required
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">HTML内容</label>
                  <textarea
                    v-model="editForm.content"
                    class="edit-content-editor"
                    placeholder="请输入HTML代码..."
                    rows="10"
                    spellcheck="false"
                    required
                  ></textarea>
                </div>
                <div class="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="closeEditModal"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    :disabled="!editForm.name.trim() || !editForm.content.trim()"
                  >
                    保存
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- 分类管理弹窗 -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showCategoryManager"
        class="html-viewer-overlay modal-overlay"
        @click="closeCategoryManager"
      >
        <Transition name="scale">
          <div
            v-if="showCategoryManager"
            class="html-viewer-dialog category-manager"
            @click.stop
          >
            <div class="dialog-header">
              <h2>管理分类</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="closeCategoryManager"
              />
            </div>
            <div class="dialog-body">
              <div class="add-category-section">
                <h3>添加新分类</h3>
                <div class="add-category-form">
                  <Input
                    v-model="newCategory.name"
                    type="text"
                    placeholder="分类名称"
                    :maxlength="10"
                  />
                  <div class="color-picker-wrapper">
                    <button
                      v-for="color in presetColors"
                      :key="color"
                      class="color-option"
                      :class="{ selected: newCategory.color === color }"
                      :style="{ backgroundColor: color }"
                      @click="newCategory.color = color"
                    ></button>
                  </div>
                  <Button
                    icon="add"
                    variant="primary"
                    size="small"
                    :disabled="!newCategory.name.trim()"
                    @click="addCategory"
                  >
                    添加
                  </Button>
                </div>
              </div>
              <div class="category-list-section">
                <h3>现有分类</h3>
                <div class="category-list">
                  <div
                    v-for="cat in categories"
                    :key="cat.id"
                    class="category-item"
                  >
                    <span
                      class="category-dot"
                      :style="{ backgroundColor: cat.color }"
                    ></span>
                    <span class="category-name">{{ cat.name }}</span>
                    <Button
                      v-if="cat.id !== 'default'"
                      icon="close"
                      variant="ghost"
                      size="small"
                      title="删除分类"
                      @click="deleteCategory(cat.id)"
                    />
                    <span
                      v-else
                      class="default-badge"
                    >默认</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
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
  reactive,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { usePlugin } from "@/main"
import { showArticleCover } from "@/features/articleCover/types"
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
const showSaveModal = ref(false)
const showSnippetLibrary = ref(false)
const showEditModal = ref(false)
const showCategoryManager = ref(false)

// 保存表单
const saveForm = reactive({
  name: "",
  category: "default",
})

// 编辑表单
const editForm = reactive({
  name: "",
  category: "default",
  content: "",
})
const editingSnippet = ref<HtmlSnippet | null>(null)

// 片段库状态
const snippets = ref<HtmlSnippet[]>([])
const categories = ref<HtmlCategory[]>([...DEFAULT_CATEGORIES])
const selectedCategory = ref<string>("all")
const searchQuery = ref("")

// 分类管理
const newCategory = reactive({
  name: "",
  color: "#d97757",
})

// JSON 格式化状态
const isJsonFormatted = ref(false)

// 预览HTML（带JSON格式化支持）
const previewHtml = computed(() => {
  if (isJsonFormatted.value && htmlContent.value.trim()) {
    const result = jsonToHtml(htmlContent.value)
    if (!result.error) {
      return result.html
    }
  }
  return htmlContent.value
})

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
  try {
    await navigator.clipboard.writeText(result.html)
    showMessage("格式化JSON HTML已复制，可直接粘贴到公众号", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
}

// AI 封面：从 HTML 内容中提取文档标题
const coverInitialTitle = computed(() => {
  const content = htmlContent.value
  if (!content) return ""
  // 尝试从 HTML 中提取 <title> 或 <h1> 标签
  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) return titleMatch[1].trim()
  const h1Match = content.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (h1Match) return h1Match[1].replace(/<[^>]*>/g, "").trim()
  return ""
})

const presetColors = [
  "#d97757",
  "#6a9bcc",
  "#788c5d",
  "#b0aea5",
  "#e8a04c",
  "#9b6bb5",
]

// 内容大小
const contentSize = computed(() => {
  const bytes = new Blob([htmlContent.value]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

// 片段数量
const snippetCount = computed(() => snippets.value.length)

// 分类选项（供 Select 组件使用）
const categoryOptions = computed(() =>
  categories.value.map((cat) => ({
    value: cat.id,
    label: cat.name,
  })),
)

// 分类Map
const categoriesMap = computed(() => {
  const map = new Map<string, HtmlCategory>()
  for (const cat of categories.value) {
    map.set(cat.id, cat)
  }
  return map
})

// 过滤片段
const filteredSnippets = computed(() => {
  let result = snippets.value
  if (selectedCategory.value !== "all") {
    result = result.filter((s) => s.category === selectedCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((s) => s.name.toLowerCase().includes(q))
  }
  return result
})

// 分类查找
const getCategoryById = (id: string): HtmlCategory | undefined => {
  return categoriesMap.value.get(id)
}

// 格式化时间
function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// 获取预览HTML（限制高度）
function getPreviewHtml(content: string): string {
  return `<style>body{margin:0;padding:4px;overflow:hidden;pointer-events:none;font-size:12px;}</style>${content}`
}

// 复制源码
async function copySource() {
  try {
    await navigator.clipboard.writeText(htmlContent.value)
    showMessage("源码已复制", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
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
      const link = document.createElement("a")
      link.download = `html-preview-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      showMessage("已下载为图片（剪贴板不可用）", 2000, "info")
    } else {
      showMessage("复制失败", 2000, "error")
    }
  }
}

// 打开保存弹窗
function openSaveModal() {
  if (!htmlContent.value.trim()) {
    showMessage("没有可保存的内容", 2000, "info")
    return
  }
  saveForm.name = ""
  saveForm.category = categories.value[0]?.id || "default"
  showSaveModal.value = true
}

function closeSaveModal() {
  showSaveModal.value = false
}

// 保存片段
async function handleSaveSnippet() {
  if (!saveForm.name.trim()) return
  try {
    await storage.addSnippet({
      name: saveForm.name.trim(),
      category: saveForm.category,
      content: htmlContent.value,
    })
    await loadSnippets()
    closeSaveModal()
    showMessage("片段已保存", 2000, "info")
  } catch (error) {
    console.error("保存片段失败:", error)
    showMessage("保存失败", 2000, "error")
  }
}

// 打开片段库
function closeSnippetLibrary() {
  showSnippetLibrary.value = false
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
  editForm.name = ""
  editForm.category = categories.value[0]?.id || "default"
  editForm.content = ""
  showEditModal.value = true
}

// 编辑片段
function editSnippet(snippet: HtmlSnippet) {
  editingSnippet.value = snippet
  editForm.name = snippet.name
  editForm.category = snippet.category
  editForm.content = snippet.content
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingSnippet.value = null
}

// 保存编辑
async function handleSaveEdit() {
  if (!editForm.name.trim() || !editForm.content.trim()) return
  try {
    if (editingSnippet.value) {
      await storage.updateSnippet(editingSnippet.value.id, {
        name: editForm.name.trim(),
        category: editForm.category,
        content: editForm.content,
      })
      showMessage("片段已更新", 2000, "info")
    } else {
      await storage.addSnippet({
        name: editForm.name.trim(),
        category: editForm.category,
        content: editForm.content,
      })
      showMessage("片段已创建", 2000, "info")
    }
    await loadSnippets()
    closeEditModal()
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

// 分类管理
function closeCategoryManager() {
  showCategoryManager.value = false
  newCategory.name = ""
  newCategory.color = "#d97757"
}

async function addCategory() {
  if (!newCategory.name.trim()) return
  if (categories.value.some((c) => c.name === newCategory.name.trim())) {
    showMessage("分类已存在", 2000, "error")
    return
  }
  const category: HtmlCategory = {
    id: Date.now().toString(),
    name: newCategory.name.trim(),
    color: newCategory.color,
  }
  categories.value.push(category)
  await saveCategories()
  newCategory.name = ""
  newCategory.color = presetColors[0]
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
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = "all"
  }
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
      closeCategoryManager()
    } else if (showEditModal.value) {
      closeEditModal()
    } else if (showSaveModal.value) {
      closeSaveModal()
    } else if (showSnippetLibrary.value) {
      closeSnippetLibrary()
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
  document.removeEventListener("keydown", handleKeyDown)
  window.removeEventListener("openHtmlViewer", handleOpenHtmlViewer as EventListener)
})
</script>

<style lang="scss" scoped>
@use './styles/index.scss';
</style>
