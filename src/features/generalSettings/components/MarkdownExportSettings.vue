<template>
  <div class="markdown-export-settings">
    <div class="settings-section">
      <h4 class="section-title">
        Markdown 导出
      </h4>
      <p class="section-desc">
        一键导出所有笔记本为 Markdown 格式
      </p>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <div class="button-group">
          <Button
            variant="primary"
            icon="download"
            :disabled="exporting"
            :loading="exporting"
            @click="exportSelected"
          >
            {{ exporting ? '导出中...' : '导出选中的笔记本' }}
          </Button>
          <Button
            variant="primary"
            icon="download"
            :disabled="exporting"
            :loading="exporting"
            @click="exportAllNotebooks"
          >
            {{ exporting ? '导出中...' : '一键导出所有笔记本' }}
          </Button>
          <Button
            variant="success"
            icon="download"
            :disabled="exporting"
            :loading="exporting"
            @click="exportAll"
          >
            {{ exporting ? '导出中...' : '一键导出工作空间' }}
          </Button>
        </div>
        <div class="button-group">
          <Button
            variant="secondary"
            @click="selectAll"
          >
            全选
          </Button>
          <Button
            variant="secondary"
            @click="deselectAll"
          >
            取消全选
          </Button>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="export-tips">
        <div class="tip-item">
          <Icon
            icon="mdi:information-outline"
            class="tip-icon"
          />
          <span class="tip-text">"导出选中的笔记本": 导出勾选的笔记本,每个生成一个 ZIP</span>
        </div>
        <div class="tip-item">
          <Icon
            icon="mdi:information-outline"
            class="tip-icon"
          />
          <span class="tip-text">"一键导出所有笔记本": 自动导出所有笔记本并打包成一个 ZIP 文件</span>
        </div>
        <div class="tip-item">
          <Icon
            icon="mdi:information-outline"
            class="tip-icon"
          />
          <span class="tip-text">"一键导出工作空间": 将整个工作空间打包成一个 ZIP 文件</span>
        </div>
      </div>

      <!-- 笔记本列表 -->
      <div class="notebook-list">
        <div
          v-if="loading"
          class="loading"
        >
          加载中...
        </div>

        <div
          v-else-if="notebooks.length === 0"
          class="empty"
        >
          没有找到笔记本
        </div>

        <div
          v-else
          class="notebook-items"
        >
          <label
            v-for="notebook in notebooks"
            :key="notebook.id"
            class="notebook-item"
            :class="{ selected: selectedNotebooks.has(notebook.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedNotebooks.has(notebook.id)"
              @change="toggleNotebook(notebook.id)"
            />
            <Icon
              icon="mdi:notebook-outline"
              class="notebook-icon"
            />
            <span class="notebook-name">{{ notebook.name }}</span>
            <span class="notebook-count">{{ notebook.docCount || 0 }} 个文档</span>
          </label>
        </div>
      </div>

      <!-- 导出进度 -->
      <div
        v-if="exportProgress.show"
        class="export-progress"
      >
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${exportProgress.percent}%` }"
          ></div>
        </div>
        <div class="progress-text">
          {{ exportProgress.current }} / {{ exportProgress.total }}
        </div>
      </div>

      <!-- 导出日志 -->
      <div
        v-if="exportLogs.length > 0"
        class="export-logs"
      >
        <h4>导出日志</h4>
        <div class="log-items">
          <div
            v-for="(log, index) in exportLogs"
            :key="index"
            class="log-item"
            :class="log.type"
          >
            {{ log.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import JSZip from "jszip"
import {
  onMounted,
  ref,
} from "vue"
import {
  lsNotebooks,
  pushErrMsg,
  pushMsg,
} from "@/api"
import Button from "@/components/Button.vue"
import { triggerBlobDownload } from "@/utils/domUtils"

interface Notebook {
  id: string
  name: string
  docCount?: number
}

interface ExportLog {
  type: "success" | "error" | "info"
  message: string
}

const loading = ref(true)
const exporting = ref(false)
const notebooks = ref<Notebook[]>([])
const selectedNotebooks = ref<Set<string>>(new Set())
const exportLogs = ref<ExportLog[]>([])
const exportProgress = ref({
  show: false,
  current: 0,
  total: 0,
  percent: 0,
})

// ============================================================
// 工具函数
// ============================================================

/** 获取当天日期字符串 YYYY-MM-DD */
function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 初始化导出进度条 */
function startExportProgress(total: number) {
  exportProgress.value = {
    show: true,
    current: 0,
    total,
    percent: 0,
  }
}

/** 更新导出进度 */
function updateProgress(current: number, total: number) {
  exportProgress.value.current = current
  exportProgress.value.percent = Math.round((current / total) * 100)
}

/** 下载 ZIP 文件 */
async function downloadZipBlob(zipPath: string): Promise<Blob> {
  const response = await fetch(zipPath)
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status}`)
  }
  return response.blob()
}

/** 调用思源导出 API，返回 ZIP 文件路径 */
async function callExportApi(
  apiPath: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const result = await response.json()
  if (result.code !== 0) throw new Error(result.msg || "导出失败")

  const zipPath = result.data?.zip
  if (!zipPath) throw new Error("未获取到ZIP文件路径")

  return zipPath
}

/** 添加日志（最多保留 50 条） */
function addLog(type: ExportLog["type"], message: string) {
  exportLogs.value.push({
    type,
    message,
  })
  if (exportLogs.value.length > 50) {
    exportLogs.value.shift()
  }
}

// ============================================================
// 初始化
// ============================================================

onMounted(async () => {
  await loadNotebooks()
})

