// 提交分析「显示范围」下拉选项（分析工具条与显示设置表单共用，避免两处顺序/文案漂移）
import type { SelectOption } from "@/components/Select.vue"
import type { AnalysisRangePreset } from "../../types/meta"
import { ANALYSIS_RANGE_PRESETS } from "../../types/meta"

/** 预设项 → i18n 文案键（顺序由 ANALYSIS_RANGE_PRESETS 决定，此处只负责文案映射） */
const PRESET_LABEL_KEYS: Record<AnalysisRangePreset, string> = {
  lastWeek: "analysisRangeLastWeek",
  lastMonth: "analysisRangeLastMonth",
  last3Months: "analysisRangeLast3Months",
  lastYear: "analysisRangeLastYear",
  all: "analysisRangeAll",
}

/**
 * 构建显示范围选项（本周 / 最近一个月 / 最近三个月 / 最近一年 / 全部 / 各年份）。
 * 过去年份=该年全年；今年=1-1 至今（与 resolveAnalysisRange 的实际口径一致）。
 * 「本周」的起点跟随「每周第一天」设置，由 resolveAnalysisRange 的 weekStart 参数决定。
 */
export function buildAnalysisRangeOptions(i18n: Record<string, any>, years: number[]): SelectOption[] {
  const currentYear = new Date().getFullYear()
  return [
    ...ANALYSIS_RANGE_PRESETS.map((preset) => ({
      value: preset,
      label: i18n[PRESET_LABEL_KEYS[preset]],
    })),
    ...years.map((y) => ({
      value: String(y),
      label: String(y === currentYear ? i18n.analysisRangeYear : i18n.analysisRangeYearFull).replace("{0}", String(y)),
    })),
  ]
}
