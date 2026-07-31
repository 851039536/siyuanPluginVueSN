/**
 * 图标辅助工具
 * 用于在非 Vue 环境中使用 Iconify 图标
 */

import mdiIcons from "@iconify-json/mdi/icons.json"

/** 离线 mdi 图标数据（body 为完整内层 SVG 标记，含 <path .../>） */
interface MdiIconData {
  body: string
  width: number
  height: number
}

/** mdi icons.json 结构最小声明 */
interface MdiIconSet {
  icons?: Record<string, { body: string, width?: number, height?: number }>
  width?: number
  height?: number
}

/**
 * 从离线预加载的 mdi 图标数据取图标（仅支持 mdi collection）
 * 依赖 setupIconifyOffline() 已预加载 mdi 图标数据，全程无网络请求
 */
function getMdiIconData(iconName: string): MdiIconData | null {
  const [collection, name] = iconName.split(":")
  if (collection !== "mdi" || !name) {
    console.warn(`iconHelper: 仅支持离线 mdi 图标，收到 "${iconName}"`)
    return null
  }
  const iconSet = mdiIcons as unknown as MdiIconSet
  const iconData = iconSet.icons?.[name]
  if (!iconData) return null
  return {
    body: iconData.body,
    width: iconData.width || iconSet.width || 24,
    height: iconData.height || iconSet.height || 24,
  }
}

/** 过滤 color 中可能破坏属性/样式的字符，防止注入 */
function sanitizeColor(color: string): string {
  return color.replace(/["'<>;]/g, "")
}

/**
 * 同步获取 Iconify 图标的 SVG HTML 字符串（用于思源 menu.addItem 等需要 iconHTML 的 API）
 * 仅支持离线预加载的 mdi 图标
 */
export function getIconHTML(
  iconName: string,
  size: number = 14,
  color?: string,
): string {
  const iconData = getMdiIconData(iconName)
  if (!iconData) return ""

  const safeColor = color ? sanitizeColor(color) : ""
  const style = `display:inline-block;vertical-align:middle${safeColor ? `;color:${safeColor}` : ""}`

  // body 已是完整内层标记（含 <path fill="currentColor" .../>），直接作为 svg 内容
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${iconData.width} ${iconData.height}" width="${size}" height="${size}" style="${style}">${iconData.body}</svg>`
}

/**
 * 替换思源笔记顶部栏的图标为 Iconify 图标
 *
 * @param element 顶部栏元素（由 plugin.addTopBar 返回）
 * @param iconName Iconify 图标名称（格式：collection:icon-name）
 * @param color 图标颜色（可选）
 *
 * @example
 * ```typescript
 * const topBar = plugin.addTopBar({
 *   icon: 'iconMenu',
 *   title: '我的功能',
 *   callback: () => {}
 * })
 * replaceTopBarIcon(topBar, 'mdi:star', '#fbbf24')
 * ```
 */
export function replaceTopBarIcon(
  element: HTMLElement,
  iconName: string,
  color?: string,
): void {
  const iconData = getMdiIconData(iconName)
  if (!iconData) return

  // 有界轮询等待顶部栏 svg 就绪（addTopBar 后通常已同步存在，
  // 一旦出现立即写入；不依赖单次定时器猜测，超时后告警放弃）
  let attempts = 0
  const maxAttempts = 20
  const apply = () => {
    const svgElement = element.querySelector("svg")
    if (!svgElement) {
      if (attempts++ < maxAttempts) {
        setTimeout(apply, 50)
      } else {
        console.warn("replaceTopBarIcon: 顶部栏 SVG 未就绪")
      }
      return
    }

    svgElement.setAttribute("width", "20")
    svgElement.setAttribute("height", "20")
    svgElement.setAttribute("viewBox", `0 0 ${iconData.width} ${iconData.height}`)
    if (color) {
      svgElement.style.color = color
      svgElement.style.fill = "currentColor"
    }
    // 离线 body 直接写入（含 <path fill="currentColor" .../>），无网络请求
    svgElement.innerHTML = iconData.body
  }
  apply()
}

/**
 * 创建一个 HTML 元素并设置 Iconify 图标
 *
 * @param iconName Iconify 图标名称
 * @param size 图标大小（默认 20）
 * @param color 图标颜色（可选）
 * @returns HTMLElement
 */
export function createIconElement(
  iconName: string,
  size: number = 20,
  color?: string,
): HTMLElement {
  const container = document.createElement("span")
  container.style.display = "inline-flex"
  container.style.alignItems = "center"
  container.style.justifyContent = "center"
  container.style.width = `${size}px`
  container.style.height = `${size}px`

  const iconData = getMdiIconData(iconName)

  // 创建 SVG 元素，同步写入离线图标内容（无网络请求）
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  svg.setAttribute(
    "viewBox",
    iconData ? `0 0 ${iconData.width} ${iconData.height}` : "0 0 24 24",
  )

  if (color) {
    svg.style.color = color
    svg.style.fill = "currentColor"
  }

  if (iconData) {
    // body 已含 <path fill="currentColor" .../>，直接作为 svg 内容
    svg.innerHTML = iconData.body
  }

  container.appendChild(svg)
  return container
}

/**
 * 批量替换多个顶部栏图标
 *
 * @param replacements 替换配置数组
 */
export function replaceMultipleTopBarIcons(
  replacements: Array<{
    element: HTMLElement
    iconName: string
    color?: string
  }>,
): void {
  replacements.forEach(({
    element,
    iconName,
    color,
  }) => {
    replaceTopBarIcon(element, iconName, color)
  })
}
