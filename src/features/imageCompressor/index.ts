/**
 * 图片压缩功能主入口
 */
import { Plugin, showMessage } from 'siyuan'

/**
 * 注册图片压缩功能
 */
export function registerImageCompressor(plugin: Plugin) {
  console.log('注册图片压缩功能')

  // 添加顶部图标
  plugin.addTopBar({
    icon: 'iconImage',
    title: (plugin.i18n as any).imageCompressor?.title || '图片压缩',
    position: 'right',
    callback: () => {
      openImageCompressor(plugin)
    }
  })

  // 添加快捷键命令
  plugin.addCommand({
    langKey: 'openImageCompressor',
    hotkey: '⌃⌥C',
    callback: () => {
      openImageCompressor(plugin)
    }
  })
}

/**
 * 打开图片压缩器
 */
function openImageCompressor(plugin: Plugin) {
  showMessage((plugin.i18n as any).imageCompressor?.opening || '正在打开图片压缩器...')

  // 通过全局事件触发打开图片压缩器
  window.dispatchEvent(new CustomEvent('openImageCompressor'))
}
