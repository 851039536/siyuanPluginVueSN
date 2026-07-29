// gitPush 项目卡片本地动作（行内改名 / 自定义 IDE 删除确认 / 复制仓库链接），经 CardServices 注入直连父层服务
import type { GitProject } from "../types"
import { inject, ref } from "vue"
import { showMessage } from "siyuan"
import { CARD_SERVICES_KEY } from "../types"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"

export function useCardActions(deps: {
  project: () => GitProject
  i18n: Record<string, any>
}) {
  const services = inject(CARD_SERVICES_KEY)!

  // ── 行内改名（卡片私有编辑态，保存直连注入的 updateProjectMeta）──
  const editingName = ref(false)
  const nameInput = ref("")

  /** 点击名称进入编辑态 */
  function startNameEdit() {
    nameInput.value = deps.project().name
    editingName.value = true
  }

  /** Escape 取消编辑（先于 blur 触发，saveNameEdit 据编辑态跳过保存） */
  function cancelNameEdit() {
    editingName.value = false
  }

  /** 失焦/回车保存名称（为空提示、未变更跳过） */
  async function saveNameEdit() {
    if (!editingName.value) return
    editingName.value = false
    const project = deps.project()
    const newName = nameInput.value.trim()
    try {
      if (!newName) {
        // 提示："名称不能为空"
        showMessage(deps.i18n.nameEmpty, 2000, "error")
      } else if (newName !== project.name) {
        await services.updateProjectMeta(project.id, { name: newName })
      }
    } catch (e: unknown) {
      // 提示："名称更新失败: {0}"
      showMessage(deps.i18n.nameUpdateFailed.replace("{0}", getErrorMessage(e)), 4000, "error")
    }
  }

  /** 自定义 IDE 删除二次确认态（按 IDE 名称标识，卡片私有） */
  const confirmingDelName = ref("")

  /** 右键复制远程仓库链接 */
  async function handleCopyUrl(url: string) {
    const ok = await copyToClipboard(url)
    // 提示："链接已复制"
    if (ok) showMessage(deps.i18n.copiedLink, 1500, "info")
  }

  return {
    editingName,
    nameInput,
    startNameEdit,
    cancelNameEdit,
    saveNameEdit,
    confirmingDelName,
    handleCopyUrl,
  }
}
