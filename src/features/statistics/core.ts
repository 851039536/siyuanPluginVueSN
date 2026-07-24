// 统计功能核心：Statistics 类（注册 Dock 面板、绑定事件、手动刷新）
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import StatisticsPanel from "./index.vue"

export class Statistics {
  private plugin: Plugin
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
    createVueDockApp(this.plugin, StatisticsPanel, {
      position: "RightBottom",
      width: 350,
      icon: "iconDatabase",
      title: "数据统计",
      type: "statistics-dock",
      i18n: this.plugin.i18n,
      extraProps: {
        onRegisterRefresh: (fn: () => Promise<void>) => {
          this.panelRefreshFn = fn
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
  }
}
