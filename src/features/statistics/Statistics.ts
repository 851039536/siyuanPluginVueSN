import { Plugin } from 'siyuan';
import { createApp, App as VueApp } from 'vue';
import StatisticsPanel from './StatisticsPanel.vue';
import { StatisticsCache } from './storage';

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
  private currentYear: number;
  private viewMode: 'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot' = 'day'; // 当前查看模式
  private dayRange: 7 | 15 | 30 | 90 | 180 | 365 = 7; // 日视图的天数范围
  private monthYearRange: 1 | 2 | 3 = 1; // 月视图的年份范围
  private statisticsTheme: 'default' | 'github' = 'default'; // 统计面板主题风格
  private updateInterval: number = 60000; // 定时更新间隔（毫秒），默认1分钟
  private updateTimer: NodeJS.Timeout | null = null; // 定时器实例
  private lastUpdateTime: number = 0; // 上次更新时间戳
  private cache: StatisticsCache; // 缓存管理器

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.cache = new StatisticsCache(plugin);
  }

  /**
   * 初始化统计模块
   */
  async init() {
    // 加载保存的主题设置和更新间隔
    try {
      const settings = await this.plugin.loadData('plugin-settings');
      if (settings) {
        if (settings.statisticsTheme) {
          this.statisticsTheme = settings.statisticsTheme;
        }
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
      console.log('收到打开统计面板事件');
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
    console.log('注册统计面板 Dock');

    this.plugin.addDock({
      config: {
        position: 'RightBottom',
        size: { width: 350, height: 0 },
        icon: 'iconDatabase', // 使用数据库图标，适合数据统计
        title: this.plugin.i18n.statisticsPanel,
        show: false,
      },
      data: {},
      type: 'statistics-dock',
      init: (dock) => {
        console.log('统计面板 Dock 初始化完成');
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
      i18n: this.plugin.i18n,
      theme: this.statisticsTheme,
      onThemeChange: async (theme: 'default' | 'github') => {
        this.statisticsTheme = theme;
        // 保存主题设置
        try {
          const settings = await this.plugin.loadData('plugin-settings');
          if (settings) {
            settings.statisticsTheme = theme;
            await this.plugin.saveData('plugin-settings', settings);
          }
        } catch (error) {
          console.error('保存主题设置失败:', error);
        }
      },
      onRefresh: async (params: {
        viewMode: 'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot'
        dayRange?: 7 | 15 | 30 | 90 | 180 | 365
        monthYearRange?: 1 | 2 | 3
        selectedYear?: number
      }) => {
        // 更新内部状态
        this.viewMode = params.viewMode;
        if (params.dayRange) this.dayRange = params.dayRange;
        if (params.monthYearRange) this.monthYearRange = params.monthYearRange;
        if (params.selectedYear) this.currentYear = params.selectedYear;

        // 快照模式也需要获取统计数据以显示顶部卡片
        return await this.getStatistics();
      },
      onGetHistoricalData: async (days?: number) => {
        return await this.getHistoricalStatistics(days || 30);
      },
      onGetSnapshots: async (count?: number) => {
        return await this.cache.getRecentSnapshots(count || 20);
      },
      onClearSnapshots: async () => {
        await this.cache.clearSnapshots();
      },
    });

    this.vueApp.mount(container);
  }

  /**
   * 旧的渲染方法（已废弃，保留作为参考）
   */
  private async renderDockPanelOld() {
    if (!this.dockElement) return;

    // 获取统计数据
    const stats = await this.getStatistics();

    this.dockElement.innerHTML = `
      <div style="padding: 16px; height: 100%; box-sizing: border-box; overflow-y: auto; background: var(--b3-theme-background);">
        <!-- 顶部卡片统计 -->
        <div style="margin-bottom: 16px;">
          <!-- 主要统计：笔记总数 | 总字数 -->
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: 700; line-height: 1.2;">${stats.totalNotes}</div>
              <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">📓 ${this.plugin.i18n.totalNotes}</div>
            </div>
            <div style="flex: 1; padding: 12px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 6px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: 700; line-height: 1.2;">${this.formatNumber(stats.totalWords)}</div>
              <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">✍️ ${this.plugin.i18n.totalWords}</div>
            </div>
          </div>

          <!-- 次要统计：内容块 | 附件 | 标签 | 双链 -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
            <div style="padding: 10px 8px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 6px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.08); text-align: center;">
              <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${this.formatShortNumber(stats.totalBlocks)}</div>
              <div style="font-size: 10px; opacity: 0.9; margin-top: 3px;">🧩 ${this.plugin.i18n.totalBlocks}</div>
            </div>
            <div style="padding: 10px 8px; background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); border-radius: 6px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.08); text-align: center;">
              <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${this.formatShortNumber(stats.totalAssets)}</div>
              <div style="font-size: 10px; opacity: 0.9; margin-top: 3px;">📎 ${this.plugin.i18n.totalAssets}</div>
            </div>
            <div style="padding: 10px 8px; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); border-radius: 6px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.08); text-align: center;">
              <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${this.formatShortNumber(stats.totalTags)}</div>
              <div style="font-size: 10px; opacity: 0.9; margin-top: 3px;">🏷️ ${this.plugin.i18n.totalTags}</div>
            </div>
            <div style="padding: 10px 8px; background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); border-radius: 6px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.08); text-align: center;">
              <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${this.formatShortNumber(stats.totalBacklinks)}</div>
              <div style="font-size: 10px; opacity: 0.9; margin-top: 3px;">🔗 ${this.plugin.i18n.totalBacklinks}</div>
            </div>
          </div>
        </div>

        <!-- 查看模式切换 -->
        <div style="margin-bottom: 16px; padding: 12px; background: var(--b3-theme-surface); border-radius: 8px;">
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button class="view-mode-btn" data-mode="day" style="flex: 1; padding: 8px; border: 2px solid ${this.viewMode === 'day' ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.viewMode === 'day' ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.viewMode === 'day' ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s;">📅 ${this.plugin.i18n.dayView}</button>
            <button class="view-mode-btn" data-mode="week" style="flex: 1; padding: 8px; border: 2px solid ${this.viewMode === 'week' ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.viewMode === 'week' ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.viewMode === 'week' ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s;">📊 ${this.plugin.i18n.weekView}</button>
            <button class="view-mode-btn" data-mode="month" style="flex: 1; padding: 8px; border: 2px solid ${this.viewMode === 'month' ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.viewMode === 'month' ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.viewMode === 'month' ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s;">📆 ${this.plugin.i18n.monthView}</button>
            <button class="view-mode-btn" data-mode="year" style="flex: 1; padding: 8px; border: 2px solid ${this.viewMode === 'year' ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.viewMode === 'year' ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.viewMode === 'year' ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s;">📈 ${this.plugin.i18n.yearView}</button>
          </div>

          ${this.viewMode === 'day' ? `
          <div style="margin-top: 8px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              <button class="day-range-btn" data-range="7" style="padding: 6px 8px; border: 2px solid ${this.dayRange === 7 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.dayRange === 7 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.dayRange === 7 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent7Days || '7天'}</button>
              <button class="day-range-btn" data-range="15" style="padding: 6px 8px; border: 2px solid ${this.dayRange === 15 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.dayRange === 15 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.dayRange === 15 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent15Days || '15天'}</button>
              <button class="day-range-btn" data-range="30" style="padding: 6px 8px; border: 2px solid ${this.dayRange === 30 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.dayRange === 30 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.dayRange === 30 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent30Days || '30天'}</button>
              <button class="day-range-btn" data-range="90" style="padding: 6px 8px; border: 2px solid ${this.dayRange === 90 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.dayRange === 90 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.dayRange === 90 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent90Days || '季度'}</button>
              <button class="day-range-btn" data-range="180" style="padding: 6px 8px; border: 2px solid ${this.dayRange === 180 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.dayRange === 180 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.dayRange === 180 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent180Days || '半年'}</button>
              <button class="day-range-btn" data-range="365" style="padding: 6px 8px; border: 2px solid ${this.dayRange === 365 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.dayRange === 365 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.dayRange === 365 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent365Days || '整年'}</button>
            </div>
          </div>
          ` : ''}

          ${this.viewMode === 'month' ? `
          <div style="margin-top: 8px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              <button class="month-year-range-btn" data-range="1" style="padding: 6px 8px; border: 2px solid ${this.monthYearRange === 1 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.monthYearRange === 1 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.monthYearRange === 1 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recentYear || '最近一年'}</button>
              <button class="month-year-range-btn" data-range="2" style="padding: 6px 8px; border: 2px solid ${this.monthYearRange === 2 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.monthYearRange === 2 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.monthYearRange === 2 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent2Years || '最近两年'}</button>
              <button class="month-year-range-btn" data-range="3" style="padding: 6px 8px; border: 2px solid ${this.monthYearRange === 3 ? 'var(--b3-theme-primary)' : 'var(--b3-border-color)'}; background: ${this.monthYearRange === 3 ? 'var(--b3-theme-primary-light)' : 'var(--b3-theme-background)'}; color: ${this.monthYearRange === 3 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-background)'}; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;">${this.plugin.i18n.recent3Years || '最近三年'}</button>
            </div>
          </div>
          ` : ''}

          ${this.viewMode === 'year' ? `
          <div style="margin-top: 8px;">
            <select id="yearSelect" style="width: 100%; padding: 6px 8px; border: 1px solid var(--b3-border-color); border-radius: 4px; background: var(--b3-theme-background); color: var(--b3-theme-on-background); cursor: pointer; font-size: 13px;">
              ${this.generateYearOptions()}
            </select>
          </div>
          ` : ''}
        </div>

        <!-- 字数统计详情 -->
        <div style="margin-bottom: 16px; padding: 16px; background: var(--b3-theme-surface); border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--b3-theme-on-surface);">
            ${stats.currentPeriod}
          </h3>

          <!-- 柱状图 -->
          ${stats.dailyStats.length > 0 ? `
          <div style="margin-bottom: 16px;">
            ${this.renderBarChart(stats.dailyStats)}
          </div>
          ` : ''}

          <!-- 每日字数列表 -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${stats.dailyStats.length > 0 ? stats.dailyStats.map(day => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--b3-theme-background); border-radius: 6px; border-left: 3px solid ${day.words > 0 ? '#667eea' : '#ddd'};">
                <span style="font-size: 13px; color: var(--b3-theme-on-surface); font-weight: 500;">${day.dateLabel}</span>
                <span style="font-size: 14px; font-weight: 700; color: ${day.words > 0 ? 'var(--b3-theme-primary)' : 'var(--b3-theme-on-surface-light)'};">${this.formatNumber(day.words)}</span>
              </div>
            `).join('') : '<div style="text-align: center; padding: 20px; color: var(--b3-theme-on-surface-light); font-size: 13px;">' + this.plugin.i18n.noData + '</div>'}
          </div>
        </div>

        <!-- 最后更新时间 -->
        <div style="padding-top: 8px; border-top: 1px solid var(--b3-border-color); font-size: 11px; color: var(--b3-theme-on-surface-light); text-align: center;">
          ${this.plugin.i18n.lastUpdate}: ${new Date().toLocaleString('zh-CN')}
        </div>
      </div>
    `;

    // 绑定事件
    this.bindPanelEvents();
  }

  /**
   * 绑定面板事件监听
   */
  private bindPanelEvents() {
    if (!this.dockElement) return;

    // 绑定查看模式切换按钮
    const modeButtons = this.dockElement.querySelectorAll('.view-mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.target as HTMLElement).getAttribute('data-mode') as 'day' | 'week' | 'month' | 'year';
        if (mode) {
          this.viewMode = mode;
          this.renderDockPanel();
        }
      });
    });

    // 绑定日视图范围按钮
    const dayRangeButtons = this.dockElement.querySelectorAll('.day-range-btn');
    dayRangeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const range = parseInt((e.target as HTMLElement).getAttribute('data-range') || '7');
        this.dayRange = range as 7 | 15 | 30 | 90 | 180 | 365;
        this.renderDockPanel();
      });
    });

    // 绑定月视图年份范围按钮
    const monthYearRangeButtons = this.dockElement.querySelectorAll('.month-year-range-btn');
    monthYearRangeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const range = parseInt((e.target as HTMLElement).getAttribute('data-range') || '1');
        this.monthYearRange = range as 1 | 2 | 3;
        this.renderDockPanel();
      });
    });

    // 绑定年份选择
    const yearSelect = this.dockElement.querySelector('#yearSelect') as HTMLSelectElement;
    if (yearSelect) {
      yearSelect.value = String(this.currentYear);
      yearSelect.addEventListener('change', (e) => {
        this.currentYear = parseInt((e.target as HTMLSelectElement).value);
        this.renderDockPanel();
      });
    }
  }

  /**
   * 生成年份选项
   */
  private generateYearOptions(): string {
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // 起始年份
    let options = '';
    for (let year = currentYear; year >= startYear; year--) {
      options += `<option value="${year}">${year}</option>`;
    }
    return options;
  }

  /**
   * 格式化数字,添加千分位分隔符
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('zh-CN');
  }

  /**
   * 渲染柱状图
   */
  private renderBarChart(data: DailyWordCount[]): string {
    if (data.length === 0) return '';

    // 计算最大值用于比例计算
    const maxWords = Math.max(...data.map(d => d.words));
    const maxHeight = 150; // 柱状图最大高度（像素）

    return `
      <div style="padding: 12px; background: var(--b3-theme-background); border-radius: 6px; overflow-x: auto;">
        <div style="display: flex; align-items: flex-end; gap: ${data.length > 20 ? '4px' : '8px'}; min-height: ${maxHeight + 40}px; padding-bottom: 30px; position: relative;">
          ${data.map(day => {
            const height = maxWords > 0 ? (day.words / maxWords) * maxHeight : 0;
            const barWidth = data.length > 20 ? '20px' : data.length > 10 ? '24px' : '32px';
            const isToday = this.isToday(day.date);
            return `
              <div style="flex: ${data.length > 12 ? '0 0 auto' : '1'}; display: flex; flex-direction: column; align-items: center; min-width: ${barWidth}; position: relative;">
                <!-- 数值提示 -->
                ${day.words > 0 ? `
                <div style="position: absolute; bottom: ${height + 5}px; font-size: 10px; color: ${isToday ? '#f5576c' : 'var(--b3-theme-on-surface-light)'}; white-space: nowrap; transform: translateX(-50%); left: 50%; font-weight: ${isToday ? '700' : '400'};">
                  ${this.formatShortNumber(day.words)}
                </div>
                ` : ''}
                <!-- 柱子 -->
                <div style="
                  width: 100%;
                  height: ${height}px;
                  background: ${isToday ? 'linear-gradient(180deg, #f093fb 0%, #f5576c 100%)' : 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'};
                  border-radius: 4px 4px 0 0;
                  transition: all 0.3s ease;
                  box-shadow: ${day.words > 0 ? (isToday ? '0 4px 8px rgba(245, 87, 108, 0.4)' : '0 2px 4px rgba(102, 126, 234, 0.3)') : 'none'};
                  cursor: pointer;
                  position: relative;
                  ${height < 5 && day.words > 0 ? 'min-height: 5px;' : ''}
                  ${isToday ? 'border: 2px solid #f5576c;' : ''}
                " title="${day.dateLabel}: ${this.formatNumber(day.words)} ${this.plugin.i18n.words}${isToday ? ' (' + this.plugin.i18n.today + ')' : ''}"></div>
                <!-- 日期标签 -->
                <div style="
                  position: absolute;
                  bottom: -25px;
                  font-size: ${data.length > 20 ? '9px' : '10px'};
                  color: ${isToday ? '#f5576c' : 'var(--b3-theme-on-surface-light)'};
                  font-weight: ${isToday ? '700' : '400'};
                  transform: rotate(-45deg);
                  transform-origin: top left;
                  white-space: nowrap;
                  left: 50%;
                ">${this.formatChartLabel(day.dateLabel, this.viewMode)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 格式化图表标签
   */
  private formatChartLabel(label: string, mode: 'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot'): string {
    if (mode === 'day') {
      // 保留完整格式 "11/26 周二"
      return label;
    } else if (mode === 'month') {
      // 从 "2024年 11月" 提取 "11月"
      return label.split(' ')[1] || label;
    }
    return label;
  }

  /**
   * 判断是否为今天
   */
  private isToday(dateStr: string): boolean {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${this.padZero(today.getMonth() + 1)}-${this.padZero(today.getDate())}`;

    // 处理不同格式的日期字符串
    // 可能是 "YYYY-MM-DD" 或 "YYYY-MM" 或 "YYYY"
    if (dateStr.length === 10) {
      // YYYY-MM-DD 格式
      return dateStr === todayStr;
    } else if (dateStr.length === 7) {
      // YYYY-MM 格式（月视图）
      return dateStr === todayStr.substring(0, 7);
    } else if (dateStr.length === 4) {
      // YYYY 格式（年视图）
      return dateStr === String(today.getFullYear());
    }
    return false;
  }

  /**
   * 格式化简短数字（K、M表示）
   */
  private formatShortNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return String(num);
  }

  /**
   * 获取统计数据
   */
  private async getStatistics(): Promise<StatisticsData> {
    try {
      // 并行获取所有基础统计（移除热门标签和最近文档）
      const [
        totalNotes,
        totalWords,
        totalBlocks,
        totalAssets,
        totalTags,
        totalBacklinks,
        todayCreated,
        todayModified
      ] = await Promise.all([
        this.getTotalNotes(),
        this.getTotalWords(),
        this.getTotalBlocks(),
        this.getTotalAssets(),
        this.getTotalTags(),
        this.getTotalBacklinks(),
        this.getTodayCreated(),
        this.getTodayModified()
      ]);

      // 计算平均每文档字数
      const avgWordsPerDoc = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0;

      // 根据不同模式获取每日统计
      let dailyStats: DailyWordCount[] = [];
      let currentPeriod = '';
      let periodTotalWords = 0;

      switch (this.viewMode) {
        case 'day':
          dailyStats = await this.getDailyStats(this.dayRange);
          const dayPeriodMap: Record<number, string> = {
            7: this.plugin.i18n.recentWeekDaily || '最近一周每日字数',
            15: this.plugin.i18n.recent15DaysDaily || '最近15天每日字数',
            30: this.plugin.i18n.recent30DaysDaily || '最近30天每日字数',
            90: this.plugin.i18n.recent90DaysDaily || '最近一季度每日字数',
            180: this.plugin.i18n.recent180DaysDaily || '最近半年每日字数',
            365: this.plugin.i18n.recent365DaysDaily || '最近一年每日字数'
          };
          currentPeriod = dayPeriodMap[this.dayRange] || '每日字数统计';
          periodTotalWords = dailyStats.reduce((sum, item) => sum + item.words, 0);
          break;
        case 'week':
          dailyStats = await this.getWeeklyStats(4); // 最近4周
          currentPeriod = this.plugin.i18n.recentWeeksWeekly;
          periodTotalWords = dailyStats.reduce((sum, item) => sum + item.words, 0);
          break;
        case 'month':
          dailyStats = await this.getMonthlyStatsRange(this.monthYearRange);
          const monthPeriodMap: Record<number, string> = {
            1: this.plugin.i18n.recentYearMonthly || '最近一年每月字数',
            2: this.plugin.i18n.recent2YearsMonthly || '最近两年每月字数',
            3: this.plugin.i18n.recent3YearsMonthly || '最近三年每月字数'
          };
          currentPeriod = monthPeriodMap[this.monthYearRange] || '每月字数统计';
          periodTotalWords = dailyStats.reduce((sum, item) => sum + item.words, 0);
          break;
        case 'year':
          dailyStats = await this.getYearlyStats(); // 最近5年
          currentPeriod = this.plugin.i18n.recentYearsYearly;
          periodTotalWords = dailyStats.reduce((sum, item) => sum + item.words, 0);
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
      };
    }
  }

  /**
   * 获取今日新增文档数
   */
  private async getTodayCreated(): Promise<number> {
    const today = new Date();
    const startDate = this.formatDate(today).substring(0, 8);
    const sql = `SELECT COUNT(DISTINCT root_id) as count FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${startDate}'`;
    const result = await this.executeSql(sql);
    return result[0]?.count || 0;
  }

  /**
   * 获取今日修改文档数
   */
  private async getTodayModified(): Promise<number> {
    const today = new Date();
    const startDate = this.formatDate(today).substring(0, 8);
    const sql = `SELECT COUNT(DISTINCT root_id) as count FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${startDate}'`;
    const result = await this.executeSql(sql);
    return result[0]?.count || 0;
  }

  /**
   * 格式化时间戳为可读日期
   */
  private formatTimestamp(timestamp: string): string {
    if (timestamp.length !== 14) return timestamp;

    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);

    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  /**
   * 获取总笔记数量
   */
  private async getTotalNotes(): Promise<number> {
    const sql = `SELECT COUNT(DISTINCT root_id) as count FROM blocks WHERE type='d'`;
    const result = await this.executeSql(sql);
    return result[0]?.count || 0;
  }

  /**
   * 获取总字数
   * 只统计段落内容，避免重复统计
   */
  private async getTotalWords(): Promise<number> {
    // 思源笔记官方统计可能只统计段落（type='p'）
    // 标题、列表等可能已经包含在段落中，避免重复统计
    const sql = `
      SELECT SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
    `;
    const result = await this.executeSql(sql);
    return result[0]?.total || 0;
  }

  /**
   * 计算字符串的字数
   * 使用思源笔记的统计方式：直接使用 length
   */
  private calculateWordCount(text: string): number {
    if (!text) return 0;

    // 使用简单的字符长度统计
    // 这是思源笔记内部使用的统计方式
    return text.length;
  }

  /**
   * 获取总块数（所有类型的内容块）
   */
  private async getTotalBlocks(): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM blocks WHERE type IN ('p', 'h', 'l', 'i', 't', 'c', 'html', 'query_embed')`;
    const result = await this.executeSql(sql);
    return result[0]?.count || 0;
  }

  /**
   * 获取总附件数（图片、音频、视频、文件）
   */
  private async getTotalAssets(): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM blocks WHERE type IN ('img', 'audio', 'video', 'widget', 'iframe')`;
    const result = await this.executeSql(sql);
    return result[0]?.count || 0;
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
   * 获取总双链数（引用关系）
   */
  private async getTotalBacklinks(): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM refs`;
    const result = await this.executeSql(sql);
    return result[0]?.count || 0;
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

    // 直接使用 length 字段按日期聚合
    const sql = `
      SELECT
        substr(created, 1, 8) as date,
        SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
        AND created >= '${startDateStr}'
        AND created <= '${endDateStr}'
      GROUP BY substr(created, 1, 8)
      ORDER BY date
    `;

    const queryResult = await this.executeSql(sql);

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
        dateLabel: `${date.getMonth() + 1}/${date.getDate()} ${[this.plugin.i18n.sunday, this.plugin.i18n.monday, this.plugin.i18n.tuesday, this.plugin.i18n.wednesday, this.plugin.i18n.thursday, this.plugin.i18n.friday, this.plugin.i18n.saturday][date.getDay()]}`,
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

    // 直接使用 length 字段按日期聚合
    const sql = `
      SELECT
        substr(created, 1, 8) as date,
        SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
        AND created >= '${startDate}'
        AND created <= '${endDate}'
      GROUP BY substr(created, 1, 8)
      ORDER BY date
    `;

    const queryResult = await this.executeSql(sql);

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
   * 获取每月统计（整年）- 使用 length 字段优化
   */
  private async getMonthlyStats(year: number): Promise<DailyWordCount[]> {
    const startDate = `${year}0101000000`;
    const endDate = `${year}1231235959`;

    // 直接使用 length 字段按月份聚合
    const sql = `
      SELECT
        substr(created, 1, 6) as month,
        SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
        AND created >= '${startDate}'
        AND created <= '${endDate}'
      GROUP BY substr(created, 1, 6)
      ORDER BY month
    `;

    const queryResult = await this.executeSql(sql);

    // 创建月份到字数的映射
    const monthMap = new Map<string, number>();
    queryResult.forEach(row => {
      monthMap.set(String(row.month), row.total || 0);
    });

    // 生成12个月的完整列表
    const result: DailyWordCount[] = [];
    for (let month = 1; month <= 12; month++) {
      const monthStr = this.padZero(month);
      const monthKey = `${year}${monthStr}`;
      const words = monthMap.get(monthKey) || 0;

      result.push({
        date: `${year}-${monthStr}`,
        words,
        dateLabel: `${year}${this.plugin.i18n.year} ${month}${this.plugin.i18n.month}`,
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

    // 直接使用 length 字段按月份聚合
    const sql = `
      SELECT
        substr(created, 1, 6) as month,
        SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
        AND created >= '${startDate}'
        AND created <= '${endDate}'
      GROUP BY substr(created, 1, 6)
      ORDER BY month
    `;

    const queryResult = await this.executeSql(sql);

    // 创建月份到字数的映射
    const monthMap = new Map<string, number>();
    queryResult.forEach(row => {
      monthMap.set(String(row.month), row.total || 0);
    });

    // 生成完整的月份列表（从起始年月到当前年月）
    const result: DailyWordCount[] = [];
    for (let y = startYear; y <= currentYear; y++) {
      const startM = (y === startYear) ? 1 : 1;
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

    // 直接使用 length 字段按年份聚合
    const sql = `
      SELECT
        substr(created, 1, 4) as year,
        SUM(LENGTH(content)) as total
      FROM blocks
      WHERE type = 'p'
        AND content IS NOT NULL
        AND content != ''
        AND created >= '${startDate}'
        AND created <= '${endDate}'
      GROUP BY substr(created, 1, 4)
      ORDER BY year
    `;

    const queryResult = await this.executeSql(sql);

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
        dateLabel: `${year}${this.plugin.i18n.year}`,
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

    console.log(`启动统计定时任务，更新间隔: ${this.updateInterval / 1000}秒`);

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
      console.log('已停止统计定时任务');
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

      console.log('开始收集统计数据...');
      const stats = await this.getStatistics();

      // 保存快照到缓存
      await this.cache.addSnapshot({
        timestamp: now,
        totalNotes: stats.totalNotes,
        totalWords: stats.totalWords,
        totalBlocks: stats.totalBlocks,
        totalAssets: stats.totalAssets,
        totalTags: stats.totalTags,
        totalBacklinks: stats.totalBacklinks,
        todayCreated: stats.todayCreated,
        todayModified: stats.todayModified,
        avgWordsPerDoc: stats.avgWordsPerDoc
      });

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

      console.log(`统计数据已保存: ${dateKey}`, existingData[dateKey]);
    } catch (error) {
      console.error('收集统计数据失败:', error);
    }
  }

  /**
   * 获取历史统计数据
   */
  async getHistoricalStatistics(days: number = 30): Promise<any[]> {
    try {
      const historyData = await this.plugin.loadData('statistics-history') || {};
      const today = new Date();
      const result = [];

      // 生成日期范围
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = this.formatDateKey(date);

        const dayData = historyData[dateKey];
        if (dayData) {
          result.push({
            date: dateKey,
            dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
            totalNotes: dayData.totalNotes,
            totalWords: dayData.totalWords,
            todayCreated: dayData.todayCreated,
            todayModified: dayData.todayModified,
            avgWordsPerDoc: dayData.avgWordsPerDoc
          });
        } else {
          // 如果没有数据，复制前一个有效数据（如果存在）
          // 这避免了连续天数显示为0导致的负增长问题
          const lastValidData = result.length > 0 ? result[result.length - 1] : null;
          if (lastValidData && lastValidData.totalWords > 0) {
            // 使用前一天的数据，避免显示为负增长
            result.push({
              date: dateKey,
              dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
              totalNotes: lastValidData.totalNotes,
              totalWords: lastValidData.totalWords,
              todayCreated: 0,  // 当天没有新增
              todayModified: 0,  // 当天没有修改
              avgWordsPerDoc: lastValidData.avgWordsPerDoc
            });
          } else {
            // 确实没有数据，填充0
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
    console.log(`更新定时任务间隔: ${interval / 1000}秒`);

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
    console.log('手动刷新统计数据');
    await this.collectAndStoreStatistics();

    // 如果面板已打开，刷新显示
    if (this.vueApp) {
      const stats = await this.getStatistics();
      // 这里可以添加刷新Vue组件的逻辑
      console.log('统计数据已更新:', stats);
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
