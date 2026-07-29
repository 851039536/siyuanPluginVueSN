// 扫描导入弹窗状态与流程（扫描目录 → 选择 → 导入）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { ScannedGitRepo } from "../types/storage"
import { UNGROUPED_ID } from "../types"
import { getErrorMessage } from "@/utils/stringUtils"

type ScanRepo = ScannedGitRepo & { alreadyImported: boolean }

export function useScanImport(deps: {
  scanResults: Ref<ScanRepo[]>
  activeCategory: Ref<string>
  startScan: (dir: string) => Promise<void>
  importScanResults: (paths: string[], catId: string) => Promise<{ imported: number, skipped: number }>
  loadProjects: () => Promise<void>
  tf: (key: string, ...args: (string | number)[]) => string
}) {
  const { scanResults, activeCategory, startScan, importScanResults, loadProjects, tf } = deps

  const showScanDialog = ref(false)
  const scanError = ref("")
  const scanSelection = ref<Record<string, boolean>>({})

  function handleOpenScan() {
    scanError.value = ""
    scanResults.value = []
    scanSelection.value = {}
    showScanDialog.value = true
  }

  function handleCloseScan() {
    showScanDialog.value = false
    scanError.value = ""
  }

  /** 执行扫描（目录由弹窗 start-scan 事件携带） */
  async function handleStartScan(dir: string) {
    scanError.value = ""
    try {
      await startScan(dir.trim())
      // 扫描成功 → 自动全选未导入项
      const sel: Record<string, boolean> = {}
      for (const repo of scanResults.value) {
        if (!repo.alreadyImported) {
          sel[repo.path] = true
        }
      }
      scanSelection.value = sel
    } catch (e: unknown) {
      scanError.value = getErrorMessage(e) || tf("scanError")
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
      const msg = tf("importSucceed", imported)
        + (skipped > 0 ? tf("importSkipped", skipped) : "")
      showMessage(msg, 3000, "info")
    }
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
  }
}
