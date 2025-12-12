/**
 * 浮动工具栏 - 谐音翻译功能模块
 * 为选中的英文单词生成谐音记忆
 */
import { Plugin } from 'siyuan'
import { ToolbarAction } from '../actions'

/**
 * 创建谐音翻译功能
 * @param plugin 插件实例
 * @returns 谐音翻译工具栏功能
 */
export function createPronunciationAction(plugin: Plugin): ToolbarAction {
  return {
    id: 'pronunciation',
    name: (plugin.i18n as any).floatingToolbar?.pronunciation || '谐音翻译',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14">
      <path fill="currentColor" d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8,12 6,14 6,16.5C6,19 8,21 10.5,21C13,21 15,19 15,16.5V6H19V3H12Z"/>
    </svg>`,
    handler: async (selectedText: string) => {
      if (!selectedText) {
        showMessage(plugin, (plugin.i18n as any).floatingToolbar?.noTextSelected || '未选中文本')
        return
      }


      // 触发打开谐音翻译对话框事件
      openPronunciationDialog(selectedText)
    }
  }
}



/**
 * 打开谐音翻译对话框
 * @param content 要生成谐音的单词
 */
function openPronunciationDialog(content: string) {
  // 使用 setTimeout 确保事件在同步执行流之外
  setTimeout(() => {
    const event = new CustomEvent('openPronunciationDialog', {
      detail: { content }
    })
    window.dispatchEvent(event)
  }, 0)
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
      timeout: 3000
    })
  })
}
