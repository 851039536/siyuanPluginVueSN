/**
 * 快捷键数据接线：响应式镜像、增删改、复制、导入导出与重置
 */
import type { ShortcutInfo } from "../types"
import { ref } from "vue"
import { pushMsg } from "@/api"
import {
  copyToClipboard,
  triggerBlobDownload,
} from "@/utils/domUtils"
import { getShortcutManager } from "../manager"
import { resolveShortcutDisplay } from "../utils"
import {
  buildExportFileName,
  buildExportPayload,
  mergeImport,
  parseImportPayload,
  serializeExport,
  IMPORT_ERROR_INVALID_JSON,
} from "../dataTransfer"

interface UseShortcutDataOptions {
  i18n: Record<string, string>
}

export function useShortcutData(options: UseShortcutDataOptions) {
  const { i18n } = options
  const manager = getShortcutManager()

  // Manager 内部数组非响应式 ⇒ 视图层留一份响应式镜像，任何变更后调用 refresh()
  const allShortcuts = ref<ShortcutInfo[]>(manager.getAllShortcuts())
  /**
   * 预置 id 集合镜像：`manager.loadFrom()` 会整体替换内部 Set，
   * 若在此处直接持有旧引用，面板早于数据初始化挂载时会误判「全部都是自定义项」
   */
  const presetIds = ref<Set<string>>(new Set(manager.getPresetIds()))

  /** 同步 Manager 数据到响应式镜像 */
  function refresh() {
    allShortcuts.value = manager.getAllShortcuts()
    presetIds.value = new Set(manager.getPresetIds())
  }

  /** 初始化：取一次数据快照（预置由 registerShortcut 异步载入，挂载后再对齐一次） */
  function init() {
    refresh()
  }

  /** 复制条目的主内容（与卡片显示同源：走 resolveShortcutDisplay，避免显示与复制规则分叉） */
  async function copyShortcut(shortcut: ShortcutInfo) {
    const ok = await copyToClipboard(resolveShortcutDisplay(shortcut).content)
    if (ok) {
      pushMsg(i18n.copiedSuccess)
    }
  }

  /** 新增 / 更新自定义快捷键 */
  async function saveCustomShortcut(shortcut: ShortcutInfo) {
    const saved = await manager.addOrUpdateCustom(shortcut)
    refresh()
    if (!saved) {
      pushMsg(i18n.scSaveFailed, 3000, "error")
    }
    return saved
  }

  /** 删除自定义快捷键 */
  async function deleteCustomShortcut(id: string) {
    const removed = await manager.removeCustom(id)
    refresh()
    return removed
  }

  /** 导出自定义快捷键为 JSON 文件 */
  function exportCustomShortcuts() {
    const payload = buildExportPayload(manager.getCustomShortcuts())
    const blob = new Blob([serializeExport(payload)], {
      type: "application/json",
    })
    triggerBlobDownload(blob, buildExportFileName())
  }

  /**
   * 导入自定义快捷键：与预置 id 冲突的条目忽略，同 id 覆盖，新 id 追加
   * @returns 合并统计；解析失败返回 null
   */
  async function importCustomShortcuts(text: string) {
    const result = parseImportPayload(text, manager.getPresetIds())
    if (!result.ok) {
      pushMsg(
        result.error === IMPORT_ERROR_INVALID_JSON ? i18n.scImportInvalidJson : i18n.scImportInvalidStructure,
        4000,
        "error",
      )
      return null
    }

    const merged = mergeImport(manager.getCustomShortcuts(), result.items)
    await manager.replaceCustom(merged.next)
    refresh()

    return { added: merged.added, updated: merged.updated, ignored: result.ignored }
  }

  /** 重置：清空自定义快捷键（预置来自代码，不受影响） */
  async function resetAll() {
    await manager.clearCustom()
    refresh()
  }

  return {
    allShortcuts,
    /** 预置 id 集合（预置只读，视图据此决定是否渲染编辑 / 删除按钮） */
    presetIds,
    refresh,
    init,
    copyShortcut,
    saveCustomShortcut,
    deleteCustomShortcut,
    exportCustomShortcuts,
    importCustomShortcuts,
    resetAll,
  }
}
