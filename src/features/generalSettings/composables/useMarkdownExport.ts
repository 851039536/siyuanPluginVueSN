/**
 * Markdown 导出 composable：笔记本列表加载、勾选管理、三种导出流程（选中/全部打包/工作空间）与进度日志状态
 */
import JSZip from "jszip"
import { ref } from "vue"
import {
  exportData,
  exportNotebookMd,
  fetchExportZip,
  lsNotebooks,
  pushErrMsg,
  pushMsg,
} from "@/api"
import { triggerBlobDownload } from "@/utils/domUtils"

export interface Notebook {
  id: string
  name: string
  docCount?: number
}

export interface ExportLog {
  type: "success" | "error" | "info"
  message: string
}

/** 导出日志最大保留条数 */
const MAX_LOG_COUNT = 50

/** 替换 i18n 文案中的 {name} / {n} 等占位符 */
function format(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  )
}

export function useMarkdownExport(i18n: any) {
  const t = () => i18n.markdownExport

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
  // 进度与日志
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

  /** 添加日志（超出上限时移除最早一条） */
  function addLog(type: ExportLog["type"], message: string) {
    exportLogs.value.push({
      type,
      message,
    })
    if (exportLogs.value.length > MAX_LOG_COUNT) {
      exportLogs.value.shift()
    }
  }

  // ============================================================
  // 笔记本加载与选择
  // ============================================================

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
      addLog("error", t().loadNotebooksFailed)
    } finally {
      loading.value = false
    }
  }

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

  async function exportSingleNotebook(notebookId: string, notebookName: string) {
    addLog("info", format(t().logStartExport, { name: notebookName }))
    const zipPath = await exportNotebookMd(notebookId)
    const blob = await fetchExportZip(zipPath)
    triggerBlobDownload(blob, `${notebookName}.zip`)
  }

  // ============================================================
  // 导出选中的笔记本
  // ============================================================

  async function exportSelected() {
    const selectedList = Array.from(selectedNotebooks.value)
    if (selectedList.length === 0) {
      await pushErrMsg(t().selectAtLeastOne)
      return
    }

    exporting.value = true
    startExportProgress(selectedList.length)

    const errors: string[] = []

    for (const [index, notebookId] of selectedList.entries()) {
      const notebook = notebooks.value.find((nb) => nb.id === notebookId)
      if (notebook) {
        try {
          await exportSingleNotebook(notebookId, notebook.name)
          addLog("success", format(t().logExported, { name: notebook.name }))
        } catch (error) {
          addLog("error", format(t().logExportFailed, { name: notebook.name }))
          errors.push(notebook.name)
          console.error(`导出笔记本 ${notebook.name} 失败:`, error)
        }
      }
      updateProgress(index + 1, selectedList.length)
    }

    exporting.value = false
    exportProgress.value.show = false

    if (errors.length === 0) {
      await pushMsg(format(t().exportSelectedSuccess, { n: selectedList.length }))
    } else {
      await pushErrMsg(format(t().exportFailedSummary, {
        n: errors.length,
        names: errors.join(", "),
      }))
    }
  }

  // ============================================================
  // 一键导出所有笔记本（打包为单个 ZIP）
  // ============================================================

  async function exportAllNotebooks() {
    exporting.value = true
    addLog("info", t().logStartBatch)
    startExportProgress(notebooks.value.length)

    const zip = new JSZip()
    const errors: string[] = []

    for (const [index, notebook] of notebooks.value.entries()) {
      try {
        addLog("info", format(t().logStartExport, { name: notebook.name }))

        const zipPath = await exportNotebookMd(notebook.id)
        const zipBlob = await fetchExportZip(zipPath)
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

        addLog("success", format(t().logAdded, { name: notebook.name }))
      } catch (error) {
        addLog("error", format(t().logExportFailed, { name: notebook.name }))
        errors.push(notebook.name)
        console.error(`导出笔记本 ${notebook.name} 失败:`, error)
      }

      updateProgress(index + 1, notebooks.value.length)
    }

    // 生成最终的 ZIP 文件
    try {
      addLog("info", t().logPacking)

      const finalZipBlob = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          const percent = Math.round(metadata.percent)
          if (percent % 10 === 0) {
            addLog("info", format(t().logPackProgress, { percent }))
          }
        },
      )

      triggerBlobDownload(finalZipBlob, `all-notebooks-${todayString()}.zip`)

      addLog("success", t().logPacked)
      await pushMsg(format(t().packSuccess, {
        n: notebooks.value.length - errors.length,
      }))
    } catch (error) {
      addLog("error", t().packFailed)
      await pushErrMsg(t().packFailed)
      console.error("打包失败:", error)
    }

    exporting.value = false
    exportProgress.value.show = false

    if (errors.length > 0) {
      await pushErrMsg(format(t().exportFailedSummary, {
        n: errors.length,
        names: errors.join(", "),
      }))
    }
  }

  // ============================================================
  // 一键导出整个工作空间
  // ============================================================

  async function exportAll() {
    exporting.value = true
    addLog("info", t().logStartWorkspace)

    try {
      const data = await exportData()
      const zipPath = data?.zip
      if (!zipPath) throw new Error(t().workspaceFailed)

      addLog("info", format(t().logDownloading, { path: zipPath }))
      const blob = await fetchExportZip(zipPath)

      triggerBlobDownload(blob, `siyuan-workspace-${todayString()}.zip`)

      addLog("success", t().logWorkspaceExported)
      await pushMsg(t().workspaceSuccess)
    } catch (error) {
      addLog("error", t().workspaceFailed)
      await pushErrMsg(t().workspaceFailed)
      console.error("导出工作空间失败:", error)
    } finally {
      exporting.value = false
    }
  }

  return {
    loading,
    exporting,
    notebooks,
    selectedNotebooks,
    exportLogs,
    exportProgress,
    loadNotebooks,
    toggleNotebook,
    selectAll,
    deselectAll,
    exportSelected,
    exportAllNotebooks,
    exportAll,
  }
}
