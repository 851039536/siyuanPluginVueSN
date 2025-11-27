/**
 * 文档层级导航插件
 * 功能：在文档标题下方自动显示父文档和子文档的导航链接
 */
import { Plugin } from 'siyuan'
import * as api from '@/api'

// 防抖定时器
let updateTimer: any = null
// 记录已处理的文档，避免重复处理
const processedDocs = new Set<string>()

/**
 * 注册文档层级导航功能
 */
export function registerDocNavigation(plugin: Plugin) {
  // 监听文档切换，动态添加/更新导航UI
  plugin.eventBus.on('switch-protyle', async ({ detail }) => {
    await updateDocNavigationDebounced(plugin, detail.protyle)
  })

  // 监听文档动态加载
  plugin.eventBus.on('loaded-protyle-dynamic', async ({ detail }) => {
    await updateDocNavigationDebounced(plugin, detail.protyle)
  })

  // 监听文档静态加载
  plugin.eventBus.on('loaded-protyle-static', async ({ detail }) => {
    await updateDocNavigationDebounced(plugin, detail.protyle)
  })

  console.log('文档层级导航功能已注册')
}

/**
 * 转义SQL字符串,防止SQL注入
 */
function escapeSqlString(str: string): string {
  if (!str) return ''
  return str.replace(/'/g, "''")
}

/**
 * 获取父文档信息
 */
async function getParentDoc(currentDoc: Block): Promise<Block | null> {
  try {
    if (!currentDoc.hpath || !currentDoc.box) {
      return null
    }

    // 从 hpath 中提取父路径
    const hpathParts = currentDoc.hpath.split('/')
    if (hpathParts.length <= 2) {
      // 已经是根文档，没有父文档
      return null
    }

    // 移除最后一部分（当前文档名）
    hpathParts.pop()
    const parentHpath = hpathParts.join('/')

    // 通过 hpath 查询父文档
    const parentDocs = await api.sql(`
      SELECT id, content, hpath
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath = '${escapeSqlString(parentHpath)}'
      LIMIT 1
    `)

    return parentDocs && parentDocs.length > 0 ? parentDocs[0] : null
  } catch (error) {
    console.error('获取父文档失败:', error)
    return null
  }
}

/**
 * 获取子文档列表
 */
async function getChildDocs(currentDoc: Block): Promise<Block[]> {
  try {
    if (!currentDoc.hpath || !currentDoc.box) {
      return []
    }

    // 使用 hpath 查询直接子文档
    const childDocs = await api.sql(`
      SELECT id, content, hpath
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
      ORDER BY hpath ASC
    `)

    return childDocs || []
  } catch (error) {
    console.error('获取子文档失败:', error)
    return []
  }
}

/**
 * 防抖更新导航（避免短时间内多次触发）
 */
async function updateDocNavigationDebounced(plugin: Plugin, protyle: any) {
  const docId = protyle?.block?.rootID
  if (!docId) return

  // 清除之前的定时器
  if (updateTimer) {
    clearTimeout(updateTimer)
  }

  // 设置新的定时器，延迟执行
  updateTimer = setTimeout(async () => {
    await updateDocNavigation(plugin, protyle)
  }, 100) // 100ms 防抖
}

/**
 * 更新文档层级导航UI
 */
async function updateDocNavigation(plugin: Plugin, protyle: any) {
  try {
    const docId = protyle?.block?.rootID
    if (!docId) return

    // 如果这个文档刚处理过，跳过
    if (processedDocs.has(docId)) {
      return
    }

    // 标记为已处理
    processedDocs.add(docId)

    // 清理已处理文档集合（避免内存泄漏）
    setTimeout(() => {
      processedDocs.delete(docId)
    }, 1000)

    // 移除所有旧的导航UI（防止重复）
    const allOldNavs = document.querySelectorAll('.doc-navigation-container')
    allOldNavs.forEach(nav => {
      const navDocId = nav.getAttribute('data-doc-id')
      // 只移除属于当前文档的导航
      if (navDocId === docId) {
        nav.remove()
      }
    })

    // 再次确认当前 protyle 中没有导航
    const oldNav = protyle.element?.querySelector('.doc-navigation-container')
    if (oldNav) {
      oldNav.remove()
    }

    // 获取当前文档信息
    const currentDoc = await api.getBlockByID(docId)
    if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
      return
    }

    // 获取父文档
    const parentDoc = await getParentDoc(currentDoc)

    // 获取子文档列表
    const childDocs = await getChildDocs(currentDoc)

    // 如果既没有父文档也没有子文档，不显示导航
    if (!parentDoc && childDocs.length === 0) {
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
      childDocs.slice(0, 5).forEach((childDoc, index) => {
        const docName = childDoc.content.replace(/<[^>]*>/g, '')
        navHTML += `<a class="doc-nav-link" data-doc-id="${childDoc.id}">${docName}</a>`
      })

      // 如果有更多文档，显示展开按钮
      if (childDocs.length > 5) {
        navHTML += `<button class="doc-nav-expand" title="展开所有下级文档">
          <svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>
          ...
        </button>`

        // 隐藏的文档（默认不显示，展开后在同一行换行显示）
        childDocs.slice(5).forEach((childDoc) => {
          const docName = childDoc.content.replace(/<[^>]*>/g, '')
          navHTML += `<a class="doc-nav-link doc-nav-link-hidden" data-doc-id="${childDoc.id}">${docName}</a>`
        })
      }

      navHTML += `
          </div>
        </div>
      `
    }

    navHTML += '</div>'
    navContainer.innerHTML = navHTML

    // 添加点击事件
    navContainer.querySelectorAll('.doc-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const targetDocId = (e.target as HTMLElement).getAttribute('data-doc-id')
        if (targetDocId) {
          // 打开目标文档
          window.open(`siyuan://blocks/${targetDocId}`)
        }
      })
    })

    // 添加展开按钮点击事件
    const expandBtn = navContainer.querySelector('.doc-nav-expand')
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.preventDefault()
        const childrenList = navContainer.querySelector('.doc-nav-children-list')
        const hiddenLinks = navContainer.querySelectorAll('.doc-nav-link-hidden')
        const isExpanded = childrenList?.getAttribute('data-expanded') === 'true'

        if (isExpanded) {
          // 折叠
          childrenList?.setAttribute('data-expanded', 'false')
          hiddenLinks.forEach(link => link.classList.remove('show'))
          expandBtn.innerHTML = `<svg class="expand-icon"><use xlink:href="#iconExpand"></use></svg>...`
          expandBtn.setAttribute('title', '展开所有下级文档')
        } else {
          // 展开
          childrenList?.setAttribute('data-expanded', 'true')
          hiddenLinks.forEach(link => link.classList.add('show'))
          expandBtn.innerHTML = `<svg class="expand-icon"><use xlink:href="#iconContract"></use></svg>`
          expandBtn.setAttribute('title', '收起')
        }
      })
    }

    // 插入到编辑器顶部标题下方
    const protyleTitle = protyle.element?.querySelector('.protyle-title')
    if (protyleTitle) {
      // 检查标题下方是否已有导航
      const nextElement = protyleTitle.nextElementSibling
      if (nextElement?.classList.contains('doc-navigation-container')) {
        nextElement.remove()
      }
      protyleTitle.after(navContainer)
    } else {
      // 如果没有找到标题，插入到 protyle-wysiwyg 前面
      const wysiwyg = protyle.element?.querySelector('.protyle-wysiwyg')
      if (wysiwyg) {
        // 检查 wysiwyg 前是否已有导航
        const prevElement = wysiwyg.previousElementSibling
        if (prevElement?.classList.contains('doc-navigation-container')) {
          prevElement.remove()
        }
        wysiwyg.before(navContainer)
      }
    }

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
  style.textContent = `
    .doc-navigation-container {
      margin: 8px 0 16px 0;
      padding: 0;
      display: flex;
      justify-content: center;
    }

    .doc-navigation {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      background: transparent;
      border: 1px solid var(--b3-theme-surface-lighter);
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      max-width: 95%;
      transition: all 0.2s ease;
      flex-wrap: wrap;
    }

    .doc-navigation:hover {
      border-color: var(--b3-theme-primary-lighter);
      background: var(--b3-theme-surface);
    }

    .doc-nav-parent,
    .doc-nav-children {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .doc-nav-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: var(--b3-theme-on-surface);
      opacity: 0.7;
    }

    .doc-nav-label {
      color: var(--b3-theme-on-surface);
      font-weight: 600;
      flex-shrink: 0;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0.8;
    }

    .doc-nav-link {
      color: var(--b3-theme-primary);
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 3px 8px;
      border-radius: 6px;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 500;
      background: transparent;
      border: 1px solid var(--b3-theme-surface-lighter);
      display: inline-flex;
      align-items: center;
    }

    .doc-nav-link:hover {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-surface);
      border-color: var(--b3-theme-primary);
      text-decoration: none;
      transform: translateY(-1px);
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
      background: transparent;
      color: var(--b3-theme-primary);
      border: 1px solid var(--b3-theme-primary);
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .doc-nav-expand:hover {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-surface);
      transform: scale(1.05) translateY(-1px);
    }

    .doc-nav-expand:active {
      transform: scale(0.98);
    }

    .doc-nav-expand .expand-icon {
      width: 12px;
      height: 12px;
    }
  `

  document.head.appendChild(style)
}
