// src/features/gitPush/reportChartColors.spec.ts — 图表配色 TS↔SCSS 一致性钉死
//
// 历史问题：REPORT_CHART_COLORS（types/report.ts，canvas 权威）与 styles/CandlestickSection.scss
// 的图例同色字面量靠注释人工同步，改色必漏。现 SCSS 侧收敛到 styles/chartColors.scss 的 $chart-*
// 变量，本测试逐色比对两侧值，取代手工注释同步——任何一侧单独改色都会在此失败。
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { REPORT_CHART_COLORS } from "./types/report"

/** 从 chartColors.scss 解析 $chart-*: <value>; 声明 */
function readChartColors(): Record<string, string> {
  const scss = readFileSync(join(import.meta.dirname, "styles", "chartColors.scss"), "utf8")
  const out: Record<string, string> = {}
  for (const m of scss.matchAll(/\$chart-([a-z-]+):\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim()
  }
  return out
}

describe("REPORT_CHART_COLORS ↔ chartColors.scss", () => {
  const scss = readChartColors()

  /** TS 键 → SCSS 变量后缀（命名一一对应） */
  const PAIRS: Array<[keyof typeof REPORT_CHART_COLORS, string]> = [
    ["up", "up"],
    ["down", "down"],
    ["flat", "flat"],
    ["ma", "ma"],
    ["grid", "grid"],
    ["axis", "axis"],
    ["workBg", "work-bg"],
  ]

  it("chartColors.scss 定义了全部 7 个图表色变量", () => {
    for (const [, suffix] of PAIRS) {
      expect(scss[suffix], `缺少 $chart-${suffix}`).toBeDefined()
    }
    expect(Object.keys(scss).sort()).toEqual(PAIRS.map(([, s]) => s).sort())
  })

  it.each(PAIRS)("$chart-%s 与 REPORT_CHART_COLORS.%s 值完全一致（含 rgba 串）", (tsKey, scssKey) => {
    expect(scss[scssKey]).toBe(REPORT_CHART_COLORS[tsKey])
  })
})
