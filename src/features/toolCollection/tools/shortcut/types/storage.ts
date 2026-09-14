/**
 * 快捷键工具 - 持久化存储
 * 预置不落盘（代码即真源），仅「自定义」一份用户数据写盘；
 * 两代旧版键在首次打开工具时自动迁移到当前键（迁移见 `migrateLegacy`）
 */
import type { ShortcutInfo } from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { sanitizeShortcutArray } from "../utils"

/**
 * 自定义快捷键键：唯一可写数据（预置不落盘，插件升级即可获得新预置）
 */
const SHORTCUTS_CUSTOM_KEY = "plugin-toolCollection-shortcut-custom"

/**
 * 迁移源 1（现役旧键）：「仅自定义」段 —— 键名沿用模块迁入工具合集前的命名
 */
const LEGACY_CUSTOM_KEY = "plugin-shortcuts-custom"

/**
 * 迁移源 2（最早期的混存键）：「预置 + 自定义」全量混存，迁移时需过滤预置条目
 */
const LEGACY_ALL_KEY = "plugin-shortcuts-all"

/**
 * 快捷键存储管理类
 */
export class ShortcutStorage {
  readonly custom: TypedStorage<ShortcutInfo[]>
  /** 迁移源槽位（按代次排序）：只读，仅用于一次性迁移 */
  private readonly legacySources: TypedStorage<ShortcutInfo[]>[]

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.custom = new TypedStorage(storage, SHORTCUTS_CUSTOM_KEY)
    this.legacySources = [
      new TypedStorage(storage, LEGACY_CUSTOM_KEY),
      new TypedStorage(storage, LEGACY_ALL_KEY),
    ]
  }

  /**
   * 加载自定义快捷键
   */
  async loadCustom(): Promise<ShortcutInfo[]> {
    const data = await this.custom.load()
    return sanitizeShortcutArray(data, true)
  }

  /**
   * 保存自定义快捷键
   */
  async saveCustom(list: ShortcutInfo[]): Promise<boolean> {
    return this.custom.save(sanitizeShortcutArray(list, true))
  }

  /**
   * 迁移历史遗留数据（幂等，兼容两代旧键）：
   * 1. 新键已存在（含空数组）⇒ 迁移已完成，直接返回其内容
   *    —— 判定依据是「键是否存在」而非「是否非空」，否则用户删光自定义项后会被旧数据复活
   * 2. 按代次读取迁移源：现役旧键 `plugin-shortcuts-custom` 优先；不存在再读混存键 `plugin-shortcuts-all`
   * 3. 清洗字段并过滤预置 id（对现役旧键是无操作，纯防御）
   * 4. 新键写入成功才删除已消费的旧键；失败保留旧键，下次重试（不丢数据）
   * @param presetIds 预置快捷键 id 集合
   */
  async migrateLegacy(presetIds: ReadonlySet<string>): Promise<ShortcutInfo[]> {
    if (await this.custom.exists()) {
      return this.loadCustom()
    }

    const consumed: TypedStorage<ShortcutInfo[]>[] = []
    let custom: ShortcutInfo[] = []

    // 逐代读取、命中即停：旧键存在但为空数组时同样视为「用户已清空」，不再回落到更早的键
    for (const source of this.legacySources) {
      const raw = await source.load()
      if (raw === null) continue
      consumed.push(source)
      custom = sanitizeShortcutArray(raw, true).filter((item) => !presetIds.has(item.id))
      break
    }

    // 两代旧键都不存在 ⇒ 首次安装，不写盘
    if (consumed.length === 0) return []

    const saved = await this.custom.save(custom)
    if (!saved) {
      console.error("[shortcut] 迁移旧数据写入失败，保留旧键待下次重试")
      return custom
    }

    for (const source of consumed) {
      await source.remove()
    }
    return custom
  }
}
