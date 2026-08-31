/**
 * Everything搜索结果操作 composable
 * 打开 / 资源管理器显示 / 复制路径 / 移入回收站（shell 瀑布降级 + PowerShell 兜底）
 */
import type { ComputedRef } from "vue"
import type {
  EverythingSearchResult,
  SearchState,
} from "../types"
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"
import {
  getElectronModules,
  getElectronRemoteShell,
  getNodeProcessModules,
} from "@/utils/nodeModules"
import { getFullPath } from "../api"

/** Electron shell 统一类型（remote / local 同构） */
type Shell = NonNullable<ReturnType<typeof getElectronRemoteShell>>

/**
 * 结果操作：依赖 i18n 文案与搜索状态（删除成功后从结果列表移除）
 */
export function useResultActions(
  i18n: ComputedRef<Record<string, string>>,
  searchState: SearchState,
) {
  /** 正在删除的 item 集合（防止异步删除窗口内重复触发） */
  const deletingItems = new Set<EverythingSearchResult>()

  /** 获取本进程 Electron shell（nodeModules 统一封装，非 Electron 环境返回 null） */
  const getShell = (): Shell | null => getElectronModules()?.shell ?? null

  /** 获取全部可用 shell：remote 优先（trashItem 依赖主进程 FileOperation），local 兜底 */
  const getShells = (): Shell[] => {
    const shells: Shell[] = []
    const remote = getElectronRemoteShell()
    if (remote) shells.push(remote)
    const local = getShell()
    if (local) shells.push(local)
    return shells
  }

  /** 打开项目 */
  const handleItemOpen = async (item: EverythingSearchResult) => {
    const shell = getShell()
    if (!shell) {
      // 错误提示："打开失败"
      showMessage(i18n.value.openFailed, 3000, "error")
      return
    }
    try {
      await shell.openPath(getFullPath(item))
    } catch (error) {
      showMessage(`${i18n.value.openFailed}: ${(error as Error).message}`, 3000, "error")
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

  /** shell 瀑布：先在全部 shell 中找 trashItem，再找 moveItemToTrash；无可用通道返回 false */
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

  /**
   * PowerShell 兜底：execFileSync 直启 powershell（不经 cmd.exe，规避 % 变量展开注入），
   * 按类型区分 DeleteFile / DeleteDirectory（空文件夹场景必须用 DeleteDirectory）
   */
  const trashViaPowerShell = (
    fullPath: string,
    type: EverythingSearchResult["type"],
  ) => {
    const nodeModules = getNodeProcessModules()
    if (!nodeModules) {
      throw new Error(i18n.value.operationFailed)
    }
    const verb = type === "folder" ? "DeleteDirectory" : "DeleteFile"
    const escaped = fullPath.replace(/'/g, "''")
    nodeModules.child_process.execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Add-Type -AssemblyName Microsoft.VisualBasic;[Microsoft.VisualBasic.FileIO.FileSystem]::${verb}('${escaped}','OnlyErrorDialogs','SendToRecycleBin')`,
      ],
      { timeout: 5000 },
    )
  }

  /** 删除文件（移入回收站：shell 瀑布 trashItem → moveItemToTrash → PowerShell 兜底） */
  const handleItemDelete = async (item: EverythingSearchResult) => {
    // 同一 item 的删除正在进行时直接忽略（快速双击时第二击可能在 await 窗口内到达）
    if (deletingItems.has(item)) {
      return
    }
    deletingItems.add(item)
    const fullPath = getFullPath(item)
    try {
      if (!await trashViaShell(getShells(), fullPath)) {
        trashViaPowerShell(fullPath, item.type)
      }
      // 删除期间新搜索可能已替换结果数组：仅当 item 仍在当前结果中才更新（避免误置 empty）
      if (searchState.results.includes(item)) {
        searchState.results = searchState.results.filter((r) => r !== item)
        if (searchState.results.length === 0) {
          searchState.status = "empty"
        }
      }
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
