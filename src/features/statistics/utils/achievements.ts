// 成就与等级纯工具函数：等级点数曲线、称号推导、阈值成就构建、成就分类/稀有度匹配

import type { AchievementDef } from "../types/milestoneData"
import {
  ACH_CATEGORIES,
  BASE_TITLES,
  THRESHOLD_ACHIEVEMENTS,
  TIER_PREFIXES,
  TIER_SIZE,
} from "../types/milestoneData"

/** 升到指定等级所需的累计成就点（曲线：m × (lv-1) × √(lv-1)） */
export function pointsForLevel(level: number, curveMultiplier: number): number {
  if (level <= 1) return 0
  return Math.floor(curveMultiplier * (level - 1) * Math.sqrt(level - 1))
}

/** 根据等级推导图标与称号（阶级前缀 + 基础称号循环） */
export function getLevelInfo(level: number): { icon: string, title: string } {
  const tierIdx = Math.min(Math.floor((level - 1) / TIER_SIZE), TIER_PREFIXES.length - 1)
  const stage = (level - 1) % TIER_SIZE
  const base = BASE_TITLES[stage % BASE_TITLES.length]
  return {
    icon: base.icon,
    title: TIER_PREFIXES[tierIdx] + base.title,
  }
}

/** 从阈值配置生成 AchievementDef 数组（check 闭包捕获传入的统计值快照） */
export function buildThresholdAchievements(statCounts: Record<string, number>): AchievementDef[] {
  const result: AchievementDef[] = []
  for (const group of THRESHOLD_ACHIEVEMENTS) {
    for (const item of group.items) {
      result.push({
        id: `${group.prefix}-${group.type}-${item.v}`,
        icon: item.icon,
        title: item.title,
        description: item.desc,
        tier: item.tier,
        check: () => (statCounts[group.type] ?? 0) >= item.v,
      })
    }
  }
  return result
}

/** 从成就 id/标记推导其所属统计类型（custom / meta / 阈值类型） */
export function getAchType(ach: AchievementDef): string {
  if (ach._custom) return "custom"
  // meta 成就 id 形如 ach-all-* / ach-half-* / ach-level-*
  if (ach.id.startsWith("ach-all-") || ach.id.startsWith("ach-half-") || ach.id.startsWith("ach-level-")) return "meta"
  // 阈值成就 id 形如 ach-{type}-{value}
  const parts = ach.id.split("-")
  return parts[1] || ""
}

/** 判断成就是否匹配指定分类 */
export function matchCategory(ach: AchievementDef, catId: string): boolean {
  if (catId === "all") return true
  const cat = ACH_CATEGORIES.find((c) => c.id === catId)
  if (!cat || !cat.types) return false
  return cat.types.includes(getAchType(ach))
}

/** 判断成就是否匹配指定稀有度 */
export function matchTier(ach: AchievementDef, tierId: string): boolean {
  if (tierId === "all") return true
  return ach.tier === tierId
}
