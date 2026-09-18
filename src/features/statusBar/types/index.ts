/**
 * 状态栏类型定义和常量
 */
import type { IconKey } from "@/components/kit/icons"

// ============================================================
// 类型定义
// ============================================================

export type ResourceLevel = "normal" | "medium" | "high"

/** 用户自定义分类（功能抽屉 Tab） */
export interface StatusBarCategory {
  id: string
  name: string
}

/** 功能抽屉条目（FeatureDrawer / DrawerFeatureItem 共用；元数据来自 config.ts + icons.ts） */
export interface FeatureDrawerItem {
  id: string
  icon: IconKey
  color: string
  title: string
  pinnable: boolean
  /** 监控项标志：进入「监控」Tab，不参与自定义分类 */
  monitor?: boolean
  /** 当前归属分类 id（未分类为空），供分类角标高亮 */
  categoryId?: string | null
  enabled?: boolean
  toggleable?: boolean
}

/** 分类分配弹出菜单的菜单项（供既有下拉实现消费） */
export interface StatusBarMenuOption {
  /** 归属分类 id（null 表示「未分类」） */
  value: string | null
  label: string
}

/** 功能注册表条目：抽屉展示 + 状态栏快捷 + 点击动作 */
export interface FeatureRegistryEntry extends FeatureDrawerItem {
  /** 状态栏快捷项，缺省则不在状态栏显示 */
  shortcut?: { icon: IconKey, itemClass: string }
  /** 点击（抽屉选中或快捷点击）触发的动作（监控项无动作） */
  action?: () => void
}

export interface StatusBarState {
  cpuPercent: number
  memPercent: number
  uptimeSeconds: number
  showMonitor: boolean
  totalNotes: number
  totalWords: number
  todayCreated: number
  todayModified: number
  yesterdayCreated: number
  yesterdayModified: number
}

// ============================================================
// 常量
// ============================================================

export const THRESHOLDS = {
  CPU: {
    HIGH: 80,
    MEDIUM: 60,
  },
  MEM: {
    HIGH: 85,
    MEDIUM: 70,
  },
} as const

export const MONITOR_INTERVAL_MS = 3000
export const STATISTICS_INTERVAL_MS = 60000
export const INITIAL_DELAY_MS = 2000
export const DEFAULT_TOTAL_MEMORY_GB = 8
