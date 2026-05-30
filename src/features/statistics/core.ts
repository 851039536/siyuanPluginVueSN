import type {
  ChangedDoc,
  DailyWordCount,
  NotebookActivityItem,
  NotebookWordStat,
  ReportData,
  StatisticsData,
  TrendPrediction,
} from "./types"
import { Plugin } from "siyuan"
import {
  createApp,
  App as VueApp,
} from "vue"
import {
  lsNotebooks,
  readDir,
  sql,
} from "@/api"
import { emitCustomEvent } from "@/utils/eventBus"
import StatisticsPanel from "./index.vue"
import { StatisticsStorage } from "./types/storage"
import { formatDate, isValidDateStr, padZero } from "./utils"

const DAY_PERIOD_MAP: Record<number, string> = {
  7: "最近一周每日字数",
  15: "最近15天每日字数",
  30: "最近30天每日字数",
  90: "最近一季度每日字数",
  180: "最近半年每日字数",
  365: "最近一年每日字数",
}

const MONTH_PERIOD_MAP: Record<number, string> = {
  1: "最近一年每月字数",
  2: "最近两年每月字数",
  3: "最近三年每月字数",
}

/**
 * 数据统计功能模块
 * 提供思源笔记的使用数据统计分析
 */
export class Statistics {
  private plugin: Plugin
  private storage: StatisticsStorage
  private dockElement: HTMLElement | null = null
  private vueApp: VueApp | null = null
  private panelRefreshFn: (() => Promise<void>) | null = null // Vue 组件的 refreshData 引用
  private viewMode: "day" | "week" | "month" | "year" | "trend" = "day" // 当前查看模式
  private dayRange: 7 | 15 | 30 | 90 | 180 | 365 = 7 // 日视图的天数范围
  private monthYearRange: 1 | 2 | 3 = 1 // 月视图的年份范围
  private selectedYear: number = new Date().getFullYear() // 年视图的选中年份
  private updateInterval: number = 60000 // 定时更新间隔（毫秒），默认1分钟
  private updateTimer: NodeJS.Timeout | null = null // 定时器实例
  private lastUpdateTime: number = 0 // 上次更新时间戳
  private isCollecting: boolean = false // 防止并发收集的标志
  private handleOpenStatistics: (() => void) | null = null // 事件监听器引用

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new StatisticsStorage(plugin)
  }

  /**
   * 初始化统计模块
   */
  async init() {
    // 先同步注册 Dock，确保侧边栏图标在 onload 阶段就出现
    this.registerDock()

    // 异步加载保存的更新间隔
    try {
      const settings = await this.storage.loadSettings()
      if (settings.statisticsUpdateInterval) {
        this.updateInterval = settings.statisticsUpdateInterval
      }
    } catch (error) {
      console.error("加载设置失败:", error)
    }

    // 启动定时任务
    this.startUpdateTimer()

    // 监听超级面板打开统计面板事件
    this.bindEvents()
  }

  /**
   * 绑定事件监听
   */
  private bindEvents(): void {
    this.handleOpenStatistics = () => {
      // 触发Dock显示
      emitCustomEvent("dock-click", { dockId: "statistics-dock" })
    }
    window.addEventListener("openStatistics", this.handleOpenStatistics)
  }

  /**
   * 注册右下角侧边栏
   */
  private registerDock() {
    this.plugin.addDock({
      config: {
        position: "RightBottom",
        size: {
          width: 350,
          height: 0,
        },
        icon: "iconDatabase", // 使用数据库图标，适合数据统计
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

  /**
   * 渲染侧边栏面板 - 使用 Vue 组件
   */
  private async renderDockPanel() {
    if (!this.dockElement) return

    // 清理旧的 Vue 实例
    if (this.vueApp) {
      this.vueApp.unmount()
      this.vueApp = null
    }

    // 创建容器
    this.dockElement.innerHTML = '<div id="statistics-vue-app"></div>'
    const container = this.dockElement.querySelector("#statistics-vue-app")
    if (!container) return

    // 创建 Vue 应用
    this.vueApp = createApp(StatisticsPanel, {
      onRefresh: async (params: {
        viewMode: "day" | "week" | "month" | "year" | "trend"
        dayRange?: 7 | 15 | 30 | 90 | 180 | 365
        monthYearRange?: 1 | 2 | 3
        selectedYear?: number
      }) => {
        // 更新内部状态
        this.viewMode = params.viewMode
        if (params.dayRange) this.dayRange = params.dayRange
        if (params.monthYearRange) this.monthYearRange = params.monthYearRange
        if (params.selectedYear !== undefined) this.selectedYear = params.selectedYear

        return await this.getStatistics()
      },
      onGetHistoricalData: async (days?: number) => {
        return await this.getHistoricalStatistics(days)
      },
      onGetNotebookDocStats: async () => {
        return await this.getNotebookDocStats()
      },
      onGetDateChangedDocs: async (dateStr: string) => {
        return await this.getDateChangedDocs(dateStr)
      },
      onGetDateRangeChangeStats: async (startStr: string, endStr: string) => {
        return await this.getDateRangeChangeStats(startStr, endStr)
      },
      onGetNotebookWordStats: async () => {
        return await this.getNotebookWordStats()
      },
      onGetNotebookActivityTrend: async (days: number) => {
        return await this.getNotebookActivityTrend(days)
      },
      onGetReportData: async (year?: number, month?: number) => {
        return await this.getReportData(year, month)
      },
      onGetTrendPrediction: async () => {
        return await this.getTrendPrediction()
      },
      onRegisterRefresh: (fn: () => Promise<void>) => {
        this.panelRefreshFn = fn
      },
    })

    this.vueApp.mount(container)
  }

  /**
   * 获取统计数据
   */
  private async getStatistics(): Promise<StatisticsData> {
    try {
      const today = new Date()
      const todayStr = this.formatDateTime(today).substring(0, 8)

      // 合并基础统计查询，减少 API 调用次数
      const combinedSql = `
        SELECT
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
          (SELECT SUM(LENGTH(content)) FROM blocks WHERE type = 'p' AND content IS NOT NULL AND content != '') as totalWords,
          (SELECT COUNT(*) FROM blocks WHERE type IN ('p', 'h', 'l', 'i', 't', 'c', 'html', 'query_embed')) as totalBlocks,
          (SELECT COUNT(*) FROM blocks WHERE type IN ('img', 'audio', 'video', 'widget', 'iframe')) as totalAssets,
          (SELECT COUNT(DISTINCT block_id) FROM refs) as totalBacklinks,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${todayStr}') as todayCreated,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${todayStr}') as todayModified
      `

      const [combinedResult, totalTags, totalImages] = await Promise.all([
        this.executeSql(combinedSql),
        this.getTotalTags(),
        this.getTotalImages(),
      ])

      const baseStats = combinedResult[0] || {}
      const totalNotes = Number(baseStats.totalNotes || 0)
      const totalWords = Number(baseStats.totalWords || 0)
      const totalBlocks = Number(baseStats.totalBlocks || 0)
      const totalAssets = Number(baseStats.totalAssets || 0)
      const totalBacklinks = Number(baseStats.totalBacklinks || 0)
      const todayCreated = Number(baseStats.todayCreated || 0)
      const todayModified = Number(baseStats.todayModified || 0)

      // 计算平均每文档字数
      const avgWordsPerDoc =
        totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0

      // 根据不同模式获取每日统计
      let dailyStats: DailyWordCount[] = []
      let currentPeriod = ""
      let periodTotalWords = 0
      const sumWords = (items: DailyWordCount[]) =>
        items.reduce((sum, item) => sum + item.words, 0)

      switch (this.viewMode) {
        case "day":
          dailyStats = await this.getDailyStats(this.dayRange)
          currentPeriod = DAY_PERIOD_MAP[this.dayRange] || "每日字数统计"
          periodTotalWords = sumWords(dailyStats)
          break
        case "week":
          dailyStats = await this.getWeeklyStats(4) // 最近4周
          currentPeriod = "最近4周每周字数"
          periodTotalWords = sumWords(dailyStats)
          break
        case "month":
          dailyStats = await this.getMonthlyStatsRange(this.monthYearRange)
          currentPeriod =
            MONTH_PERIOD_MAP[this.monthYearRange] || "每月字数统计"
          periodTotalWords = sumWords(dailyStats)
          break
        case "year":
          dailyStats = await this.getYearlyStats()
          currentPeriod = `${this.selectedYear - 4} - ${this.selectedYear} 每年字数`
          periodTotalWords = sumWords(dailyStats)
          break
      }

      return {
        totalNotes,
        totalWords,
        totalBlocks,
        totalAssets,
        totalTags,
        totalBacklinks,
        todayCreated,
        todayModified,
        avgWordsPerDoc,
        dailyStats,
        currentPeriod,
        periodTotalWords,
        totalImages,
      }
    } catch (error) {
      console.error("获取统计数据失败:", error)
      return {
        totalNotes: 0,
        totalWords: 0,
        totalBlocks: 0,
        totalAssets: 0,
        totalTags: 0,
        totalBacklinks: 0,
        todayCreated: 0,
        todayModified: 0,
        avgWordsPerDoc: 0,
        dailyStats: [],
        currentPeriod: "",
        periodTotalWords: 0,
        totalImages: 0,
      }
    }
  }

  /**
   * 按日期查询新增/修改文档列表
   * 利用 blocks 表的 created / updated 字段直接查询，无需持久化
   * @param dateStr 日期字符串 yyyyMMdd，如 "20260521"
   */
  public async getDateChangedDocs(dateStr: string): Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }> {
    // 参数校验：防止 SQL 注入
    if (!isValidDateStr(dateStr)) {
      console.warn("getDateChangedDocs: 无效的日期参数", dateStr)
      return {
        newDocs: [],
        modifiedDocs: [],
      }
    }

    // 查询指定日期新增的文档
    const newDocsSql = `
      SELECT id, content FROM blocks
      WHERE type = 'd' AND substr(created, 1, 8) = '${dateStr}'
      ORDER BY created ASC
    `
    // 查询指定日期修改的文档（排除当日新增的）
    const modifiedDocsSql = `
      SELECT id, content, updated FROM blocks
      WHERE type = 'd'
        AND substr(updated, 1, 8) = '${dateStr}'
        AND substr(created, 1, 8) != '${dateStr}'
      ORDER BY updated DESC
    `

    const [newRows, modifiedRows] = await Promise.all([
      this.executeSql(newDocsSql),
      this.executeSql(modifiedDocsSql),
    ])

    return {
      newDocs: (newRows || []).map((r: any) => ({
        id: r.id,
        title: (r.content || "").replace(/<[^>]*>/g, ""),
      })),
      modifiedDocs: (modifiedRows || []).map((r: any) => ({
        id: r.id,
        title: (r.content || "").replace(/<[^>]*>/g, ""),
        updated: r.updated,
      })),
    }
  }

  /**
   * 查询日期范围内的每日变更统计（柱状图数据）
   * @param startStr 开始日期 yyyyMMdd
   * @param endStr 结束日期 yyyyMMdd
   */
  public async getDateRangeChangeStats(startStr: string, endStr: string): Promise<
    Array<{ date: string, newCount: number, modifiedCount: number }>
  > {
    // 参数校验：防止 SQL 注入
    if (!isValidDateStr(startStr) || !isValidDateStr(endStr)) {
      console.warn("getDateRangeChangeStats: 无效的日期参数", {
        startStr,
        endStr,
      })
      return []
    }

    // 每日新增数量
    const newSql = `
      SELECT substr(created, 1, 8) as date, COUNT(*) as cnt
      FROM blocks
      WHERE type = 'd'
        AND substr(created, 1, 8) >= '${startStr}'
        AND substr(created, 1, 8) <= '${endStr}'
      GROUP BY substr(created, 1, 8)
      ORDER BY date ASC
    `
    // 每日修改数量（排除当日新增）
    const modifiedSql = `
      SELECT substr(updated, 1, 8) as date, COUNT(*) as cnt
      FROM blocks
      WHERE type = 'd'
        AND substr(updated, 1, 8) >= '${startStr}'
        AND substr(updated, 1, 8) <= '${endStr}'
        AND substr(created, 1, 8) != substr(updated, 1, 8)
      GROUP BY substr(updated, 1, 8)
      ORDER BY date ASC
    `

    const [newRows, modifiedRows] = await Promise.all([
      this.executeSql(newSql),
      this.executeSql(modifiedSql),
    ])

    // 生成完整日期列表，填充统计数据
    const result: Array<{ date: string, newCount: number, modifiedCount: number }> = []
    const startDate = new Date(
      Number.parseInt(startStr.substring(0, 4)),
      Number.parseInt(startStr.substring(4, 6)) - 1,
      Number.parseInt(startStr.substring(6, 8)),
    )
    const endDate = new Date(
      Number.parseInt(endStr.substring(0, 4)),
      Number.parseInt(endStr.substring(4, 6)) - 1,
      Number.parseInt(endStr.substring(6, 8)),
    )

    const newMap = new Map<string, number>()
    const modifiedMap = new Map<string, number>()
    ;(newRows || []).forEach((r: any) => newMap.set(r.date, Number(r.cnt || 0)))
    ;(modifiedRows || []).forEach((r: any) => modifiedMap.set(r.date, Number(r.cnt || 0)))

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`
      result.push({
        date: dateStr,
        newCount: newMap.get(dateStr) || 0,
        modifiedCount: modifiedMap.get(dateStr) || 0,
      })
    }

    return result
  }


  /**
   * 获取总标签数（优化版：单次查询）
   * 思源笔记的标签可能存储在多个位置：
   * - spans 表：内联标签
   * - attributes 表：块属性标签
   * - blocks 表：独立标签块
   */
  private async getTotalTags(): Promise<number> {
    // 优化：一次性查询所有可能的标签来源，避免多次全表扫描
    const sql = `
      SELECT
        COALESCE((SELECT COUNT(DISTINCT content) FROM spans WHERE type='tag'), 0) +
        COALESCE((SELECT COUNT(DISTINCT value) FROM attributes WHERE name='tags' AND value IS NOT NULL AND value != ''), 0) +
        COALESCE((SELECT COUNT(DISTINCT content) FROM blocks WHERE type='tag'), 0) as totalTags
    `
    const result = await this.executeSql(sql)
    return Number(result[0]?.totalTags || 0)
  }

  /**
   * 统计 data/assets 目录下的图片数量
   */
  private async getTotalImages(): Promise<number> {
    const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]

    const isImageFile = (filename: string): boolean => {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf("."))
      return IMAGE_EXTENSIONS.includes(ext)
    }

    const countImagesInDirectory = async (path: string): Promise<number> => {
      let count = 0
      try {
        const result = await readDir(path)
        if (!result) return 0

        const files = Array.isArray(result) ? result : [result]

        for (const file of files) {
          const fullPath = `${path}/${file.name}`

          if (file.isDir) {
            // 递归统计子目录
            count += await countImagesInDirectory(fullPath)
          } else if (isImageFile(file.name)) {
            count++
          }
        }
      } catch (error) {
        console.error(`统计目录图片失败 ${path}:`, error)
      }
      return count
    }

    try {
      const assetsPath = "/data/assets"
      return await countImagesInDirectory(assetsPath)
    } catch (error) {
      console.error("统计思源图片失败:", error)
      return 0
    }
  }

  /**
   * 获取各笔记本文档数量统计
   * 使用 lsNotebooks API 获取所有笔记本，再通过 SQL 统计每个笔记本的文档数
   */
  async getNotebookDocStats(): Promise<Array<{ name: string, count: number }>> {
    try {
      const data = await lsNotebooks()
      if (!data || !data.notebooks) return []

      const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
      if (openNotebooks.length === 0) return []

      // 构建 SQL 查询：统计每个笔记本的文档数
      const notebookIds = openNotebooks.map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`).join(",")
      const sqlStmt = `
        SELECT box as notebook_id, COUNT(*) as doc_count
        FROM blocks
        WHERE type = 'd' AND box IN (${notebookIds})
        GROUP BY box
        ORDER BY doc_count DESC
      `

      const rows = await this.executeSql(sqlStmt)

      // 创建 notebook ID -> name 映射
      const notebookMap = new Map<string, string>()
      for (const nb of openNotebooks) {
        notebookMap.set(nb.id, nb.name)
      }

      // 组装结果
      const result: Array<{ name: string, count: number }> = []

      // 先添加有文档的笔记本
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const name = notebookMap.get(row.notebook_id) || "未知笔记本"
          result.push({
            name,
            count: row.doc_count || 0,
          })
          notebookMap.delete(row.notebook_id)
        }
      }

      // 再添加没有文档的笔记本（count = 0）
      for (const [_, name] of notebookMap) {
        result.push({
          name,
          count: 0,
        })
      }

      return result
    } catch (error) {
      console.error("获取笔记本文档统计失败:", error)
      return []
    }
  }

  /**
   * 聚合字数统计的核心 SQL 方法
   * @param startDate 开始日期字符串
   * @param endDate 结束日期字符串
   * @param subStrLen 截取日期字符串的长度 (4:年, 6:月, 8:日)
   * @param groupField 聚合字段名
   */
  private async getWordCountAggregation(
    startDate: string,
    endDate: string,
    subStrLen: number,
    groupField: string,
  ): Promise<any[]> {
    const sql = `
      SELECT
        substr(created, 1, ${subStrLen}) as ${groupField},
        SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
        AND created >= '${startDate}'
        AND created <= '${endDate}'
      GROUP BY substr(created, 1, ${subStrLen})
      ORDER BY ${groupField}
    `
    return await this.executeSql(sql)
  }

  /**
   * 获取每日统计（最近N天）- 使用 length 字段优化
   */
  private async getDailyStats(days: number): Promise<DailyWordCount[]> {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const startDateStr = this.formatDateTime(startDate)
    const endDateStr = this.formatDateTime(today)

    const queryResult = await this.getWordCountAggregation(
      startDateStr,
      endDateStr,
      8,
      "date",
    )

    // 创建日期到字数的映射
    const dateMap = new Map<string, number>()
    queryResult.forEach((row) => {
      const dateStr = String(row.date)
      const year = Number.parseInt(dateStr.substring(0, 4))
      const month = Number.parseInt(dateStr.substring(4, 6))
      const day = Number.parseInt(dateStr.substring(6, 8))
      const formattedDate = `${year}-${padZero(month)}-${padZero(day)}`
      dateMap.set(formattedDate, row.total || 0)
    })

    // 生成完整的日期列表（包括没有数据的日期）
    const result: DailyWordCount[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const dateStr = `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
      const words = dateMap.get(dateStr) || 0

      result.push({
        date: dateStr,
        words,
        dateLabel: `${date.getMonth() + 1}/${date.getDate()} ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}`,
      })
    }

    return result
  }

  /**
   * 获取每周统计（最近N周）- 使用 length 字段优化
   */
  private async getWeeklyStats(weeks: number): Promise<DailyWordCount[]> {
    const today = new Date()
    const firstWeekStart = new Date(today)
    const dayOfWeek = firstWeekStart.getDay() || 7
    firstWeekStart.setDate(today.getDate() - dayOfWeek + 1 - (weeks - 1) * 7)
    firstWeekStart.setHours(0, 0, 0, 0)

    const lastWeekEnd = new Date(today)
    const currentDayOfWeek = lastWeekEnd.getDay() || 7
    lastWeekEnd.setDate(today.getDate() - currentDayOfWeek + 7)
    lastWeekEnd.setHours(23, 59, 59, 999)

    const startDate = this.formatDateTime(firstWeekStart)
    const endDate = this.formatDateTime(lastWeekEnd)

    const queryResult = await this.getWordCountAggregation(
      startDate,
      endDate,
      8,
      "date",
    )

    // 创建日期到字数的映射
    const dateMap = new Map<string, number>()
    queryResult.forEach((row) => {
      dateMap.set(String(row.date), row.total || 0)
    })

    // 生成每周统计
    const result: DailyWordCount[] = []
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(today)
      const dow = weekStart.getDay() || 7
      weekStart.setDate(today.getDate() - dow + 1 - i * 7)
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      // 累计本周7天的字数
      let weekWords = 0
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart)
        day.setDate(weekStart.getDate() + d)
        const dayStr = this.formatDateTime(day).substring(0, 8)
        weekWords += dateMap.get(dayStr) || 0
      }

      result.push({
        date: `${weekStart.getFullYear()}-${padZero(weekStart.getMonth() + 1)}-${padZero(weekStart.getDate())}`,
        words: weekWords,
        dateLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
      })
    }

    return result
  }

  /**
   * 获取最近N年的每月统计 - 使用 length 字段优化
   */
  private async getMonthlyStatsRange(years: number): Promise<DailyWordCount[]> {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1

    // 计算起始年月
    const startYear = currentYear - years + 1
    const startDate = `${startYear}0101000000`
    const endDate = this.formatDateTime(today)

    const queryResult = await this.getWordCountAggregation(
      startDate,
      endDate,
      6,
      "month",
    )

    // 创建月份到字数的映射
    const monthMap = new Map<string, number>()
    queryResult.forEach((row) => {
      monthMap.set(String(row.month), row.total || 0)
    })

    // 生成完整的月份列表（从起始年月到当前年月）
    const result: DailyWordCount[] = []
    for (let y = startYear; y <= currentYear; y++) {
      const startM = 1
      const endM = y === currentYear ? currentMonth : 12

      for (let m = startM; m <= endM; m++) {
        const monthStr = padZero(m)
        const monthKey = `${y}${monthStr}`
        const words = monthMap.get(monthKey) || 0

        result.push({
          date: `${y}-${monthStr}`,
          words,
          dateLabel: `${y}/${m}`,
        })
      }
    }

    return result
  }

  /**
   * 获取每年统计（最近N年）- 使用 length 字段优化
   */
  private async getYearlyStats(): Promise<DailyWordCount[]> {
    const baseYear = this.selectedYear
    const startYear = baseYear - 4
    const startDate = `${startYear}0101000000`
    const endDate = `${baseYear}1231235959`

    const queryResult = await this.getWordCountAggregation(
      startDate,
      endDate,
      4,
      "year",
    )

    // 创建年份到字数的映射
    const yearMap = new Map<string, number>()
    queryResult.forEach((row) => {
      yearMap.set(String(row.year), row.total || 0)
    })

    // 生成5年的完整列表
    const result: DailyWordCount[] = []
    for (let i = 4; i >= 0; i--) {
      const year = baseYear - i
      const words = yearMap.get(String(year)) || 0

      result.push({
        date: `${year}`,
        words,
        dateLabel: `${year}年`,
      })
    }

    return result
  }

  /**
   * 格式化日期时间为思源笔记格式
   */
  private formatDateTime(date: Date): string {
    const year = date.getFullYear()
    const month = padZero(date.getMonth() + 1)
    const day = padZero(date.getDate())
    const hour = padZero(date.getHours())
    const minute = padZero(date.getMinutes())
    const second = padZero(date.getSeconds())
    return `${year}${month}${day}${hour}${minute}${second}`
  }

  /**
   * 执行 SQL 查询（使用统一的 @/api sql() 封装）
   */
  private async executeSql(stmt: string): Promise<any[]> {
    try {
      return (await sql(stmt)) || []
    } catch (error) {
      console.error("SQL 查询异常:", error)
      return []
    }
  }

  /**
   * 启动定时更新任务
   * @param immediate 是否立即执行一次，默认为 true
   */
  private startUpdateTimer(immediate: boolean = true): void {
    // 清除现有定时器
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }

    // 按需立即执行一次
    if (immediate) {
      this.collectAndStoreStatistics()
    }

    // 设置定时任务
    this.updateTimer = setInterval(() => {
      this.collectAndStoreStatistics()
    }, this.updateInterval)
  }

  /**
   * 停止定时更新任务
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  /**
   * 收集并存储统计数据
   */
  private async collectAndStoreStatistics(): Promise<void> {
    // 防止并发收集
    if (this.isCollecting) return

    const now = Date.now()
    // 避免频繁执行（间隔小于30秒）
    if (now - this.lastUpdateTime < 30000) return

    this.isCollecting = true
    try {
      const stats = await this.getStatistics()

      // 保存到数据库（按日期）
      const today = new Date()
      const dateKey = formatDate(today)
      const existingData = await this.storage.loadHistory()

      // 更新当日数据（使用统一的 createHistoryRecord）
      existingData[dateKey] = this.createHistoryRecord(
        today,
        stats.totalNotes,
        stats.totalWords,
        stats.todayCreated,
        stats.todayModified,
        stats.avgWordsPerDoc,
      )

      // 只保留最近365天的数据
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

  /**
   * 创建历史统计记录对象的辅助方法
   */
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

  /**
   * 获取历史统计数据
   * @param days 获取的天数，如果不指定则返回所有历史数据（永久展示）
   */
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

      // 如果未指定天数，则计算从最早数据到今天的天数（永久展示）
      let daysToProcess = days
      if (days === undefined) {
        const dateKeys = Object.keys(historyData).sort()
        if (dateKeys.length > 0) {
          const earliestDate = new Date(dateKeys[0])
          const diffTime = today.getTime() - earliestDate.getTime()
          daysToProcess = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        } else {
          daysToProcess = 30 // 如果没有历史数据，默认30天
        }
      }

      // 生成日期范围（从最早到最晚，正序）
      for (let i = (daysToProcess || 30) - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dateKey = formatDate(date)
        const isToday = i === 0

        const dayData = historyData[dateKey]

        // 判断是否有效数据
        const isValidData =
          dayData && (dayData.totalWords > 0 || dayData.totalNotes > 0)

        if (isValidData) {
          // 有效数据，直接使用
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
          // 今天没有有效数据，尝试获取实时数据
          try {
            const currentStats = await this.getStatistics()
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
            // 使用最后一次已知数据或填充0
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
          // 过去某天没有有效数据，使用最后一次已知数据或填充0
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

  /**
   * 更新定时任务间隔
   */
  async updateUpdateInterval(interval: number): Promise<void> {
    this.updateInterval = interval
    // 保存到设置
    try {
      const settings = await this.storage.loadSettings()
      settings.statisticsUpdateInterval = interval
      await this.storage.saveSettings(settings)
    } catch (error) {
      console.error("保存更新间隔设置失败:", error)
    }

    // 重新启动定时器（不触发即时数据采集）
    this.startUpdateTimer(false)
  }

  /**
   * 手动触发数据收集
   */
  async manualRefresh(): Promise<void> {
    await this.collectAndStoreStatistics()

    // 如果面板已打开，通知 Vue 组件刷新显示
    if (this.panelRefreshFn) {
      await this.panelRefreshFn()
    }
  }

  /**
   * 获取笔记本字数统计（饼图用）
   * 查询每个笔记本的段落字数总和
   */
  public async getNotebookWordStats(): Promise<NotebookWordStat[]> {
    const notebookColors = [
      "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
      "#06b6d4", "#ec4899", "#f97316", "#84cc16", "#14b8a6",
      "#6366f1", "#e11d48", "#0ea5e9", "#a855f7", "#10b981",
    ]

    try {
      const data = await lsNotebooks()
      if (!data || !data.notebooks) return []

      const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
      if (openNotebooks.length === 0) return []

      const notebookIds = openNotebooks
        .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
        .join(",")

      const sqlStmt = `
        SELECT box as notebook_id, SUM(length) as total_words
        FROM blocks
        WHERE type = 'p' AND length > 0 AND box IN (${notebookIds})
        GROUP BY box
        ORDER BY total_words DESC
      `
      const rows = await this.executeSql(sqlStmt)

      const notebookMap = new Map<string, string>()
      for (const nb of openNotebooks) {
        notebookMap.set(nb.id, nb.name)
      }

      const result: NotebookWordStat[] = []
      let totalWordsAll = 0

      // 先用有数据的结果
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const name = notebookMap.get(row.notebook_id) || "未知笔记本"
          const words = Number(row.total_words || 0)
          totalWordsAll += words
          result.push({ name, words, percentage: 0, color: "" })
          notebookMap.delete(row.notebook_id)
        }
      }

      // 没有字数数据的笔记本
      for (const [_, name] of notebookMap) {
        result.push({ name, words: 0, percentage: 0, color: "" })
      }

      // 计算百分比并分配颜色
      result.forEach((item, idx) => {
        item.percentage = totalWordsAll > 0
          ? Math.round((item.words / totalWordsAll) * 1000) / 10
          : 0
        item.color = notebookColors[idx % notebookColors.length]
      })

      return result
    } catch (error) {
      console.error("获取笔记本字数统计失败:", error)
      return []
    }
  }

  /**
   * 获取各笔记本每日活跃度趋势（用于多线对比图）
   * @param days 最近N天
   */
  public async getNotebookActivityTrend(days: number): Promise<NotebookActivityItem[]> {
    const notebookColors = [
      "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
      "#06b6d4", "#ec4899", "#f97316", "#84cc16", "#14b8a6",
    ]

    try {
      const data = await lsNotebooks()
      if (!data || !data.notebooks) return []

      const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
      if (openNotebooks.length === 0) return []

      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - days + 1)
      startDate.setHours(0, 0, 0, 0)

      const startStr = this.formatDateTime(startDate)
      const endStr = this.formatDateTime(today)

      const notebookIds = openNotebooks
        .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
        .join(",")

      // 一次性查询所有笔记本的每日字数
      const sqlStmt = `
        SELECT box as notebook_id, substr(created, 1, 8) as date, SUM(length) as words
        FROM blocks
        WHERE type = 'p'
          AND length > 0
          AND box IN (${notebookIds})
          AND created >= '${startStr}'
          AND created <= '${endStr}'
        GROUP BY box, substr(created, 1, 8)
        ORDER BY date ASC
      `
      const rows = await this.executeSql(sqlStmt)

      const notebookMap = new Map<string, string>()
      for (const nb of openNotebooks) {
        notebookMap.set(nb.id, nb.name)
      }

      // 数据透视：notebook_id -> { dateStr -> words }
      const pivot = new Map<string, Map<string, number>>()
      if (rows) {
        for (const row of rows) {
          const nbId = row.notebook_id
          const dateStr = String(row.date)
          const words = Number(row.words || 0)
          if (!pivot.has(nbId)) {
            pivot.set(nbId, new Map())
          }
          pivot.get(nbId)!.set(dateStr, words)
        }
      }

      // 生成每个笔记本的每日数据
      const result: NotebookActivityItem[] = []
      openNotebooks.forEach((nb: any, idx) => {
        const dayMap = pivot.get(nb.id) || new Map()
        const dailyData: DailyWordCount[] = []

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          date.setHours(0, 0, 0, 0)
          const dateStr = `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}`
          const words = dayMap.get(dateStr) || 0

          dailyData.push({
            date: `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`,
            words,
            dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
          })
        }

        result.push({
          notebook: notebookMap.get(nb.id) || "未知笔记本",
          data: dailyData,
          color: notebookColors[idx % notebookColors.length],
        })
      })

      return result
    } catch (error) {
      console.error("获取笔记本活跃度趋势失败:", error)
      return []
    }
  }

  /**
   * 获取年度/月度报告数据
   * @param year 年份（可选，默认当年）
   * @param month 月份 1-12（可选，不填则为年度报告）
   */
  public async getReportData(year?: number, month?: number): Promise<ReportData> {
    const today = new Date()
    const reportYear = year || today.getFullYear()
    const reportMonth = month

    const isAnnual = !reportMonth
    const pad = padZero

    try {
      if (isAnnual) {
        // === 年度报告 ===
        const yearStartStr = `${reportYear}0101000000`
        const yearEndStr = `${reportYear}1231235959`

        // 并行查询：字数、新增笔记数
        const [wordRows, createdRows] = await Promise.all([
          this.executeSql(`
            SELECT SUM(length) as total_words
            FROM blocks
            WHERE type = 'p' AND length > 0
              AND created >= '${yearStartStr}' AND created <= '${yearEndStr}'
          `),
          this.executeSql(`
            SELECT COUNT(*) as cnt
            FROM blocks
            WHERE type = 'd'
              AND substr(created, 1, 4) = '${reportYear}'
          `),
        ])

        const totalWords = Number(wordRows[0]?.total_words || 0)
        const totalNotesCreated = Number(createdRows[0]?.cnt || 0)

        // 活跃天数
        const activeRows = await this.executeSql(`
          SELECT COUNT(DISTINCT substr(created, 1, 8)) as active_days
          FROM blocks
          WHERE type = 'p' AND length > 0
            AND created >= '${yearStartStr}' AND created <= '${yearEndStr}'
        `)
        const activeDays = Number(activeRows[0]?.active_days || 0)

        // 最高字数日
        const maxDayRows = await this.executeSql(`
          SELECT substr(created, 1, 8) as date, SUM(length) as words
          FROM blocks
          WHERE type = 'p' AND length > 0
            AND created >= '${yearStartStr}' AND created <= '${yearEndStr}'
          GROUP BY substr(created, 1, 8)
          ORDER BY words DESC
          LIMIT 1
        `)

        let maxWordsDay: { date: string, words: number } = { date: "", words: 0 }
        if (maxDayRows.length > 0) {
          const d = maxDayRows[0].date
          maxWordsDay = {
            date: `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`,
            words: Number(maxDayRows[0].words || 0),
          }
        }

        // 最高产笔记本
        const mostProductiveNotebook = await this.getMostProductiveNotebook(
          yearStartStr, yearEndStr,
        )

        // 最长连续活跃
        const longestStreak = await this.calcLongestStreak(yearStartStr, yearEndStr)

        // 各月明细
        const monthlyRows = await this.executeSql(`
          SELECT substr(created, 1, 6) as month,
            SUM(length) as words,
            COUNT(DISTINCT CASE WHEN type='d' THEN root_id END) as created
          FROM blocks
          WHERE (type = 'p' OR type = 'd')
            AND created >= '${yearStartStr}' AND created <= '${yearEndStr}'
          GROUP BY substr(created, 1, 6)
          ORDER BY month ASC
        `)

        const monthlyBreakdown: Array<{ month: string, words: number, created: number }> = []
        for (let m = 1; m <= 12; m++) {
          const monthKey = `${reportYear}${pad(m)}`
          const row = (monthlyRows || []).find((r: any) => String(r.month) === monthKey)
          monthlyBreakdown.push({
            month: `${reportYear}/${pad(m)}`,
            words: Number(row?.words || 0),
            created: Number(row?.created || 0),
          })
        }

        const daysInYear = today.getFullYear() === reportYear
          ? (() => { const start = new Date(reportYear, 0, 1); return Math.ceil((today.getTime() - start.getTime()) / 86400000) + 1 })()
          : 365

        return {
          periodLabel: `${reportYear}年`,
          totalWords,
          totalNotesCreated,
          avgDailyWords: daysInYear > 0 ? Math.round(totalWords / daysInYear) : 0,
          activeDays,
          maxWordsDay,
          mostProductiveNotebook,
          longestStreak,
          monthlyBreakdown,
        }
      } else {
        // === 月度报告 ===
        const monthStartStr = `${reportYear}${pad(reportMonth)}01000000`
        const lastDay = new Date(reportYear, reportMonth, 0).getDate()
        const monthEndStr = `${reportYear}${pad(reportMonth)}${pad(lastDay)}235959`

        const [wordRows, createdRows] = await Promise.all([
          this.executeSql(`
            SELECT SUM(length) as total_words
            FROM blocks
            WHERE type = 'p' AND length > 0
              AND created >= '${monthStartStr}' AND created <= '${monthEndStr}'
          `),
          this.executeSql(`
            SELECT COUNT(*) as cnt
            FROM blocks
            WHERE type = 'd'
              AND substr(created, 1, 6) = '${reportYear}${pad(reportMonth)}'
          `),
        ])

        const totalWords = Number(wordRows[0]?.total_words || 0)
        const totalNotesCreated = Number(createdRows[0]?.cnt || 0)

        const activeRows = await this.executeSql(`
          SELECT COUNT(DISTINCT substr(created, 1, 8)) as active_days
          FROM blocks
          WHERE type = 'p' AND length > 0
            AND created >= '${monthStartStr}' AND created <= '${monthEndStr}'
        `)
        const activeDays = Number(activeRows[0]?.active_days || 0)

        const maxDayRows = await this.executeSql(`
          SELECT substr(created, 1, 8) as date, SUM(length) as words
          FROM blocks
          WHERE type = 'p' AND length > 0
            AND created >= '${monthStartStr}' AND created <= '${monthEndStr}'
          GROUP BY substr(created, 1, 8)
          ORDER BY words DESC
          LIMIT 1
        `)

        let maxWordsDay: { date: string, words: number } = { date: "", words: 0 }
        if (maxDayRows.length > 0) {
          const d = maxDayRows[0].date
          maxWordsDay = {
            date: `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`,
            words: Number(maxDayRows[0].words || 0),
          }
        }

        const mostProductiveNotebook = await this.getMostProductiveNotebook(
          monthStartStr, monthEndStr,
        )

        const longestStreak = await this.calcLongestStreak(monthStartStr, monthEndStr)

        // 按周分组
        const weeklyRows = await this.executeSql(`
          SELECT substr(created, 1, 8) as date,
            SUM(length) as words,
            COUNT(DISTINCT CASE WHEN type='d' THEN root_id END) as created
          FROM blocks
          WHERE (type = 'p' OR type = 'd')
            AND created >= '${monthStartStr}' AND created <= '${monthEndStr}'
          GROUP BY substr(created, 1, 8)
          ORDER BY date ASC
        `)

        const monthlyBreakdown = (weeklyRows || []).map((r: any) => {
          const d = String(r.date)
          return {
            month: `${d.substring(4, 6)}/${d.substring(6, 8)}`,
            words: Number(r.words || 0),
            created: Number(r.created || 0),
          }
        })

        return {
          periodLabel: `${reportYear}年${reportMonth}月`,
          totalWords,
          totalNotesCreated,
          avgDailyWords: lastDay > 0 ? Math.round(totalWords / lastDay) : 0,
          activeDays,
          maxWordsDay,
          mostProductiveNotebook,
          longestStreak,
          monthlyBreakdown,
        }
      }
    } catch (error) {
      console.error("获取报告数据失败:", error)
      return {
        periodLabel: "",
        totalWords: 0,
        totalNotesCreated: 0,
        avgDailyWords: 0,
        activeDays: 0,
        maxWordsDay: { date: "", words: 0 },
        mostProductiveNotebook: { name: "", words: 0 },
        longestStreak: 0,
        monthlyBreakdown: [],
      }
    }
  }

  /**
   * 获取最高产笔记本
   */
  private async getMostProductiveNotebook(
    startStr: string,
    endStr: string,
  ): Promise<{ name: string, words: number }> {
    try {
      const data = await lsNotebooks()
      if (!data || !data.notebooks) return { name: "", words: 0 }

      const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
      if (openNotebooks.length === 0) return { name: "", words: 0 }

      const notebookIds = openNotebooks
        .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
        .join(",")

      const rows = await this.executeSql(`
        SELECT box as notebook_id, SUM(length) as words
        FROM blocks
        WHERE type = 'p' AND length > 0 AND box IN (${notebookIds})
          AND created >= '${startStr}' AND created <= '${endStr}'
        GROUP BY box
        ORDER BY words DESC
        LIMIT 1
      `)

      if (rows.length > 0) {
        const nb = openNotebooks.find((n: any) => n.id === rows[0].notebook_id)
        return {
          name: nb?.name || "未知笔记本",
          words: Number(rows[0].words || 0),
        }
      }

      return { name: openNotebooks[0].name, words: 0 }
    } catch {
      return { name: "", words: 0 }
    }
  }

  /**
   * 计算最长连续活跃天数
   */
  private async calcLongestStreak(startStr: string, endStr: string): Promise<number> {
    try {
      const rows = await this.executeSql(`
        SELECT DISTINCT substr(created, 1, 8) as date
        FROM blocks
        WHERE type = 'p' AND length > 0
          AND created >= '${startStr}' AND created <= '${endStr}'
        ORDER BY date ASC
      `)

      if (!rows || rows.length === 0) return 0

      const activeDates = new Set(rows.map((r: any) => String(r.date)))
      const sorted = [...activeDates].sort()
      let longest = 1
      let current = 1

      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(
          Number(sorted[i - 1].substring(0, 4)),
          Number(sorted[i - 1].substring(4, 6)) - 1,
          Number(sorted[i - 1].substring(6, 8)),
        )
        const curr = new Date(
          Number(sorted[i].substring(0, 4)),
          Number(sorted[i].substring(4, 6)) - 1,
          Number(sorted[i].substring(6, 8)),
        )
        const diff = (curr.getTime() - prev.getTime()) / 86400000

        if (diff === 1) {
          current++
          longest = Math.max(longest, current)
        } else {
          current = 1
        }
      }

      return longest
    } catch {
      return 0
    }
  }

  /**
   * 获取趋势预测数据（简单线性回归）
   * 基于最近30天的历史字数数据进行预测
   */
  public async getTrendPrediction(): Promise<TrendPrediction> {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 29)
    startDate.setHours(0, 0, 0, 0)

    const startStr = this.formatDateTime(startDate)
    const endStr = this.formatDateTime(today)

    try {
      // 获取最近30天的每日字数
      const rows = await this.executeSql(`
        SELECT substr(created, 1, 8) as date, SUM(length) as words
        FROM blocks
        WHERE type = 'p' AND length > 0
          AND created >= '${startStr}' AND created <= '${endStr}'
        GROUP BY substr(created, 1, 8)
        ORDER BY date ASC
      `)

      // 构建日期-字数映射并填充完整日期
      const wordMap = new Map<string, number>()
      if (rows) {
        for (const row of rows) {
          wordMap.set(String(row.date), Number(row.words || 0))
        }
      }

      const historical: DailyWordCount[] = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dateStr = `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}`

        historical.push({
          date: `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`,
          words: wordMap.get(dateStr) || 0,
          dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        })
      }

      const n = historical.length
      if (n < 2) {
        return {
          historical,
          predicted: [],
          slope: 0,
          intercept: 0,
          rSquared: 0,
          weeklyProjection: 0,
          monthlyProjection: 0,
        }
      }

      // 简单线性回归：y = mx + b
      const xs = historical.map((_, i) => i)
      const ys = historical.map(h => h.words)
      const meanX = xs.reduce((a, b) => a + b, 0) / n
      const meanY = ys.reduce((a, b) => a + b, 0) / n

      let numerator = 0
      let denominator = 0
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX
        numerator += dx * (ys[i] - meanY)
        denominator += dx * dx
      }

      const slope = denominator !== 0 ? numerator / denominator : 0
      const intercept = meanY - slope * meanX

      // R²计算
      const yPred = xs.map(x => slope * x + intercept)
      const ssRes = ys.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0)
      const ssTot = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0)
      const rSquared = ssTot !== 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0

      // 预测未来7天
      const predicted: DailyWordCount[] = []
      for (let i = 0; i < 7; i++) {
        const idx = n + i
        const predWords = Math.max(0, Math.round(slope * idx + intercept))
        const predDate = new Date(today)
        predDate.setDate(today.getDate() + i + 1)

        predicted.push({
          date: `${predDate.getFullYear()}-${padZero(predDate.getMonth() + 1)}-${padZero(predDate.getDate())}`,
          words: predWords,
          dateLabel: `${predDate.getMonth() + 1}/${predDate.getDate()}`,
        })
      }

      const weeklyProjection = predicted.reduce((s, p) => s + p.words, 0)
      const monthlyProjection = Math.round(
        slope > 0 ? (slope * (n + 30) + intercept) * 30 : (meanY * 30),
      )

      return {
        historical,
        predicted,
        slope,
        intercept,
        rSquared,
        weeklyProjection,
        monthlyProjection,
      }
    } catch (error) {
      console.error("获取趋势预测失败:", error)
      return {
        historical: [],
        predicted: [],
        slope: 0,
        intercept: 0,
        rSquared: 0,
        weeklyProjection: 0,
        monthlyProjection: 0,
      }
    }
  }

  /**
   * 销毁模块
   */
  destroy() {
    // 停止定时任务
    this.stopUpdateTimer()

    // 移除事件监听器
    if (this.handleOpenStatistics) {
      window.removeEventListener("openStatistics", this.handleOpenStatistics)
      this.handleOpenStatistics = null
    }

    // 清理 Vue 实例
    if (this.vueApp) {
      this.vueApp.unmount()
      this.vueApp = null
    }
    // 清理回调引用
    this.panelRefreshFn = null
    // 清理资源
    this.dockElement = null
  }
}
