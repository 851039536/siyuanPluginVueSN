/**
 * 通用设置功能模块
 * 提供模块化的通用配置功能，包括字体设置、外观设置等
 */
import { Plugin, showMessage } from 'siyuan';
import { createApp, h } from 'vue';
// @ts-ignore
import GeneralSettingsPanel from './GeneralSettingsPanel.vue';
import { loadCodeBlockSettings, loadListSettingsFromDB, loadHeadingSettings } from '@/config/settings';
import JSZip from 'jszip';

export function checkIsMobile(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
  const screenWidth = window.innerWidth <= 768;
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSiyuanMobile = (window as any)._siyuan_mobile === true;
  return mobileUA || screenWidth || (hasTouchScreen && mobileUA) || isSiyuanMobile;
}

const CODEBLOCK_STYLES = ['default', 'github', 'mac', 'cartoon'] as const;
type CodeBlockStyle = typeof CODEBLOCK_STYLES[number];

export const HEADING_LEVEL_MAPPINGS: Record<string, string[]> = {
  number: ['1', '2', '3', '4', '5', '6'],
  roman: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  chinese: ['一', '二', '三', '四', '五', '六'],
  chineseUpper: ['壹', '贰', '叁', '肆', '伍', '陆'],
  dots: ['•', '••', '•••', '••••', '•••••', '••••••'],
  emoji: ['😀', '😁', '😂', '🤣', '😊', '😎'],
  star: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐'],
  arrow: ['→', '→→', '→→→', '→→→→', '→→→→→', '→→→→→→'],
  tag: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
  bracket: ['[1]', '[2]', '[3]', '[4]', '[5]', '[6]']
};

export function applyCodeBlockStyle(style: CodeBlockStyle | string): void {
  CODEBLOCK_STYLES.forEach(s => document.body.classList.remove(`codeblock-style-${s}`));
  document.body.classList.add(`codeblock-style-${style}`);
}

/**
 * 通用设置类
 */
export class GeneralSettings {
  private plugin: Plugin;
  private autoBackupTimer: number | null = null;
  private lastBackupTimestamp = 0;
  private workspacePath = '';
  private workspaceRoot = '';

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * 初始化通用设置功能
   */
  public async init() {
    this.addDock();
    this.applySavedSettings(); // 应用已保存的设置
    await this.applyCodeBlockStyle(); // 应用代码块样式
    await this.applyListStyle(); // 应用列表样式
    await this.applyHeadingStyle(); // 应用标题样式

    // 监听页面内容变化，确保样式持续应用
    this.observeContentChanges();

    // 启动自动备份定时器
    await this.initAutoBackup();

  }

