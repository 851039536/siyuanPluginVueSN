/**
 * 网站导航 — I18n 接口 + Manager 类 + 公开 API
 * （类型与常量已下沉至 utils/sharedStorage/websiteStorage，直接由共享层导入）
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { closeWebsiteStorage } from "../composables/useWebsiteNavigation"
import WebsiteNavigationPanel from "../index.vue"

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
  categoryName?: string
  add?: string
  openUrl?: string
  copyUrl?: string
  noWebsites?: string
  notFound?: string
  categoryExists?: string
  categoryNotEmpty?: string
  defaultBadge?: string
  createSuccess?: string
  updateSuccess?: string
  deleteSuccess?: string
  saveFailed?: string
  deleteFailed?: string
  urlCopied?: string
  copyFailed?: string
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
    // 实例仍在（面板处于打开状态）时仅复用，避免重复创建遮罩
    // —— 状态栏派发的是 toggle 事件，可能被重复触发。
    // 非持久 Modal 关闭即销毁并置空 this.modal，故正常关闭后再打开会走下方
    // 重建路径，由 onMounted 重新加载数据，不会读到陈旧数据。
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
    // 释放 SQLite 连接（含 WAL 归并），避免插件卸载后句柄残留
    closeWebsiteStorage()
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