async function loadNotebooks() {
  try {
    loading.value = true
    const data = await lsNotebooks()

    if (data?.notebooks) {
      notebooks.value = data.notebooks.map(
        (nb: { id: string, name: string, docCount?: number }) => ({
          id: nb.id,
          name: nb.name,
          docCount: nb.docCount,
        }),
      )
    }
  } catch (error) {
    console.error("加载笔记本列表失败:", error)
    addLog("error", "加载笔记本列表失败")
  } finally {
    loading.value = false
  }
}

// ============================================================
// 笔记本选择
// ============================================================

function toggleNotebook(notebookId: string) {
  const set = selectedNotebooks.value
  if (set.has(notebookId)) {
    set.delete(notebookId)
  } else {
    set.add(notebookId)
  }
}

function selectAll() {
  selectedNotebooks.value = new Set(notebooks.value.map((nb) => nb.id))
}

function deselectAll() {
  selectedNotebooks.value = new Set()
}

// ============================================================
// 导出单个笔记本 MD
// ============================================================

async function exportNotebookMd(notebookId: string, notebookName: string) {
  try {
    addLog("info", `开始导出: ${notebookName}`)
    const zipPath = await callExportApi("/api/export/exportNotebookMd", {
      notebook: notebookId,
    })
    const blob = await downloadZipBlob(zipPath)
    triggerBlobDownload(blob, `${notebookName}.zip`)
  } catch (error) {
    console.error("导出失败详情:", error)
    throw error
  }
}

// ============================================================
// 导出选中的笔记本
// ============================================================

async function exportSelected() {
  const selectedList = Array.from(selectedNotebooks.value)
  if (selectedList.length === 0) {
    await pushErrMsg("请至少选择一个笔记本")
    return
  }

  exporting.value = true
  startExportProgress(selectedList.length)

  const errors: string[] = []

  for (const [index, notebookId] of selectedList.entries()) {
    const notebook = notebooks.value.find((nb) => nb.id === notebookId)
    if (notebook) {
      try {
        await exportNotebookMd(notebookId, notebook.name)
        addLog("success", `✅ 已导出: ${notebook.name}`)
      } catch (error) {
        addLog("error", `❌ 导出失败: ${notebook.name}`)
        errors.push(notebook.name)
        console.error(`导出笔记本 ${notebook.name} 失败:`, error)
      }
    }
    updateProgress(index + 1, selectedList.length)
  }

  exporting.value = false
  exportProgress.value.show = false

  if (errors.length === 0) {
    await pushMsg(`成功导出 ${selectedList.length} 个笔记本`)
  } else {
    await pushErrMsg(`${errors.length} 个笔记本导出失败: ${errors.join(", ")}`)
  }
}

// ============================================================
// 一键导出所有笔记本（打包为单个 ZIP）
// ============================================================

async function exportAllNotebooks() {
  exporting.value = true
  addLog("info", "开始批量导出所有笔记本并打包...")
  startExportProgress(notebooks.value.length)

  const zip = new JSZip()
  const errors: string[] = []

  for (const [index, notebook] of notebooks.value.entries()) {
    try {
      addLog("info", `正在导出: ${notebook.name}`)

      const zipPath = await callExportApi("/api/export/exportNotebookMd", {
        notebook: notebook.id,
      })
      const zipBlob = await downloadZipBlob(zipPath)
      const notebookZip = await JSZip.loadAsync(zipBlob)

      const notebookFolder = zip.folder(notebook.name)
      if (notebookFolder) {
        for (const [relativePath, file] of Object.entries(notebookZip.files)) {
          if (!file.dir) {
            const content = await file.async("blob")
            notebookFolder.file(relativePath, content)
          } else {
            notebookFolder.folder(relativePath)
          }
        }
      }

      addLog("success", `✅ 已添加: ${notebook.name}`)
    } catch (error) {
      addLog("error", `❌ 导出失败: ${notebook.name}`)
      errors.push(notebook.name)
      console.error(`导出笔记本 ${notebook.name} 失败:`, error)
    }

    updateProgress(index + 1, notebooks.value.length)
  }

  // 生成最终的 ZIP 文件
  try {
    addLog("info", "正在打包所有笔记本...")

    const finalZipBlob = await zip.generateAsync(
      {
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      },
      (metadata) => {
        const percent = Math.round(metadata.percent)
        if (percent % 10 === 0) addLog("info", `打包进度: ${percent}%`)
      },
    )

    triggerBlobDownload(finalZipBlob, `all-notebooks-${todayString()}.zip`)

    addLog("success", "✅ 已打包所有笔记本到一个 ZIP 文件")
    await pushMsg(
      `成功导出并打包 ${notebooks.value.length - errors.length} 个笔记本`,
    )
  } catch (error) {
    addLog("error", "❌ 打包失败")
    await pushErrMsg("打包失败")
    console.error("打包失败:", error)
  }

  exporting.value = false
  exportProgress.value.show = false

  if (errors.length > 0) {
    await pushErrMsg(`${errors.length} 个笔记本导出失败: ${errors.join(", ")}`)
  }
}

// ============================================================
// 一键导出整个工作空间
// ============================================================

async function exportAll() {
  exporting.value = true
  addLog("info", "开始导出整个工作空间...")

  try {
    const zipPath = await callExportApi("/api/export/exportData", {})
    addLog("info", `正在下载: ${zipPath}`)
    const blob = await downloadZipBlob(zipPath)

    triggerBlobDownload(blob, `siyuan-workspace-${todayString()}.zip`)

    addLog("success", "✅ 已导出整个工作空间")
    await pushMsg("成功导出整个工作空间")
  } catch (error) {
    addLog("error", "❌ 导出工作空间失败")
    await pushErrMsg("导出工作空间失败")
    console.error("导出工作空间失败:", error)
  } finally {
    exporting.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/MarkdownExportSettings.scss";
</style>
