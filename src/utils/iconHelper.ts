/**
 * 图标辅助工具
 * 用于在非 Vue 环境中使用 Iconify 图标
 */

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
export function replaceTopBarIcon(element: HTMLElement, iconName: string, color?: string): void {
  // 延迟执行，确保元素已添加到 DOM
  setTimeout(() => {
    const svgElement = element.querySelector('svg')
    if (!svgElement) {
      console.warn('SVG element not found in top bar')
      return
    }

    const [collection, icon] = iconName.split(':')
    if (!collection || !icon) {
      console.error('Invalid icon name format. Expected: collection:icon-name')
      return
    }
    
    // 设置 SVG 基本属性
    svgElement.innerHTML = ''
    svgElement.setAttribute('width', '20')
    svgElement.setAttribute('height', '20')
    svgElement.setAttribute('viewBox', '0 0 24 24')
    
    if (color) {
      svgElement.style.color = color
      svgElement.style.fill = 'currentColor'
    }
    
    // 从 Iconify API 加载图标
    fetch(`https://api.iconify.design/${collection}/${icon}.svg?height=20`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.text()
      })
      .then(svgText => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(svgText, 'image/svg+xml')
        const newSvg = doc.querySelector('svg')
        
        if (newSvg) {
          // 复制内容和 viewBox
          svgElement.innerHTML = newSvg.innerHTML
          const viewBox = newSvg.getAttribute('viewBox')
          if (viewBox) {
            svgElement.setAttribute('viewBox', viewBox)
          }
        }
      })
      .catch(error => {
        console.error(`Failed to load Iconify icon: ${iconName}`, error)
      })
  }, 100)
}

/**
 * 创建一个 HTML 元素并设置 Iconify 图标
 * 
 * @param iconName Iconify 图标名称
 * @param size 图标大小（默认 20）
 * @param color 图标颜色（可选）
 * @returns HTMLElement
 */
export function createIconElement(iconName: string, size: number = 20, color?: string): HTMLElement {
  const container = document.createElement('span')
  container.style.display = 'inline-flex'
  container.style.alignItems = 'center'
  container.style.justifyContent = 'center'
  container.style.width = `${size}px`
  container.style.height = `${size}px`
  
  const [collection, icon] = iconName.split(':')
  
  // 创建 SVG 元素
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 24 24')
  
  if (color) {
    svg.style.color = color
    svg.style.fill = 'currentColor'
  }
  
  container.appendChild(svg)
  
  // 异步加载图标内容
  fetch(`https://api.iconify.design/${collection}/${icon}.svg?height=${size}`)
    .then(response => response.text())
    .then(svgText => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgText, 'image/svg+xml')
      const newSvg = doc.querySelector('svg')
      
      if (newSvg) {
        svg.innerHTML = newSvg.innerHTML
        const viewBox = newSvg.getAttribute('viewBox')
        if (viewBox) {
          svg.setAttribute('viewBox', viewBox)
        }
      }
    })
    .catch(error => {
      console.error(`Failed to load icon: ${iconName}`, error)
    })
  
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
  }>
): void {
  replacements.forEach(({ element, iconName, color }) => {
    replaceTopBarIcon(element, iconName, color)
  })
}
