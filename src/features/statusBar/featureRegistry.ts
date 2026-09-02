/**
 * 状态栏功能注册表：抽屉展示 + 状态栏快捷 + 点击动作的统一数据源
 * 添加新功能只需在 FEATURES 数组新增一条；title / 处理逻辑不再分散于多处
 */
import type { Plugin } from "siyuan"
import type { FeatureDrawerItem } from "./components/FeatureDrawer.vue"
import { emitCustomEvent } from "@/utils/eventBus"

// ============================================================
// 类型
// ============================================================

export interface FeatureRegistryEntry extends FeatureDrawerItem {
  // 监控项标志：进入「监控」Tab，不参与自定义分类与功能开关
  monitor?: boolean
  // 状态栏快捷项，缺省则不在状态栏显示
  shortcut?: { icon: string, itemClass: string }
  // 点击（抽屉选中或快捷点击）触发的动作（监控项无动作）
  action?: () => void
}

// ============================================================
// i18n 辅助
// ============================================================

// 思源类型将 i18n 声明为扁平 IObject，嵌套命名空间需显式收窄
type I18nShard = Record<string, string>

/** 读取插件的 i18n 分片（嵌套命名空间），缺失时返回空对象 */
export function getI18nShard(plugin: Plugin | undefined, name: string): I18nShard {
  return ((plugin?.i18n as unknown as Record<string, I18nShard>)?.[name]) ?? {}
}

// ============================================================
// 功能注册表
// ============================================================

