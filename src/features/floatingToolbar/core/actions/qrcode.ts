/**
 * 浮动工具栏 - 二维码生成功能模块
 * 为选中的文本生成二维码
 */
import { Plugin } from 'siyuan'
import { ToolbarAction } from '../../types'
import { showI18nMessage, dispatchDialogEvent } from '../utils'

/**
 * 创建二维码功能
 * @param plugin 插件实例
 * @returns 二维码工具栏功能
 */
export function createQRCodeAction(plugin: Plugin): ToolbarAction {
  return {
    id: 'qrcode',
    name: (plugin.i18n as any).floatingToolbar?.qrcode || '生成二维码',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14">
      <path fill="currentColor" d="M3,11H11V3H3M5,5H9V9H5M13,3V11H21V3M19,9H15V5H19M3,21H11V13H3M5,15H9V19H5M18,13H16V15H13V18H15V21H18V18H21V15H18M21,21H19V19H21V21Z"/>
    </svg>`,
    handler: async (selectedText: string) => {
      if (!selectedText) {
        showI18nMessage(plugin, 'noTextSelected', '未选中文本')
        return
      }

      // 触发打开二维码对话框事件
      dispatchDialogEvent('openQRCodeDialog', selectedText)
    }
  }
}
