/**
 * 目录索引插件 - 完整重构版本
 * 参考: https://github.com/TinkMingKing/siyuan-plugins-index
 */
import { Plugin, showMessage } from 'siyuan'
import * as api from '@/api'

/**
 * 注册目录索引插件功能
 */
export function registerTableOfContents(plugin: Plugin) {
  // 注册快捷键命令
  registerCommands(plugin)
}

/**
 * 注册快捷键命令
 */
function registerCommands(plugin: Plugin) {
  // CTRL + ALT + I: 插入索引（当前文档的子文档列表）
  plugin.addCommand({
    langKey: 'insertIndex',
    hotkey: '⌃⌥I',
    callback: () => {
      insertIndex(plugin)
    }
  })

  // CTRL + ALT + O: 插入子文档及其大纲
  plugin.addCommand({
    langKey: 'insertSubDocsWithOutline',
    hotkey: '⌃⌥O',
    callback: () => {
      insertSubDocsWithOutline(plugin)
    }
  })

  // CTRL + ALT + R: 插入子文档引用列表
  plugin.addCommand({
    langKey: 'insertSubDocsRef',
    hotkey: '⌃⌥R',
    callback: () => {
      insertSubDocsRef(plugin)
    }
  })
}

/**
 * 获取当前光标所在的块ID
 */
function getCurrentBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector('.protyle-wysiwyg--select')
  if (selectedBlock) {
    return selectedBlock.getAttribute('data-node-id')
  }

  // 方法2: 获取光标所在的块（聚焦的块）
  const focusedBlock = document.querySelector('.protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus')
  if (focusedBlock) {
    return focusedBlock.getAttribute('data-node-id')
  }

  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    let node: Node | null = range.startContainer

    // 向上查找直到找到带有 data-node-id 和 data-type 的元素
    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute('data-node-id')
        const dataType = node.getAttribute('data-type')

        // 必须同时有 data-node-id 和 data-type 才是有效的块
        if (nodeId && dataType) {
          return nodeId
        }
      }
      node = node.parentNode
    }
  }

  return null
}

/**
 * 通过块ID获取其所属的文档ID
 */
async function getDocIdByBlockId(blockId: string): Promise<string | null> {
  try {
    const block = await api.getBlockByID(blockId)
    return block?.root_id || null
  } catch (error) {
    console.error('获取文档ID失败:', error)
    return null
  }
}

/**
 * 获取当前激活的编辑器
 */
function getActiveProtyle(): any {
  const activeTab = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)')
  return activeTab
}

/**
 * 获取当前文档ID（优先使用光标所在文档，其次使用激活窗口）
 */
async function getCurrentDocId(): Promise<string | null> {
  // 优先方案：通过光标所在的块获取文档ID
  const currentBlockId = getCurrentBlockId()
  if (currentBlockId) {
    const docId = await getDocIdByBlockId(currentBlockId)
    if (docId) {
      return docId
    }
  }

  // 备用方案：使用激活窗口的文档
  const protyle = getActiveProtyle()
  const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id')
  return docId || null
}

/**
 * 插入内容到当前光标位置
 * @param indexType 索引类型标识,用于区分不同类型的索引
 */
async function insertContent(plugin: Plugin, content: string, indexType: string) {
  try {
    // 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId()

    if (!currentBlockId) {
      showMessage('请先将光标放在文档中的某个块上', 3000, 'error')
      return
    }

    // 通过块ID获取文档ID,确保在同一文档内操作
    const docId = await getDocIdByBlockId(currentBlockId)
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error')
      return
    }

    // 查找整个文档中是否存在同类型的索引块
    const existingIndexBlock = await findExistingIndexBlock(docId, indexType)

    if (existingIndexBlock) {
      // 获取已存在块的内容
      const existingContent = await api.getBlockKramdown(existingIndexBlock.id)
      const existingMarkdown = existingContent?.kramdown || ''

      // 规范化内容进行比较(统一换行符,去除首尾空白)
      const normalizedExisting = existingMarkdown.replace(/\r\n/g, '\n').trim()
      const normalizedNew = content.replace(/\r\n/g, '\n').trim()

      if (normalizedExisting === normalizedNew) {
        showMessage('内容无变化,无需更新', 2000, 'info')
        return
      }

      // 内容有变化,更新块
      await api.updateBlock('markdown', content, existingIndexBlock.id)
      showMessage('索引已更新', 2000, 'info')
    } else {
      // 不存在索引块,插入新内容到当前块之后
      const result = await api.insertBlock('markdown', content, undefined, currentBlockId, undefined)

      // 为新插入的块添加自定义属性标记
      if (result && result.length > 0 && result[0].doOperations) {
        const newBlockId = result[0].doOperations[0]?.id
        if (newBlockId) {
          await api.setBlockAttrs(newBlockId, {
            'custom-toc-type': indexType,
            'custom-toc-generated': 'true'
          })
        }
      }

      showMessage(plugin.i18n.insertSuccess, 2000, 'info')
    }
  } catch (error) {
    console.error('插入内容失败:', error)
    const errorMsg = error?.message || String(error)
    showMessage(plugin.i18n.insertFailed + errorMsg, 3000, 'error')
  }
}

/**
 * 查找整个文档中该类型的索引块
 * @param docId 文档ID
 * @param indexType 索引类型
 */
