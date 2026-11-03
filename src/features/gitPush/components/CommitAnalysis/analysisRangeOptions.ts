// 提交分析「显示范围」下拉选项（分析工具条与显示设置表单共用，避免两处顺序/文案漂移）
import type { SelectOption } from "@/components/Select.vue"

/**
 * 构建显示范围选项（最近一年 / 全部 / 各年份）。
 * 过去年份=该年全年；今年=1-1 至今（与 resolveAnalysisRange 的实际口径一致）。
 */
export function buildAnalysisRangeOptions(i18n: Record<string, any>, years: number[]): SelectOption[] {
  const currentYear = new Date().getFullYear()
  return [
    { value: "lastYear", label: i18n.analysisRangeLastYear },
    { value: "all", label: i18n.analysisRangeAll },
    ...years.map((y) => ({
      value: String(y),
      label: String(y === currentYear ? i18n.analysisRangeYear : i18n.analysisRangeYearFull).replace("{0}", String(y)),
    })),
  ]
}
