/**
 * 速记功能 — 领域类型与共享常量
 * 定义速记条目、弹窗位置、视图筛选类型，以及位置 → 遮罩 flex 对齐映射表
 */

/** 单条速记条目 */
export interface QuickNoteItem {
  /** 唯一 ID（时间戳 + 随机串） */
  id: string
  /** 多行文本内容 */
  content: string
  /** 是否已完成 */
  done: boolean
  /** 创建时间戳（毫秒） */
  createdAt: number
  /** 最近更新时间戳（毫秒） */
  updatedAt: number
}

/** 弹窗显示位置（五档） */
export type QuickNotePosition = "center" | "top" | "bottom" | "left" | "right"

/** 列表视图筛选：待完成 / 已完成 */
export type QuickNoteFilter = "pending" | "done"

/** 速记功能设置（对象存储，便于未来扩展字段时浅合并兜底） */
export interface QuickNoteSettings {
  position: QuickNotePosition
}

/** 位置选项列表（Select 选项与 Manager 校验共用的单一数据源） */
export const QUICK_NOTE_POSITIONS: QuickNotePosition[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
]

/**
 * 位置 → 遮罩层 flex 对齐样式映射
 * Manager 据此改写 Modal 遮罩的 align-items / justify-content 实现贴边
 */
export const POSITION_ALIGN_MAP: Record<
  QuickNotePosition,
  { alignItems: string, justifyContent: string }
> = {
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  bottom: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  left: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  right: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
}
