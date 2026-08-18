/**
 * 极简浏览器 — 导航状态 composable（模块级单例）
 * 维护地址栏/历史栈/收藏数据/主页设置，供 Toolbar/FavoritesSidebar/SettingsDialog 共享
 */
import type { Plugin } from "siyuan"
import type {
  WebsiteCategory,
  WebsiteEntry,
} from "@/utils/sharedStorage/websiteStorage"
import { WebsiteNavigationStorage } from "@/utils/sharedStorage/websiteStorage"
import {
  ref,
  shallowRef,
} from "vue"
import type { BrowserSettings } from "../types/storage"
import {
  BrowserSettingsStorage,
  DEFAULT_BROWSER_SETTINGS,
} from "../types/storage"

let storage: WebsiteNavigationStorage | null = null
let settingsStorage: BrowserSettingsStorage | null = null

function requireStorage(): WebsiteNavigationStorage {
  if (!storage) {
    throw new Error("[MinimalBrowser] website storage not initialized")
  }
  return storage
}

function requireSettingsStorage(): BrowserSettingsStorage {
  if (!settingsStorage) {
    throw new Error("[MinimalBrowser] settings storage not initialized")
  }
  return settingsStorage
}

export const entries = ref<WebsiteEntry[]>([])
export const categories = ref<WebsiteCategory[]>([])
/** 浏览器设置（主页/侧栏宽度） */
export const browserSettings = ref<BrowserSettings>({ ...DEFAULT_BROWSER_SETTINGS })

/** 当前 iframe 元素引用（导航/刷新共用） */
export const frameRef = shallowRef<HTMLIFrameElement | null>(null)
/** 当前 URL（用户输入后立即更新，iframe onload 后校正） */
export const currentUrl = ref("")
/** 历史栈游标 */
export const historyIndex = ref(-1)
/** 历史栈（iframe onload 时推进） */
export const historyStack = ref<string[]>([])
/** 页面加载中标记 */
export const loading = ref(false)
/** 侧栏拖拽缩放中标记（拖拽期间禁用 iframe 交互，避免鼠标事件被 iframe 吞掉） */
export const sidebarResizing = ref(false)

/**
 * 初始化数据层：仅在面板 setup 中调用一次。
 * 子组件直接复用模块级 refs 与 CRUD 函数，避免各自创建 Storage。
 */
export function useBrowserState(plugin: Plugin) {
  if (!storage) {
    storage = new WebsiteNavigationStorage(plugin)
  }
  if (!settingsStorage) {
    settingsStorage = new BrowserSettingsStorage(plugin)
  }

  return {
    storage,
    settingsStorage,
  }
}

/** 加载收藏与分类，返回是否成功 */
export async function loadFavorites(): Promise<boolean> {
  try {
    const [nextEntries, nextCategories] = await Promise.all([
      requireStorage().getAllEntries(),
      requireStorage().getCategories(),
    ])
    entries.value = nextEntries
    categories.value = nextCategories
    return true
  } catch (error) {
    console.error("[MinimalBrowser] load favorites failed:", error)
    return false
  }
}

/** 启动即加载主页设置（设置面板只负责修改） */
export async function loadBrowserSettings(): Promise<boolean> {
  try {
    browserSettings.value = await requireSettingsStorage().loadOrDefault()
    return true
  } catch (error) {
    console.error("[MinimalBrowser] load settings failed:", error)
    return false
  }
}

/** 保存设置（调用方需传入完整对象，避免覆盖其他字段） */
export async function saveBrowserSettings(next: BrowserSettings): Promise<boolean> {
  const ok = await requireSettingsStorage().save(next)
  if (ok) {
    browserSettings.value = next
  }
  return ok
}

/**
 * 保存侧栏宽度（钳制在 [140, 480] 区间）。
 * 基于当前设置合并保存，防止覆盖主页等其他字段。
 */
