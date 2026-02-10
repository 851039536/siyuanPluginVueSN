/**
 * 文档层级导航插件
 * 功能：在文档标题下方自动显示父文档和子文档的导航链接
 */
import { Plugin } from 'siyuan'
import * as api from '@/api'
import './style.scss'

// 防抖定时器
let updateTimer: ReturnType<typeof setTimeout> | null = null
// 缓存文档层级数据，避免重复查询 (LRU: 最多20个，60秒过期)
const docHierarchyCache = new Map<string, { parent: Block | null; children: Block[]; timestamp: number }>()
const MAX_CACHE_SIZE = 20
const CACHE_TTL = 60000
// HTML 文本缓存
const htmlCache = new Map<string, string>()

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

const stripHtml = (html: string): string => {
  let text = htmlCache.get(html)
  if (!text) {
    text = html.replace(/<[^>]*>/g, '')
    // 限制缓存大小
    if (htmlCache.size > 100) htmlCache.clear()
    htmlCache.set(html, text)
  }
  return text
}

const createDocLink = (hidden = false) => (doc: Block): string =>
  `<a class="doc-nav-link${hidden ? ' doc-nav-link-hidden' : ''}" data-doc-id="${doc.id}" title="${stripHtml(doc.content)}">${stripHtml(doc.content)}</a>`

// 缓存目标元素引用
const targetCache = new WeakMap<any, { el: Element; method: 'after' | 'before' }>()

/**
 * 插入导航容器到指定位置
 */
function insertNavigation(protyle: any, navContainer: HTMLElement) {
  let cached = targetCache.get(protyle)

  if (!cached) {
    const target = protyle.element?.querySelector('.protyle-title') ||
                   protyle.element?.querySelector('.protyle-wysiwyg')
    if (!target) return
    cached = {
      el: target,
      method: target.classList.contains('protyle-title') ? 'after' : 'before'
    }
    targetCache.set(protyle, cached)
  }

  const sibling = cached.method === 'after'
    ? cached.el.nextElementSibling
    : cached.el.previousElementSibling

  if (sibling?.classList.contains('doc-navigation-container')) {
    sibling.remove()
  }
  cached.el[cached.method](navContainer)
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

    // 检查缓存
    const cacheKey = `${currentDoc.box}:${currentDoc.id}`
    const cached = docHierarchyCache.get(cacheKey)
    const now = Date.now()
    if (cached && now - cached.timestamp < CACHE_TTL) {
      // LRU: 删除后重新添加，使其成为最新
      docHierarchyCache.delete(cacheKey)
      docHierarchyCache.set(cacheKey, cached)
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

    // 缓存结果 (LRU)
    docHierarchyCache.set(cacheKey, { parent, children, timestamp: now })

    // 超出限制时删除最老的 (Map 的 keys 按插入顺序排列)
    if (docHierarchyCache.size > MAX_CACHE_SIZE) {
      const firstKey = docHierarchyCache.keys().next().value
      firstKey && docHierarchyCache.delete(firstKey)
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

// 使用 WeakMap 存储容器，避免重复查询 DOM
const navContainers = new WeakMap<any, HTMLElement>()

/**
 * 生成导航 HTML
 */
function generateNavHTML(_docId: string, parentDoc: Block | null, childDocs: Block[]): string {
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
  return parts.join('')
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

    // 无数据时移除导航
    if (!parentDoc && !childDocs.length) {
      const existing = navContainers.get(protyle)
      if (existing) {
        existing.remove()
        navContainers.delete(protyle)
      }
      return
    }

    // 复用现有容器或创建新的
    let container = navContainers.get(protyle)
    const html = generateNavHTML(docId, parentDoc, childDocs)

    if (container) {
      // 复用：只更新内容，保留事件监听
      container.dataset.docId = docId
      container.innerHTML = html
    } else {
      // 创建新容器
      container = document.createElement('div')
      container.className = 'doc-navigation-container'
      container.dataset.docId = docId
      container.innerHTML = html
      container.addEventListener('click', handleNavClick)
      navContainers.set(protyle, container)
      insertNavigation(protyle, container)
    }
  } catch (error) {
    console.error('更新文档层级导航失败:', error)
  }
}

function handleNavClick(e: Event) {
  const target = e.target as HTMLElement

  const link = target.closest('.doc-nav-link') as HTMLElement | null
  if (link) {
    e.preventDefault()
    link.dataset.docId && window.open(`siyuan://blocks/${link.dataset.docId}`)
    return
  }

  const expandBtn = target.closest('.doc-nav-expand') as HTMLElement | null
  if (!expandBtn) return

  e.preventDefault()
  const list = expandBtn.parentElement as HTMLElement | null
  if (!list) return

  const hidden = list.querySelectorAll('.doc-nav-link-hidden')
  if (!hidden.length) return

  const expanded = list.dataset.expanded === 'true'
  list.dataset.expanded = String(!expanded)
  hidden.forEach(el => el.classList.toggle('show', !expanded))

  const count = hidden.length
  expandBtn.innerHTML = expanded
    ? `<svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>+${count}`
    : `<svg class="expand-icon"><use xlink:href="#iconContract"></use></svg>收起`
  expandBtn.title = expanded ? `展开 ${count} 个文档` : '收起'
}