function buildFeatures(plugin: Plugin): FeatureRegistryEntry[] {
  const quickNoteI18n = getI18nShard(plugin, "quickNote")
  const quickNoteResetI18n = getI18nShard(plugin, "quickNoteReset")
  const imageCreationI18n = getI18nShard(plugin, "imageCreation")
  const globalRelationsI18n = getI18nShard(plugin, "globalRelations")
  const minimalBrowserI18n = getI18nShard(plugin, "minimalBrowser")
  const ideaGeneratorI18n = getI18nShard(plugin, "ideaGenerator")
  const s3FileManagerI18n = getI18nShard(plugin, "s3FileManager")
  const imageCompressorI18n = getI18nShard(plugin, "imageCompressor")
  const bookmarkMarkerI18n = getI18nShard(plugin, "bookmarkMarker")
  const statusBarI18n = getI18nShard(plugin, "statusBar")

  return [
    {
      id: "superPanel",
      icon: "mdi:view-dashboard",
      color: "#3b82f6",
      title: "超级面板",
      pinnable: false,
      action: () => emitCustomEvent("toggleSuperPanel"),
    },
    {
      id: "video",
      icon: "mdi:video",
      color: "#6366f1",
      title: "视频管理器",
      pinnable: true,
      shortcut: {
        icon: "ph:video",
        itemClass: "action-item video-manager-item",
      },
      action: () => emitCustomEvent("openVideoManager"),
    },
    {
      id: "passwordVault",
      icon: "mdi:lock",
      color: "#22c55e",
      title: "密码箱",
      pinnable: true,
      shortcut: {
        icon: "ph:lock-key",
        itemClass: "action-item password-vault-item",
      },
      action: () => emitCustomEvent("openPasswordVault"),
    },
    {
      id: "skillsViewer",
      icon: "mdi:puzzle",
      color: "#f59e0b",
      title: "Skills 查看器",
      pinnable: true,
      shortcut: {
        icon: "ph:puzzle-piece",
        itemClass: "action-item skills-viewer-item",
      },
      action: () => emitCustomEvent("openSkillsViewer"),
    },
    {
      id: "htmlViewer",
      icon: "mdi:language-html5",
      color: "#e67e22",
      title: "HTML 展示",
      pinnable: true,
      shortcut: {
        icon: "ph:code",
        itemClass: "action-item html-viewer-item",
      },
      action: () => emitCustomEvent("openHtmlViewer"),
    },
    {
      id: "formatAssistant",
      icon: "mdi:format-align-left",
      color: "#07c160",
      title: "排版助手",
      pinnable: true,
      shortcut: {
        icon: "ph:text-align-left",
        itemClass: "action-item format-assistant-item",
      },
      action: () => emitCustomEvent("openFormatAssistant"),
    },
    {
      id: "websiteNavigation",
      icon: "mdi:link-variant",
      color: "#8b5cf6",
      title: "网站导航",
      pinnable: true,
      shortcut: {
        icon: "ph:link",
        itemClass: "action-item website-navigation-item",
      },
      action: () => emitCustomEvent("toggleWebsiteNavigation"),
    },
    {
      id: "minimalBrowser",
      icon: "mdi:earth",
      color: "#0ea5e9",
      title: minimalBrowserI18n.title || "极简浏览器",
      pinnable: true,
      shortcut: {
        icon: "mdi:earth",
        itemClass: "action-item minimal-browser-item",
      },
      action: () => emitCustomEvent("openMinimalBrowser"),
    },
    {
      id: "ideaGenerator",
      icon: "mdi:lightbulb-on-outline",
      color: "#9333ea",
      title: ideaGeneratorI18n.title,
      pinnable: true,
      action: () => emitCustomEvent("openIdeaGenerator"),
    },
    {
      id: "imageCreation",
      icon: "mdi:image-text",
      color: "#f59e0b",
      title: imageCreationI18n.title,
      pinnable: false,
      shortcut: {
        icon: "ph:image-square",
        itemClass: "action-item image-creation-item",
      },
      action: () => emitCustomEvent("openImageCreation"),
    },
    {
      id: "s3Backup",
      icon: "mdi:cloud-upload",
      color: "#f59e0b",
      title: plugin?.i18n?.s3Backup || "S3 备份",
      pinnable: true,
      shortcut: {
        icon: "mdi:cloud-upload",
        itemClass: "action-item s3-backup-item",
      },
      action: () => emitCustomEvent("openS3Backup"),
    },
    {
      id: "s3FileManager",
      icon: "mdi:folder-network",
      color: "#0ea5e9",
      title: s3FileManagerI18n.s3FileManager || "S3 文件管理",
      pinnable: true,
      shortcut: {
        icon: "mdi:folder-network",
        itemClass: "action-item s3-file-manager-item",
      },
      action: () => emitCustomEvent("openS3FileManager"),
    },
    {
      id: "globalRelations",
      icon: "mdi:relation-many-to-many",
      color: "#06b6d4",
      title: globalRelationsI18n.panelTitle || "全局关系列表",
      pinnable: true,
      shortcut: {
        icon: "mdi:relation-many-to-many",
        itemClass: "action-item global-relations-item",
      },
      action: () => emitCustomEvent("toggleGlobalRelations"),
    },
    {
      id: "everythingSearch",
      icon: "ph:binoculars",
      color: "#d97706",
      title: "Everything 搜索",
      pinnable: true,
      shortcut: {
        icon: "ph:binoculars",
        itemClass: "action-item everything-search-item",
      },
      action: () => emitCustomEvent("openEverythingSearch"),
    },
    {
      id: "imageCompressor",
      icon: "mdi:image",
      color: "#ef4444",
      title: imageCompressorI18n.title || "图片压缩",
      pinnable: true,
      shortcut: {
        icon: "ph:image",
        itemClass: "action-item image-compressor-item",
      },
      action: () => emitCustomEvent("openImageCompressor"),
    },
    {
      id: "toolCollection",
      icon: "mdi:toolbox-outline",
      color: "#6366f1",
      title: plugin?.i18n?.toolCollection || "工具合集",
      pinnable: true,
      shortcut: {
        icon: "mdi:toolbox-outline",
        itemClass: "action-item tool-collection-item",
      },
      action: () => emitCustomEvent("toggleToolCollection"),
    },
    {
      id: "bookmarkMarker",
      icon: "mdi:bookmark-multiple",
      color: "#10b981",
      title: bookmarkMarkerI18n.title || "书签标记",
      pinnable: true,
      shortcut: {
        icon: "ph:bookmark-simple",
        itemClass: "action-item bookmark-marker-item",
      },
      action: () => emitCustomEvent("openBookmarkMarker"),
    },
    {
      id: "quickNote",
      icon: "mdi:note-edit-outline",
      color: "#f59e0b",
      title: quickNoteI18n.title,
      pinnable: true,
      shortcut: {
        icon: "ph:note-pencil",
        itemClass: "action-item quick-note-item",
      },
      action: () => emitCustomEvent("toggleQuickNote"),
    },
    // 速记恢复：弹窗卡死/位置异常时的应急兜底，点击即复位为居中展开态
    {
      id: "quickNoteReset",
      icon: "ph:arrow-counter-clockwise",
      color: "#f59e0b",
      title: quickNoteResetI18n.title,
      pinnable: false,
      action: () => emitCustomEvent("resetQuickNote"),
    },
    // ========== 状态栏监控项（可固定控制显隐） ==========
    {
      id: "monitor-notes",
      icon: "ph:file-text",
      color: "#3b82f6",
      title: statusBarI18n.monitorNotes || "文档数",
      pinnable: true,
      monitor: true,
    },
    {
      id: "monitor-words",
      icon: "ph:text-aa",
      color: "#8b5cf6",
      title: statusBarI18n.monitorWords || "总字数",
      pinnable: true,
      monitor: true,
    },
    {
      id: "monitor-today",
      icon: "ph:chart-line-up",
      color: "#22c55e",
      title: statusBarI18n.monitorToday || "今日活动",
      pinnable: true,
      monitor: true,
    },
    {
      id: "monitor-cpu",
      icon: "ph:cpu",
      color: "#ef4444",
      title: statusBarI18n.monitorCpu || "CPU 使用率",
      pinnable: true,
      monitor: true,
    },
    {
      id: "monitor-memory",
      icon: "ph:memory",
      color: "#f59e0b",
      title: statusBarI18n.monitorMemory || "内存使用",
      pinnable: true,
      monitor: true,
    },
    {
      id: "monitor-uptime",
      icon: "ph:timer",
      color: "#6b7280",
      title: statusBarI18n.monitorUptime || "运行时间",
      pinnable: true,
      monitor: true,
    },
  ]
}

// ============================================================
// 注册表构建入口
// ============================================================

export function createFeatureRegistry(plugin: Plugin) {
  const features = buildFeatures(plugin)

  // 监控项 ID 集合：由 monitor 标志派生（单一数据源）
  const MONITOR_IDS = new Set(
    features.filter((f) => f.monitor).map((f) => f.id),
  )

  // id → 功能映射，用于点击分发（O(1)）
  const featureMap = new Map(features.map((f) => [f.id, f]))

  return {
    features,
    MONITOR_IDS,
    featureMap,
  }
}
