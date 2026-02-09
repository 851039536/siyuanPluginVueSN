/**
 * 文档层级导航插件
 * 功能：在文档标题下方自动显示父文档和子文档的导航链接
 */
import { Plugin } from 'siyuan'
import * as api from '@/api'

// 防抖定时器
let updateTimer: ReturnType<typeof setTimeout> | null = null
// 缓存文档层级数据，避免重复查询
const docHierarchyCache = new Map<string, { parent: Block | null; children: Block[]; timestamp: number }>()

/**
 * 注册文档层级导航功能
 */
export function registerDocNavigation(plugin: Plugin) {
  // 统一处理文档加载事件
  const handleEvent = async (e: CustomEvent) => {
    const { protyle } = e.detail as { protyle: any }
    updateDocNavigationDebounced(plugin, protyle)
  }

  const events: ('switch-protyle' | 'loaded-protyle-dynamic' | 'loaded-protyle-static')[] = [
    'switch-protyle',
    'loaded-protyle-dynamic',
    'loaded-protyle-static'
  ]
  events.forEach(event => plugin.eventBus.on(event, handleEvent))
}

/**
 * 创建文档链接HTML
 */
function createDocLink(doc: Block, hidden = false): string {
  const name = doc.content.replace(/<[^>]*>/g, '')
  const hiddenClass = hidden ? ' doc-nav-link-hidden' : ''
  return `<a class="doc-nav-link${hiddenClass}" data-doc-id="${doc.id}" title="${name}">${name}</a>`
}

/**
 * 插入导航容器到指定位置
 */
function insertNavigation(protyle: any, navContainer: HTMLElement) {
  const targetEl = protyle.element?.querySelector('.protyle-title')
  const containerClass = 'doc-navigation-container'

  const insert = (parent: Element, method: 'after' | 'before') => {
    const sibling = method === 'after' ? parent.nextElementSibling : parent.previousElementSibling
    if (sibling?.classList.contains(containerClass)) {
      parent[method](navContainer)
      sibling.remove()
    } else {
      parent[method](navContainer)
    }
  }

  if (targetEl) {
    insert(targetEl, 'after')
  } else {
    const wysiwyg = protyle.element?.querySelector('.protyle-wysiwyg')
    wysiwyg && insert(wysiwyg, 'before')
  }
}

/**
 * 转义SQL字符串,防止SQL注入
 */
function escapeSqlString(str: string): string {
  if (!str) return ''
  return str.replace(/'/g, "''")
}

/**
 * 一次性查询父文档和子文档（性能优化 + 缓存）
 */
async function getDocHierarchy(currentDoc: Block): Promise<{ parent: Block | null; children: Block[] }> {
  try {
    if (!currentDoc.hpath || !currentDoc.box) {
      return { parent: null, children: [] }
    }

    // 检查缓存（60秒内有效）
    const cacheKey = `${currentDoc.box}:${currentDoc.id}`
    const cached = docHierarchyCache.get(cacheKey)
    const now = Date.now()
    if (cached && (now - cached.timestamp) < 60000) {
      return { parent: cached.parent, children: cached.children }
    }

    // 提取父路径
    const hpathParts = currentDoc.hpath.split('/')
    const hasParent = hpathParts.length > 2
    const parentHpath = hasParent ? hpathParts.slice(0, -1).join('/') : ''

    // 使用 UNION 一次性查询父文档和子文档
    const query = `
      SELECT id, content, hpath, 'parent' as doc_type
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      ${hasParent ? `AND hpath = '${escapeSqlString(parentHpath)}'` : 'AND 1=0'}

      UNION ALL

      SELECT id, content, hpath, 'child' as doc_type
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
      ORDER BY hpath ASC
    `

    const results = await api.sql(query)

    let parent: Block | null = null
    const children: Block[] = []

    results?.forEach(doc => {
      if (doc.doc_type === 'parent') {
        parent = doc
      } else {
        children.push(doc)
      }
    })

    // 缓存结果
    docHierarchyCache.set(cacheKey, { parent, children, timestamp: now })

    // 清理过期缓存（保留最近 20 个）
    if (docHierarchyCache.size > 20) {
      const entries = Array.from(docHierarchyCache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 20)
      docHierarchyCache.clear()
      entries.forEach(([key, value]) => docHierarchyCache.set(key, value))
    }

    return { parent, children }
  } catch (error) {
    console.error('获取文档层级失败:', error)
    return { parent: null, children: [] }
  }
}

/**
 * 防抖更新导航（避免短时间内多次触发）
 */
function updateDocNavigationDebounced(plugin: Plugin, protyle: any) {
  if (!protyle?.block?.rootID) return

  updateTimer && clearTimeout(updateTimer)
  updateTimer = setTimeout(() => updateDocNavigation(plugin, protyle), 100)
}

/**
 * 更新文档层级导航UI
 */
async function updateDocNavigation(_plugin: Plugin, protyle: any) {
  try {
    const docId = protyle?.block?.rootID
    if (!docId) return

    // 获取当前文档信息
    const currentDoc = await api.getBlockByID(docId)
    if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
      return
    }

    // 获取文档层级信息（使用缓存优化）
    const { parent: parentDoc, children: childDocs } = await getDocHierarchy(currentDoc)

    // 如果既没有父文档也没有子文档，移除导航并返回
    if (!parentDoc && childDocs.length === 0) {
      const existingNav = protyle.element?.querySelector('.doc-navigation-container')
      existingNav?.remove()
      return
    }

    // 创建导航容器
    const navContainer = document.createElement('div')
    navContainer.className = 'doc-navigation-container'
    navContainer.setAttribute('data-doc-id', docId) // 标记所属文档

    // 生成导航HTML
    let navHTML = '<div class="doc-navigation">'

    // 父文档部分
    if (parentDoc) {
      const parentName = parentDoc.content.replace(/<[^>]*>/g, '')
      navHTML += `
        <div class="doc-nav-parent">
          <svg class="doc-nav-icon"><use xlink:href="#iconUp"></use></svg>
          <span class="doc-nav-label">上级:</span>
          <a class="doc-nav-link" data-doc-id="${parentDoc.id}">${parentName}</a>
        </div>
      `
    }

    // 子文档部分
    if (childDocs.length > 0) {
      navHTML += `
        <div class="doc-nav-children">
          <svg class="doc-nav-icon"><use xlink:href="#iconDown"></use></svg>
          <span class="doc-nav-label">下级 (${childDocs.length}):</span>
          <div class="doc-nav-children-list" data-expanded="false">
      `

      // 显示前5个
      const [visibleDocs, hiddenDocs] = [childDocs.slice(0, 5), childDocs.slice(5)]
      navHTML += visibleDocs.map(d => createDocLink(d)).join('')

      // 如果有更多文档，显示展开按钮
      if (hiddenDocs.length) {
        navHTML += `<button class="doc-nav-expand" title="展开 ${hiddenDocs.length} 个文档">
          <svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>+${hiddenDocs.length}
        </button>${hiddenDocs.map(d => createDocLink(d, true)).join('')}`
      }

      navHTML += `
          </div>
        </div>
      `
    }

    navHTML += '</div>'
    navContainer.innerHTML = navHTML

    // 使用事件委托优化事件监听（减少内存占用）
    navContainer.addEventListener('click', handleNavClick)

    // 插入到编辑器顶部标题下方（先插入新导航，再移除旧导航，避免跳闪）
    insertNavigation(protyle, navContainer)

    // 注入样式
    injectNavigationStyles()
  } catch (error) {
    console.error('更新文档层级导航失败:', error)
  }
}