  /**
   * 添加通用设置 Dock 到右侧边栏
   */
  private addDock() {
    const self = this;
    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 360, height: 0 }, // 统一右侧边栏宽度
        icon: 'iconSettings',
        title: this.plugin.i18n.generalSettings || '通用设置',
        show: false,
      },
      data: {},
      type: 'general-settings-dock',
      init: (dock: any) => {
        const container = document.createElement('div');
        container.style.height = '100%';
        container.style.overflow = 'hidden';

        const app = createApp({
          setup() {
            return () => h(GeneralSettingsPanel, {
              i18n: self.plugin.i18n,
              plugin: self.plugin,
              onSettingsChange: (settings: any) => {
                self.handleSettingsChange(settings);
              }
            });
          }
        });

        app.mount(container);
        dock.element?.appendChild(container);

        dock.__app = app;
        dock.__container = container;
      },
    });
  }

  /**
   * 处理设置变化
   */
  private handleSettingsChange(settings: any) {

    // 根据模块类型处理不同的设置
    if (settings.moduleId === 'font') {
      this.applyGlobalFontStyles(settings.settings);
    } else if (settings.moduleId === 'codeblock') {
      this.applyCodeBlockStyleFromSettings(settings.settings);
    } else if (settings.moduleId === 'list') {
      this.applyListStyles(settings.settings);
    }
    // 未来可以添加更多模块的处理逻辑
    // else if (settings.moduleId === 'appearance') {
    //   this.applyAppearanceStyles(settings.settings);
    // }

    this.dispatchEvent('general-settings-changed', settings);
  }

  /**
   * 应用全局字体样式
   */
  private applyGlobalFontStyles(fontSettings: any) {
    try {
      const root = document.documentElement;

      if (fontSettings.fontFamily) {
        root.style.setProperty('--general-font-family', fontSettings.fontFamily);
        this.applyToSiyuanElements('font-family', fontSettings.fontFamily);
      }

      root.style.setProperty('--general-font-size', `${fontSettings.fontSize}px`);
      this.applyToSiyuanElements('font-size', `${fontSettings.fontSize}px`);

      root.style.setProperty('--general-font-weight', fontSettings.fontWeight);
      this.applyToSiyuanElements('font-weight', fontSettings.fontWeight);

      root.style.setProperty('--general-line-height', fontSettings.lineHeight.toString());
      this.applyToSiyuanElements('line-height', fontSettings.lineHeight.toString());

    } catch (error) {
      console.error('应用全局字体样式失败:', error);
    }
  }

  /**
   * 应用样式到思源笔记的主要元素
   */
  private applyToSiyuanElements(property: string, value: string) {
    try {
      // 应用到编辑器内容区域
      const editorElements = document.querySelectorAll('.protyle-content, .protyle-wysiwyg');
      editorElements.forEach((el: any) => {
        el.style[property as any] = value;
      });

      // 应用到阅读模式内容
      const contentElements = document.querySelectorAll('.b3-typography, .render-node');
      contentElements.forEach((el: any) => {
        el.style[property as any] = value;
      });

    } catch (error) {
      console.error(`应用字体样式到思源元素失败:`, error);
    }
  }

  /**
   * 发送自定义事件
   */
  private dispatchEvent(eventType: string, data: any) {
    try {
      const event = new CustomEvent(eventType, {
        detail: data,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('发送事件失败:', error);
    }
  }

  /**
   * 获取当前字体设置
   */
  public getCurrentFontSettings(): any {
    try {
      const saved = localStorage.getItem('general-font-settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('获取字体设置失败:', error);
    }

    return {
      fontFamily: '',
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: 1.6
    };
  }

  /**
   * 应用保存的字体设置
   */
  public applySavedSettings() {
    const settings = this.getCurrentFontSettings();
    this.applyGlobalFontStyles(settings);
  }

  /**
   * 应用代码块样式
   */
  public async applyCodeBlockStyle() {
    try {
      // 从插件数据库加载设置
      const settings = await loadCodeBlockSettings(this.plugin);
      this.applyCodeBlockStyleFromSettings(settings);
    } catch (error) {
      console.error('应用代码块样式失败:', error);
    }
  }

  /**
   * 应用列表样式
   */
  public async applyListStyle() {
    try {
      // 从插件数据库加载设置
      const settings = await loadListSettingsFromDB(this.plugin);
      this.applyListStyles(settings);
    } catch (error) {
      console.error('应用列表样式失败:', error);
    }
  }

  /**
   * 应用标题样式
   */
  public async applyHeadingStyle() {
    try {
      // 从插件数据库加载设置
      const settings = await loadHeadingSettings(this.plugin);

      // 确保 DOM 已准备好，延迟应用样式以避免时机问题
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            this.applyHeadingStyles(settings);
          }, 200);
        });
      } else {
        // DOM 已经加载完成，稍微延迟以确保页面完全渲染
        setTimeout(() => {
          this.applyHeadingStyles(settings);
        }, 200);
      }
    } catch (error) {
      console.error('应用标题样式失败:', error);
    }
  }

  /**
   * 从设置对象应用标题样式
   */
  private applyHeadingStyles(settings: any) {
    try {
      const style = document.getElementById('heading-colors-style') || document.createElement('style');
      style.id = 'heading-colors-style';

      // 颜色样式
      const colors = settings.colors || {};
      const colorCss = Object.entries(colors)
        .map(([level, color]) => {
          return `
            .protyle-wysiwyg [data-node-id].${level},
            .protyle-wysiwyg .${level},
            .b3-typography .${level} {
              color: ${color} !important;
            }
          `;
        })
        .join('\n');

      // 字体大小样式（H1-H6）
      const fontSizes = settings.fontSizes || {};
      const fontSizeCss = Object.entries(fontSizes)
        .map(([level, size]) => `
          .protyle-wysiwyg [data-node-id].${level},
          .protyle-wysiwyg .${level},
          .b3-typography .${level} {
            font-size: ${size}px !important;
          }
        `)
        .join('\n');


      // 层级显示样式
      let levelCss = '';
      if (settings.levelDisplay && settings.levelDisplay !== 'none') {
        levelCss = this.generateLevelDisplayCss(settings.levelDisplay, settings.customMarkers || []);
      }

      // 标题居中样式（仅文档标题）
      const centerAlignCss = settings.titleCenterAlign ? `
        .protyle-title__input {
          text-align: center !important;
        }
      ` : '';

      // 文档标题颜色样式（独立于居中设置）
      const titleColorCss = settings.titleColor ? `
        .protyle-title__input {
          color: ${settings.titleColor} !important;
        }
      ` : '';

      // 文档标题字体大小样式
      const titleFontSizeCss = settings.titleFontSize ? `
        .protyle-title__input {
          font-size: ${settings.titleFontSize}px !important;
        }
      ` : ''

      style.textContent = colorCss + '\n' + fontSizeCss + '\n' + levelCss + '\n' + centerAlignCss + '\n' + titleColorCss + '\n' + titleFontSizeCss;

      if (!style.parentElement) {
        document.head.appendChild(style);
      }

    } catch (error) {
      console.error('应用标题样式失败:', error);
    }
  }

  /**
   * 生成层级显示 CSS
   */
  private generateLevelDisplayCss(style: string, customMarkers: string[]): string {
    const levels = style === 'custom'
      ? customMarkers
      : (HEADING_LEVEL_MAPPINGS[style] || HEADING_LEVEL_MAPPINGS.number);

    return levels.map((label, index) => {
      const level = index + 1;
      const tagStyles = style === 'tag'
        ? 'background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; opacity: 0.7;'
        : '';

      return `
        .protyle-wysiwyg div[data-subtype="h${level}"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
        .protyle-wysiwyg div[data-subtype="h${level}"][data-node-id] > div.h${level}[contenteditable]::after {
          content: "  ${label}";
          font-size: 0.7em;
          opacity: 0.4;
          margin-left: 6px;
          vertical-align: middle;
          ${tagStyles}
        }
      `;
    }).join('\n');
  }

  /**
   * 从设置对象应用列表样式
   */
  private applyListStyles(settings: any) {
    try {
      // 保存设置到localStorage
      localStorage.setItem('general-list-settings', JSON.stringify(settings));

      // 应用CSS样式
      if (settings.css) {
        this.applyListCSS(settings.css);
      } else {
        // 如果没有CSS，移除现有样式
        this.removeExistingListStyles();
      }

    } catch (error) {
      console.error('应用列表样式失败:', error);
    }
  }

  /**
   * 应用列表CSS到页面
   */
  private applyListCSS(css: string) {
    if (!css) {
      this.removeExistingListStyles();
      return;
    }

    // 移除现有的样式
    this.removeExistingListStyles();

    // 创建新的样式元素
    const styleElement = document.createElement('style');
    styleElement.id = 'custom-list-styles';
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

  }

  /**
   * 移除现有的列表样式
   */
  private removeExistingListStyles() {
    const existingStyle = document.getElementById('custom-list-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  /**
   * 从设置对象应用代码块样式
   */
  private applyCodeBlockStyleFromSettings(settings: any) {
    try {
      applyCodeBlockStyle(settings.style || 'default');
    } catch (error) {
      console.error('应用代码块样式失败:', error);
    }
  }



  /**
   * 观察内容变化，确保样式持续应用
   */
  private observeContentChanges() {
    try {
      // 创建 MutationObserver 监听 DOM 变化
      const observer = new MutationObserver((mutations) => {
        let shouldReapplyStyles = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // 检查是否有新的编辑器内容添加
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                // 如果添加的是编辑器相关元素，重新应用样式
                if (element.classList?.contains('protyle-wysiwyg') ||
                    element.classList?.contains('b3-typography') ||
                    element.querySelector?.('.protyle-wysiwyg') ||
                    element.querySelector?.('.b3-typography')) {
                  shouldReapplyStyles = true;
                }
              }
            });
          }
        });

        if (shouldReapplyStyles) {
          setTimeout(async () => {
            await this.applyHeadingStyle();
          }, 100);
        }
      });

      // 配置观察选项
      const observerOptions = {
        childList: true,
        subtree: true,
        attributes: false
      };

      // 开始观察 document.body 的变化
      observer.observe(document.body, observerOptions);

      // 保存 observer 实例以便清理
      (this as any).contentObserver = observer;

    } catch (error) {
      console.error('启动内容变化观察器失败:', error);
    }
  }

  /**
   * 初始化自动备份
   */
  private async initAutoBackup() {
    try {
      // 加载自动备份设置
      const data = await this.plugin.loadData('data-backup-settings');

      if (data) {
        this.workspacePath = data.workspacePath || '';
        this.workspaceRoot = data.workspaceRoot || '';
        this.lastBackupTimestamp = data.lastBackupTimestamp || 0;
      }

      // 检测是否为移动端
      const isMobile = checkIsMobile();
      const autoBackupEnabled = data?.autoBackupEnabled ?? false;
      const backupFrequency = data?.backupFrequency ?? 'daily';

      // 移动端自动禁用自动备份
      if (!isMobile && autoBackupEnabled) {
        this.startAutoBackupTimer(backupFrequency);
      }
    } catch (error) {
      console.error('初始化自动备份失败:', error);
    }
  }

  /**
   * 启动自动备份定时器
   */
  private startAutoBackupTimer(backupFrequency: string) {
    this.stopAutoBackupTimer();

    const interval = this.getBackupInterval(backupFrequency);
    const checkAndBackup = async () => {
      // 确保有工作区路径
      if (!this.workspacePath) {
        await this.detectWorkspacePath();
        if (!this.workspacePath) {
          return;
        }
      }

      const now = new Date();
      const currentTime = now.getTime();
      const timeSinceLastBackup = currentTime - this.lastBackupTimestamp;

      // 如果距离上次备份时间超过间隔，则执行备份
      if (timeSinceLastBackup >= interval) {
        await this.performAutoBackup(backupFrequency);
      }
    };

    // 每分钟检查一次
    this.autoBackupTimer = window.setInterval(checkAndBackup, 60000);

    // 立即检查一次
    checkAndBackup();
  }

  /**
   * 停止自动备份定时器
   */
  private stopAutoBackupTimer() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  /**
   * 检测工作区路径
   */
  private async detectWorkspacePath(): Promise<boolean> {
    // 方式1: 检查环境变量
    if ((window as any).__SIYUAN_WS__ || (window as any).SIYUAN_WORKSPACE) {
      const rootPath = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE;
      this.workspaceRoot = rootPath;
      this.workspacePath = `${rootPath}/data`;
      return true;
    }

    // 方式2: 尝试从 localStorage 获取
    const savedPath = localStorage.getItem('siyuan-workspace-path');
    const savedRoot = localStorage.getItem('siyuan-workspace-root');
    if (savedPath) {
      this.workspacePath = savedPath;
      this.workspaceRoot = savedRoot || savedPath.replace(/\/data$/, '');
      return true;
    }

    // 方式3: 尝试从插件配置获取
    if (this.plugin && this.plugin.dataPath) {
      this.workspaceRoot = this.plugin.dataPath;
      this.workspacePath = `${this.plugin.dataPath}/data`;
      return true;
    }

    // 方式4: 通过 API 获取工作区路径
    try {
      const response = await fetch('/api/system/getConf', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        const wsPath = data?.data?.conf?.system?.workspaceDir;
        if (wsPath) {
          this.workspaceRoot = wsPath;
          this.workspacePath = `${wsPath}/data`;
          localStorage.setItem('siyuan-workspace-root', wsPath);
          localStorage.setItem('siyuan-workspace-path', `${wsPath}/data`);
          return true;
        }
      }
    } catch (e) {
      console.error('通过 API 获取工作区路径失败:', e);
    }

    return false;
  }

  /**
   * 获取备份间隔（毫秒）
   */
  private getBackupInterval(backupFrequency: string): number {
    switch (backupFrequency) {
      case 'minute':
        return 60 * 1000; // 1 分钟
      case 'hourly':
        return 60 * 60 * 1000; // 1 小时
      case 'daily':
        return 24 * 60 * 60 * 1000; // 1 天
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * 执行自动备份（直接在插件级别执行，不依赖 Vue 组件）
   */
  private async performAutoBackup(backupFrequency: string) {

    try {
      // 检查是否有 Node.js API 可用
      if (typeof window.require !== 'function') {
        return;
      }

      const fs = window.require('fs').promises;
      const path = window.require('path');

      // 确保工作区路径存在
      if (!this.workspacePath) {
        await this.detectWorkspacePath();
        if (!this.workspacePath) {
          return;
        }
      }

      // 获取备份设置
      const data = await this.plugin.loadData('data-backup-settings');
      const keepBackupCount = data?.keepBackupCount || 7;
      const backupDir = `${this.workspaceRoot}/data-backup`;

      // 生成文件名: data-251209-153045.zip (年月日-时分秒)
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      const second = now.getSeconds().toString().padStart(2, '0');
      const fileName = `data-${year}${month}${day}-${hour}${minute}${second}.zip`;


      // 检查 data 目录是否存在
      const dataPath = this.workspacePath;
      try {
        await fs.access(dataPath);
      } catch {
        return;
      }

      // 创建 ZIP
      const zip = new JSZip();

      // 递归添加目录到 ZIP
      const addDirectoryToZip = async (dirPath: string, zipPath: string) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            // 跳过一些不需要备份的目录
            if (entry.name === 'temp' || entry.name === '.recycle') {
              continue;
            }
            await addDirectoryToZip(fullPath, relativePath);
          } else if (entry.isFile()) {
            try {
              const content = await fs.readFile(fullPath);
              zip.file(relativePath, content);
            } catch (err) {
              console.warn(`自动备份 - 无法读取文件: ${fullPath}`, err);
            }
          }
        }
      };

      // 添加 data 目录内容到 ZIP
      await addDirectoryToZip(dataPath, '');

      // 添加备份信息
      const backupData = {
        timestamp: Date.now(),
        backupTime: new Date().toISOString(),
        version: '1.0',
        workspaceRoot: this.workspaceRoot,
        workspaceDataPath: this.workspacePath,
        backupDir: backupDir,
        isAutoBackup: true,
        backupFrequency: backupFrequency
      };
      zip.file('backup-info.json', JSON.stringify(backupData, null, 2));

      // 生成 ZIP 文件
      const zipBuffer = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // 确保备份目录存在
      await fs.mkdir(backupDir, { recursive: true });

      // 写入 ZIP 文件
      const zipFilePath = path.join(backupDir, fileName);
      await fs.writeFile(zipFilePath, zipBuffer);

      // 更新时间戳
      this.lastBackupTimestamp = Date.now();
      await this.saveBackupSettings();

      // 清理旧备份
      await this.cleanOldBackups(keepBackupCount, backupDir, fs, path);

      // 显示通知
      showMessage(`自动备份成功: ${fileName}`, 3000, 'info');
    } catch (error) {
      console.error('自动备份失败:', error);
    }
  }

  /**
   * 清理旧备份文件
   */
  private async cleanOldBackups(keepCount: number, backupDir: string, fs: any, path: any) {
    try {
      const entries = await fs.readdir(backupDir, { withFileTypes: true });
      const backupFiles = entries
        .filter((e: any) => e.isFile() && e.name.startsWith('data-') && e.name.endsWith('.zip'))
        .map((e: any) => ({
          name: e.name,
          path: path.join(backupDir, e.name)
        }));

      // 按文件名排序（包含时间戳）
      backupFiles.sort((a: any, b: any) => b.name.localeCompare(a.name));

      // 删除超出数量的旧备份
      if (backupFiles.length > keepCount) {
        const filesToDelete = backupFiles.slice(keepCount);
        for (const file of filesToDelete) {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            console.warn('自动备份 - 删除旧备份失败:', file.name, err);
          }
        }
      }
    } catch (error) {
      console.error('自动备份 - 清理旧备份失败:', error);
    }
  }

  /**
   * 保存备份设置（更新时间戳）
   */
  private async saveBackupSettings() {
    try {
      const data = await this.plugin.loadData('data-backup-settings') || {};
      await this.plugin.saveData('data-backup-settings', {
        ...data,
        lastBackupTimestamp: this.lastBackupTimestamp,
        lastBackupTime: new Date(this.lastBackupTimestamp).toLocaleString()
      });
    } catch (error) {
      console.error('保存备份设置失败:', error);
    }
  }

  /**
   * 重新启动自动备份定时器（供 Vue 组件调用）
   */
  public restartAutoBackupTimer(enabled: boolean, backupFrequency: string) {
    this.stopAutoBackupTimer();
    if (enabled) {
      this.startAutoBackupTimer(backupFrequency);
    }
  }

  /**
   * 更新上次备份时间（供 Vue 组件调用）
   */
  public updateLastBackupTime(timestamp: number) {
    this.lastBackupTimestamp = timestamp;
  }

  /**
   * 销毁功能
   */
  public destroy() {
    try {
      // 停止观察器
      if ((this as any).contentObserver) {
        (this as any).contentObserver.disconnect();
      }
      // 停止自动备份定时器
      this.stopAutoBackupTimer();
    } catch (error) {
      console.error('销毁通用设置模块失败:', error);
    }
  }
}

