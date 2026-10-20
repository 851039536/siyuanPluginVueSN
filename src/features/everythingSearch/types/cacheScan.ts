// everythingSearch 缓存清理的类型定义：缓存根目录白名单、扫描进度、扫描结果
import type { IconKey } from "@/config/icons"

/**
 * 缓存根目录的稳定标识（同时作为设置项 key 与 i18n 键后缀）。
 *
 * ⚠️ 新增标识必须同时在 `CACHE_ROOTS`（cacheScan/roots.ts）与
 * `src/i18n/{zh_CN,en_US}/everythingSearch.json` 的 `cacheRoot<Id>` 键中登记 ——
 * `roots.spec.ts` 会断言三者一致。
 */
export type CacheRootId =
  | "userTemp"
  | "windowsTemp"
  | "crashDumps"
  | "browserCache"
  | "packageCache"
  | "npmCache"
  | "devCache"

/**
 * 风险等级。
 * - `safe`：删掉后程序自动重建，不影响系统启动与已装软件运行
 * - `caution`：删掉不致命，但会导致「下次修复/卸载需重新下载」等副作用，默认不勾选
 */
export type CacheRisk = "safe" | "caution"

/** 根目录解析策略（判别联合：新增根时必须显式选择解析方式） */
export type CacheRootResolver =
  /** 固定绝对路径（如 `C:\Windows\Temp`） */
  | {
    kind: "absolute"
    path: string
  }
  /** 从一个环境变量取（可再拼若干子目录）；变量未定义则跳过 */
  | {
    kind: "env"
    variable: string
    segments?: string[]
  }
  /** 从用户主目录派生（如 `~\.npm`） */
  | {
    kind: "home"
    segments: string[]
  }
  /**
   * 多候选：逐个尝试，**只要存在就全部收集**（同一分类可能分布在多个目录，
   * 如浏览器缓存按厂商/用户配置分目录）。不存在或不可读的候选静默跳过。
   */
  | {
    kind: "candidates"
    list: CacheRootResolver[]
  }

/**
 * 一个扫描根目录的定义。
 *
 * ⚠️ 本表是**删除白名单的唯一真源**：只有落在某个根本身或其子目录内的条目才允许删除
 * （见 `isAllowedCachePath`）。任何新增根都必须同时满足
 * 「删掉不影响系统启动与已装软件运行」「不触碰 $Recycle.Bin / System Volume Information /
 * Windows Defender / 注册表 / 计划任务」。
 */
export interface CacheRootDef {
  id: CacheRootId
  /** i18n 键名（`everythingSearch` 命名空间下的扁平键，如 `cacheRootUserTemp`） */
  labelKey: string
  /** 路径解析方式 */
  resolve: CacheRootResolver
  /** 风险等级 */
  risk: CacheRisk
  /** 图标键（受 `IconKey` 约束，只能取已注册值） */
  icon: IconKey
  /** 默认是否勾选（`caution` 一律默认不勾） */
  defaultEnabled: boolean
}

/** 解析后的根目录（`path` 已存在性校验通过） */
export interface ResolvedCacheRoot {
  def: CacheRootDef
  /** 绝对路径（不带末尾分隔符） */
  path: string
}

/** 扫描到的单个可清理条目 */
export interface CacheEntry {
  /** 完整路径 */
  path: string
  /** 展示名（条目本身的名字） */
  name: string
  /** 是否为目录 */
  isDirectory: boolean
  /** 字节数（目录为递归合计） */
  size: number
  /** 最后修改时间（毫秒时间戳，0 = 未知） */
  modifiedTime: number
  /** 归属的缓存根 */
  rootId: CacheRootId
}

/** 单个根目录的扫描结果 */
export interface CacheRootScanResult {
  rootId: CacheRootId
  /** 解析到的绝对路径（未解析到为空串） */
  path: string
  /** 同一分类解析出的全部目录（如浏览器多厂商、npm 多候选） */
  paths?: string[]
  /** 未解析/不可读的原因（失败时填写，成功为空串） */
  message: string
  /** 条目的字节数合计 */
  size: number
  /** 条目数 */
  files: number
  /** 明细（受 `maxEntries` 上限约束，可能被截断） */
  entries: CacheEntry[]
  /** 是否因条目上限被截断 */
  truncated: boolean
}

/** 扫描进度回调载荷 */
export interface CacheScanProgress {
  /** 已完成的根数量 */
  done: number
  /** 本次要扫描的根总数 */
  total: number
  /** 当前正在扫描的根 */
  current: CacheRootId | null
}

/** 一次完整扫描的结果 */
export interface CacheScanResult {
  roots: CacheRootScanResult[]
  /** 合计字节数 */
  size: number
  /** 合计条目数 */
  files: number
  /** 扫描耗时（毫秒） */
  elapsed: number
  /** 是否被用户取消（取消时保留已完成部分） */
  cancelled: boolean
}

/** 清理结果 */
export interface CacheCleanResult {
  /** 成功删除的条目数 */
  deleted: number
  /** 失败条目数 */
  failed: number
  /** 释放的字节数 */
  freed: number
  /** 失败原因（截取前若干条，供提示） */
  errors: string[]
  /** 是否被用户取消 */
  cancelled: boolean
}

/** 清理方式：移入回收站（默认，可还原）/ 永久删除 */
export type CacheCleanMode = "recycle" | "permanent"
