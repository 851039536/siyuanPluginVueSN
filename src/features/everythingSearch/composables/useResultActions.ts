/**
 * Everything搜索结果操作 composable
 * 打开 / 资源管理器显示 / 复制路径 / 移入回收站
 *
 * 整改要点：
 * 1. `trashViaPowerShell` 原先用 `execFileSync("powershell", ...)` 拼字符串调
 *    `Microsoft.VisualBasic.FileIO.FileSystem.DeleteFile/DeleteDirectory` ——
 *    这是**杀软最敏感的行为组合**（脚本宿主 + 原生删除 + 无签名命令行），
 *    企业版 360 极易按「可疑脚本行为」拦截并上报。现一律走 Electron 主进程的
 *    `shell.trashItem`（真正的系统回收站 API，与资源管理器删文件同一条路径，
 *    不产生子进程、不落脚本特征），并**取消 PowerShell 兜底**：
 *    宁可在极端环境下提示「删除失败」，也不引入会被安全软件上报的执行路径。
 * 2. 删除前统一经 `isProtectedPath` 守卫（系统关键路径一律拒绝）。
 * 3. `shell.openPath` 的契约是「成功返回空串、失败返回错误描述」，原先未取返回值，
 *    失败也会提示成功 —— 现按返回值分流提示。
 */
import type { ComputedRef } from "vue"
import type { EverythingSearchResult } from "../types"
import { showMessage } from "siyuan"
import { onScopeDispose } from "vue"
import { openPathInShell } from "@/utils/electronDialog"
import { copyToClipboard } from "@/utils/domUtils"
import {
  getElectronModules,
  getElectronRemoteShell,
} from "@/utils/nodeModules"
import {
  getFullPath,
  isProtectedPath,
} from "../utils"

/** Electron shell 统一类型（remote / local 同构） */
type Shell = NonNullable<ReturnType<typeof getElectronRemoteShell>>

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

  /** 获取本进程 Electron shell（nodeModules 统一封装，非 Electron 环境返回 null） */
  const getShell = (): Shell | null => getElectronModules()?.shell ?? null

  /**
   * 获取全部可用 shell：remote 优先（`trashItem` 依赖主进程 FileOperation，
   * 渲染进程直接调用会抛 "Failed to create FileOperation instance"），local 兜底。
   */
  const getShells = (): Shell[] => {
    const shells: Shell[] = []
    const remote = getElectronRemoteShell()
    if (remote) shells.push(remote)
    const local = getShell()
    if (local) shells.push(local)
    return shells
  }

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
    const shell = getShell()
    if (!shell) {
      // 错误提示："操作失败"
      showMessage(i18n.value.operationFailed, 3000, "error")
      return
    }
    try {
      shell.showItemInFolder(getFullPath(item))
    } catch (error) {
      showMessage(`${i18n.value.operationFailed}: ${(error as Error).message}`, 3000, "error")
    }
  }

  /** 复制路径 */
  const handleItemCopyPath = async (item: EverythingSearchResult) => {
    const ok = await copyToClipboard(getFullPath(item))
    // 提示："路径已复制" / "复制失败"
    showMessage(ok ? i18n.value.pathCopied : i18n.value.copyFailed, 2000, ok ? "info" : "error")
  }

  /**
   * 移入系统回收站：仅在 Electron 主进程 shell 上寻找 `trashItem` / `moveItemToTrash`。
   * 无可用通道时返回 false（**不再降级到 PowerShell**，见文件头说明）。
   */
  const trashViaShell = async (shells: Shell[], fullPath: string): Promise<boolean> => {
    for (const shell of shells) {
      if (typeof shell.trashItem === "function") {
        await shell.trashItem(fullPath)
        return true
      }
    }
    for (const shell of shells) {
      if (typeof shell.moveItemToTrash === "function") {
        shell.moveItemToTrash(fullPath)
        return true
      }
    }
    return false
  }

  /** 删除文件（移入回收站） */
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
      if (!await trashViaShell(getShells(), fullPath)) {
        throw new Error(i18n.value.operationFailed)
      }
      // 删除成功后从结果列表移除（条目可能已被新搜索替换，由父层按「仍在列表中」判断）
      removeResult(item)
      // 提示："文件已移入回收站"
      showMessage(i18n.value.deletedToTrash, 2000, "info")
    } catch (error) {
      // 错误提示："删除失败"
      showMessage(`${i18n.value.deleteFailed}: ${(error as Error).message}`, 3000, "error")
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
