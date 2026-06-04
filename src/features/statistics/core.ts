import { Plugin } from "siyuan"
import {
  createApp,
  App as VueApp,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import StatisticsPanel from "./index.vue"

export class Statistics {
  private plugin: Plugin
  private dockElement: HTMLElement | null = null
  private vueApp: VueApp | null = null
  private panelRefreshFn: (() => Promise<void>) | null = null
  private handleOpenStatistics: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  async init(): Promise<void> {
    this.registerDock()
    this.bindEvents()
  }

  private bindEvents(): void {
    this.handleOpenStatistics = () => {
      emitCustomEvent("dock-click", { dockId: "statistics-dock" })
    }
    window.addEventListener("openStatistics", this.handleOpenStatistics)
  }

  private registerDock(): void {
    this.plugin.addDock({
      config: {
        position: "RightBottom",
        size: {
          width: 350,
          height: 0,
        },
        icon: "iconDatabase",
        title: "数据统计",
        show: false,
      },
      data: {},
      type: "statistics-dock",
      init: (dock) => {
        this.dockElement = dock.element as HTMLElement
        this.renderDockPanel()
      },
    })
  }

  private async renderDockPanel(): Promise<void> {
    if (!this.dockElement) return

    if (this.vueApp) {
      this.vueApp.unmount()
      this.vueApp = null
    }

    this.dockElement.innerHTML = '<div id="statistics-vue-app"></div>'
    const container = this.dockElement.querySelector("#statistics-vue-app")
    if (!container) return

    this.vueApp = createApp(StatisticsPanel, {
      plugin: this.plugin,
      onRegisterRefresh: (fn: () => Promise<void>) => {
        this.panelRefreshFn = fn
      },
    })

    this.vueApp.mount(container)
  }

  async manualRefresh(): Promise<void> {
    if (this.panelRefreshFn) {
      await this.panelRefreshFn()
    }
  }

  destroy(): void {
    if (this.handleOpenStatistics) {
      window.removeEventListener("openStatistics", this.handleOpenStatistics)
      this.handleOpenStatistics = null
    }

    if (this.vueApp) {
      this.vueApp.unmount()
      this.vueApp = null
    }
    this.panelRefreshFn = null
    this.dockElement = null
  }
}
