import { Plugin } from 'siyuan';
import { createApp, App as VueApp } from 'vue';
import StatisticsPanel from './StatisticsPanel.vue';
import { readDir } from '@/api';
import { WeeklyGoalSettings, STATISTICS_STORAGE_KEYS, DEFAULT_WEEKLY_GOAL } from './types';

const DAY_PERIOD_MAP: Record<number, string> = {
  7: '最近一周每日字数',
  15: '最近15天每日字数',
  30: '最近30天每日字数',
  90: '最近一季度每日字数',
  180: '最近半年每日字数',
  365: '最近一年每日字数'
};

const MONTH_PERIOD_MAP: Record<number, string> = {
  1: '最近一年每月字数',
  2: '最近两年每月字数',
  3: '最近三年每月字数'
};


/**
 * 统计数据接口
 */
interface StatisticsData {
  totalNotes: number;      // 总笔记数
  totalWords: number;      // 总字数
  totalBlocks: number;     // 总块数
  totalAssets: number;     // 总附件数
  totalTags: number;       // 总标签数
  totalBacklinks: number;  // 总双链数
  todayCreated: number;    // 今日新增文档数
  todayModified: number;   // 今日修改文档数
  avgWordsPerDoc: number;  // 平均每文档字数
  dailyStats: DailyWordCount[];  // 每日字数统计
  currentPeriod: string;   // 当前统计周期
  periodTotalWords: number; // 当前时段总字数
  topTags: Array<{ name: string; count: number }>;  // 热门标签（已废弃，始终为空数组）
  recentDocs: Array<{ id: string; title: string; updated: string; words: number }>;  // 最近活跃文档（已废弃，始终为空数组）
  totalImages: number;     // 思源图片总数（data/assets目录）
}

/**
 * 每日字数统计
 */
interface DailyWordCount {
  date: string;      // 日期 YYYY-MM-DD
  words: number;     // 字数
  dateLabel: string; // 日期显示标签
}

/**
 * 数据统计功能模块
 * 提供思源笔记的使用数据统计分析
 */
