// 统计功能核心：Statistics 类（注册 Dock 面板、绑定事件、手动/定时刷新）
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { TimerRegistry, type TimerHandle } from "@/utils/timerRegistry"
import StatisticsPanel from "./index.vue"
import type { StatisticsSettings } from "./types/storage"

export class Statistics {
  private plugin: Plugin
  private panelRefreshFn: (() => Promise<void>) | null = null
  private handleOpenStatistics: (() => void) | null = null
  private readonly timers = new TimerRegistry()
  private refreshTimer: TimerHandle | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /** 应用自动刷新设置：开启则按间隔启动定时器，关闭则停止（由 Vue 面板变更设置时调用） */
  applyAutoRefresh(settings: StatisticsSettings): void {
    this.timers.clear(this.refreshTimer)
    this.refreshTimer = null
    if (settings.autoRefreshEnabled && settings.refreshInterval > 0) {
      this.refreshTimer = this.timers.setInterval(() => {
        void this.manualRefresh()
      }, settings.refreshInterval * 60 * 1000)
    }
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
    // 取 statistics 分片，使组件内可用扁平键（i18n.wordsUnit 等）访问
    const pluginI18n = (this.plugin.i18n as Record<string, any>) || {}
    const i18n = pluginI18n.statistics || pluginI18n
    createVueDockApp(this.plugin, StatisticsPanel, {
      position: "RightBottom",
      width: 350,
      icon: "iconDatabase",
      title: i18n.title || "数据统计",
      type: "statistics-dock",
      i18n,
      extraProps: {
        onRegisterRefresh: (fn: () => Promise<void>) => {
          this.panelRefreshFn = fn
        },
        onAutoRefreshChange: (settings: StatisticsSettings) => {
          this.applyAutoRefresh(settings)
        },
      },
    })
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
    this.panelRefreshFn = null
    this.timers.clearAll()
    this.refreshTimer = null
  }
}
