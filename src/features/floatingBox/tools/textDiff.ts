import type { FloatingTool } from '../types'
import { toggleTextDiff } from '../../textDiff'

/**
 * 文本对比工具
 */
export const textDiffTool: FloatingTool = {
  id: 'textDiff',
  label: '文本对比',
  title: '打开文本对比工具',
  icon: '<path fill="currentColor" d="M3 3h8v2H3V3zm0 4h8v2H3V7zm0 4h8v2H3v-2zm10-6h4v2h-4v-2zm0 4h4v2h-4v-2zm0-8h4v2h-4V3zm0 8h4v2h-4v-2z"/>',
  bgColor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  action: (plugin?: any) => {
    // 传递 plugin 实例给文本对比工具
    if (plugin) {
      toggleTextDiff(plugin)
    } else {
      console.error('未获取到 plugin 实例，无法打开文本对比工具')
    }
  }
}
