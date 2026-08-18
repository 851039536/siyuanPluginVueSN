// gitPush 项目卡片本地动作（自定义 IDE 删除确认 / 复制仓库链接）
import { ref } from "vue"
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"

export function useCardActions(deps: {
  i18n: Record<string, any>
}) {
  /** 自定义 IDE 删除二次确认态（按 IDE 名称标识，卡片私有） */
  const confirmingDelName = ref("")

  /** 右键复制远程仓库链接 */
  async function handleCopyUrl(url: string) {
    const ok = await copyToClipboard(url)
    // 提示："链接已复制"
    if (ok) showMessage(deps.i18n.copiedLink, 1500, "info")
  }

  return {
    confirmingDelName,
    handleCopyUrl,
  }
}