export class Statistics {
  private plugin: Plugin;
  private dockElement: HTMLElement | null = null;
  private vueApp: VueApp | null = null;
  private viewMode: 'day' | 'week' | 'month' | 'year' | 'trend' = 'day'; // 当前查看模式
  private dayRange: 7 | 15 | 30 | 90 | 180 | 365 = 7; // 日视图的天数范围
  private monthYearRange: 1 | 2 | 3 = 1; // 月视图的年份范围
  private updateInterval: number = 60000; // 定时更新间隔（毫秒），默认1分钟
  private updateTimer: NodeJS.Timeout | null = null; // 定时器实例
  private lastUpdateTime: number = 0; // 上次更新时间戳

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * 初始化统计模块
   */
  async init() {
    // 加载保存的更新间隔
    try {
      const settings = await this.plugin.loadData('plugin-settings');
      if (settings) {
        if (settings.statisticsUpdateInterval) {
          this.updateInterval = settings.statisticsUpdateInterval;
        }
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }

    // 启动定时任务
    this.startUpdateTimer();

    // 注册Dock
    this.registerDock();

    // 监听超级面板打开统计面板事件
    this.bindEvents();
  }

  /**
   * 绑定事件监听
   */
  private bindEvents(): void {
    window.addEventListener('openStatistics', () => {
      // 触发Dock显示
      const dockEvent = new CustomEvent('dock-click', {
        detail: { dockId: 'statistics-dock' }
      });
      window.dispatchEvent(dockEvent);
    });
  }

  /**
   * 注册右下角侧边栏
   */
  private registerDock() {

    this.plugin.addDock({
      config: {
        position: 'RightBottom',
        size: { width: 350, height: 0 },
        icon: 'iconDatabase', // 使用数据库图标，适合数据统计
        title: '数据统计',
        show: false,
      },
      data: {},
      type: 'statistics-dock',
      init: (dock) => {
        this.dockElement = dock.element as HTMLElement;
        this.renderDockPanel();
      },
    });
  }

  /**
   * 渲染侧边栏面板 - 使用 Vue 组件
   */
  private async renderDockPanel() {
    if (!this.dockElement) return;

    // 清理旧的 Vue 实例
    if (this.vueApp) {
      this.vueApp.unmount();
      this.vueApp = null;
    }

    // 创建容器
    this.dockElement.innerHTML = '<div id="statistics-vue-app"></div>';
    const container = this.dockElement.querySelector('#statistics-vue-app');
    if (!container) return;

    // 创建 Vue 应用
    this.vueApp = createApp(StatisticsPanel, {
      onRefresh: async (params: {
        viewMode: 'day' | 'week' | 'month' | 'year' | 'trend'
        dayRange?: 7 | 15 | 30 | 90 | 180 | 365
        monthYearRange?: 1 | 2 | 3
        selectedYear?: number
      }) => {
        // 更新内部状态
        this.viewMode = params.viewMode;
        if (params.dayRange) this.dayRange = params.dayRange;
        if (params.monthYearRange) this.monthYearRange = params.monthYearRange;
        // selectedYear 由 getYearlyStats 方法内部使用，不需要存储

        return await this.getStatistics();
      },
      onGetHistoricalData: async (days?: number) => {
        return await this.getHistoricalStatistics(days);
      },
      onGetWeeklyGoal: async () => {
        return await this.getWeeklyGoal();
      },
      onSaveWeeklyGoal: async (goal: WeeklyGoalSettings) => {
        return await this.saveWeeklyGoal(goal);
      },
    });

    this.vueApp.mount(container);
  }



  /**
   * 获取统计数据
   */
  private async getStatistics(): Promise<StatisticsData> {
    try {
      const today = new Date();
      const todayStr = this.formatDate(today).substring(0, 8);

      // 合并基础统计查询，减少 API 调用次数
      const combinedSql = `
        SELECT
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
          (SELECT SUM(LENGTH(content)) FROM blocks WHERE type = 'p' AND content IS NOT NULL AND content != '') as totalWords,
          (SELECT COUNT(*) FROM blocks WHERE type IN ('p', 'h', 'l', 'i', 't', 'c', 'html', 'query_embed')) as totalBlocks,
          (SELECT COUNT(*) FROM blocks WHERE type IN ('img', 'audio', 'video', 'widget', 'iframe')) as totalAssets,
          (SELECT COUNT(*) FROM refs) as totalBacklinks,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${todayStr}') as todayCreated,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${todayStr}') as todayModified
      `;

      const [combinedResult, totalTags, totalImages] = await Promise.all([
        this.executeSql(combinedSql),
        this.getTotalTags(),
        this.getTotalImages()
      ]);

      const baseStats = combinedResult[0] || {};
      const totalNotes = Number(baseStats.totalNotes || 0);
      const totalWords = Number(baseStats.totalWords || 0);
      const totalBlocks = Number(baseStats.totalBlocks || 0);
      const totalAssets = Number(baseStats.totalAssets || 0);
      const totalBacklinks = Number(baseStats.totalBacklinks || 0);
      const todayCreated = Number(baseStats.todayCreated || 0);
      const todayModified = Number(baseStats.todayModified || 0);

      // 计算平均每文档字数
      const avgWordsPerDoc = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0;


      // 根据不同模式获取每日统计
      let dailyStats: DailyWordCount[] = [];
      let currentPeriod = '';
      let periodTotalWords = 0;
      const sumWords = (items: DailyWordCount[]) => items.reduce((sum, item) => sum + item.words, 0);

      switch (this.viewMode) {
        case 'day':
          dailyStats = await this.getDailyStats(this.dayRange);
          currentPeriod = DAY_PERIOD_MAP[this.dayRange] || '每日字数统计';
          periodTotalWords = sumWords(dailyStats);
          break;
        case 'week':
          dailyStats = await this.getWeeklyStats(4); // 最近4周
          currentPeriod = '最近4周每周字数';
          periodTotalWords = sumWords(dailyStats);
          break;
        case 'month':
          dailyStats = await this.getMonthlyStatsRange(this.monthYearRange);
          currentPeriod = MONTH_PERIOD_MAP[this.monthYearRange] || '每月字数统计';
          periodTotalWords = sumWords(dailyStats);
          break;
        case 'year':
          dailyStats = await this.getYearlyStats(); // 最近5年
          currentPeriod = '最近5年每年字数';
          periodTotalWords = sumWords(dailyStats);
          break;
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
        topTags: [],
        recentDocs: [],
        totalImages,
      };
    } catch (error) {
      console.error('获取统计数据失败:', error);
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
        currentPeriod: '',
        periodTotalWords: 0,
        topTags: [],
        recentDocs: [],
        totalImages: 0,
      };
    }
  }

