/**
 * Everything搜索结果操作 composable
 * 打开 / 资源管理器显示 / 复制路径 / 移入回收站
 *
 * 关键设计约束：
 * 1. 删除一律走 Electron 主进程的 `shell.trashItem`（真正的系统回收站 API，与资源管理器
 *    删文件同一条路径，不产生子进程、不落脚本特征），**不保留 PowerShell 兜底**：
 *    宁可在极端环境下提示「删除失败」，也不引入会被安全软件上报的执行路径。
 * 2. 删除前统一经 `isProtectedPath` 守卫（系统关键路径一律拒绝）。
 * 3. `shell.openPath` 的契约是「成功返回空串、失败返回错误描述」，故按返回值分流提示，
 *    不能无条件报成功。
 */
import type { ComputedRef } from "vue"
import type { EverythingSearchResult } from "../types"
import { showMessage } from "siyuan"
import { onScopeDispose } from "vue"
import { openPathInShell } from "@/utils/electronDialog"
import { copyToClipboard } from "@/utils/domUtils"
import { getElectronModules } from "@/utils/nodeModules"
import { trashToRecycleBin } from "../shellChannels"
import {
  getFullPath,
  isProtectedPath,
  readErrorMessage,
} from "../utils"

/**
 * 结果操作：依赖 i18n 文案与「移除条目」回调。
 *
 * ⚠️ 删除成功后的列表与状态更新由父层注入 `removeResult` 完成 —— 本 composable
 * 既不读也不写 `SearchState`，避免「谁能改结果列表」出现两个入口。
 */
export function useResultActions(
  i18n: ComputedRef<Record<string, string>>,
  removeResult: (item: EverythingSearchResult) => void,
) {
  /** 正在删除的 item 集合（防止异步删除窗口内重复触发） */
  const deletingItems = new Set<EverythingSearchResult>()

  // 卸载时清空：`trashItem` 若长期不返回，该集合会一直握着结果对象，
  // 而结果对象可能已被下一次搜索整体替换（本应可回收）
  onScopeDispose(() => deletingItems.clear())

  /** 打开项目（按 `openPathInShell` 的返回值分流提示，不再无条件报成功） */
  const handleItemOpen = async (item: EverythingSearchResult) => {
    const ok = await openPathInShell(getFullPath(item))
    if (!ok) {
      // 错误提示："打开失败"
      showMessage(i18n.value.openFailed, 3000, "error")
    }
  }

  /** 在文件夹中显示 */
  const handleItemShowInFolder = (item: EverythingSearchResult) => {
    const shell = getElectronModules()?.shell
    if (!shell) {
      // 错误提示："操作失败"
      showMessage(i18n.value.operationFailed, 3000, "error")
      return
    }
    try {
      shell.showItemInFolder(getFullPath(item))
    } catch (error) {
      showMessage(`${i18n.value.operationFailed}: ${readErrorMessage(error)}`, 3000, "error")
    }
  }

  /** 复制路径 */
  const handleItemCopyPath = async (item: EverythingSearchResult) => {
    const ok = await copyToClipboard(getFullPath(item))
    // 提示："路径已复制" / "复制失败"
    showMessage(ok ? i18n.value.pathCopied : i18n.value.copyFailed, 2000, ok ? "info" : "error")
  }

  /**
   * 删除文件（移入回收站）：通道探测与执行统一由 `shellChannels.trashToRecycleBin` 承担
   * （**不降级到 PowerShell**，见文件头说明）。
   */
  const handleItemDelete = async (item: EverythingSearchResult) => {
    // 同一 item 的删除正在进行时直接忽略（快速双击时第二击可能在 await 窗口内到达）
    if (deletingItems.has(item)) {
      return
    }
    const fullPath = getFullPath(item)

    // 系统关键路径守卫：宁可拒绝，也不允许把系统文件移入回收站
    if (isProtectedPath(fullPath)) {
      showMessage(i18n.value.protectedPath, 3000, "error")
      return
    }

    deletingItems.add(item)
    try {
      await trashToRecycleBin(fullPath)
      // 删除成功后从结果列表移除（条目可能已被新搜索替换，由父层按「仍在列表中」判断）
      removeResult(item)
      // 提示："文件已移入回收站"
      showMessage(i18n.value.deletedToTrash, 2000, "info")
    } catch (error) {
      // 错误提示："删除失败" + 具体原因（回收站通道不可用 / 文件被占用等）
      showMessage(`${i18n.value.deleteFailed}: ${readErrorMessage(error)}`, 3000, "error")
    } finally {
      // 清理标记，失败后允许再次尝试
      deletingItems.delete(item)
    }
  }

  return {
    handleItemOpen,
    handleItemShowInFolder,
    handleItemCopyPath,
    handleItemDelete,
  }
}
