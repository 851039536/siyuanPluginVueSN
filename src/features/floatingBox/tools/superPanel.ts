import type { FloatingTool } from '../types'

/**
 * 超级面板工具
 */
export const superPanelTool: FloatingTool = {
  id: 'superPanel',
  label: '超级面板',
  title: '打开超级面板',
  icon: '<path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  bgColor: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  action: (plugin?: any) => {
    // 触发超级面板切换事件
    window.dispatchEvent(new CustomEvent('toggleSuperPanel'))
  }
}