/**
 * 注入导航样式
 */
function injectNavigationStyles() {
  const styleId = 'doc-navigation-styles'
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = /* css */ `
    .doc-navigation-container {
      margin: 4px 0 12px;
      display: flex;
      justify-content: center;
    }

    .doc-navigation {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 4px 0;
      font-size: 13px;
      line-height: 1.5;
      max-width: 95%;
      flex-wrap: wrap;
    }

    .doc-nav-parent, .doc-nav-children {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .doc-nav-icon {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      color: var(--b3-theme-on-surface);
      opacity: .5;
    }

    .doc-nav-label {
      color: var(--b3-theme-on-surface);
      font-weight: 500;
      flex-shrink: 0;
      font-size: 12px;
      white-space: nowrap;
      opacity: .7;
    }

    .doc-nav-link {
      color: var(--b3-theme-primary);
      text-decoration: none;
      cursor: pointer;
      padding: 1px 6px;
      border-radius: 4px;
      white-space: nowrap;
      font-size: 12px;
      background: var(--b3-theme-surface-lighter);
      display: inline-flex;
      align-items: center;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background .15s;
    }

    .doc-nav-link:hover {
      background: var(--b3-theme-primary-lightest);
      text-decoration: none;
    }

    .doc-nav-children-list {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      overflow: visible;
      min-width: 0;
      flex: 1;
    }

    .doc-nav-link-hidden {
      display: none;
    }

    .doc-nav-link-hidden.show {
      display: inline-flex;
    }

    .doc-nav-expand {
      color: var(--b3-theme-primary);
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 1px 6px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
      opacity: .8;
      transition: opacity .15s;
    }

    .doc-nav-expand:hover {
      opacity: 1;
      background: var(--b3-theme-surface-lighter);
    }

    .doc-nav-expand .expand-icon {
      width: 10px;
      height: 10px;
    }
  `

  document.head.appendChild(style)
}

/**
 * 处理导航点击事件
 */
function handleNavClick(e: Event) {
  const target = e.target as HTMLElement

  // 处理导航链接点击
  const link = target.closest('.doc-nav-link')
  if (link) {
    e.preventDefault()
    const docId = link.getAttribute('data-doc-id')
    docId && window.open(`siyuan://blocks/${docId}`)
    return
  }

  // 处理展开/折叠按钮点击
  const expandBtn = target.closest('.doc-nav-expand')
  if (!expandBtn) return

  e.preventDefault()
  const navContainer = target.closest('.doc-navigation-container')
  const childrenList = navContainer?.querySelector('.doc-nav-children-list')
  const hiddenLinks = navContainer?.querySelectorAll('.doc-nav-link-hidden')
  if (!childrenList || !hiddenLinks?.length) return

  const isExpanded = childrenList.getAttribute('data-expanded') === 'true'
  const hiddenCount = hiddenLinks.length

  childrenList.setAttribute('data-expanded', String(!isExpanded))
  hiddenLinks.forEach(link => link.classList.toggle('show', !isExpanded))

  expandBtn.innerHTML = isExpanded
    ? `<svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>+${hiddenCount}`
    : `<svg class="expand-icon"><use xlink:href="#iconContract"></use></svg>收起`
  expandBtn.setAttribute('title', isExpanded ? `展开 ${hiddenCount} 个文档` : '收起')
}
