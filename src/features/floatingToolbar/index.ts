import { Plugin } from 'siyuan'
import { FloatingToolbar } from './FloatingToolbar'
import { createQRCodeAction } from './qrcode/qrcode-action'
import type PluginSample from '@/index'

/**
 * 注册浮动工具栏功能
 * 当用户选中文字时,在文字上方显示一个包含多种操作的工具栏
 */
export function registerFloatingToolbar(plugin: Plugin): void {
    // 创建浮动工具栏实例
    const floatingToolbar: FloatingToolbar = new FloatingToolbar(plugin);

    // 初始化工具栏
    floatingToolbar.init();

    // 注册二维码功能（如果启用）
    const pluginInstance = plugin as PluginSample;
    if (pluginInstance.settings?.enableQRCode) {
        floatingToolbar.registerAction(createQRCodeAction(plugin));
    }

    // 将实例保存到插件对象中，以便在插件卸载时清理资源
    (plugin as any).__floatingToolbar = floatingToolbar;
}

// 导出二维码对话框组件供 App.vue 使用
export { default as QRCodeDialog } from './qrcode/QRCodeDialog.vue'
