// gitPush 项目卡片本地动作（复制项目路径 / 复制仓库链接）
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"

export function useCardActions(deps: {
  i18n: Record<string, any>
}) {
  /** 右键复制远程仓库链接 */
  async function handleCopyUrl(url: string) {
    const ok = await copyToClipboard(url)
    // 提示："链接已复制"
    if (ok) showMessage(deps.i18n.copiedLink, 1500, "info")
  }

  /** 「打开项目」菜单 → 复制项目路径（多设备场景取当前设备解析出的有效路径） */
  async function handleCopyProjectPath(path: string) {
    if (!path) {
      showMessage(deps.i18n.copyProjectPathFailed, 2000, "error")
      return
    }
    const ok = await copyToClipboard(path)
    // 提示："项目路径已复制" / 失败："复制项目路径失败"
    if (ok) showMessage(deps.i18n.copiedProjectPath, 1500, "info")
    else showMessage(deps.i18n.copyProjectPathFailed, 2000, "error")
  }

  return {
    handleCopyUrl,
    handleCopyProjectPath,
  }
}
