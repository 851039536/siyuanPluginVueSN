/**
 * 存储槽注册表 - 类型定义
 *
 * 注册表只承载元数据（owner / 类型 / key / 增长性 / 敏感性 / 导出重置策略），
 * 不参与实际读写；功能侧的 TypedStorage / 表常量仍是唯一写入口。
 * 双向一致性由 `pnpm audit:storage` 与 registry.spec.ts 保证。
 */
import type { FeatureId } from "@/features/config"

/** 存储形态 */
export type StorageKind = "json" | "sqlite" | "file" | "localStorage"

/** 归属功能；core 表示插件级（plugin-settings / feature-flags 等） */
export type StorageOwner = FeatureId | "core"

/** 所有槽位的公共元数据 */
export interface StorageSlotBase {
  /** 唯一 id，约定 `<owner>.<entity>`（共享槽取主 owner） */
  id: string
  /** 归属功能；共享槽可列多个 */
  owners: readonly StorageOwner[]
  /** 存储形态 */
  kind: StorageKind
  /** JSON key / 表名 / 相对目录 / localStorage key */
  key: string
  /** 面板兜底文案（i18n 缺失时使用） */
  defaultLabel: string
  /** 面板文案 i18n 键（`storageManager.slots.<id>`），可选 */
  labelI18nKey?: string
  /** 记录集合会随使用增长 */
  growth: boolean
  /** 含密码 / 密钥 / 令牌 / 请求凭据 */
  sensitive: boolean
  /** 可出现在按模块导出中 */
  exportable: boolean
  /** 运行中可清空 / 恢复默认 */
  resettable: boolean
  /** 可参与逻辑还原（JSON / SQLite 默认 true，文件与 localStorage 默认 false） */
  restorable: boolean
  /** 存量不合规命名（冻结，不做 kebab 校验） */
  legacyName: boolean
  /** 补充说明（敏感项必须写明处理方式） */
  notes?: string
}

export interface JsonStorageSlot extends StorageSlotBase {
  kind: "json"
}

export interface SqliteStorageSlot extends StorageSlotBase {
  kind: "sqlite"
}

export interface FileStorageSlot extends StorageSlotBase {
  kind: "file"
}

export interface LocalStorageSlot extends StorageSlotBase {
  kind: "localStorage"
}

export type StorageSlot = JsonStorageSlot | SqliteStorageSlot | FileStorageSlot | LocalStorageSlot

/** 工厂可选参数 */
export interface SlotOptions {
  labelI18nKey?: string
  growth?: boolean
  sensitive?: boolean
  exportable?: boolean
  resettable?: boolean
  restorable?: boolean
  legacyName?: boolean
  notes?: string
}
