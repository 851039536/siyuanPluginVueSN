/**
 * 快捷键工具 - 数据初始化（幂等 bootstrap）
 * 工具合集切换工具会销毁并重建工具组件 ⇒ 初始化必须在模块级只执行一次：
 * 首次调用读存储（含旧键迁移）并注入 Manager，后续挂载直接复用同一个 Promise。
 */
import type { Plugin } from "siyuan"
import { PRESET_SHORTCUTS } from "./data/presets"
import { getShortcutManager } from "./manager"
import { ShortcutStorage } from "./types/storage"

/** 初始化 Promise 缓存（同一插件生命周期内只跑一次） */
let bootstrapPromise: Promise<void> | null = null

/**
 * 确保快捷键数据已初始化（幂等）：
 * 迁移历史遗留数据 → 注入「预置（代码真源）+ 自定义（存储）」→ 绑定保存回调（只写自定义段）。
 * 失败不抛错、也不缓存失败态：视图照常渲染，下次挂载自动重试。
 */
export function ensureShortcutData(plugin: Plugin): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = initShortcutData(plugin).catch((error: unknown) => {
      console.error("[shortcut] 初始化快捷键数据失败:", error)
      bootstrapPromise = null
    })
  }
  return bootstrapPromise
}

/** 真正的一次性初始化流程 */
async function initShortcutData(plugin: Plugin): Promise<void> {
  const manager = getShortcutManager()
  const storage = new ShortcutStorage(plugin)
  const presetIds = new Set(PRESET_SHORTCUTS.map((item) => item.id))

  // 旧版持久化键 → 自定义段（幂等，写新键成功才删旧键，失败保留待下次重试）
  const custom = await storage.migrateLegacy(presetIds)

  manager.loadFrom({ presets: PRESET_SHORTCUTS, custom })
  manager.setSaveCallback((list) => storage.saveCustom(list))
}
