// gitPush 报告展示格式化纯函数（从 CodeReport 组件迁出：视图层不得驻留纯逻辑）
//
// 迁出来源：AuthorContributionSection（formatNet/churnText）、HotspotSection（splitPath）、
// FileDetailModal（净增格式化）。三处共用同一展示口径，此处为单一真源。

/** 拆分文件路径为目录 + 文件名（dirname 弱化 / basename 强调，便于快速扫描定位文件） */
export function splitPath(path: string): { dir: string, base: string } {
  const idx = path.lastIndexOf("/")
  if (idx < 0) {
    return { dir: "", base: path }
  }
  return { dir: path.slice(0, idx + 1), base: path.slice(idx + 1) }
}

/** 净增格式化：正数带 + 前缀便于视觉区分；0 显示 "0"（作者排行表口径） */
export function formatNet(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

/** 净增格式化（含零）：非负数带 + 前缀（文件详情弹窗口径，0 → "+0"） */
export function formatSignedNet(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

/** 代码流失率 → 百分比文案 */
export function churnText(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
