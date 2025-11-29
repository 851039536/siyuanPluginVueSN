/**
 * 通用设置功能模块
 * 提供模块化的通用配置功能，包括字体设置、外观设置等
 */
import { Plugin, showMessage } from 'siyuan';
import { createApp, h } from 'vue';
// @ts-ignore
import GeneralSettingsPanel from './GeneralSettingsPanel.vue';

/**
 * 通用设置类
 */
export class GeneralSettings {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * 初始化通用设置功能
   */
  public init() {
    this.addDock();
    this.applySavedSettings(); // 应用已保存的设置
    console.log('通用设置模块已初始化');
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
    console.log('通用设置已更新:', settings);

    // 根据模块类型处理不同的设置
    if (settings.moduleId === 'font') {
      this.applyGlobalFontStyles(settings.settings);
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
   * 重置字体设置
   */
  public resetFontSettings() {
    try {
      localStorage.removeItem('general-font-settings');

      // 重置CSS变量
      const root = document.documentElement;
      root.style.removeProperty('--general-font-family');
      root.style.removeProperty('--general-font-size');
      root.style.removeProperty('--general-font-weight');
      root.style.removeProperty('--general-line-height');

      // 重置思源元素样式
      this.resetSiyuanElementStyles();

      showMessage(this.plugin.i18n.settingsReset || '设置已重置', 3000, 'info');
    } catch (error) {
      console.error('重置字体设置失败:', error);
    }
  }

  /**
   * 重置思源元素样式
   */
  private resetSiyuanElementStyles() {
    const properties = ['font-family', 'font-size', 'font-weight', 'line-height'];
    const selectorList = [
      '.protyle-content',
      '.protyle-wysiwyg',
      '.b3-typography',
      '.render-node',
      '[data-node-id]',
      '.protyle-title',
      '.card-item__text'
    ];

    try {
      selectorList.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el: any) => {
          properties.forEach(prop => {
            el.style.removeProperty(prop);
          });
        });
      });
    } catch (error) {
      console.error('重置思源元素样式失败:', error);
    }
  }

  /**
   * 销毁功能
   */
  public destroy() {
    console.log('通用设置模块已销毁');
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
        let successfullyOpened = false
        if ((window as any).require) {
          try {
            const { shell } = (window as any).require('electron')
            const result = await shell.openPath(workspacePath)
            successfullyOpened = !result // shell.openPath返回空字符串表示成功
            console.log('使用Electron打开工作区，结果:', result || '成功')
          } catch (electronError) {
            console.warn('Electron API 不可用或失败:', electronError)
          }
        } else {
          console.log('非Electron环境')
        }

        // 显示成功消息
        showMessage(plugin.i18n.workspaceOpened || '工作区已打开', 2000, 'info')
        console.log('工作区打开命令已执行，路径:', workspacePath)
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
          console.log(`Found tabs using selector: ${selector}, count: ${tabs.length}`)
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
      console.log(`Closed ${closedCount} tabs, total: ${tabs.length}`, closedCount === 0 ? '(might not have found tabs or tabs cannot be closed)' : '')
    } catch (error) {
      console.error('Failed to close tabs:', error)
      showMessage(plugin.i18n.closeTabsFailed || '关闭页签失败', 3000, 'error')
    }
  })

  console.log('通用设置模块已注册');
  return settings;
}