export async function saveSidebarWidth(width: number): Promise<boolean> {
  const clamped = Math.min(480, Math.max(140, Math.round(width)))
  return saveBrowserSettings({
    ...browserSettings.value,
    sidebarWidth: clamped,
  })
}

/** 分类 ID → 分类 映射缓存 */
export function getCategoryById(id: string): WebsiteCategory | undefined {
  return categories.value.find((c) => c.id === id)
}

/** 当前 URL 是否已收藏 */
export function isFavorite(url: string): WebsiteEntry | null {
  const target = normalizeUrl(url)
  if (!target) return null
  return entries.value.find((e) => normalizeUrl(e.url) === target) ?? null
}

/** 收藏当前页；重名/空名不拦截（URL 为唯一性依据），持久化失败抛出异常 */
export async function addFavorite(name: string, url: string, category = "default"): Promise<WebsiteEntry> {
  const entry = await requireStorage().createEntry({
    name: name.trim() || url,
    url,
    category,
    description: "",
  })
  entries.value = [...entries.value, entry]
  return entry
}

/** 取消收藏（按条目 id），持久化失败抛出异常 */
export async function removeFavorite(id: string): Promise<boolean> {
  const ok = await requireStorage().deleteEntry(id)
  if (!ok) return false
  entries.value = entries.value.filter((e) => e.id !== id)
  return true
}

/** 重命名收藏 */
export async function renameFavorite(id: string, name: string): Promise<boolean> {
  const updated = await requireStorage().updateEntry(id, { name: name.trim() })
  if (!updated) return false
  entries.value = entries.value.map((e) => (e.id === id ? updated : e))
  return true
}

/** 规范化 URL：无协议时补 https，用于收藏去重比较 */
export function normalizeUrl(input: string): string {
  let value = input.trim()
  if (!value) return ""
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    value = `https://${value}`
  }
  try {
    return new URL(value).href
  } catch {
    return value.toLowerCase()
  }
}

/** 校验是否为可浏览的 http(s) 地址（返回规范化后的地址或 null） */
export function resolveBrowsableUrl(input: string): string | null {
  const value = normalizeUrl(input)
  if (!value) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : null
  } catch {
    return null
  }
}

/** 提取 hostname 作为标题兜底 */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** 导航到指定地址（更新地址栏 + 触发 iframe 加载） */
export function navigate(url: string, options: { pushHistory?: boolean, fromHistory?: boolean } = {}) {
  const resolved = resolveBrowsableUrl(url)
  if (!resolved) return false
  const frame = frameRef.value
  if (!frame) return false

  currentUrl.value = resolved
  if (!options.fromHistory) {
    // 截断前进分支后追加新地址
    historyStack.value = [...historyStack.value.slice(0, historyIndex.value + 1), resolved]
    historyIndex.value = historyStack.value.length - 1
  }
  if (frame.src !== resolved) {
    loading.value = true
    frame.src = resolved
  }
  return true
}

/** 后退 */
export function goBack() {
  if (historyIndex.value <= 0) return false
  historyIndex.value -= 1
  const target = historyStack.value[historyIndex.value]
  const frame = frameRef.value
  if (!frame || !target) return false
  currentUrl.value = target
  loading.value = true
  frame.src = target
  return true
}

/** 前进 */
export function goForward() {
  if (historyIndex.value >= historyStack.value.length - 1) return false
  historyIndex.value += 1
  const target = historyStack.value[historyIndex.value]
  const frame = frameRef.value
  if (!frame || !target) return false
  currentUrl.value = target
  loading.value = true
  frame.src = target
  return true
}

/** 刷新当前页 */
export function refreshPage() {
  const frame = frameRef.value
  const url = currentUrl.value
  if (!frame || !url) return false
  loading.value = true
  frame.src = url
  return true
}

/** 主页：设置的主页 URL；未配置时返回 null（面板展示收藏列表作为起始页） */
export function resolveHomeUrl(): string | null {
  return resolveBrowsableUrl(browserSettings.value.homeUrl || "")
}