async function findExistingIndexBlock(docId: string, indexType: string): Promise<any> {
  try {
    // 使用SQL直接查询带有自定义属性的块,避免循环调用API
    // 通过JOIN attributes表一次性查询,性能更优
    const blocks = await api.sql(`
      SELECT DISTINCT b.id, b.type
      FROM blocks b
      JOIN attributes a1 ON b.id = a1.block_id AND a1.name = 'custom-toc-type' AND a1.value = '${escapeSqlString(indexType)}'
      JOIN attributes a2 ON b.id = a2.block_id AND a2.name = 'custom-toc-generated' AND a2.value = 'true'
      WHERE b.root_id = '${escapeSqlString(docId)}'
      ORDER BY b.sort ASC
      LIMIT 1
    `)

    return blocks && blocks.length > 0 ? blocks[0] : null
  } catch (error) {
    console.error('查找索引块失败:', error)
    return null
  }
}

/**
 * 转义SQL字符串,防止SQL注入
 */
function escapeSqlString(str: string): string {
  if (!str) return ''
  // 转义单引号,防止SQL注入
  return str.replace(/'/g, "''")
}

/**
 * 1. 插入索引(当前文档的子文档列表)
 * CTRL + ALT + I
 */
async function insertIndex(plugin: Plugin) {
  try {
    const docId = await getCurrentDocId()
    if (!docId) {
      showMessage(plugin.i18n.noActiveDocument, 3000, 'error')
      return
    }

    // 获取当前文档信息
    const currentDoc = await api.getBlockByID(docId)
    if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
      showMessage('无法获取当前文档信息', 3000, 'error')
      return
    }

    // 使用hpath查询子文档(人类可读路径)
    const subDocs = await api.sql(`
      SELECT id, content, hpath
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
      ORDER BY hpath ASC
    `)

    if (!subDocs || subDocs.length === 0) {
      showMessage(plugin.i18n.noSubDocuments, 3000, 'info')
      return
    }

    // 生成索引内容
    let indexContent = ''

    for (const subDoc of subDocs) {
      const docName = subDoc.content.replace(/<[^>]*>/g, '')
      indexContent += `- [${docName}](siyuan://blocks/${subDoc.id})\n`
    }

    await insertContent(plugin, indexContent, 'index')
  } catch (error) {
    console.error('插入索引失败:', error)
    const errorMsg = error?.message || String(error)
    showMessage(plugin.i18n.insertFailed + errorMsg, 3000, 'error')
  }
}

/**
 * 2. 插入子文档引用列表
 * CTRL + ALT + R
 */
async function insertSubDocsRef(plugin: Plugin) {
  try {
    const docId = await getCurrentDocId()
    if (!docId) {
      showMessage(plugin.i18n.noActiveDocument, 3000, 'error')
      return
    }

    // 获取当前文档信息
    const currentDoc = await api.getBlockByID(docId)
    if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
      showMessage('无法获取当前文档信息', 3000, 'error')
      return
    }

    // 使用hpath查询子文档(人类可读路径)
    const subDocs = await api.sql(`
      SELECT id, content, hpath
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
      ORDER BY hpath ASC
    `)

    if (!subDocs || subDocs.length === 0) {
      showMessage(plugin.i18n.noSubDocuments, 3000, 'info')
      return
    }

    // 生成引用内容
    let refContent = ''

    for (const subDoc of subDocs) {
      // 使用引用块语法 ((id "锚文本"))
      const docName = subDoc.content.replace(/<[^>]*>/g, '')
      refContent += `- ((${subDoc.id} "${docName}"))
`
    }

    await insertContent(plugin, refContent, 'subdocs-ref')
  } catch (error) {
    console.error('插入子文档引用失败:', error)
    const errorMsg = error?.message || String(error)
    showMessage(plugin.i18n.insertFailed + errorMsg, 3000, 'error')
  }
}

/**
 * 3. 插入子文档及其大纲（使用引用块）
 * CTRL + ALT + O
 */
async function insertSubDocsWithOutline(plugin: Plugin) {
  try {
    const docId = await getCurrentDocId()
    if (!docId) {
      showMessage(plugin.i18n.noActiveDocument, 3000, 'error')
      return
    }

    // 获取当前文档信息
    const currentDoc = await api.getBlockByID(docId)
    if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
      showMessage('无法获取当前文档信息', 3000, 'error')
      return
    }

    // 使用hpath查询直接子文档
    const subDocs = await api.sql(`
      SELECT id, content, hpath
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
      ORDER BY hpath ASC
    `)

    if (!subDocs || subDocs.length === 0) {
      showMessage(plugin.i18n.noSubDocuments, 3000, 'info')
      return
    }

    // 生成内容
    let content = ''

    for (const subDoc of subDocs) {
      const docName = subDoc.content.replace(/<[^>]*>/g, '')
      // 使用引用块语法替代超链接
      content += `## ((${subDoc.id} "${docName}"))\n\n`

      // 获取子文档的大纲(标题)
      const headings = await api.sql(`
        SELECT * FROM blocks
        WHERE root_id = '${escapeSqlString(subDoc.id)}'
        AND type = 'h'
        ORDER BY sort ASC
      `)

      if (headings && headings.length > 0) {
        for (const heading of headings) {
          const level = parseInt(heading.subtype.replace('h', ''))
          const indent = '  '.repeat(level - 1)
          const headingContent = heading.content.replace(/<[^>]*>/g, '')
          // 标题也使用引用块语法
          content += `${indent}- ((${heading.id} "${headingContent}"))\n`
        }
        content += '\n'
      }
    }

    await insertContent(plugin, content, 'subdocs-outline')
  } catch (error) {
    console.error('插入子文档及大纲失败:', error)
    const errorMsg = error?.message || String(error)
    showMessage(plugin.i18n.insertFailed + errorMsg, 3000, 'error')
  }
}


