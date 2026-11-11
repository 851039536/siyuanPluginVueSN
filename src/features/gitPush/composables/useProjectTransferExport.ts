/**
 * 项目配置导出（给 GitDesk 桌面端）
 *
 * 流程：读项目/分类/标签/模板 → 构造与 `ModuleExportPayload` v1 同形的载荷 →
 * 选保存路径 → 写 JSON → 提示。只带 4 个项目槽位，不含缓存与敏感槽位。
 *
 * 为什么单独给「给桌面端」的入口，而不是让用户去「数据管理 → 按模块导出」：
 * 那边按 registry 全量导出，会把 1.5MB 级的分析缓存一起写进去，且要手动在功能列表里
 * 找 `gitPush`；这边的入口固定只导项目配置，文件名与桌面端导出一致，便于混放辨认。
 */
import type { GitPushManager } from "../GitPushManager"
import { ref } from "vue"
import { showMessage } from "siyuan"
import { pickSavePath } from "@/utils/electronDialog"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import { desktopTransferFileName } from "../utils/projectTransferExport"

/** 保存对话框的 JSON 过滤 */
const JSON_FILTER = [{ name: "JSON", extensions: ["json"] }]

export function useProjectTransferExport(deps: {
  manager: GitPushManager
  i18n: Record<string, any>
}) {
  /** 导出中（并发去重，避免重复点击写出多份文件） */
  const exporting = ref(false)

  async function exportForDesktop(): Promise<void> {
    if (exporting.value) {
      return
    }
    const node = getNodeModules()
    if (!node) {
      showMessage(
        deps.i18n.exportForDesktopFailed.replace("{0}", deps.i18n.exportForDesktopNoNode),
        5000,
        "error",
      )
      return
    }
    exporting.value = true
    try {
      const payload = await deps.manager.buildProjectTransferPayload()
      const count = payload.slots["git-push-projects"].length
      if (count === 0) {
        showMessage(deps.i18n.exportForDesktopEmpty, 3000, "info")
        return
      }
      const target = await pickSavePath(deps.i18n.exportForDesktop, desktopTransferFileName(), JSON_FILTER)
      // 用户在保存对话框点了取消：静默返回，不提示也不落空文件
      if (!target) {
        return
      }
      await node.fs.promises.writeFile(target, JSON.stringify(payload, null, 2), "utf8")
      showMessage(
        deps.i18n.exportForDesktopDone
          .replace("{0}", String(count))
          .replace("{1}", target),
        6000,
        "info",
      )
    } catch (error: unknown) {
      showMessage(
        deps.i18n.exportForDesktopFailed.replace("{0}", getErrorMessage(error)),
        5000,
        "error",
      )
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportForDesktop }
}