/**
 * 注册通用设置模块
 */
export function registerGeneralSettings(plugin: Plugin) {
  const settings = new GeneralSettings(plugin);
  settings.init();

  // 保存实例到插件对象中，以便在其他地方使用
  (plugin as any).__generalSettings = settings;

  // 监听打开工作区事件
  window.addEventListener('openWorkspace', async () => {
    try {
      // 获取工作区路径 - 多种策略获取
      let workspacePath = null

      // 策略1: 从siyuan全局配置获取
      if ((window as any).siyuan?.config?.system?.workspaceDir) {
        workspacePath = (window as any).siyuan.config.system.workspaceDir
      }
      // 策略2: 从dataDir推导
      else if ((window as any).siyuan?.config?.dataDir) {
        const dataDir = (window as any).siyuan.config.dataDir
        // 思源的dataDir通常是 /workspace/data，上级目录是工作区
        workspacePath = dataDir.substring(0, dataDir.lastIndexOf('/')) || dataDir.substring(0, dataDir.lastIndexOf('\\'))
      }
      // 策略3: 从localStorage获取
      if (!workspacePath) {
        workspacePath = localStorage.getItem('siyuan_workspace_path')
      }

      if (workspacePath) {
        // 使用 Electron API 打开文件夹（真实环境）
        if ((window as any).require) {
          try {
            const { shell } = (window as any).require('electron')
            await shell.openPath(workspacePath)
          } catch (electronError) {
            console.warn('Electron API 不可用或失败:', electronError)
          }
        }

        // 显示成功消息
        showMessage(plugin.i18n.workspaceOpened || '工作区已打开', 2000, 'info')
      } else {
        showMessage(plugin.i18n.openWorkspaceFailed || '打开工作区失败', 3000, 'error')
        console.error('无法获取工作区路径')
      }
    } catch (error) {
      console.error('打开工作区失败:', error)
      showMessage(plugin.i18n.openWorkspaceFailed || '打开工作区失败', 3000, 'error')
    }
  })

  // 监听关闭所有页签事件
  window.addEventListener('closeAllTabs', () => {
    try {
      // Try multiple selectors to find tabs
      const selectors = [
        '[role="tab"]',  // Method 1: WAI-ARIA role
        '[data-type][data-id]',  // Method 2: data attributes
        '.layout-tab-bar .item',  // Method 3: CSS class
        '.item[data-id]'  // Method 4: combined selector
      ]

      let tabs: NodeListOf<Element> | Element[] = []
      for (const selector of selectors) {
        const result = document.querySelectorAll(selector)
        if (result.length > 0) {
          tabs = result
          break
        }
      }

      // If no tabs found
      if (tabs.length === 0) {
        console.warn('No tab elements found')
      }

      let closedCount = 0
      const tabArray = Array.from(tabs)

      // Close tabs from back to front to avoid index issues
      for (let i = tabArray.length - 1; i >= 0; i--) {
        const tab = tabArray[i] as any

        // Skip readonly tabs
        if (tab.getAttribute('data-type') === 'readonly' ||
            tab.getAttribute('role') === 'readonly' ||
            tab.classList?.contains('item--readonly')) {
          continue
        }

        // Method 1: Find and click close button
        const closeBtn = tab.querySelector('[class*="close"]') ||
                        tab.querySelector('[data-action="close"]') ||
                        tab.querySelector('.item__close')

        if (closeBtn) {
          try {
            (closeBtn as HTMLElement).click()
            closedCount++
          } catch (clickErr) {
            console.warn('Failed to click close button:', clickErr)
          }
        } else {
          // Method 2: Send Ctrl+W keyboard shortcut
          try {
            document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'w',
              code: 'KeyW',
              ctrlKey: true,
              bubbles: true,
              cancelable: true
            }))
            closedCount++
          } catch (keyErr) {
            console.warn('Failed to send Ctrl+W shortcut:', keyErr)
          }
        }
      }

      showMessage(plugin.i18n.allTabsClosed || '所有页签已关闭', 2000, 'info')
    } catch (error) {
      console.error('Failed to close tabs:', error)
      showMessage(plugin.i18n.closeTabsFailed || '关闭页签失败', 3000, 'error')
    }
  })

  return settings;
}
