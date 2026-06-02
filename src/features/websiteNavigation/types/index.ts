import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import WebsiteNavigationPanel from "../index.vue"
import { WebsiteNavigationStorage } from "./storage"

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
  loadFailed?: string
  saveSuccess?: string
  createSuccess?: string
  updateSuccess?: string
  deleteSuccess?: string
  saveFailed?: string
  deleteFailed?: string
  urlCopied?: string
}

export class WebsiteNavigation {
  private plugin: Plugin
  private storage: WebsiteNavigationStorage

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new WebsiteNavigationStorage(plugin)
  }

  public async init() {
    await this.storage.init()
    this.addDock()
  }

  private addDock() {
    createVueDockApp(this.plugin, WebsiteNavigationPanel, {
      position: "RightTop",
      width: 400,
      icon: "iconLink",
      title:
        (this.plugin.i18n as any)?.websiteNavigation?.panelTitle || "网站导航",
      type: "websitenavigation-dock",
      i18n:
        (this.plugin.i18n?.websiteNavigation as I18n) || ({} as I18n),
    })
  }

  public getStorage(): WebsiteNavigationStorage {
    return this.storage
  }

  public destroy() {}
}
