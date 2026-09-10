/**
 * 紧凑模式功能模块
 *
 * CSS 类体系：
 *   - 主 class：siyuan-compact-mode
 *   - 密度 class：compact-density-moderate / compact / extreme
 *   - 字号 class：compact-font-100 / 98 / 96 / 94 / 92 / 90
 *   - 区域 class：compact-area-sidebar / editor / tabs / dialogs / controls
 *
 * 所有值均在 SCSS 编译期通过 Sass 乘法计算，无 calc()/var() 运行时依赖。
 */

import "./styles/index.scss"

const COMPACT_MASTER = "siyuan-compact-mode"
const DENSITY_PREFIX = "compact-density-"
const FONT_PREFIX = "compact-font-"
const AREA_PREFIX = "compact-area-"

/** 密度档位（互斥，与 SCSS 的 $density-spacings 键一一对应） */
export const ALL_DENSITIES = ["moderate", "compact", "extreme"] as const
/** 字号缩放档位（互斥，值为百分比，与 SCSS 的 $font-scales 键一一对应） */
export const ALL_FONT_SCALES = [100, 98, 96, 94, 92, 90] as const
/** 生效区域开关（可多选，与 SCSS 的 .compact-area-* 选择器一一对应） */
export const ALL_AREAS = ["sidebar", "editor", "tabs", "dialogs", "controls"] as const

/** 密度档位字面量类型 */
export type CompactDensity = (typeof ALL_DENSITIES)[number]
/** 生效区域字面量类型 */
export type CompactArea = (typeof ALL_AREAS)[number]

export interface CompactModeSettings {
  compactMode: boolean
  compactModeDensity: CompactDensity
  compactModeFontScale: number // 100 | 98 | 96 | 94 | 92 | 90
  compactModeAreas: Record<string, boolean>
}

/** 清除 html 上全部紧凑模式类名（关闭开关或重新应用前的幂等复位） */
function clearCompactClasses(html: HTMLElement): void {
  html.classList.remove(COMPACT_MASTER)
  for (const d of ALL_DENSITIES) {
    html.classList.remove(`${DENSITY_PREFIX}${d}`)
  }
  for (const f of ALL_FONT_SCALES) {
    html.classList.remove(`${FONT_PREFIX}${f}`)
  }
  for (const a of ALL_AREAS) {
    html.classList.remove(`${AREA_PREFIX}${a}`)
  }
}

export function applyCompactMode(settings: CompactModeSettings): void {
  const html = document.documentElement
  const {
    compactMode,
    compactModeDensity,
    compactModeFontScale,
    compactModeAreas,
  } = settings

  // 先整体复位再按需置位，避免档位切换时残留旧类名
  clearCompactClasses(html)
  if (!compactMode) {
    return
  }

  html.classList.add(COMPACT_MASTER)

  // 密度（互斥）
  for (const d of ALL_DENSITIES) {
    html.classList.toggle(`${DENSITY_PREFIX}${d}`, d === compactModeDensity)
  }

  // 字号（互斥）：String 归一化以兼容历史数据中可能以字符串形式持久化的档位
  for (const f of ALL_FONT_SCALES) {
    html.classList.toggle(`${FONT_PREFIX}${f}`, String(f) === String(compactModeFontScale))
  }

  // 区域
  for (const a of ALL_AREAS) {
    html.classList.toggle(`${AREA_PREFIX}${a}`, compactModeAreas?.[a] ?? true)
  }
}
