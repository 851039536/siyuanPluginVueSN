// 资源行内快捷操作 composable：复制 Markdown 引用、在系统文件管理器中打开资源目录
import type { ResourceManagerI18n } from "../types"
import { resolveAssetPath } from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import { openFolderInExplorer } from "@/utils/electronDialog"
import { resolveDiskPath, safeDecodeURI, toMarkdownPath } from "../utils"

/** 行内快捷操作逻辑，供 useResourceManager 组合复用；showMsg 由调用方注入以复用统一提示封装 */
export function useAssetActions(i18n: ResourceManagerI18n, showMsg: (msg: string) => void) {
  /** 复制资源的 Markdown 引用（图片用 ![]() 语法，文件用 []() 语法，路径为空格编码形态） */
  async function copyMarkdownRef(path: string, isImage: boolean) {
    const mdPath = toMarkdownPath(path)
    const name = safeDecodeURI(path).split("/").pop() ?? path
    const md = isImage ? `![${name}](${mdPath})` : `[${name}](${mdPath})`
    const ok = await copyToClipboard(md)
    showMsg(ok ? i18n.mdRefCopied : i18n.copyFailed)
  }

  /** 在系统文件管理器中打开资源所在目录（浏览器/移动端 openFolderInExplorer 自然降级返回 false） */
  async function openAssetInExplorer(path: string) {
    try {
      // 磁盘文件名可能是解码形态，先确认真实路径再解析为 OS 绝对路径
      const diskPath = await resolveDiskPath(path)
      if (!diskPath) {
        showMsg(i18n.fileNotFound)
        return
      }
      const absPath = await resolveAssetPath(diskPath)
      if (!absPath || typeof absPath !== "string") {
        showMsg(i18n.openFolderFailed)
        return
      }
      // 截取父目录（兼容 Windows \ 与 POSIX / 分隔符）
      const sepIndex = Math.max(absPath.lastIndexOf("/"), absPath.lastIndexOf("\\"))
      const dir = sepIndex > 0 ? absPath.slice(0, sepIndex) : absPath
      const ok = await openFolderInExplorer(dir)
      if (!ok) showMsg(i18n.openFolderFailed)
    }
    catch {
      showMsg(i18n.openFolderFailed)
    }
  }

  return { copyMarkdownRef, openAssetInExplorer }
}
