/**
 * 字数统计功能模块
 */
import { Plugin, showMessage } from 'siyuan'

/**
 * 注册字数统计右键菜单
 */
export function registerWordCountMenu(plugin: Plugin) {
  plugin.eventBus.on('open-menu-content', ({ detail }) => {
    const menu = detail.menu
    const protyle = detail.protyle

    menu.addItem({
      iconHTML: '',
      label: plugin.i18n.wordCount,
      click: async () => {
        await countWords(plugin, protyle)
      }
    })
  })
}

/**
 * 统计当前页面字数
 */
async function countWords(plugin: Plugin, protyle: any) {
  try {
    // 获取当前文档ID
    const blockId = protyle?.block?.rootID
    if (!blockId) {
      showMessage(plugin.i18n.noDocument, 3000, 'error')
      return
    }

    // 获取文档内容
    const response = await fetch('/api/export/exportMdContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: blockId })
    })

    const result = await response.json()
    if (result.code === 0 && result.data) {
      const content = result.data.content || ''

      // 统计字数
      const stats = calculateWordCount(content)

      // 显示统计结果
      const message = formatWordCountMessage(plugin, stats)
      showMessage(message, 7000)
    } else {
      showMessage(plugin.i18n.getContentFailed, 5000, 'error')
    }
  } catch (error) {
    console.error('统计字数出错:', error)
    showMessage(plugin.i18n.countError + error.message, 5000, 'error')
  }
}

/**
 * 计算字数统计
 */
function calculateWordCount(content: string) {
  // 移除 markdown 标记
  let plainText = content
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]*`/g, '') // 移除行内代码
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // 移除链接和图片
    .replace(/#{1,6}\s/g, '') // 移除标题标记
    .replace(/[*_~`]/g, '') // 移除格式标记
    .replace(/^[->*+]\s/gm, '') // 移除列表标记
    .replace(/\n+/g, '\n') // 合并多个换行
    .trim()

  // 统计中文字符数
  const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length

  // 统计英文单词数(连续的字母数字序列)
  const englishWords = (plainText.match(/[a-zA-Z0-9]+/g) || []).length

  // 统计总字符数(不含空格)
  const totalChars = plainText.replace(/\s/g, '').length

  return {
    chineseChars,
    englishWords,
    totalChars
  }
}

/**
 * 格式化字数统计消息
 */
function formatWordCountMessage(plugin: Plugin, stats: {
  chineseChars: number
  englishWords: number
  totalChars: number
}) {
  return `${plugin.i18n.wordCountResult}:

${plugin.i18n.chineseChars}: ${stats.chineseChars}
${plugin.i18n.englishWords}: ${stats.englishWords}
${plugin.i18n.totalChars}: ${stats.totalChars}`
}
