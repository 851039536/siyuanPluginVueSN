/**
 * 状态栏功能注册表：抽屉展示 + 状态栏快捷 + 点击动作的统一数据源
 *
 * 元数据（title / icon / color）**不再本地维护**，而是从项目单一数据源派生：
 * - title ← `FEATURE_CONFIG[].defaultTitle`（i18n 经 `titleI18nKey` 解析）
 * - icon / color ← `FEATURE_ICONS[id]`（真源）
 * 本文件只声明「状态栏独有的增量信息」：收录白名单、状态栏快捷图标与类名、监控项。
 *
 * 新增可 pin 功能 = 在 DRAWER_FEATURE_IDS 加一个 id（其余自动继承）。
 */
import type { Plugin } from "siyuan"
import type { IconKey } from "@/components/kit/icons"
import { FEATURE_ICONS } from "@/config/icons"
import type { FeatureMeta } from "@/features/config"
import { FEATURE_CONFIG } from "@/features/config"
import { emitCustomEvent } from "@/utils/eventBus"
import type { FeatureRegistryEntry } from "./types"

// ============================================================
// i18n 辅助
// ============================================================

/**
 * 读取插件的 i18n 分片（嵌套命名空间），缺失时返回空对象。
 * 仅用于 profile/statusBar 等「分片自身」作用域下的取值。
 */
function getI18nShard(plugin: Plugin | undefined, name: string): Record<string, string> {
  return ((plugin?.i18n as unknown as Record<string, Record<string, string>>)?.[name]) ?? {}
}

/**
 * 按点号路径解析 i18n 文案（值必须是字符串；对象/缺失一律视为不可用）。
 * `FEATURE_CONFIG.titleI18nKey` 存在三种形态：点号路径（`s3FileManager.s3FileManager`）、
 * 顶层分片名（`s3Backup`）、以及缺省（此时回退 `defaultTitle`）。
 */
function resolveI18nText(i18n: Record<string, unknown>, key: string): string | undefined {
  const value = key.includes(".")
    ? key.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], i18n)
    : i18n[key]
  return typeof value === "string" && value ? value : undefined
}

// ============================================================
// 状态栏独有的增量声明
// ============================================================

/** 抽屉收录的功能 id（顺序即抽屉内展示顺序；未列出的功能不进抽屉） */
const DRAWER_FEATURE_IDS = [
  "superPanel",
  "video",
  "passwordVault",
  "skillsViewer",
  "htmlViewer",
  "formatAssistant",
  "websiteNavigation",
  "minimalBrowser",
  "ideaGenerator",
  "imageCreation",
  "s3Backup",
  "s3FileManager",
  "globalRelations",
  "everythingSearch",
  "imageCompressor",
  "toolCollection",
  "componentPreview",
  "bookmarkMarker",
  "quickNote",
] as const

/**
 * 状态栏快捷项图标覆盖：默认取功能自身图标，需与抽屉内的功能图标区分时在此覆盖。
 * 值为 `IconKey`（图标键名，非 iconify 字符串）—— 由 `IconWrapper` 经 `getIconConfig` 解析。
 */
const SHORTCUT_ICONS: Partial<Record<string, IconKey>> = {
  video: "videoOutline",
  passwordVault: "lockKey",
  skillsViewer: "puzzlePiece",
  htmlViewer: "codeOutline",
  formatAssistant: "textAlignLeft",
  websiteNavigation: "linkOutline",
  imageCreation: "imageSquare",
  everythingSearch: "binoculars",
  imageCompressor: "imageOutline",
  bookmarkMarker: "bookmarkOutline",
  quickNote: "notePencil",
}

/**
 * 点击动作事件名（**不能**取自 `FEATURE_CONFIG.actions[].key`）。
 *
 * 原因：`actions[].key` 是「面板动作标识」，与本模块需要派发的 window 事件名**并非同一套**——
 * - `imageCompressor`：action `openCompressor` vs 事件 `openImageCompressor`
 * - `globalRelations`：action `openGlobalRelations` vs 事件 `toggleGlobalRelations`
 * - 另有 9 个功能（superPanel/passwordVault/skillsViewer/htmlViewer/websiteNavigation/
 *   s3Backup/toolCollection/quickNote/imageCreation）在 FEATURE_CONFIG 中**无 actions[]**，
 *   但其事件名客观存在且被 App.vue / 各功能监听。
 *
 * 故此处显式登记事件名（等价于原实现的 20 个 emitCustomEvent，但集中为一张表）。
 */
