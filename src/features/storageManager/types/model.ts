/**
 * 数据管理 - 领域类型
 */
import type { StorageKind, StorageOwner } from "@/config/storage"

/** 单个槽位的用量 */
export interface SlotUsage {
  slotId: string
  kind: StorageKind
  key: string
  /** JSON 文件 / 文件目录 / localStorage 的字节数；SQLite 表为 0（库大小单独统计） */
  bytes: number
  /** SQLite 行数；其它形态不填 */
  items?: number
  /** 最后修改时间（文件槽） */
  updatedAt?: number
  /** 槽位在磁盘/浏览器中不存在 */
  missing: boolean
  /** 不可用原因码：no-node / no-data-dir / no-sqlite / read-failed */
  unavailableReason?: string
}

/** 按功能分组的用量 */
export interface StorageGroupUsage {
  owner: StorageOwner
  bytes: number
  slots: SlotUsage[]
}

/** 诊断项 */
export interface DiagnosticFinding {
  slotId: string
  level: "warning" | "info"
  /** growth-large：增长型且超过 150KB */
  code: "growth-large"
  bytes: number
}

/** 存储总览 */
export interface StorageInventory {
  /** 插件数据目录绝对路径；解析失败为空串 */
  dataDir: string
  capturedAt: number
  groups: StorageGroupUsage[]
  totals: {
    json: number
    sqlite: number
    file: number
    localStorage: number
    bytes: number
    sensitiveCount: number
  }
  warnings: DiagnosticFinding[]
}

/** 单槽操作结果 */
export interface SlotActionResult {
  slotId: string
  ok: boolean
  /** 失败原因码 */
  error?: string
}

/** 模块导出载荷（写入单个 JSON 文件） */
export interface ModuleExportPayload {
  version: 1
  exportedAt: number
  owners: StorageOwner[]
  /** JSON 槽：key → 值 */
  slots: Record<string, unknown>
  /** SQLite 表：表名 → 行数组 */
  tables: Record<string, Record<string, unknown>[]>
  /** SQLite 建表语句：表名 → CREATE TABLE DDL（用于目标库缺表时重建） */
  schemas?: Record<string, string>
}

/** 导入/还原报告 */
export interface ImportReport {
  applied: string[]
  skipped: { slotId: string; reason: string }[]
  failed: { slotId: string; error: string }[]
  snapshotPath?: string
  /** 设置/开关变更后建议用户重载插件 */
  requiresReload: boolean
}
