/**
 * 紧凑模式功能模块
 *
 * CSS 类体系：
 *   - 主 class：siyuan-compact-mode
 *   - 密度 class：compact-density-moderate / compact / extreme
 *   - 字号 class：compact-font-80 / 85 / 90 / 95 / 100
 *   - 区域 class：compact-area-sidebar / editor / tabs / dialogs / controls
 *
 * 所有值均在 SCSS 编译期通过 Sass 乘法计算，无 calc()/var() 运行时依赖。
 */

const COMPACT_MASTER = "siyuan-compact-mode"
const DENSITY_PREFIX = "compact-density-"
const FONT_PREFIX = "compact-font-"
const AREA_PREFIX = "compact-area-"

const ALL_DENSITIES = ["moderate", "compact", "extreme"] as const
const ALL_FONT_SCALES = ["80", "85", "90", "95", "100"] as const
const ALL_AREAS = ["sidebar", "editor", "tabs", "dialogs", "controls"] as const

export interface CompactModeSettings {
  compactMode: boolean
  compactModeDensity: 'moderate' | 'compact' | 'extreme'
  compactModeFontScale: number   // 80 | 85 | 90 | 95 | 100
  compactModeAreas: Record<string, boolean>
}

export function applyCompactMode(settings: CompactModeSettings): void {
  const html = document.documentElement
  const { compactMode, compactModeDensity, compactModeFontScale, compactModeAreas } = settings

  if (!compactMode) {
    html.classList.remove(COMPACT_MASTER)
    for (const d of ALL_DENSITIES) html.classList.remove(`${DENSITY_PREFIX}${d}`)
    for (const f of ALL_FONT_SCALES) html.classList.remove(`${FONT_PREFIX}${f}`)
    for (const a of ALL_AREAS) html.classList.remove(`${AREA_PREFIX}${a}`)
    return
  }

  html.classList.add(COMPACT_MASTER)

  // 密度（互斥）
  for (const d of ALL_DENSITIES) {
    html.classList.toggle(`${DENSITY_PREFIX}${d}`, d === compactModeDensity)
  }

  // 字号（互斥）
  const fontLabel = String(compactModeFontScale)
  for (const f of ALL_FONT_SCALES) {
    html.classList.toggle(`${FONT_PREFIX}${f}`, f === fontLabel)
  }

  // 区域
  for (const a of ALL_AREAS) {
    html.classList.toggle(`${AREA_PREFIX}${a}`, compactModeAreas?.[a] ?? true)
  }
}

export function getCompactModeState(): boolean {
  return document.documentElement.classList.contains(COMPACT_MASTER)
}
