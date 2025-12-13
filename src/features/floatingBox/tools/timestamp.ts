import { showMessage } from 'siyuan'
import type { FloatingTool } from '../types'

/**
 * 时间戳工具
 */
export const timestampTool: FloatingTool = {
  id: 'timestamp',
  label: '时间戳',
  title: '插入当前时间',
  icon: '<path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>',
  bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  action: () => {
    const now = new Date()
    const timestamp = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    navigator.clipboard.writeText(timestamp)
    showMessage(`已复制: ${timestamp}`, 2000, 'info')
  }
}