  /**
   * 获取总标签数（多重查询机制）
   */
  private async getTotalTags(): Promise<number> {
    // 优先查询 spans 表
    let sql = `SELECT COUNT(DISTINCT content) as count FROM spans WHERE type='tag'`;
    let result = await this.executeSql(sql);
    let count = result[0]?.count || 0;

    // 如果 spans 表没有数据，尝试 attributes 表
    if (count === 0) {
      sql = `SELECT COUNT(*) as count FROM attributes WHERE name='tags'`;
      result = await this.executeSql(sql);
      count = result[0]?.count || 0;
    }

    // 最后尝试 blocks 表
    if (count === 0) {
      sql = `SELECT COUNT(*) as count FROM blocks WHERE type='tag'`;
      result = await this.executeSql(sql);
      count = result[0]?.count || 0;
    }

    return count;
  }

  /**
   * 统计 data/assets 目录下的图片数量
   */
  private async getTotalImages(): Promise<number> {
    const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

    const isImageFile = (filename: string): boolean => {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      return IMAGE_EXTENSIONS.includes(ext);
    };

    const countImagesInDirectory = async (path: string): Promise<number> => {
      let count = 0;
      try {
        const result = await readDir(path);
        if (!result) return 0;

        const files = Array.isArray(result) ? result : [result];

        for (const file of files) {
          const fullPath = `${path}/${file.name}`;

          if (file.isDir) {
            // 递归统计子目录
            count += await countImagesInDirectory(fullPath);
          } else if (isImageFile(file.name)) {
            count++;
          }
        }
      } catch (error) {
        console.error(`统计目录图片失败 ${path}:`, error);
      }
      return count;
    };

    try {
      const assetsPath = '/data/assets';
      return await countImagesInDirectory(assetsPath);
    } catch (error) {
      console.error('统计思源图片失败:', error);
      return 0;
    }
  }

