/**
 * 浮动工具栏 - 单词查询功能模块
 * 查询选中的文本是否存在于 flashcard-cards 存储中
 */
import { Plugin } from 'siyuan'
import { ToolbarAction } from '../actions'

/**
 * 创建查询单词功能
 * @param plugin 插件实例
 * @returns 查询单词工具栏功能
 */
export function createFlashcardQueryAction(plugin: Plugin): ToolbarAction {
  return {
    id: 'queryFlashcard',
    name: (plugin.i18n as any).floatingToolbar?.queryFlashcard || '查询单词',
    icon: '<svg><use xlink:href="#iconSearch"></use></svg>',
    handler: async (selectedText: string) => {
      await queryFlashcard(plugin, selectedText)
    }
  }
}

/**
 * 查询单词卡片
 * @param plugin 插件实例
 * @param text 选中的文本
 */
async function queryFlashcard(plugin: Plugin, text: string) {
  if (!text.trim()) {
    showMessage(plugin, (plugin.i18n as any).floatingToolbar?.noTextSelected || '未选中文本')
    return
  }

  try {
    // 从插件存储中加载 flashcard-cards 数据
    const cards = await plugin.loadData('flashcard-cards') as Array<{
      title: string
      content: string
      category: string
    }> || []

    // 检查是否有卡片数据
    if (!cards || cards.length === 0) {
      showMessage(plugin, (plugin.i18n as any).floatingToolbar?.noFlashcards || '暂无卡片数据')
      return
    }

    // 查找匹配的卡片（精确匹配标题）
    const matchedCard = cards.find(card => card.title === text.trim())

    if (matchedCard) {
      // 找到匹配的卡片
      const message = `✅ ${matchedCard.title}\n${matchedCard.content}\n[${matchedCard.category}]`
      showMessage(plugin, message)
    } else {
      // 未找到匹配的卡片
      showMessage(plugin, `${(plugin.i18n as any).floatingToolbar?.cardNotFound || '未找到卡片'}: ${text}`)
    }
  } catch (error) {
    console.error('Query flashcard failed:', error)
    showMessage(plugin, (plugin.i18n as any).floatingToolbar?.queryFailed || '查询失败')
  }
}

/**
 * 显示消息
 * @param plugin 插件实例
 * @param message 消息内容
 */
function showMessage(plugin: Plugin, message: string) {
  fetch('/api/notification/pushMsg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msg: message,
      timeout: 7000
    })
  })
}
