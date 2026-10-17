/**
 * 网站条目数据模型与存储层（共享模块）
 * 供 websiteNavigation 与 minimalBrowser 共用同一份书签数据。
 *
 * 存储：**纯 SQLite**（统一单库 `plugin.db` 的 `wn_entries` / `wn_categories` 表）。
 * 表命名约定见 @/utils/sqliteDb 的 featureTables()。
 *
 * ⚠️ 本模块**不含**任何旧格式兼容/迁移分支；新增功能请照此模式只加表、不建库。
 */
import type { Plugin } from "siyuan"
import { featureTables, openWithRetry, type PluginDatabase } from "@/utils/sqliteDb"

/** 日志前缀（便于在多功能日志中区分） */
const LOG_TAG = "[websiteNavigation]"

// ========================================
// 数据模型
// ========================================

/** 网站条目 */
export interface WebsiteEntry {
  id: string
  name: string
  url: string
  category: string
  description: string
  createdAt: number
  updatedAt: number
}

/** 创建网站条目数据传输对象 */
export interface CreateWebsiteDTO {
  name: string
  url: string
  category: string
  description: string
}

/** 更新网站条目数据传输对象（所有字段可选） */
export interface UpdateWebsiteDTO {
  name?: string
  url?: string
  category?: string
  description?: string
}

/** 网站分类 */
export interface WebsiteCategory {
  id: string
  name: string
  color: string
}

// ========================================
// 共享常量
// ========================================

/** 默认分类 ID（面板/弹窗/存储共用） */
export const DEFAULT_CATEGORY_ID = "default"
/** “全部”分类筛选 ID（面板/筛选栏共用） */
export const ALL_CATEGORY_ID = "all"
/** 默认分类颜色（FilterBar/WebsiteCard/Storage 共用） */
export const DEFAULT_CATEGORY_COLOR = "#b0aea5"
/** 分类管理弹窗预设色（CategoryManager/Storage 共用） */
export const PRESET_CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#b0aea5",
] as const

// ========================================
// 存储层（统一单库 plugin.db）
// ========================================

/** 表命名空间前缀：统一单库下按功能隔离表名（websiteNavigation → wn） */
const TABLE = featureTables("wn", ["entries", "categories"] as const)

/** 表结构版本（结构变更时递增，见 _migrate） */
const DB_SCHEMA_VERSION = 2

const DEFAULT_CATEGORIES: WebsiteCategory[] = [
  {
    id: DEFAULT_CATEGORY_ID,
    name: "默认",
    color: DEFAULT_CATEGORY_COLOR,
  },
  {
    id: "dev",
    name: "开发",
    color: PRESET_CATEGORY_COLORS[0],
  },
  {
    id: "tools",
    name: "工具",
    color: PRESET_CATEGORY_COLORS[1],
  },
  {
    id: "social",
    name: "社交",
    color: PRESET_CATEGORY_COLORS[2],
  },
  {
    id: "media",
    name: "媒体",
    color: PRESET_CATEGORY_COLORS[3],
  },
]

/** 数据库行形状（列名与 WebsiteEntry 字段一一对应） */
interface EntryRow {
  id: string
  name: string
  url: string
  category: string
  description: string
  created_at: number
  updated_at: number
}

/** categories 表行形状 */
interface CategoryRow {
  id: string
  name: string
  color: string
  sort: number
}

/** 行 → 领域对象 */
function rowToEntry(row: EntryRow): WebsiteEntry {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category,
    description: row.description ?? "",
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

/** categories 行 → 领域对象 */
function rowToCategory(row: CategoryRow): WebsiteCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  }
}

export class WebsiteNavigationStorage {
  /** SQLite 句柄；null = 尚未就绪或不可用 */
  private db: PluginDatabase | null = null
  /** 初始化 Promise（并发调用只初始化一次） */
  private initPromise: Promise<PluginDatabase | null> | null = null
  /** 已关闭标记：防止 close() 后仍被初始化回调重新赋值而泄漏连接 */
  private closed = false

  constructor(plugin: Plugin) {
    this.initPromise = this._init(plugin)
  }

  /**
   * 初始化数据库：打开（含启动早期重试）→ 建表 → 播种默认分类。
   *
   * 通用重试逻辑在 `openWithRetry`，本类只提供「建表 + 播种」这一功能特有部分。
   * 历史数据迁移已由一次性脚本完成并下线，此处**只保证表存在**，
   * 因此每次启动都是 O(1)，不存在「反复侦测并导入」的开销。
   */
  private async _init(plugin: Plugin): Promise<PluginDatabase | null> {
    const db = await openWithRetry(plugin, (d) => this._prepare(d), { logTag: LOG_TAG })
    // 关闭可能发生在初始化期间（500ms~10.5s 的重试窗口里插件被卸载）。
    // 此时必须立即关掉刚拿到的句柄，否则它会泄漏 —— 单例已被清空，再没人能关它。
    if (this.closed) {
      db?.close()
      return null
    }
    this.db = db
    return db
  }

