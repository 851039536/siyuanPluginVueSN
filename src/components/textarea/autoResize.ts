// 多行文本域的自动增高：按行高与行数上下限换算高度并写回内联样式
// （Textarea 的私有模块，禁止 feature 直接导入）

/** 自动增高的行数约束 */
export interface AutoResizeMetrics {
  /** 行数下限 */
  minRows: number
  /** 行数上限（未设 / 0 表示不设上限，随内容持续增高） */
  maxRows?: number
}

/**
 * 测量并写回文本域高度。
 *
 * 两个反直觉点：
 * 1. 写入前必须先把高度归零，否则上一次写入的高度会污染 scrollHeight 读数；
 * 2. 字段自身无边框且为 border-box，scrollHeight（含 padding 不含 border）
 *    可直接作为高度使用；上下限按「行高 × 行数 + 上下内边距」换算。
 *
 * 超上限时把 overflow-y 切为 auto，回落时**必须复位为 hidden**，
 * 否则内容变少后仍残留滚动条。
 */
export function applyAutoResize(
  el: HTMLTextAreaElement | undefined | null,
  metrics: AutoResizeMetrics,
): void {
  if (!el) return

  el.style.height = "auto"

  const styles = window.getComputedStyle(el)
  const padding = (Number.parseFloat(styles.paddingTop) || 0)
    + (Number.parseFloat(styles.paddingBottom) || 0)
  // 行高被解析为 normal 时（非数值）按字号 × 1.75 兜底
  const lineHeight = Number.parseFloat(styles.lineHeight)
    || (Number.parseFloat(styles.fontSize) || 0) * 1.75

  const minHeight = padding + lineHeight * metrics.minRows

  let height = el.scrollHeight
  let overflowY = "hidden"

  if (height < minHeight) {
    height = minHeight
  }

  if (metrics.maxRows) {
    const maxHeight = padding + lineHeight * metrics.maxRows
    if (height > maxHeight) {
      height = maxHeight
      overflowY = "auto"
    }
  }

  el.style.height = `${height}px`
  el.style.overflowY = overflowY
}

/** 清除内联高度与溢出控制，把高度交还原生 rows（关闭自动增高时调用） */
export function clearAutoResize(el: HTMLTextAreaElement | undefined | null): void {
  if (!el) return
  el.style.height = ""
  el.style.overflowY = ""
}
