// 统计功能核心：Statistics 类（注册 Dock 面板、绑定事件、启动预载、定时/手动刷新）
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { TimerRegistry, type TimerHandle } from "@/utils/timerRegistry"
import {
  refreshStatisticsData,
  setStatisticsI18n,
} from "./composables/useStatistics"
import StatisticsPanel from "./index.vue"
import type { StatisticsSettings } from "./types/storage"

export class Statistics {
  private plugin: Plugin
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
    // 注入状态栏文案（Dock 懒加载，面板挂载晚于启动，需 core 侧先注入）
    const pluginI18n = (this.plugin.i18n as Record<string, any>) || {}
    setStatisticsI18n(pluginI18n.statistics || pluginI18n)
    this.registerDock()
    this.bindEvents()
    // 启动预载：Dock init 懒加载，面板 onMounted 不会在启动时触发，需在此主动刷新一次
    void this.preload()
  }

  /**
   * 启动预载统计数据：插件加载即刷新一次（底部状态栏可见），
   * 面板首次展开时直接显示预载结果，无需等待
   */
  async preload(): Promise<void> {
    try {
      await refreshStatisticsData()
    } catch (error) {
      console.error("启动预载统计数据失败:", error)
    }
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
        onAutoRefreshChange: (settings: StatisticsSettings) => {
          this.applyAutoRefresh(settings)
        },
      },
    })
  }

  async manualRefresh(): Promise<void> {
    await refreshStatisticsData()
  }

  destroy(): void {
    if (this.handleOpenStatistics) {
      window.removeEventListener("openStatistics", this.handleOpenStatistics)
      this.handleOpenStatistics = null
    }
    this.timers.clearAll()
    this.refreshTimer = null
  }
}