  /** 建表 + 版本迁移（幂等） */
  private _migrate(db: PluginDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE.entries} (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        url         TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'default',
        description TEXT NOT NULL DEFAULT '',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )
    `)
    // 按分类筛选是主要查询路径（面板/侧栏均按分类分组）
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${TABLE.entries}_category ON ${TABLE.entries}(category)`)

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE.categories} (
        id    TEXT PRIMARY KEY,
        name  TEXT NOT NULL,
        color TEXT NOT NULL,
        sort  INTEGER NOT NULL DEFAULT 0
      )
    `)

    db.setUserVersion(DB_SCHEMA_VERSION)
  }

  /**
   * 建表 + 播种默认分类（由 openWithRetry 在打开成功后调用一次）。
   *
   * 只负责「表存在且可用」，不含任何格式兼容/迁移分支。
   */
  private _prepare(db: PluginDatabase): void {
    this._migrate(db)

    // 全新库（首次安装）时播种默认分类，避免界面空分类。
    // 已有数据时 count > 0，不会覆盖。
    const catCount = db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${TABLE.categories}`)?.c ?? 0
    if (catCount === 0) {
      db.withTransaction(() => {
        DEFAULT_CATEGORIES.forEach((cItem, index) => {
          db.run(
            `INSERT OR REPLACE INTO ${TABLE.categories} (id, name, color, sort) VALUES (?, ?, ?, ?)`,
            cItem.id,
            cItem.name,
            cItem.color,
            index,
          )
        })
      })
    }

    // 自愈：把指向「不存在分类」的书签归入默认分类（历史脏数据兜底）。
    const orphanFixed = db.run(
      `UPDATE ${TABLE.entries}
          SET category = ?
        WHERE category <> ?
          AND category NOT IN (SELECT id FROM ${TABLE.categories})`,
      DEFAULT_CATEGORY_ID,
      DEFAULT_CATEGORY_ID,
    )
    if (orphanFixed > 0) {
      console.info(`${LOG_TAG} 已将 ${orphanFixed} 条指向已删除分类的书签归入默认分类`)
    }
  }

  /** 等待初始化完成，返回可用句柄（不可用时为 null） */
  private async _ready(): Promise<PluginDatabase | null> {
    if (this.db) return this.db
    const db = await this.initPromise
    return db
  }

  /**
   * 等待初始化完成（打开库 + 建表 + 播种默认分类）。
   * 供 registerFeature 阶段预热调用，使数据库不依赖「用户是否打开面板」。
   *
   * @returns 数据库是否可用
   */
  async warmup(): Promise<boolean> {
    return (await this._ready()) !== null
  }

  /** 关闭数据库连接（插件卸载时调用） */
  /** 关闭连接（幂等）。关闭后本实例不再可用，所有读写抛「数据库不可用」 */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.db?.close()
    this.db = null
    // 清掉在途/已完成的初始化 Promise：否则 _ready() 仍会返回已关闭的句柄
    this.initPromise = Promise.resolve(null)
  }

  /** 取可用句柄；未就绪或已关闭时抛错（调用方在 UI 层兜底提示） */
  private async _require(): Promise<PluginDatabase> {
    if (this.closed) {
      throw new Error("[websiteNavigation] 存储已关闭")
    }
    const db = await this._ready()
    if (!db) {
      throw new Error("[websiteNavigation] 数据库不可用（node:sqlite 缺失或工作区路径未就绪）")
    }
    return db
  }

  // ========================================
  // 条目读写（纯 SQLite）
  // ========================================

  async getAllEntries(): Promise<WebsiteEntry[]> {
    const db = await this._require()
    const rows = db.all<EntryRow>(`SELECT * FROM ${TABLE.entries} ORDER BY created_at ASC`)
    return rows.map(rowToEntry)
  }

  async getCategories(): Promise<WebsiteCategory[]> {
    const db = await this._require()
    const rows = db.all<CategoryRow>(`SELECT * FROM ${TABLE.categories} ORDER BY sort ASC, id ASC`)
    return rows.map(rowToCategory)
  }

  async createEntry(data: CreateWebsiteDTO): Promise<WebsiteEntry> {
    const db = await this._require()
    const now = Date.now()
    const entry: WebsiteEntry = {
      // 必须用碰撞抗性 ID：毫秒时间戳在同一 tick 内会重复（批量收藏/双击），
      // 而 id 是主键，重复会抛 SQLITE_CONSTRAINT_UNIQUE（旧数组存储是静默容忍的）
      id: `ws-${crypto.randomUUID()}`,
      name: data.name,
      url: data.url,
      category: data.category || DEFAULT_CATEGORY_ID,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    }

    db.run(
      `INSERT INTO ${TABLE.entries} (id, name, url, category, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.name,
      entry.url,
      entry.category,
      entry.description,
      entry.createdAt,
      entry.updatedAt,
    )
    return entry
  }

  async updateEntry(id: string, data: UpdateWebsiteDTO): Promise<WebsiteEntry | null> {
    const db = await this._require()
    const existing = db.get<EntryRow>(`SELECT * FROM ${TABLE.entries} WHERE id = ?`, id)
    if (!existing) return null

    const current = rowToEntry(existing)
    // 逐字段取值：显式 undefined 回落到原值，避免把 NOT NULL 列写成 NULL；
    // 同时保证返回值与真正写入的列完全一致（不再整体 spread 可能含额外键的 data）
    const updated: WebsiteEntry = {
      id: current.id,
      name: data.name ?? current.name,
      url: data.url ?? current.url,
      category: data.category ?? current.category,
      description: data.description ?? current.description,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
    }
    db.run(
      `UPDATE ${TABLE.entries}
          SET name = ?, url = ?, category = ?, description = ?, updated_at = ?
        WHERE id = ?`,
      updated.name,
      updated.url,
      updated.category,
      updated.description,
      updated.updatedAt,
      id,
    )
    return updated
  }

  async deleteEntry(id: string): Promise<boolean> {
    const db = await this._require()
    return db.run(`DELETE FROM ${TABLE.entries} WHERE id = ?`, id) > 0
  }

  /**
   * 整体覆盖分类（调用方总是传完整列表）。
   * 单事务内「清空 + 重插」，保证顺序与集合完全一致、无中间态。
   */
  async saveCategories(categories: WebsiteCategory[]): Promise<boolean> {
    const db = await this._require()
    db.withTransaction(() => {
      db.run(`DELETE FROM ${TABLE.categories}`)
      categories.forEach((cItem, index) => {
        db.run(
          `INSERT OR REPLACE INTO ${TABLE.categories} (id, name, color, sort) VALUES (?, ?, ?, ?)`,
          cItem.id,
          cItem.name,
          cItem.color,
          index,
        )
      })
    })
    return true
  }
}

/**
 * 模块级单例：与两个消费方（websiteNavigation / minimalBrowser）共用同一实例，
 * 避免各自构造导致重复打开数据库。
 */
let sharedStorage: WebsiteNavigationStorage | null = null

/** 获取（必要时创建）共享存储实例 */
export function getSharedWebsiteStorage(plugin: Plugin): WebsiteNavigationStorage {
  if (!sharedStorage) {
    sharedStorage = new WebsiteNavigationStorage(plugin)
  }
  return sharedStorage
}

/** 预热进行中的 Promise：让两个 register 的重复调用合并成一次（幂等） */
let warmupPromise: Promise<boolean> | null = null

/**
 * 预热共享存储：在 registerFeature 阶段调用，提前建库建表，
 * 而不必等用户首次打开面板。
 *
 * 为什么需要：存储只在面板挂载时构造（懒初始化），用户若从未打开
 * 网站导航/极简浏览器面板，数据库就永远不会被创建。
 *
 * 幂等：websiteNavigation 与 minimalBrowser 各调一次是常态（两个功能开关独立），
 * 这里合并成同一 Promise，避免重复初始化与重复退避重试。
 *
 * 注意：不做任何数据导入。历史迁移已完成并下线，运行时只保证「表存在」。
 * 非阻塞：失败仅记录日志，不影响插件其余功能。
 */
export function warmupSharedWebsiteStorage(plugin: Plugin): void {
  if (warmupPromise) return
  warmupPromise = (async () => {
    try {
      const storage = getSharedWebsiteStorage(plugin)
      const ok = await storage.warmup()
      // 失败时明确留痕：否则降级状态在 websiteNavigation 侧毫无可诊断信息
      if (!ok) {
        console.error(`${LOG_TAG} 数据库预热失败，该功能数据不可用（详见上方 sqlite 日志）`)
      }
      return ok
    } catch (error) {
      console.error(`${LOG_TAG} SQLite 预热失败:`, error)
      return false
    }
  })()
}

/** 关闭并释放共享存储（插件卸载时调用） */
export function closeSharedWebsiteStorage(): void {
  sharedStorage?.close()
  sharedStorage = null
  // 允许卸载后重新加载插件时再次预热
  warmupPromise = null
}
