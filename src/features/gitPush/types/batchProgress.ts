// 批量操作进度状态类型定义（顶部旋转进度指示器数据源）

export interface LoadProgress {
  visible: boolean
  current: number
  total: number
  label: string
  /** 是否已完成（显示完成图标，短暂停留后自动消失） */
  done?: boolean
}
