/**
 * 网站导航 — 类型定义 + Manager 类 + 公开 API
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import WebsiteNavigationPanel from "../index.vue"

export interface WebsiteEntry {
  id: string
  name: string
  url: string
  category: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface CreateWebsiteDTO {
  name: string
  url: string
  category: string
  description: string
}

export interface UpdateWebsiteDTO {
  name?: string
  url?: string
  category?: string
  description?: string
}

export interface WebsiteCategory {
  id: string
  name: string
  color: string
}

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
      getCloseHandler: () => () => {
        this.modal?.close()
        this.modal = null
      },
      buildProps: () => ({
        plugin: this.plugin,
        i18n: (this.plugin.i18n?.websiteNavigation as I18n) || ({} as I18n),
      }),
    })
    this.modal.open()
  }
}

let _instance: WebsiteNavigation | null = null

/** 公共 API：显示网站导航弹窗 */
export function showWebsiteNavigation(plugin?: Plugin) {
  if (!_instance && plugin) {
    _instance = new WebsiteNavigation(plugin)
  }
  _instance?.showModal()
}
