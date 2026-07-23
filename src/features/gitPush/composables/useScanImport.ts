// 扫描导入弹窗状态与流程（扫描目录 → 选择 → 导入）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { ScannedGitRepo } from "../types/storage"
import { UNGROUPED_ID } from "../types"
import { pickDirectory } from "./useDirectoryPicker"

type ScanRepo = ScannedGitRepo & { alreadyImported: boolean }

export function useScanImport(deps: {
  scanResults: Ref<ScanRepo[]>
  scanDirInput: Ref<string>
  activeCategory: Ref<string>
  startScan: (dir: string) => Promise<void>
  importScanResults: (paths: string[], catId: string) => Promise<{ imported: number, skipped: number }>
  loadProjects: () => Promise<void>
  tf: (key: string, fallback: string, ...args: (string | number)[]) => string
}) {
  const { scanResults, scanDirInput, activeCategory, startScan, importScanResults, loadProjects, tf } = deps

  const showScanDialog = ref(false)
  const scanError = ref("")
  const scanSelection = ref<Record<string, boolean>>({})

  function handleOpenScan() {
    scanError.value = ""
    scanDirInput.value = ""
    scanResults.value = []
    scanSelection.value = {}
    showScanDialog.value = true
  }

  function handleCloseScan() {
    showScanDialog.value = false
    scanError.value = ""
  }

  async function handleStartScan() {
    scanError.value = ""
    try {
      await startScan(scanDirInput.value.trim())
      // 扫描成功 → 自动全选未导入项
      const sel: Record<string, boolean> = {}
      for (const repo of scanResults.value) {
        if (!repo.alreadyImported) {
          sel[repo.path] = true
        }
      }
      scanSelection.value = sel
    } catch (e: any) {
      scanError.value = e?.message || tf("scanError", "扫描失败")
    }
  }

  function handleToggleSelectAll() {
    const allSelected = scanResults.value.every(
      (r) => r.alreadyImported || scanSelection.value[r.path],
    )
    const sel: Record<string, boolean> = {}
    for (const repo of scanResults.value) {
      if (!repo.alreadyImported) {
        sel[repo.path] = !allSelected
      }
    }
    scanSelection.value = sel
  }

  function toggleScanItem(path: string) {
    scanSelection.value = {
      ...scanSelection.value,
      [path]: !scanSelection.value[path],
    }
  }

  async function handleImportSelected() {
    const selected = scanResults.value
      .filter((r) => scanSelection.value[r.path])
      .map((r) => r.path)
    const catId = activeCategory.value || UNGROUPED_ID
    const {
      imported,
      skipped,
    } = await importScanResults(selected, catId)
    // 刷新项目列表以显示新导入的项目
    await loadProjects()
    handleCloseScan()
    if (imported > 0 || skipped > 0) {
      const msg = tf("importSucceed", "导入完成：成功 {0} 个", imported)
        + (skipped > 0 ? tf("importSkipped", "，跳过 {0} 个", skipped) : "")
      showMessage(msg, 3000, "info")
    }
  }

  /** 扫描目录专用路径选择，结果写入 scanDirInput */
  async function selectScanDirectory() {
    const path = await pickDirectory(tf("selectScanDirTitle", "选择要扫描的目录"))
    if (path) scanDirInput.value = path
  }

  return {
    showScanDialog,
    scanError,
    scanSelection,
    handleOpenScan,
    handleCloseScan,
    handleStartScan,
    handleToggleSelectAll,
    toggleScanItem,
    handleImportSelected,
    selectScanDirectory,
  }
}
