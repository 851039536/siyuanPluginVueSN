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
  /** 读取上次扫描目录（弹窗打开时预填） */
  getScanDir: () => Promise<string>
  /** 记录本次扫描目录（持久化，供下次预填） */
  setScanDir: (dir: string) => Promise<void>
  tf: (key: string, ...args: (string | number)[]) => string
}) {
  const { scanResults, activeCategory, startScan, importScanResults, loadProjects, getScanDir, setScanDir, tf } = deps

  const showScanDialog = ref(false)
  const scanError = ref("")
  const scanSelection = ref<Record<string, boolean>>({})
  /** 扫描目录（与持久化存储同步，弹窗 v-model 直连） */
  const scanDir = ref("")

  async function handleOpenScan() {
    scanError.value = ""
    scanResults.value = []
    scanSelection.value = {}
    showScanDialog.value = true
    // 预填上次扫描目录：读盘失败不应阻塞弹窗打开（空串即回退到占位符提示）
    try {
      scanDir.value = await getScanDir()
    } catch {
      scanDir.value = ""
    }
  }

  function handleCloseScan() {
    showScanDialog.value = false
    scanError.value = ""
  }

  /** 执行扫描（目录由弹窗 v-model 传入，此处落盘以便下次预填） */
  async function handleStartScan(dir: string) {
    scanError.value = ""
    const trimmed = dir.trim()
    try {
      await startScan(trimmed)
      // 扫描成功才记录目录：失败路径（目录不存在/无权限）不值得持久化，否则下次预填一个坏路径
      scanDir.value = trimmed
      await setScanDir(trimmed)
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
    scanDir,
    handleOpenScan,
    handleCloseScan,
    handleStartScan,
    handleToggleSelectAll,
    toggleScanItem,
    handleImportSelected,
  }
}
