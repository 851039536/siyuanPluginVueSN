// 关系图画布视口纯逻辑：缩放 / 平移 / 适配的坐标换算与边界约束（无 Vue / DOM 依赖）

export interface Size {
  width: number
  height: number
}

/** 画布变换：scale 缩放，x/y 为内容左上角在视口中的像素偏移 */
export interface ViewTransform {
  scale: number
  x: number
  y: number
}

export interface WorldRect {
  x: number
  y: number
  width: number
  height: number
}

export const VIEW_MIN_SCALE = 0.5
export const VIEW_MAX_SCALE = 2

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(VIEW_MAX_SCALE, Math.max(VIEW_MIN_SCALE, scale))
}

/**
 * 边界约束：内容小于视口时居中锁定；大于视口时禁止把内容拖出视口。
 * 视口尚未测量（宽高为 0）时原样返回，避免首帧抖动。
 */
export function clampTransform(
  transform: ViewTransform,
  content: Size,
  viewport: Size,
): ViewTransform {
  if (viewport.width <= 0 || viewport.height <= 0) return transform
  const scale = clampScale(transform.scale)
  const scaledWidth = content.width * scale
  const scaledHeight = content.height * scale
  const x = scaledWidth <= viewport.width
    ? (viewport.width - scaledWidth) / 2
    : Math.min(0, Math.max(viewport.width - scaledWidth, transform.x))
  const y = scaledHeight <= viewport.height
    ? (viewport.height - scaledHeight) / 2
    : Math.min(0, Math.max(viewport.height - scaledHeight, transform.y))
  return { scale, x, y }
}

/** 以指定缩放居中 */
export function centerTransform(content: Size, viewport: Size, scale = 1): ViewTransform {
  const safeScale = clampScale(scale)
  return {
    scale: safeScale,
    x: (viewport.width - content.width * safeScale) / 2,
    y: (viewport.height - content.height * safeScale) / 2,
  }
}

/** 适应画布：内容完整可见（不放大超过 100%），四周保留 padding */
export function fitTransform(content: Size, viewport: Size, padding = 12): ViewTransform {
  if (viewport.width <= 0 || viewport.height <= 0 || content.width <= 0 || content.height <= 0) {
    return { scale: 1, x: 0, y: 0 }
  }
  const available = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  }
  const scale = clampScale(Math.min(1, available.width / content.width, available.height / content.height))
  return clampTransform(centerTransform(content, viewport, scale), content, viewport)
}

/** 以指针位置为锚点缩放：锚点下的内容在屏幕上保持不动 */
export function zoomAt(
  transform: ViewTransform,
  content: Size,
  viewport: Size,
  point: { x: number, y: number },
  factor: number,
): ViewTransform {
  const scale = clampScale(transform.scale * factor)
  const worldX = (point.x - transform.x) / transform.scale
  const worldY = (point.y - transform.y) / transform.scale
  return clampTransform(
    { scale, x: point.x - worldX * scale, y: point.y - worldY * scale },
    content,
    viewport,
  )
}

/** 当前视口覆盖的世界坐标范围（用于迷你地图的取景框） */
export function visibleWorldRect(transform: ViewTransform, viewport: Size): WorldRect {
  return {
    x: -transform.x / transform.scale,
    y: -transform.y / transform.scale,
    width: viewport.width / transform.scale,
    height: viewport.height / transform.scale,
  }
}
