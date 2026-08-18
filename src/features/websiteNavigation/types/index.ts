/**
 * 网站导航 — 类型定义 + Manager 类 + 公开 API
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import WebsiteNavigationPanel from "../index.vue"

// 数据模型下沉至共享层（utils/sharedStorage/websiteStorage），
// 网站导航与极简浏览器共用同一份类型与存储；此处保持原有导出名不变
export type {
  CreateWebsiteDTO,
  UpdateWebsiteDTO,
  WebsiteCategory,
  WebsiteEntry,
} from "@/utils/sharedStorage/websiteStorage"

export {
  ALL_CATEGORY_ID,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ID,
  PRESET_CATEGORY_COLORS,
} from "./constants"

export interface I18n {
  panelTitle?: string
  title?: string
  addWebsite?: string
  editWebsite?: string
  deleteWebsite?: string
  category?: string
  allCategories?: string
  name?: string
  url?: string
  description?: string
  namePlaceholder?: string
  urlPlaceholder?: string
  descriptionPlaceholder?: string
  searchPlaceholder?: string
  confirmDelete?: string
  save?: string
  cancel?: string
  manageCategories?: string
  newCategory?: string
  categoryName?: string
  add?: string
  openUrl?: string
  copyUrl?: string
  noWebsites?: string
  notFound?: string
  categoryExists?: string
  categoryNotEmpty?: string
  defaultBadge?: string
  loadFailed?: string
  saveSuccess?: string
  createSuccess?: string
  updateSuccess?: string
  deleteSuccess?: string
  saveFailed?: string
  deleteFailed?: string
  urlCopied?: string
  uncategorized?: string
}

/**
 * Manager：管理 modal 生命周期。
 * 数据存储由 composables/useWebsiteNavigation.ts 统一负责。
 */
export class WebsiteNavigation {
  private plugin: Plugin
  private modal: ModalAppInstance | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  public showModal() {
    if (this.modal?.app) {
      this.modal.open()
      return
    }
    this.modal = createModalVueApp(WebsiteNavigationPanel, {
      maskId: "website-navigation-mask",
      width: "min(42vw, 630px)",
      height: "75vh",
      getCloseHandler: () => () => this.closeModal(),
      buildProps: () => ({
        plugin: this.plugin,
        i18n: (this.plugin.i18n?.websiteNavigation as I18n) || ({} as I18n),
        onClose: () => this.closeModal(),
      }),
    })
    this.modal.open()
  }

  private closeModal() {
    this.modal?.close()
    this.modal = null
  }

  public destroy() {
    this.modal?.destroy()
    this.modal = null
  }
}

let _instance: WebsiteNavigation | null = null

/** 公共 API：显示网站导航弹窗 */
export function showWebsiteNavigation(plugin?: Plugin) {
  const mounted = plugin
    ? (plugin as any).__websiteNavigation as WebsiteNavigation | undefined
    : undefined
  if (mounted) {
    mounted.showModal()
    return
  }

  if (!_instance && plugin) {
    _instance = new WebsiteNavigation(plugin)
  }
  _instance?.showModal()
}
