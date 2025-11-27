/**
 * 快捷键模块
 * 功能：在右侧边栏显示思源笔记和插件的快捷键信息
 * 侧边栏图标：iconKeymap（快捷键图标）
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import ShortcutPanel from './ShortcutPanel.vue'
import { ShortcutManager, getShortcutManager } from './manager'
import { loadCustomShortcuts, saveCustomShortcuts } from './storage'
import type { ShortcutInfo } from './types'

/**
 * 注册快捷键模块
 */
export async function registerShortcut(plugin: Plugin) {
  // 初始化快捷键管理器
  const manager = getShortcutManager()

  // 添加思源笔记常用快捷键
  await manager.addShortcuts(getSiyuanShortcuts())

  // 添加当前项目的快捷键
  await manager.addShortcuts(getPluginShortcuts(plugin))

  // 加载自定义快捷键从数据库
  const customShortcuts = await loadCustomShortcuts(plugin)
  if (customShortcuts.length > 0) {
    await manager.addShortcuts(customShortcuts)
  }

  // 设置保存回调
  manager.setSaveCallback(async (shortcuts: ShortcutInfo[]) => {
    await saveCustomShortcuts(plugin, shortcuts)
  })

  // 添加右侧边栏 Dock
  addShortcutDock(plugin, manager)

  console.log('快捷键模块已注册')
}

/**
 * 获取思源笔记的常用快捷键
 */
function getSiyuanShortcuts(): ShortcutInfo[] {
  return [
    // 编辑操作
    {
      id: 'sy_undo',
      name: '撤销',
      description: '撤销上一步操作',
      keys: 'Ctrl+Z',
      category: 'siyuan',
      group: '编辑操作'
    },
    {
      id: 'sy_redo',
      name: '重做',
      description: '重做上一步操作',
      keys: 'Ctrl+Shift+Z',
      category: 'siyuan',
      group: '编辑操作'
    },
    {
      id: 'sy_bold',
      name: '粗体',
      description: '使文本加粗',
      keys: 'Ctrl+B',
      category: 'siyuan',
      group: '文本格式'
    },
    {
      id: 'sy_italic',
      name: '斜体',
      description: '使文本倾斜',
      keys: 'Ctrl+I',
      category: 'siyuan',
      group: '文本格式'
    },
    {
      id: 'sy_underline',
      name: '下划线',
      description: '为文本添加下划线',
      keys: 'Ctrl+U',
      category: 'siyuan',
      group: '文本格式'
    },
    {
      id: 'sy_strikethrough',
      name: '删除线',
      description: '为文本添加删除线',
      keys: 'Ctrl+Shift+X',
      category: 'siyuan',
      group: '文本格式'
    },
    {
      id: 'sy_code',
      name: '代码',
      description: '使文本显示为代码',
      keys: 'Ctrl+Shift+`',
      category: 'siyuan',
      group: '文本格式'
    },
    {
      id: 'sy_heading1',
      name: '一级标题',
      description: '插入一级标题',
      keys: 'Ctrl+1',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_heading2',
      name: '二级标题',
      description: '插入二级标题',
      keys: 'Ctrl+2',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_heading3',
      name: '三级标题',
      description: '插入三级标题',
      keys: 'Ctrl+3',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_unordered_list',
      name: '无序列表',
      description: '插入无序列表',
      keys: 'Ctrl+Shift+L',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_ordered_list',
      name: '有序列表',
      description: '插入有序列表',
      keys: 'Ctrl+Shift+O',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_quote',
      name: '引用块',
      description: '插入引用块',
      keys: 'Ctrl+Shift+B',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_code_block',
      name: '代码块',
      description: '插入代码块',
      keys: 'Ctrl+Shift+C',
      category: 'siyuan',
      group: '块类型'
    },
    {
      id: 'sy_inline_link',
      name: '行内链接',
      description: '插入行内链接',
      keys: 'Ctrl+K',
      category: 'siyuan',
      group: '插入'
    },
    {
      id: 'sy_search',
      name: '搜索',
      description: '打开全局搜索',
      keys: 'Ctrl+F',
      category: 'siyuan',
      group: '导航'
    },
    {
      id: 'sy_replace',
      name: '替换',
      description: '打开替换面板',
      keys: 'Ctrl+H',
      category: 'siyuan',
      group: '导航'
    },
    {
      id: 'sy_focus',
      name: '聚焦',
      description: '聚焦当前块',
      keys: 'Ctrl+L',
      category: 'siyuan',
      group: '导航'
    },
    {
      id: 'sy_delete_block',
      name: '删除块',
      description: '删除当前块',
      keys: 'Ctrl+Shift+D',
      category: 'siyuan',
      group: '编辑操作'
    },
    {
      id: 'sy_duplicate_block',
      name: '复制块',
      description: '复制当前块',
      keys: 'Ctrl+D',
      category: 'siyuan',
      group: '编辑操作'
    }
  ]
}

