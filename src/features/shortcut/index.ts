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

  // 添加Claude Code快捷键
  await manager.addShortcuts(getClaudeShortcuts())

  // 添加OpenSpec快捷键
  await manager.addShortcuts(getOpenSpecShortcuts())

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
 * 获取Claude Code的快捷键
 */
function getClaudeShortcuts(): ShortcutInfo[] {
  return [
    // 基础交互
    {
      id: 'claude_start',
      name: '启动 Claude Code',
      description: '启动 Claude Code 交互模式',
      keys: 'claude',
      category: 'claude',
      group: '基础交互'
    },
    {
      id: 'claude_prompt',
      name: '一次性命令执行',
      description: '快速执行单个任务',
      keys: 'claude "任务描述"',
      category: 'claude',
      group: '基础交互'
    },
    {
      id: 'claude_continue',
      name: '继续上次对话',
      description: '继续上次的对话内容',
      keys: 'claude -c',
      category: 'claude',
      group: '基础交互'
    },
    {
      id: 'claude_update',
      name: '更新客户端',
      description: '更新 Claude Code 客户端',
      keys: 'claude update',
      category: 'claude',
      group: '基础交互'
    },
    {
      id: 'claude_mcp',
      name: '启动 MCP 向导',
      description: '启动 Model Context Protocol 向导',
      keys: 'claude mcp',
      category: 'claude',
      group: '基础交互'
    },
    // 快捷命令
    {
      id: 'claude_help',
      name: '帮助',
      description: '列出所有斜线命令',
      keys: '/help',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_add_dir',
      name: '添加工作目录',
      description: '添加更多工作目录',
      keys: '/add-dir',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_bug',
      name: '报告错误',
      description: '向 Anthropic 报告错误',
      keys: '/bug',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_clear',
      name: '清除聊天记录',
      description: '清除当前对话历史',
      keys: '/clear',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_compact',
      name: '压缩上下文',
      description: '压缩对话上下文以节省 Token',
      keys: '/compact',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_config',
      name: '配置菜单',
      description: '打开配置菜单',
      keys: '/config',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_cost',
      name: 'Token 花费统计',
      description: '查看 Token 使用统计',
      keys: '/cost',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_doctor',
      name: '完整性检查',
      description: '客户端完整性检查',
      keys: '/doctor',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_exit',
      name: '退出',
      description: '退出 Claude Code',
      keys: '/exit',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_init',
      name: '初始化项目',
      description: '初始化项目，生成 CLAUDE.md 全局记忆',
      keys: '/init',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_mcp_list',
      name: 'MCP 列表',
      description: '查看 MCP 列表和状态',
      keys: '/mcp',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_memory',
      name: '编辑记忆',
      description: '编辑 Claude 记忆',
      keys: '/memory',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_model',
      name: '更换模型',
      description: '切换 AI 模型',
      keys: '/model',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_permissions',
      name: '修改工具权限',
      description: '修改工具权限设置',
      keys: '/permissions',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_pr_comments',
      name: '查看 PR 评论',
      description: '查看 Pull Request 评论',
      keys: '/pr_comments',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_review',
      name: '代码审查',
      description: '请求代码审查',
      keys: '/review',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_sessions',
      name: '会话列表',
      description: '列出 sessions 列表',
      keys: '/sessions',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_status',
      name: '系统状态',
      description: '查看系统/账户状态',
      keys: '/status',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_terminal_setup',
      name: '终端设置',
      description: '安装 Shift+Enter 绑定',
      keys: '/terminal-setup',
      category: 'claude',
      group: '快捷命令'
    },
    {
      id: 'claude_vim',
      name: 'Vim 模式',
      description: '切换 vim 模式',
      keys: '/vim',
      category: 'claude',
      group: '快捷命令'
    },
    // Think 模式
    {
      id: 'claude_think',
      name: '基础思考',
      description: '激活基础思考模式（2-5秒）',
      keys: 'think',
      category: 'claude',
      group: 'Think 模式'
    },
    {
      id: 'claude_think_hard',
      name: '深度思考',
      description: '激活深度思考模式（5-15秒）',
      keys: 'think hard',
      category: 'claude',
      group: 'Think 模式'
    },
    {
      id: 'claude_think_harder',
      name: '更深度思考',
      description: '激活更深度思考模式（15-30秒）',
      keys: 'think harder',
      category: 'claude',
      group: 'Think 模式'
    },
    {
      id: 'claude_ultrathink',
      name: '极深度思考',
      description: '激活极深度思考模式（30-60秒）',
      keys: 'ultrathink',
      category: 'claude',
      group: 'Think 模式'
    },
    // 快捷键
    {
      id: 'claude_esc',
      name: '中断操作',
      description: '停止 AI 执行',
      keys: 'ESC',
      category: 'claude',
      group: '快捷键'
    },
    {
      id: 'claude_ctrl_z',
      name: '退出模式',
      description: '返回普通终端',
      keys: 'Ctrl+Z',
      category: 'claude',
      group: '快捷键'
    },
    {
      id: 'claude_ctrl_v',
      name: '粘贴图片',
      description: '直接粘贴截图分析',
      keys: 'Ctrl+V',
      category: 'claude',
      group: '快捷键'
    },
    {
      id: 'claude_ctrl_c',
      name: '强制退出',
      description: '强制终止程序',
      keys: 'Ctrl+C',
      category: 'claude',
      group: '快捷键'
    },
    {
      id: 'claude_tab',
      name: '自动补全',
      description: '补全命令和路径',
      keys: 'Tab',
      category: 'claude',
      group: '快捷键'
    }
  ]
}

/**
 * 获取 OpenSpec 的快捷键
 */
function getOpenSpecShortcuts(): ShortcutInfo[] {
  return [
    // 核心命令
    {
      id: 'openspec_proposal',
      name: '创建变更提案',
      description: '创建新的 OpenSpec 变更提案',
      keys: '/openspec:proposal',
      category: 'openspec',
      group: '核心命令'
    },
    {
      id: 'openspec_apply',
      name: '应用变更',
      description: '应用已批准的 OpenSpec 变更',
      keys: '/openspec:apply',
      category: 'openspec',
      group: '核心命令'
    },
    {
      id: 'openspec_archive',
      name: '归档变更',
      description: '归档已部署的 OpenSpec 变更',
      keys: '/openspec:archive',
      category: 'openspec',
      group: '核心命令'
    },
    // 辅助命令
    {
      id: 'openspec_validate',
      name: '验证变更',
      description: '验证 OpenSpec 变更的正确性',
      keys: 'openspec validate',
      category: 'openspec',
      group: '辅助命令'
    },
    {
      id: 'openspec_list',
      name: '列出变更',
      description: '列出所有 OpenSpec 变更',
      keys: 'openspec list',
      category: 'openspec',
      group: '辅助命令'
    },
    {
      id: 'openspec_show',
      name: '显示详情',
      description: '显示 OpenSpec 变更或规范的详细信息',
      keys: 'openspec show',
      category: 'openspec',
      group: '辅助命令'
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
      size: { width: 480, height: 0 },
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
