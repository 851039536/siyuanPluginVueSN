import { Plugin } from "siyuan"
import {
  createApp,
  App as VueApp,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import StatisticsPanel from "./index.vue"
import { StatisticsStorage } from "./types/storage"
import { formatDate } from "./utils"
import {
  getDateChangedDocs,
  getDateRangeChangeStats,
  getNotebookActivityTrend,
  getNotebookDocStats,
  getNotebookWordStats,
  getReportData,
  getStatistics,
  getTrendPrediction,
} from "./queries"

export class Statistics {
  private plugin: Plugin
  private storage: StatisticsStorage
  private dockElement: HTMLElement | null = null
  private vueApp: VueApp | null = null
  private panelRefreshFn: (() => Promise<void>) | null = null
  private viewMode: "day" | "week" | "month" | "year" | "trend" = "day"
  private dayRange: 7 | 15 | 30 | 90 | 180 | 365 = 7
  private monthYearRange: 1 | 2 | 3 = 1
  private selectedYear: number = new Date().getFullYear()
  private updateInterval: number = 60000
  private updateTimer: NodeJS.Timeout | null = null
  private lastUpdateTime: number = 0
  private isCollecting: boolean = false
  private handleOpenStatistics: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new StatisticsStorage(plugin)
  }

  async init() {
    this.registerDock()

    try {
      const settings = await this.storage.loadSettings()
      if (settings.statisticsUpdateInterval) {
        this.updateInterval = settings.statisticsUpdateInterval
      }
    } catch (error) {
      console.error("加载设置失败:", error)
    }

    this.startUpdateTimer()
    this.bindEvents()
  }

  private bindEvents(): void {
    this.handleOpenStatistics = () => {
      emitCustomEvent("dock-click", { dockId: "statistics-dock" })
    }
    window.addEventListener("openStatistics", this.handleOpenStatistics)
  }

  private registerDock() {
    this.plugin.addDock({
      config: {
        position: "RightBottom",
        size: { width: 350, height: 0 },
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

  private async renderDockPanel() {
    if (!this.dockElement) return

    if (this.vueApp) {
      this.vueApp.unmount()
      this.vueApp = null
    }

    this.dockElement.innerHTML = '<div id="statistics-vue-app"></div>'
    const container = this.dockElement.querySelector("#statistics-vue-app")
    if (!container) return

    this.vueApp = createApp(StatisticsPanel, {
      onRefresh: async (params: {
        viewMode: "day" | "week" | "month" | "year" | "trend"
        dayRange?: 7 | 15 | 30 | 90 | 180 | 365
        monthYearRange?: 1 | 2 | 3
        selectedYear?: number
      }) => {
        this.viewMode = params.viewMode
        if (params.dayRange) this.dayRange = params.dayRange
        if (params.monthYearRange) this.monthYearRange = params.monthYearRange
        if (params.selectedYear !== undefined) this.selectedYear = params.selectedYear

        return await getStatistics(this.viewMode, {
          dayRange: this.dayRange,
          monthYearRange: this.monthYearRange,
          selectedYear: this.selectedYear,
        })
      },
      onGetHistoricalData: async (days?: number) => {
        return await this.getHistoricalStatistics(days)
      },
      onGetNotebookDocStats: async () => {
        return await getNotebookDocStats()
      },
      onGetDateChangedDocs: async (dateStr: string) => {
        return await getDateChangedDocs(dateStr)
      },
      onGetDateRangeChangeStats: async (startStr: string, endStr: string) => {
        return await getDateRangeChangeStats(startStr, endStr)
      },
      onGetNotebookWordStats: async () => {
        return await getNotebookWordStats()
      },
      onGetNotebookActivityTrend: async (days: number) => {
        return await getNotebookActivityTrend(days)
      },
      onGetReportData: async (year?: number, month?: number) => {
        return await getReportData(year, month)
      },
      onGetTrendPrediction: async () => {
        return await getTrendPrediction()
      },
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
      const stats = await getStatistics(this.viewMode, {
        dayRange: this.dayRange,
        monthYearRange: this.monthYearRange,
        selectedYear: this.selectedYear,
      })

      const today = new Date()
      const dateKey = formatDate(today)
      const existingData = await this.storage.loadHistory()

      existingData[dateKey] = this.createHistoryRecord(
        today,
        stats.totalNotes,
        stats.totalWords,
        stats.todayCreated,
        stats.todayModified,
        stats.avgWordsPerDoc,
      )

      const keys = Object.keys(existingData).sort().reverse()
      if (keys.length > 365) {
        keys.slice(365).forEach((key) => {
          delete existingData[key]
        })
      }

      await this.storage.saveHistory(existingData)
      this.lastUpdateTime = now
    } catch (error) {
      console.error("收集统计数据失败:", error)
    } finally {
      this.isCollecting = false
    }
  }

  private createHistoryRecord(
    date: Date,
    totalNotes: number,
    totalWords: number,
    todayCreated: number,
    todayModified: number,
    avgWordsPerDoc: number,
  ) {
    return {
      date: formatDate(date),
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      totalNotes,
      totalWords,
      todayCreated,
      todayModified,
      avgWordsPerDoc,
    }
  }

  async getHistoricalStatistics(days?: number): Promise<any[]> {
    try {
      const historyData = await this.storage.loadHistory()
      const today = new Date()
      const result = []
      let lastKnownStats: {
        totalNotes: number
        totalWords: number
        avgWordsPerDoc: number
      } | null = null

      let daysToProcess = days
      if (days === undefined) {
        const dateKeys = Object.keys(historyData).sort()
        if (dateKeys.length > 0) {
          const earliestDate = new Date(dateKeys[0])
          const diffTime = today.getTime() - earliestDate.getTime()
          daysToProcess = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        } else {
          daysToProcess = 30
        }
      }

      for (let i = (daysToProcess || 30) - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dateKey = formatDate(date)
        const isToday = i === 0

        const dayData = historyData[dateKey]
        const isValidData = dayData && (dayData.totalWords > 0 || dayData.totalNotes > 0)

        if (isValidData) {
          const record = this.createHistoryRecord(
            date,
            dayData.totalNotes,
            dayData.totalWords,
            dayData.todayCreated,
            dayData.todayModified,
            dayData.avgWordsPerDoc,
          )
          result.push(record)
          lastKnownStats = {
            totalNotes: record.totalNotes,
            totalWords: record.totalWords,
            avgWordsPerDoc: record.avgWordsPerDoc,
          }
        } else if (isToday) {
          try {
            const currentStats = await getStatistics(this.viewMode, {
              dayRange: this.dayRange,
              monthYearRange: this.monthYearRange,
              selectedYear: this.selectedYear,
            })
            const record = this.createHistoryRecord(
              date,
              currentStats.totalNotes,
              currentStats.totalWords,
              currentStats.todayCreated,
              currentStats.todayModified,
              currentStats.avgWordsPerDoc,
            )
            result.push(record)
            lastKnownStats = {
              totalNotes: record.totalNotes,
              totalWords: record.totalWords,
              avgWordsPerDoc: record.avgWordsPerDoc,
            }
          } catch (error) {
            console.error("获取今日实时数据失败:", error)
            const record = lastKnownStats
              ? this.createHistoryRecord(
                  date,
                  lastKnownStats.totalNotes,
                  lastKnownStats.totalWords,
                  0,
                  0,
                  lastKnownStats.avgWordsPerDoc,
                )
              : this.createHistoryRecord(date, 0, 0, 0, 0, 0)
            result.push(record)
          }
        } else {
          const record = lastKnownStats
            ? this.createHistoryRecord(
                date,
                lastKnownStats.totalNotes,
                lastKnownStats.totalWords,
                0,
                0,
                lastKnownStats.avgWordsPerDoc,
              )
            : this.createHistoryRecord(date, 0, 0, 0, 0, 0)
          result.push(record)
        }
      }

      return result
    } catch (error) {
      console.error("获取历史统计数据失败:", error)
      return []
    }
  }

  async updateUpdateInterval(interval: number): Promise<void> {
    this.updateInterval = interval
    try {
      const settings = await this.storage.loadSettings()
      settings.statisticsUpdateInterval = interval
      await this.storage.saveSettings(settings)
    } catch (error) {
      console.error("保存更新间隔设置失败:", error)
    }

    this.startUpdateTimer(false)
  }

  async manualRefresh(): Promise<void> {
    await this.collectAndStoreStatistics()

    if (this.panelRefreshFn) {
      await this.panelRefreshFn()
    }
  }

  destroy() {
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
