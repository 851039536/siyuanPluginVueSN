/**
 * 快捷键数据接线：响应式镜像、增删改、收藏/最近、导入导出与重置
 */
import type { Plugin } from "siyuan"
import type { ShortcutInfo } from "../types"
import {
  computed,
  ref,
} from "vue"
import { pushMsg } from "@/api"
import {
  copyToClipboard,
  triggerBlobDownload,
} from "@/utils/domUtils"
import {
  buildConflictMap,
  pruneIds,
} from "../utils"
import { getShortcutManager } from "../manager"
import { ShortcutStorage } from "../types/storage"
import { RECENT_LIMIT } from "../types"
import {
  buildExportFileName,
  buildExportPayload,
  mergeImport,
  parseImportPayload,
  serializeExport,
  IMPORT_ERROR_INVALID_JSON,
} from "../dataTransfer"

interface UseShortcutDataOptions {
  plugin?: Plugin
  i18n: Record<string, string>
}

export function useShortcutData(options: UseShortcutDataOptions) {
  const { plugin, i18n } = options
  const manager = getShortcutManager()
  const storage = plugin ? new ShortcutStorage(plugin) : null

  // Manager 内部数组非响应式 ⇒ 视图层留一份响应式镜像，任何变更后调用 refresh()
  const allShortcuts = ref<ShortcutInfo[]>(manager.getAllShortcuts())
  /**
   * 预置 id 集合镜像：`manager.loadFrom()` 会整体替换内部 Set，
   * 若在此处直接持有旧引用，面板早于数据初始化挂载时会误判「全部都是自定义项」
   */
  const presetIds = ref<Set<string>>(new Set(manager.getPresetIds()))
  const favorites = ref<Set<string>>(new Set())
  /** 最近使用 id（最新在前，上限 RECENT_LIMIT） */
  const recentIds = ref<string[]>([])

  /** 冲突表：冲突项 id → 冲突对象名称列表 */
  const conflictMap = computed(() => buildConflictMap(allShortcuts.value))
  /** 存在冲突的条目 id 集合 */
  const conflictIds = computed(() => new Set(conflictMap.value.keys()))

  /** 同步 Manager 数据到响应式镜像 */
  function refresh() {
    allShortcuts.value = manager.getAllShortcuts()
    presetIds.value = new Set(manager.getPresetIds())
  }

  /**
   * 初始化：加载收藏与最近使用；结束时再取一次数据快照
   * （预置数据由 registerShortcut 异步载入，此处 await 之后才能取到完整列表）
   */
  async function init() {
    if (storage) {
      try {
        const [loadedFavorites, loadedRecent] = await Promise.all([
          storage.loadFavorites(),
          storage.loadRecent(),
        ])
        favorites.value = new Set(loadedFavorites)
        recentIds.value = loadedRecent
      } catch (error) {
        console.error("初始化收藏与最近使用失败:", error)
      }
    }
    refresh()
  }

  /** 落盘收藏与最近使用（两者不经过 Manager 的保存回调） */
  async function persistUserState(): Promise<boolean> {
    if (!storage) return true
    const results = await Promise.all([
      storage.saveFavorites(Array.from(favorites.value)),
      storage.saveRecent(recentIds.value),
    ])
    return results.every(Boolean)
  }

  /** 切换收藏 */
  async function toggleFavorite(id: string) {
    if (favorites.value.has(id)) {
      favorites.value.delete(id)
    } else {
      favorites.value.add(id)
    }
    await persistUserState()
  }

  /** 记入最近使用（最新在前，超出上限时丢弃最旧） */
  async function markRecent(id: string) {
    recentIds.value = [id, ...recentIds.value.filter((item) => item !== id)]
      .slice(0, RECENT_LIMIT)
    await persistUserState()
  }

  /** 复制快捷键内容并记入最近使用 */
  async function copyShortcut(shortcut: ShortcutInfo) {
    const ok = await copyToClipboard(shortcut.copyContent || shortcut.keys)
    if (!ok) return
    await markRecent(shortcut.id)
    pushMsg(i18n.copiedSuccess)
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

  /** 删除自定义快捷键，并同步清理收藏与最近使用中的残留 */
  async function deleteCustomShortcut(id: string) {
    const removed = await manager.removeCustom(id)
    if (!removed) {
      return false
    }
    favorites.value.delete(id)
    recentIds.value = recentIds.value.filter((item) => item !== id)
    refresh()
    await persistUserState()
    return true
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

    // 导入可能覆盖了正在被收藏/最近引用的条目，重新剪枝一次
    const validIds = new Set(allShortcuts.value.map((item) => item.id))
    const prunedFavorites = pruneIds(Array.from(favorites.value), validIds)
    const prunedRecent = pruneIds(recentIds.value, validIds)
    favorites.value = new Set(prunedFavorites.ids)
    recentIds.value = prunedRecent.ids
    if (prunedFavorites.changed || prunedRecent.changed) {
      await persistUserState()
    }

    return { added: merged.added, updated: merged.updated, ignored: result.ignored }
  }

  /** 重置：清空自定义 + 收藏 + 最近（预置来自代码，不受影响） */
  async function resetAll() {
    await manager.clearCustom()
    favorites.value = new Set()
    recentIds.value = []
    refresh()
    if (storage) {
      await storage.clearUserData()
    }
  }

  return {
    allShortcuts,
    favorites,
    recentIds,
    /** 预置 id 集合（预置只读，视图据此决定是否渲染编辑 / 删除按钮） */
    presetIds,
    conflictMap,
    conflictIds,
    refresh,
    init,
    toggleFavorite,
    markRecent,
    copyShortcut,
    saveCustomShortcut,
    deleteCustomShortcut,
    exportCustomShortcuts,
    importCustomShortcuts,
    resetAll,
  }
}
