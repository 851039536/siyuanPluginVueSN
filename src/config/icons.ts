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
    icon: "mdi:view-dashboard",
    color: "#3b82f6",
  },

  // 目录索引
  tableOfContents: {
    icon: "mdi:format-list-bulleted-square",
    color: "#10b981",
  },

  // 图片压缩
  imageCompressor: {
    icon: "mdi:image",
    color: "#f59e0b",
  },

  // 文档导航
  docNavigation: {
    icon: "mdi:file-tree",
    color: "#8b5cf6",
  },
  docNavParent: {
    icon: "mdi:folder-open",
    color: "#8b5cf6",
  },
  docNavChildren: {
    icon: "mdi:folder-multiple",
    color: "#8b5cf6",
  },

  // 页面锁定
  pageLock: {
    icon: "mdi:lock",
    color: "#ef4444",
  },

  // 单词查询
  wordQuery: {
    icon: "mdi:book",
    color: "#06b6d4",
  },

  // 通用设置
  generalSettings: {
    icon: "mdi:tune",
    color: "#a855f7",
  },

  // 数据备份（已合并到 s3Backup）

  // 二维码生成
  qrCode: {
    icon: "mdi:qrcode",
    color: "#6366f1",
  },

  // 快捷键面板
  shortcuts: {
    icon: "mdi:keyboard",
    color: "#14b8a6",
  },

  // 本地磁盘浏览器
  diskBrowser: {
    icon: "mdi:harddisk",
    color: "#f97316",
  },

  // AI信息生成
  aiContentGenerator: {
    icon: "mdi:robot",
    color: "#9333ea",
  },

  // 数据统计
  statistics: {
    icon: "mdi:chart-bar",
    color: "#0ea5e9",
  },

  // 文档分析
  docAnalysis: {
    icon: "mdi:file-search-outline",
    color: "#0ea5e9",
  },

  // 内容加密
  encryption: {
    icon: "mdi:lock",
    color: "#dc2626",
  },

  // 视频管理器
  video: {
    icon: "mdi:video",
    color: "#e11d48",
  },

  // Everything本地搜索
  everythingSearch: {
    icon: "mdi:file-search",
    color: "#3b82f6",
  },

  // 状态栏
  statusBar: {
    icon: "mdi:monitor-dashboard",
    color: "#8b5cf6",
  },

  // 浮动工具栏
  floatingToolbar: {
    icon: "mdi:format-text",
    color: "#f97316",
  },

  // 悬浮框
  floatingBox: {
    icon: "mdi:widgets",
    color: "#8b5cf6",
  },

  // 文本对比
  textDiff: {
    icon: "mdi:file-compare",
    color: "#06b6d4",
  },

  // 提示词库
  prompts: {
    icon: "mdi:brain",
    color: "#a855f7",
  },

  // Skills 查看器
  skillsViewer: {
    icon: "mdi:puzzle",
    color: "#f59e0b",
  },

  // 主题色
  themeColor: {
    icon: "mdi:palette",
    color: "#d97757",
  },

  // 技能学习
  skillLearning: {
    icon: "mdi:code-braces-box",
    color: "#6366f1",
  },

  // 工具合集
  toolCollection: {
    icon: "mdi:toolbox-outline",
    color: "#6366f1",
  },

  // S3 备份
  s3Backup: {
    icon: "mdi:cloud-upload",
    color: "#f59e0b",
  },

  // 单词阅读
  flashcardReading: {
    icon: "mdi:card-bulleted",
    color: "#f472b6",
  },
  headphones: {
    icon: "mdi:headphones",
    color: "#f472b6",
  },

  // 查询单词
  flashcardQuery: {
    icon: "mdi:magnify",
    color: "#3b82f6",
  },

  // 编程字段翻译
  codeTranslation: {
    icon: "mdi:code-json",
    color: "#8b5cf6",
  },

  // 书签标记
  bookmarkMarker: {
    icon: "mdi:bookmark-multiple",
    color: "#10b981",
  },

  // API调试器
  apiDebugger: {
    icon: "mdi:flask",
    color: "#0ea5e9",
  },
  websiteNavigation: {
    icon: "mdi:web",
    color: "#6366f1",
  },
  scriptLauncher: {
    icon: "mdi:script-text-outline",
    color: "#f59e0b",
  },
  // 图片生成
  imageCreation: {
    icon: "mdi:image-text",
    color: "#f59e0b",
  },
  // 数据快照
  dataSnapshot: {
    icon: "mdi:camera-marker",
    color: "#0ea5e9",
  },
  // Git 推送
  gitPush: {
    icon: "mdi:source-repository",
    color: "#f05032",
  },
  // 代码块设置
  codeBlockEnable: {
    icon: "mdi:star-four-points",
    color: "#fbbf24",
  },
  codeBlockStyle: {
    icon: "mdi:palette-swatch",
    color: "#a855f7",
  },
  codeBlockDefault: {
    icon: "mdi:file-document-outline",
  },
  codeBlockGithub: {
    icon: "mdi:github",
  },
  codeBlockMac: {
    icon: "mdi:apple",
  },
  codeBlockAdvanced: {
    icon: "mdi:cog-outline",
    color: "#8b5cf6",
  },
  codeBlockBackground: {
    icon: "mdi:image-outline",
  },
  codeBlockBorder: {
    icon: "mdi:border-outside",
  },
  codeBlockShadow: {
    icon: "mdi:circle-opacity",
  },
  codeBlockFont: {
    icon: "mdi:format-font",
  },
  codeBlockColor: {
    icon: "mdi:palette",
  },
  codeBlockCollapse: {
    icon: "mdi:package-variant-closed",
  },
  codeBlockHeight: {
    icon: "mdi:ruler",
  },

  // 表格样式
  tableBorder: {
    icon: "mdi:border-outside",
  },
  tableCell: {
    icon: "mdi:border-all",
  },
  tableHeader: {
    icon: "mdi:table-headers-eye",
  },
  tableRowOdd: {
    icon: "mdi:table-row",
  },
  tableRowEven: {
    icon: "mdi:table-row-plus-after",
  },
  tableTextColor: {
    icon: "mdi:format-color-text",
  },
  borderRadius: {
    icon: "mdi:rounded-corner",
  },
  starFourPoints: {
    icon: "mdi:star-four-points",
    color: "#fbbf24",
  },
} as const

