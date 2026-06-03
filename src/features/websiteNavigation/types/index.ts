import type { Plugin } from "siyuan"
import { createModalVueApp, type ModalAppInstance } from "@/utils/vueAppHelper"
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
  private modal: ModalAppInstance | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new WebsiteNavigationStorage(plugin)
  }

  public async init() {
    await this.storage.init()
  }

  public showModal() {
    if (this.modal?.app) {
      this.modal.open()
      return
    }
    this.modal = createModalVueApp(WebsiteNavigationPanel, {
      maskId: "website-navigation-mask",
      width: "70vw",
      height: "80vh",
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

  public getStorage(): WebsiteNavigationStorage {
    return this.storage
  }

  public destroy() {
    this.modal?.close()
    this.modal = null
  }
}

let _instance: WebsiteNavigation | null = null

export function showWebsiteNavigation(plugin?: Plugin) {
  if (!_instance && plugin) {
    _instance = new WebsiteNavigation(plugin)
    _instance.init()
  }
  _instance?.showModal()
}