  /**
   * 聚合字数统计的核心 SQL 方法
   * @param startDate 开始日期字符串
   * @param endDate 结束日期字符串
   * @param subStrLen 截取日期字符串的长度 (4:年, 6:月, 8:日)
   * @param groupField 聚合字段名
   */
  private async getWordCountAggregation(startDate: string, endDate: string, subStrLen: number, groupField: string): Promise<any[]> {
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
    `;
    return await this.executeSql(sql);
  }

  /**
   * 获取每日统计（最近N天）- 使用 length 字段优化
   */
  private async getDailyStats(days: number): Promise<DailyWordCount[]> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const startDateStr = this.formatDate(startDate);
    const endDateStr = this.formatDate(today);

    const queryResult = await this.getWordCountAggregation(startDateStr, endDateStr, 8, 'date');

    // 创建日期到字数的映射
    const dateMap = new Map<string, number>();
    queryResult.forEach(row => {
      const dateStr = String(row.date);
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      const formattedDate = `${year}-${this.padZero(month)}-${this.padZero(day)}`;
      dateMap.set(formattedDate, row.total || 0);
    });

    // 生成完整的日期列表（包括没有数据的日期）
    const result: DailyWordCount[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dateStr = `${date.getFullYear()}-${this.padZero(date.getMonth() + 1)}-${this.padZero(date.getDate())}`;
      const words = dateMap.get(dateStr) || 0;

      result.push({
        date: dateStr,
        words,
        dateLabel: `${date.getMonth() + 1}/${date.getDate()} ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]}`,
      });
    }

    return result;
  }

  /**
   * 获取每周统计（最近N周）- 使用 length 字段优化
   */
  private async getWeeklyStats(weeks: number): Promise<DailyWordCount[]> {
    const today = new Date();
    const firstWeekStart = new Date(today);
    const dayOfWeek = firstWeekStart.getDay() || 7;
    firstWeekStart.setDate(today.getDate() - dayOfWeek + 1 - (weeks - 1) * 7);
    firstWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(today);
    const currentDayOfWeek = lastWeekEnd.getDay() || 7;
    lastWeekEnd.setDate(today.getDate() - currentDayOfWeek + 7);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const startDate = this.formatDate(firstWeekStart);
    const endDate = this.formatDate(lastWeekEnd);

    const queryResult = await this.getWordCountAggregation(startDate, endDate, 8, 'date');

    // 创建日期到字数的映射
    const dateMap = new Map<string, number>();
    queryResult.forEach(row => {
      dateMap.set(String(row.date), row.total || 0);
    });

    // 生成每周统计
    const result: DailyWordCount[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(today);
      const dow = weekStart.getDay() || 7;
      weekStart.setDate(today.getDate() - dow + 1 - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // 累计本周7天的字数
      let weekWords = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const dayStr = this.formatDate(day).substring(0, 8);
        weekWords += dateMap.get(dayStr) || 0;
      }

      result.push({
        date: `${weekStart.getFullYear()}-${this.padZero(weekStart.getMonth() + 1)}-${this.padZero(weekStart.getDate())}`,
        words: weekWords,
        dateLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
      });
    }

    return result;
  }

  /**
   * 获取最近N年的每月统计 - 使用 length 字段优化
   */
  private async getMonthlyStatsRange(years: number): Promise<DailyWordCount[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // 计算起始年月
    const startYear = currentYear - years + 1;
    const startDate = `${startYear}0101000000`;
    const endDate = this.formatDate(today);

    const queryResult = await this.getWordCountAggregation(startDate, endDate, 6, 'month');

    // 创建月份到字数的映射
    const monthMap = new Map<string, number>();
    queryResult.forEach(row => {
      monthMap.set(String(row.month), row.total || 0);
    });

    // 生成完整的月份列表（从起始年月到当前年月）
    const result: DailyWordCount[] = [];
      for (let y = startYear; y <= currentYear; y++) {
      const startM = 1;
      const endM = (y === currentYear) ? currentMonth : 12;


      for (let m = startM; m <= endM; m++) {
        const monthStr = this.padZero(m);
        const monthKey = `${y}${monthStr}`;
        const words = monthMap.get(monthKey) || 0;

        result.push({
          date: `${y}-${monthStr}`,
          words,
          dateLabel: `${y}/${m}`,
        });
      }
    }

    return result;
  }

  /**
   * 获取每年统计（最近N年）- 使用 length 字段优化
   */
  private async getYearlyStats(): Promise<DailyWordCount[]> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4;
    const startDate = `${startYear}0101000000`;
    const endDate = `${currentYear}1231235959`;

    const queryResult = await this.getWordCountAggregation(startDate, endDate, 4, 'year');

    // 创建年份到字数的映射
    const yearMap = new Map<string, number>();
    queryResult.forEach(row => {
      yearMap.set(String(row.year), row.total || 0);
    });

    // 生成5年的完整列表
    const result: DailyWordCount[] = [];
    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;
      const words = yearMap.get(String(year)) || 0;

      result.push({
        date: `${year}`,
        words,
        dateLabel: `${year}年`,
      });
    }

    return result;
  }


  /**
   * 格式化日期为思源笔记格式
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = this.padZero(date.getMonth() + 1);
    const day = this.padZero(date.getDate());
    const hour = this.padZero(date.getHours());
    const minute = this.padZero(date.getMinutes());
    const second = this.padZero(date.getSeconds());
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * 数字补零
   */
  private padZero(num: number): string {
    return num < 10 ? '0' + num : String(num);
  }



  /**
   * 执行 SQL 查询
   */
  private async executeSql(sql: string): Promise<any[]> {
    try {
      const response = await fetch('/api/query/sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stmt: sql }),
      });

      const data = await response.json();
      if (data.code === 0) {
        return data.data || [];
      } else {
        console.error('SQL 查询失败:', data.msg);
        return [];
      }
    } catch (error) {
      console.error('SQL 查询异常:', error);
      return [];
    }
  }

  /**
   * 启动定时更新任务
   */
  private startUpdateTimer(): void {
    // 清除现有定时器
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // 立即执行一次
    this.collectAndStoreStatistics();

    // 设置定时任务
    this.updateTimer = setInterval(() => {
      this.collectAndStoreStatistics();
    }, this.updateInterval);
  }

  /**
   * 停止定时更新任务
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * 收集并存储统计数据
   */
  private async collectAndStoreStatistics(): Promise<void> {
    try {
      const now = Date.now();
      // 避免频繁执行（间隔小于30秒）
      if (now - this.lastUpdateTime < 30000) {
        return;
      }

      const stats = await this.getStatistics();

      // 保存到数据库（按日期）
      const today = new Date();
      const dateKey = this.formatDateKey(today);
      const existingData = await this.plugin.loadData('statistics-history') || {};

      // 更新当日数据
      existingData[dateKey] = {
        date: dateKey,
        timestamp: now,
        totalNotes: stats.totalNotes,
        totalWords: stats.totalWords,
        todayCreated: stats.todayCreated,
        todayModified: stats.todayModified,
        avgWordsPerDoc: stats.avgWordsPerDoc
      };

      // 只保留最近365天的数据
      const keys = Object.keys(existingData).sort().reverse();
      if (keys.length > 365) {
        keys.slice(365).forEach(key => {
          delete existingData[key];
        });
      }

      await this.plugin.saveData('statistics-history', existingData);
      this.lastUpdateTime = now;

    } catch (error) {
      console.error('收集统计数据失败:', error);
    }
  }

  /**
   * 获取历史统计数据
   * @param days 获取的天数，如果不指定则返回所有历史数据（永久展示）
   */
  async getHistoricalStatistics(days?: number): Promise<any[]> {
    try {
      const historyData = await this.plugin.loadData('statistics-history') || {};
      const today = new Date();
      const result = [];
      let lastKnownStats = null; // 记录最后一次已知的统计数据

      // 如果未指定天数，则计算从最早数据到今天的天数（永久展示）
      let daysToProcess = days;
      if (days === undefined) {
        const dateKeys = Object.keys(historyData).sort();
        if (dateKeys.length > 0) {
          const earliestDate = new Date(dateKeys[0]);
          const diffTime = today.getTime() - earliestDate.getTime();
          daysToProcess = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } else {
          daysToProcess = 30; // 如果没有历史数据，默认30天
        }
      }

      // 生成日期范围（从最早到最晚，正序）
      for (let i = (daysToProcess || 30) - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = this.formatDateKey(date);
        const isToday = i === 0;

        const dayData = historyData[dateKey];

        if (dayData) {
          // 有历史数据，但需要检查是否是有效数据
          // 如果 totalWords 和 totalNotes 都是 0，说明是无效数据，应该跳过
          const isValidData = dayData.totalWords > 0 || dayData.totalNotes > 0;

          if (isValidData) {
            // 有效数据，直接使用
            const record = {
              date: dateKey,
              dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
              totalNotes: dayData.totalNotes,
              totalWords: dayData.totalWords,
              todayCreated: dayData.todayCreated,
              todayModified: dayData.todayModified,
              avgWordsPerDoc: dayData.avgWordsPerDoc
            };
            result.push(record);
            lastKnownStats = record; // 更新最后一次已知状态
          } else {
            // 无效数据，当作没有数据处理
            if (lastKnownStats) {
              result.push({
                date: dateKey,
                dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                totalNotes: lastKnownStats.totalNotes,
                totalWords: lastKnownStats.totalWords,
                todayCreated: 0,
                todayModified: 0,
                avgWordsPerDoc: lastKnownStats.avgWordsPerDoc
              });
            } else if (isToday) {
              // 如果今天是无效数据，尝试获取实时数据
              try {
                const currentStats = await this.getStatistics();
                const record = {
                  date: dateKey,
                  dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                  totalNotes: currentStats.totalNotes,
                  totalWords: currentStats.totalWords,
                  todayCreated: currentStats.todayCreated,
                  todayModified: currentStats.todayModified,
                  avgWordsPerDoc: currentStats.avgWordsPerDoc
                };
                result.push(record);
                lastKnownStats = record;
              } catch (error) {
                console.error('获取今日实时数据失败:', error);
                result.push({
                  date: dateKey,
                  dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                  totalNotes: 0,
                  totalWords: 0,
                  todayCreated: 0,
                  todayModified: 0,
                  avgWordsPerDoc: 0
                });
              }
            } else {
              // 填充0
              result.push({
                date: dateKey,
                dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                totalNotes: 0,
                totalWords: 0,
                todayCreated: 0,
                todayModified: 0,
                avgWordsPerDoc: 0
              });
            }
          }
        } else if (isToday) {
          // 今天没有历史数据，尝试获取实时数据
          try {
            const currentStats = await this.getStatistics();
            const record = {
              date: dateKey,
              dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
              totalNotes: currentStats.totalNotes,
              totalWords: currentStats.totalWords,
              todayCreated: currentStats.todayCreated,
              todayModified: currentStats.todayModified,
              avgWordsPerDoc: currentStats.avgWordsPerDoc
            };
            result.push(record);
            lastKnownStats = record;
          } catch (error) {
            console.error('获取今日实时数据失败:', error);
            // 获取失败时，使用最后一次已知的数据（如果有）
            if (lastKnownStats) {
              result.push({
                date: dateKey,
                dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                totalNotes: lastKnownStats.totalNotes,
                totalWords: lastKnownStats.totalWords,
                todayCreated: 0,
                todayModified: 0,
                avgWordsPerDoc: lastKnownStats.avgWordsPerDoc
              });
            } else {
              result.push({
                date: dateKey,
                dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                totalNotes: 0,
                totalWords: 0,
                todayCreated: 0,
                todayModified: 0,
                avgWordsPerDoc: 0
              });
            }
          }
        } else {
          // 过去某天没有历史数据
          if (lastKnownStats) {
            // 使用最后一次已知的数据，表示这天没有新的统计，但总数保持不变
            result.push({
              date: dateKey,
              dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
              totalNotes: lastKnownStats.totalNotes,
              totalWords: lastKnownStats.totalWords,
              todayCreated: 0,
              todayModified: 0,
              avgWordsPerDoc: lastKnownStats.avgWordsPerDoc
            });
          } else {
            // 还没有任何已知数据，填充0
            result.push({
              date: dateKey,
              dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
              totalNotes: 0,
              totalWords: 0,
              todayCreated: 0,
              todayModified: 0,
              avgWordsPerDoc: 0
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error('获取历史统计数据失败:', error);
      return [];
    }
  }

  /**
   * 更新定时任务间隔
   */
  async updateUpdateInterval(interval: number): Promise<void> {
    this.updateInterval = interval;
    // 保存到设置
    try {
      const settings = await this.plugin.loadData('plugin-settings') || {};
      settings.statisticsUpdateInterval = interval;
      await this.plugin.saveData('plugin-settings', settings);
    } catch (error) {
      console.error('保存更新间隔设置失败:', error);
    }

    // 重新启动定时器
    this.startUpdateTimer();
  }

  /**
   * 手动触发数据收集
   */
  async manualRefresh(): Promise<void> {
    await this.collectAndStoreStatistics();

    // 如果面板已打开，刷新显示
    if (this.vueApp) {
      await this.getStatistics();
      // 这里可以根据需要通知 Vue 组件更新
    }
  }


  /**
   * 格式化日期为键值
   */
  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = this.padZero(date.getMonth() + 1);
    const day = this.padZero(date.getDate());
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取周目标设置
   */
  async getWeeklyGoal(): Promise<WeeklyGoalSettings> {
    try {
      const data = await this.plugin.loadData(STATISTICS_STORAGE_KEYS.WEEKLY_GOAL);
      if (data) {
        return {
          created: data.created ?? DEFAULT_WEEKLY_GOAL.created,
          words: data.words ?? DEFAULT_WEEKLY_GOAL.words,
        };
      }
      return { ...DEFAULT_WEEKLY_GOAL };
    } catch (error) {
      console.error('获取周目标设置失败:', error);
      return { ...DEFAULT_WEEKLY_GOAL };
    }
  }

  /**
   * 保存周目标设置
   */
  async saveWeeklyGoal(goal: WeeklyGoalSettings): Promise<boolean> {
    try {
      await this.plugin.saveData(STATISTICS_STORAGE_KEYS.WEEKLY_GOAL, goal);
      return true;
    } catch (error) {
      console.error('保存周目标设置失败:', error);
      return false;
    }
  }

  /**
   * 销毁模块
   */
  destroy() {
    // 停止定时任务
    this.stopUpdateTimer();

    // 清理 Vue 实例
    if (this.vueApp) {
      this.vueApp.unmount();
      this.vueApp = null;
    }
    // 清理资源
    this.dockElement = null;
  }
}