/**
 * 获取插件的快捷键
 */
function getPluginShortcuts(plugin: Plugin): ShortcutInfo[] {
  return [
    // 目录索引功能
    {
      id: 'plugin_insert_index',
      name: '插入索引',
      description: '插入当前文档的子文档索引',
      keys: 'Ctrl+Alt+I',
      category: 'plugin',
      group: '目录索引'
    },
    {
      id: 'plugin_insert_subdocs_ref',
      name: '插入子文档引用',
      description: '插入子文档引用列表',
      keys: 'Ctrl+Alt+R',
      category: 'plugin',
      group: '目录索引'
    },
    {
      id: 'plugin_insert_subdocs_outline',
      name: '插入子文档大纲',
      description: '插入子文档及其大纲',
      keys: 'Ctrl+Alt+O',
      category: 'plugin',
      group: '目录索引'
    },
    // 页面锁定功能
    {
      id: 'plugin_page_lock',
      name: '锁定/解锁页面',
      description: '对当前文档进行加密锁定或解锁',
      keys: 'Icon Click',
      category: 'plugin',
      group: '页面锁定'
    },
    // 图片压缩功能
    {
      id: 'plugin_image_compressor',
      name: '打开图片压缩器',
      description: '扫描并压缩资源库中的图片',
      keys: 'Icon Click',
      category: 'plugin',
      group: '图片压缩'
    }
  ]
}

/**
 * 添加快捷键 Dock 到右侧边栏
 */
function addShortcutDock(plugin: Plugin, manager: ShortcutManager) {
  plugin.addDock({
    config: {
      position: 'RightTop',
      size: { width: 300, height: 0 },
      icon: 'iconKeymap',
      title: plugin.i18n.shortcuts || '快捷键',
      show: false,
    },
    data: {},
    type: 'shortcut-panel-dock',
    init(dock: any) {
      // 创建 Vue 应用
      const container = document.createElement('div')
      container.style.height = '100%'
      container.style.overflow = 'hidden'

      const app = createApp({
        setup() {
          return () => h(ShortcutPanel, {
            i18n: plugin.i18n,
          })
        }
      })

      app.mount(container)
      dock.element?.appendChild(container)

      // 保存应用引用，以便卸载时清理
      dock.__app = app
      dock.__container = container
    },
  })
}

/**
 * 导出公共接口供用户自定义添加快捷键
 */
export async function addCustomShortcut(shortcut: ShortcutInfo) {
  const manager = getShortcutManager()
  await manager.addShortcut(shortcut)
}

/**
 * 批量添加自定义快捷键
 */
export async function addCustomShortcuts(shortcuts: ShortcutInfo[]) {
  const manager = getShortcutManager()
  await manager.addShortcuts(shortcuts)
}

/**
 * 获取快捷键管理器
 */
export { getShortcutManager, ShortcutManager }

/**
 * 导出类型
 */
export type { ShortcutInfo, ShortcutGroup } from './types'
