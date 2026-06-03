import { Plugin } from "siyuan"
import {
  createApp,
  App as VueApp,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import StatisticsPanel from "./index.vue"
import { getStatistics } from "./queries"
import { StatisticsStorage } from "./types/storage"
import { formatDate } from "./utils"

export class Statistics {
  private plugin: Plugin
  private storage: StatisticsStorage
  private dockElement: HTMLElement | null = null
  private vueApp: VueApp | null = null
  private panelRefreshFn: (() => Promise<void>) | null = null
  private updateInterval: number = 60000
  private updateTimer: ReturnType<typeof setInterval> | null = null
  private lastUpdateTime: number = 0
  private isCollecting: boolean = false
  private handleOpenStatistics: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new StatisticsStorage(plugin)
  }

  async init(): Promise<void> {
    this.registerDock()

    this.startUpdateTimer()
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

  private startUpdateTimer(immediate: boolean = true): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }

    if (immediate) {
      this.collectAndStoreStatistics()
    }

    this.updateTimer = setInterval(() => {
      this.collectAndStoreStatistics()
    }, this.updateInterval)
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  private async collectAndStoreStatistics(): Promise<void> {
    if (this.isCollecting) return

    const now = Date.now()
    if (now - this.lastUpdateTime < 30000) return

    this.isCollecting = true
    try {
      const stats = await getStatistics("day", {
        dayRange: 7,
        monthYearRange: 1,
        selectedYear: new Date().getFullYear(),
      })

      const today = new Date()
      const dateKey = formatDate(today)
      const existingData = await this.storage.loadHistory()

      existingData[dateKey] = {
        date: formatDate(today),
        dateLabel: `${today.getMonth() + 1}/${today.getDate()}`,
        totalNotes: stats.totalNotes,
        totalWords: stats.totalWords,
        totalBlocks: stats.totalBlocks,
        todayCreated: stats.todayCreated,
        todayModified: stats.todayModified,
        avgWordsPerDoc: stats.avgWordsPerDoc,
      }

      await this.storage.saveHistory(existingData)
      this.lastUpdateTime = now
    } catch (error) {
      console.error("收集统计数据失败:", error)
    } finally {
      this.isCollecting = false
    }
  }

  async manualRefresh(): Promise<void> {
    await this.collectAndStoreStatistics()

    if (this.panelRefreshFn) {
      await this.panelRefreshFn()
    }
  }

  destroy(): void {
    this.stopUpdateTimer()

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
