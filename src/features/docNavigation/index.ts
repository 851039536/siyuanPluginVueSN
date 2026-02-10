/**
 * 文档层级导航插件
 * 功能：在文档标题下方自动显示父文档和子文档的导航链接
 */
import { Plugin } from 'siyuan'
import * as api from '@/api'
import './style.scss'

// 防抖定时器
let updateTimer: ReturnType<typeof setTimeout> | null = null
// 缓存文档层级数据，避免重复查询
const docHierarchyCache = new Map<string, { parent: Block | null; children: Block[]; timestamp: number }>()

/**
 * 注册文档层级导航功能
 */
export function registerDocNavigation(plugin: Plugin) {
  const handleEvent = (e: CustomEvent) => {
    updateDocNavigationDebounced(plugin, (e.detail as { protyle: any }).protyle)
  }

  ;['switch-protyle', 'loaded-protyle-dynamic', 'loaded-protyle-static'].forEach(event => {
    plugin.eventBus.on(event as any, handleEvent)
  })
}

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '')

const createDocLink = (hidden = false) => (doc: Block): string =>
  `<a class="doc-nav-link${hidden ? ' doc-nav-link-hidden' : ''}" data-doc-id="${doc.id}" title="${stripHtml(doc.content)}">${stripHtml(doc.content)}</a>`

/**
 * 插入导航容器到指定位置
 */
function insertNavigation(protyle: any, navContainer: HTMLElement) {
  const target = protyle.element?.querySelector('.protyle-title') ||
                 protyle.element?.querySelector('.protyle-wysiwyg')
  if (!target) return

  const method = target.classList.contains('protyle-title') ? 'after' : 'before'
  const sibling = method === 'after' ? target.nextElementSibling : target.previousElementSibling

  if (sibling?.classList.contains('doc-navigation-container')) {
    sibling.remove()
  }
  target[method](navContainer)
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
      const newCache = new Map(
        Array.from(docHierarchyCache.entries())
          .sort((a, b) => b[1].timestamp - a[1].timestamp)
          .slice(0, 20)
      )
      docHierarchyCache.clear()
      newCache.forEach((v, k) => docHierarchyCache.set(k, v))
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

    const currentDoc = await api.getBlockByID(docId)
    if (!currentDoc?.box || !currentDoc.hpath) return

    const { parent: parentDoc, children: childDocs } = await getDocHierarchy(currentDoc)

    if (!parentDoc && !childDocs.length) {
      protyle.element?.querySelector('.doc-navigation-container')?.remove()
      return
    }

    const navContainer = document.createElement('div')
    navContainer.className = 'doc-navigation-container'
    navContainer.dataset.docId = docId

    const parts: string[] = ['<div class="doc-navigation">']

    if (parentDoc) {
      parts.push(`
        <div class="doc-nav-parent">
          <svg class="doc-nav-icon"><use xlink:href="#iconUp"></use></svg>
          <span class="doc-nav-label">上级:</span>
          <a class="doc-nav-link" data-doc-id="${parentDoc.id}">${stripHtml(parentDoc.content)}</a>
        </div>`)
    }

    if (childDocs.length) {
      const [visible, hidden] = [childDocs.slice(0, 5), childDocs.slice(5)]
      parts.push(`
        <div class="doc-nav-children">
          <svg class="doc-nav-icon"><use xlink:href="#iconDown"></use></svg>
          <span class="doc-nav-label">下级 (${childDocs.length}):</span>
          <div class="doc-nav-children-list" data-expanded="false">
            ${visible.map(createDocLink()).join('')}`)

      if (hidden.length) {
        parts.push(`<button class="doc-nav-expand" title="展开 ${hidden.length} 个文档">
          <svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>+${hidden.length}
        </button>${hidden.map(createDocLink(true)).join('')}`)
      }

      parts.push('</div></div>')
    }

    parts.push('</div>')
    navContainer.innerHTML = parts.join('')
    navContainer.addEventListener('click', handleNavClick)
    insertNavigation(protyle, navContainer)
  } catch (error) {
    console.error('更新文档层级导航失败:', error)
  }
}

function handleNavClick(e: Event) {
  const target = e.target as HTMLElement

  const link = target.closest('.doc-nav-link')
  if (link) {
    e.preventDefault()
    const docId = link.getAttribute('data-doc-id')
    docId && window.open(`siyuan://blocks/${docId}`)
    return
  }

  const expandBtn = target.closest('.doc-nav-expand') as HTMLElement | null
  if (!expandBtn) return

  e.preventDefault()
  const container = target.closest('.doc-navigation-container')
  const list = container?.querySelector('.doc-nav-children-list')
  const hidden = container?.querySelectorAll('.doc-nav-link-hidden')
  if (!list || !hidden?.length) return

  const expanded = list.getAttribute('data-expanded') === 'true'
  list.setAttribute('data-expanded', String(!expanded))
  hidden.forEach(el => el.classList.toggle('show', !expanded))

  const count = hidden.length
  expandBtn.innerHTML = expanded
    ? `<svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>+${count}`
    : `<svg class="expand-icon"><use xlink:href="#iconContract"></use></svg>收起`
  expandBtn.title = expanded ? `展开 ${count} 个文档` : '收起'
}
