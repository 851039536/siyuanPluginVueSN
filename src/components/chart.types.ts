/**
 * Chart 组件共享类型
 * 从 Chart.vue 抽取为独立 .ts 文件，供 .ts 文件（无法导入 .vue 类型）与组件共同引用，
 * Chart.vue 保留 re-export 以兼容既有导入路径
 */

export interface ChartData {
  label: string
  value: number
  color?: string
}

export interface ChartOptions {
  showLegend?: boolean
  showGrid?: boolean
  showLabels?: boolean
  showTooltip?: boolean
  animationDuration?: number
  minY?: number
  maxY?: number
  colors?: string[]
}