/**
 * 通用图标配置
 */
export const COMMON_ICONS = {
  // 操作类
  close: {
    icon: "mdi:close",
  },
  x: {
    icon: "mdi:close",
  },
  settings: {
    icon: "mdi:cog",
  },
  save: {
    icon: "mdi:content-save",
  },
  cancel: {
    icon: "mdi:close-circle",
  },
  edit: {
    icon: "mdi:pencil",
  },
  delete: {
    icon: "mdi:delete",
  },
  add: {
    icon: "mdi:plus",
  },
  plus: {
    icon: "mdi:plus",
  },
  copy: {
    icon: "mdi:content-copy",
  },
  refresh: {
    icon: "mdi:refresh",
  },
  refreshLeft: {
    icon: "mdi:undo",
  },
  loading: {
    icon: "mdi:loading",
  },
  // 收藏类
  star: {
    icon: "mdi:star",
    color: "#fbbf24",
  },
  starOutline: {
    icon: "mdi:star-outline",
  },

  // 状态类
  success: {
    icon: "mdi:check-circle",
    color: "#10b981",
  },
  error: {
    icon: "mdi:alert-circle",
    color: "#ef4444",
  },
  warning: {
    icon: "mdi:alert",
    color: "#f59e0b",
  },
  info: {
    icon: "mdi:information",
    color: "#3b82f6",
  },

  // 导航类
  menu: {
    icon: "mdi:menu",
  },
  back: {
    icon: "mdi:arrow-left",
  },
  forward: {
    icon: "mdi:arrow-right",
  },
  up: {
    icon: "mdi:arrow-up",
  },
  down: {
    icon: "mdi:arrow-down",
  },
  chevronLeft: {
    icon: "mdi:chevron-left",
  },
  chevronRight: {
    icon: "mdi:chevron-right",
  },
  shuffle: {
    icon: "mdi:shuffle-variant",
  },
  swapVertical: {
    icon: "mdi:swap-vertical",
  },
  skipNext: {
    icon: "mdi:skip-next",
  },

  // 文件类
  file: {
    icon: "mdi:file-document",
  },
  folder: {
    icon: "mdi:folder",
  },
  image: {
    icon: "mdi:image",
  },

  // 其他
  search: {
    icon: "mdi:magnify",
  },
  filter: {
    icon: "mdi:filter",
  },
  sort: {
    icon: "mdi:sort",
  },
  help: {
    icon: "mdi:help-circle",
  },
  eye: {
    icon: "mdi:eye",
  },
  eyeOff: {
    icon: "mdi:eye-off",
  },

  // 列表相关
  list: {
    icon: "mdi:format-list-bulleted",
  },
  listBulleted: {
    icon: "mdi:format-list-bulleted",
  },
  listOrdered: {
    icon: "mdi:format-list-numbered",
  },
  textBox: {
    icon: "mdi:text-box",
  },
  contentCopy: {
    icon: "mdi:content-copy",
  },
  starCircle: {
    icon: "mdi:star-circle",
  },
  chevronUp: {
    icon: "mdi:chevron-up",
  },
  chevronDown: {
    icon: "mdi:chevron-down",
  },
  download: {
    icon: "mdi:download",
  },
  fileCopy: {
    icon: "mdi:file-document-multiple",
  },
  openInNew: {
    icon: "mdi:open-in-new",
  },

  // 编程翻译相关
  code: {
    icon: "mdi:code-braces",
  },
  format: {
    icon: "mdi:format-text",
  },
  formatSize: {
    icon: "mdi:format-size",
  },
  lightbulb: {
    icon: "mdi:lightbulb",
  },
  regex: {
    icon: "mdi:regex",
    color: "#f97316",
  },
  sparkles: {
    icon: "mdi:auto-fix",
    color: "#a855f7",
  },
  codeComment: {
    icon: "mdi:comment-text",
  },
  browser: {
    icon: "mdi:web",
  },
  play: {
    icon: "mdi:play",
  },
} as const

/**
 * 获取图标配置
 */
export function getIconConfig(
  key: keyof typeof FEATURE_ICONS | keyof typeof COMMON_ICONS,
): IconConfig {
  return (
    (FEATURE_ICONS as any)[key]
    || (COMMON_ICONS as any)[key] || { icon: "mdi:help-circle" }
  )
}

/**
 * 图标类型定义
 */
export type FeatureIconKey = keyof typeof FEATURE_ICONS
export type CommonIconKey = keyof typeof COMMON_ICONS
export type IconKey = FeatureIconKey | CommonIconKey
