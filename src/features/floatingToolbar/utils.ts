import { Plugin } from 'siyuan'

/**
 * 显示通知消息
 * @param message 消息内容
 * @param timeout 显示时长（毫秒）
 */
export function showMessage(message: string, timeout: number = 3000): void {
  fetch('/api/notification/pushMsg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msg: message,
      timeout
    })
  })
}

/**
 * 显示插件国际化消息
 * @param plugin 插件实例
 * @param key 国际化键
 * @param defaultMessage 默认消息
 * @param timeout 显示时长
 */
export function showI18nMessage(
  plugin: Plugin,
  key: string,
  defaultMessage: string,
  timeout?: number
): void {
  const i18n = plugin.i18n as any
  const message = i18n.floatingToolbar?.[key] || defaultMessage
  showMessage(message, timeout)
}

/**
 * 派发自定义事件打开对话框
 * @param eventName 事件名称
 * @param content 对话框内容
 */
export function dispatchDialogEvent(eventName: string, content: string): void {
  setTimeout(() => {
    const event = new CustomEvent(eventName, {
      detail: { content }
    })
    window.dispatchEvent(event)
  }, 0)
}

/**
 * 获取当前选中的块ID
 * 使用多种策略确保准确获取
 */
export function getSelectedBlockId(): string | null {
  // 策略1: 获取多选块
  const selectedBlock = document.querySelector('.protyle-wysiwyg--select')
  if (selectedBlock) {
    return selectedBlock.getAttribute('data-node-id')
  }

  // 策略2: 获取聚焦块
  const focusedBlock = document.querySelector('.protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus')
  if (focusedBlock) {
    return focusedBlock.getAttribute('data-node-id')
  }

  // 策略3: 通过选择范围精确查找
  const selection = window.getSelection()
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0)
    let node: Node | null = range.startContainer

    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute('data-node-id')
        const dataType = node.getAttribute('data-type')

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
 * 检测是否为英文文本（超过50%英文字符）
 */
export function isEnglishText(text: string): boolean {
  const englishChars = text.match(/[a-zA-Z]/g)
  const totalChars = text.replace(/\s/g, '').length
  return englishChars !== null && englishChars.length > totalChars * 0.5
}