const FEATURE_EVENTS: Record<string, string> = {
  superPanel: "toggleSuperPanel",
  video: "openVideoManager",
  passwordVault: "openPasswordVault",
  skillsViewer: "openSkillsViewer",
  htmlViewer: "openHtmlViewer",
  formatAssistant: "openFormatAssistant",
  websiteNavigation: "toggleWebsiteNavigation",
  minimalBrowser: "openMinimalBrowser",
  ideaGenerator: "openIdeaGenerator",
  imageCreation: "openImageCreation",
  s3Backup: "openS3Backup",
  s3FileManager: "openS3FileManager",
  globalRelations: "toggleGlobalRelations",
  everythingSearch: "openEverythingSearch",
  imageCompressor: "openImageCompressor",
  toolCollection: "toggleToolCollection",
  componentPreview: "openComponentPreview",
  bookmarkMarker: "openBookmarkMarker",
  quickNote: "toggleQuickNote",
}

/** 不可 pin 的功能（抽屉可点开，但不提供固定到状态栏） */
const NOT_PINNABLE = new Set(["superPanel", "imageCreation"])

/** goodsId → goods-id（快捷项配色类名由 SCSS 按同规则定义） */
function toKebab(id: string): string {
  return id.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

function buildFeatureEntry(
  meta: FeatureMeta,
  i18n: Record<string, unknown>,
): FeatureRegistryEntry {
  // FEATURE_ICONS 的键名与功能 id 一致，故图标键名即 id（与 superPanel 的 `iconKey: id` 同法）
  const iconKey = meta.id as IconKey
  const iconConfig = (FEATURE_ICONS as Record<string, { color?: string }>)[meta.id]
  const title = (meta.titleI18nKey ? resolveI18nText(i18n, meta.titleI18nKey) : undefined)
    ?? meta.defaultTitle
  const event = FEATURE_EVENTS[meta.id]
  const pinnable = !NOT_PINNABLE.has(meta.id)

  return {
    id: meta.id,
    icon: iconKey,
    // 配色取自 FEATURE_ICONS 真源；缺省回退主题主色（不再依赖「itemClass 是否有对应 SCSS 规则」）
    color: iconConfig?.color ?? "var(--b3-theme-primary)",
    title,
    pinnable,
    ...(pinnable
      ? {
          shortcut: {
            icon: SHORTCUT_ICONS[meta.id] ?? iconKey,
            itemClass: `action-item ${toKebab(meta.id)}-item`,
          },
        }
      : {}),
    ...(event ? { action: () => emitCustomEvent(event) } : {}),
  }
}

/** 状态栏监控项（本模块自有，不来自 FEATURE_CONFIG） */
function buildMonitorEntries(statusBarI18n: Record<string, string>): FeatureRegistryEntry[] {
  const defs: { id: string, icon: IconKey, color: string, labelKey: string }[] = [
    { id: "monitor-notes", icon: "fileText", color: "#3b82f6", labelKey: "monitorNotes" },
    { id: "monitor-words", icon: "textAa", color: "#8b5cf6", labelKey: "monitorWords" },
    { id: "monitor-today", icon: "chartLineUp", color: "#22c55e", labelKey: "monitorToday" },
    { id: "monitor-cpu", icon: "cpuChip", color: "#ef4444", labelKey: "monitorCpu" },
    { id: "monitor-memory", icon: "memoryChip", color: "#f59e0b", labelKey: "monitorMemory" },
    { id: "monitor-uptime", icon: "timerOutline", color: "#6b7280", labelKey: "monitorUptime" },
  ]
  return defs.map((d) => ({
    id: d.id,
    icon: d.icon,
    color: d.color,
    title: statusBarI18n[d.labelKey] ?? d.id,
    pinnable: true,
    monitor: true,
  }))
}

// ============================================================
// 注册表构建入口
// ============================================================

function buildFeatures(plugin: Plugin): FeatureRegistryEntry[] {
  const i18n = (plugin?.i18n ?? {}) as Record<string, unknown>
  const metaById = new Map((FEATURE_CONFIG as readonly FeatureMeta[]).map((m) => [m.id, m]))

  const drawerEntries = DRAWER_FEATURE_IDS
    .map((id) => metaById.get(id))
    .filter((m): m is FeatureMeta => !!m)
    .map((meta) => buildFeatureEntry(meta, i18n))

  // 速记恢复：弹窗卡死/位置异常时的应急兜底，点击即复位为居中展开态
  // （statusBar 独有动作，FEATURE_CONFIG 未收录，故在此外挂）
  const quickNoteResetI18n = getI18nShard(plugin, "quickNoteReset")
  drawerEntries.push({
    id: "quickNoteReset",
    icon: "counterClockwise",
    color: "#f59e0b",
    // 不做 `|| "速记恢复"` 兜底：quickNoteReset.title 在 zh_CN/en_US 均已存在，
    // 兜底只会在 i18n 未加载时掩盖问题（AGENTS_I18N.md 禁止硬编码兜底）
    title: quickNoteResetI18n.title,
    pinnable: false,
    action: () => emitCustomEvent("resetQuickNote"),
  })

  return [...drawerEntries, ...buildMonitorEntries(getI18nShard(plugin, "statusBar"))]
}

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
