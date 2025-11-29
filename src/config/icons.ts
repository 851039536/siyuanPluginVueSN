/**
 * 图标配置模块
 * 统一管理所有功能的图标，方便后续维护和扩展
 */

export interface IconConfig {
  /** 图标名称（Iconify 格式：collection:icon-name） */
  icon: string
  /** 图标颜色（可选，默认继承主题色） */
  color?: string
  /** 图标大小（可选，默认继承父元素） */
  size?: string | number
}

/**
 * 功能图标配置
 * 使用 Iconify 图标库，支持多种图标集
 *
 * 常用图标集：
 * - mdi: Material Design Icons
 * - carbon: IBM Carbon Design System
 * - lucide: Lucide Icons
 * - tabler: Tabler Icons
 * - heroicons: Heroicons
 *
 * 浏览图标：https://icon-sets.iconify.design/
 */
export const FEATURE_ICONS = {
  // 超级面板
  superPanel: {
    icon: 'mdi:view-dashboard',
    color: '#3b82f6'
  },

  // 目录索引
  tableOfContents: {
    icon: 'mdi:format-list-bulleted-square',
    color: '#10b981'
  },

  // 图片压缩
  imageCompressor: {
    icon: 'mdi:image-size-select-actual',
    color: '#f59e0b'
  },

  // 文档导航
  docNavigation: {
    icon: 'mdi:file-tree',
    color: '#8b5cf6'
  },

  // 页面锁定
  pageLock: {
    icon: 'mdi:lock',
    color: '#ef4444'
  },

  // 单词查询
  wordQuery: {
    icon: 'mdi:book-alphabet',
    color: '#06b6d4'
  },

  // 通用设置
  generalSettings: {
    icon: 'mdi:tune',
    color: '#a855f7'
  },

  // 二维码生成
  qrCode: {
    icon: 'mdi:qrcode',
    color: '#6366f1'
  },

  // 单位转换
  unitConverter: {
    icon: 'mdi:calculator',
    color: '#ec4899'
  },

  // 快捷键面板
  shortcuts: {
    icon: 'mdi:keyboard',
    color: '#14b8a6'
  },

  // 本地磁盘浏览器
  diskBrowser: {
    icon: 'mdi:harddisk',
    color: '#f97316'
  }
} as const

/**
 * 通用图标配置
 */
export const COMMON_ICONS = {
  // 操作类
  close: {
    icon: 'mdi:close',
  },
  settings: {
    icon: 'mdi:cog',
  },
  save: {
    icon: 'mdi:content-save',
  },
  cancel: {
    icon: 'mdi:close-circle',
  },
  edit: {
    icon: 'mdi:pencil',
  },
  delete: {
    icon: 'mdi:delete',
  },
  add: {
    icon: 'mdi:plus',
  },
  refresh: {
    icon: 'mdi:refresh',
  },
  // 收藏类
  star: {
    icon: 'mdi:star',
    color: '#fbbf24'
  },
  starOutline: {
    icon: 'mdi:star-outline',
  },

  // 状态类
  success: {
    icon: 'mdi:check-circle',
    color: '#10b981'
  },
  error: {
    icon: 'mdi:alert-circle',
    color: '#ef4444'
  },
  warning: {
    icon: 'mdi:alert',
    color: '#f59e0b'
  },
  info: {
    icon: 'mdi:information',
    color: '#3b82f6'
  },

  // 导航类
  menu: {
    icon: 'mdi:menu',
  },
  back: {
    icon: 'mdi:arrow-left',
  },
  forward: {
    icon: 'mdi:arrow-right',
  },
  up: {
    icon: 'mdi:arrow-up',
  },
  down: {
    icon: 'mdi:arrow-down',
  },

  // 文件类
  file: {
    icon: 'mdi:file-document',
  },
  folder: {
    icon: 'mdi:folder',
  },
  image: {
    icon: 'mdi:image',
  },

  // 其他
  search: {
    icon: 'mdi:magnify',
  },
  filter: {
    icon: 'mdi:filter',
  },
  sort: {
    icon: 'mdi:sort',
  },
  help: {
    icon: 'mdi:help-circle',
  }
} as const

/**
 * 获取图标配置
 */
export function getIconConfig(key: keyof typeof FEATURE_ICONS | keyof typeof COMMON_ICONS): IconConfig {
  return (FEATURE_ICONS as any)[key] || (COMMON_ICONS as any)[key] || { icon: 'mdi:help-circle' }
}

/**
 * 图标类型定义
 */
export type FeatureIconKey = keyof typeof FEATURE_ICONS
export type CommonIconKey = keyof typeof COMMON_ICONS
export type IconKey = FeatureIconKey | CommonIconKey
