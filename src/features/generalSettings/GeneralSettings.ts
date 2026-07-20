import type {
  CodeBlockSettings,
  DocumentFontSettings,
  FontSettings,
  HeadingSettings,
  ListSettings,
  ListStyleSettings,
  TableStyleSettings,
} from "./types/storage"
/**
 * 通用设置功能模块
 * 提供模块化的通用配置功能，包括字体设置、外观设置等
 */
import { Plugin } from "siyuan"
import {
  injectStyle,
  removeStyle,
} from "@/utils/domUtils"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import GeneralSettingsPanel from "./index.vue"
import { DocCountManager } from "./modules/DocCountManager"
import { HighlightManager } from "./modules/HighlightManager"
import { GeneralSettingsStorage } from "./types/storage"
import {
  applyCodeBlockCollapse,
  applyCodeBlockEnhancedStyles,
  applyCodeBlockStyle,
  applyDocumentFontStyles,
  generateLevelDisplayCss,
  generateTabPinCSS,
  HEADING_LEVEL_MAPPINGS,
} from "./utils/styles"

export class GeneralSettings {
  private plugin: Plugin
  private storage: GeneralSettingsStorage
  private contentObserver: MutationObserver | null = null
  private docCountManager: DocCountManager | null = null
  private highlightManager: HighlightManager | null = null
  private _cachedFontSettings: FontSettings = {
    fontFamily: "",
    fontSize: 14,
    fontWeight: "normal",
    lineHeight: 1.6,
  }

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GeneralSettingsStorage(plugin)
  }

  public async init() {
    this.addDock()
    this.applySavedSettings()
    await this.applyCodeBlockStyle()
    await this.applyListStyle()
    await this.applyHeadingStyle()
    await this.applyDocumentFontStyle()
    await this.applyTableStyle()
    await this.applyListStyleEnhanced()
    await this.applyDocCountStyle()
    await this.applyTabPinStyle()
    await this.applyHighlightStyle()
    this.observeContentChanges()
  }

  private addDock() {
    const handleSettingsChange = (settings: any) => this.handleSettingsChange(settings)

    createVueDockApp(this.plugin, GeneralSettingsPanel, {
      position: "RightTop",
      width: 360,
      icon: "iconSettings",
      title: this.plugin.i18n.generalSettings || "通用设置",
      type: "general-settings-dock",
      i18n: this.plugin.i18n,
      extraProps: {
        onSettingsChange: handleSettingsChange,
      },
    })
  }

  private handleSettingsChange(settings: { moduleId: string, settings: Record<string, unknown> }) {
    if (settings.moduleId === "codeblock") {
      this.applyCodeBlockStyleFromSettings(settings.settings as unknown as CodeBlockSettings)
    } else if (settings.moduleId === "heading") {
      this.applyHeadingStyles(settings.settings as unknown as HeadingSettings)
    } else if (settings.moduleId === "documentFont") {
      applyDocumentFontStyles(settings.settings as unknown as DocumentFontSettings)
    } else if (settings.moduleId === "tableStyle") {
      this.applyTableStyles(settings.settings as unknown as TableStyleSettings)
    } else if (settings.moduleId === "listStyle") {
      this.applyListStylesEnhanced(settings.settings as unknown as ListStyleSettings)
    } else if (settings.moduleId === "tabPin") {
      this.applyTabPinStyles(settings.settings as { enabled: boolean, displayMode: string, backgroundColor: string })
    }
    emitCustomEvent("general-settings-changed", settings)
  }

  private applyGlobalFontStyles(fontSettings: FontSettings) {
    try {
      const root = document.documentElement

      if (fontSettings.fontFamily) {
        root.style.setProperty(
          "--general-font-family",
          fontSettings.fontFamily,
        )
        this.applyToSiyuanElements("font-family", fontSettings.fontFamily)
      }

      root.style.setProperty(
        "--general-font-size",
        `${fontSettings.fontSize}px`,
      )
      this.applyToSiyuanElements("font-size", `${fontSettings.fontSize}px`)

      root.style.setProperty("--general-font-weight", fontSettings.fontWeight)
      this.applyToSiyuanElements("font-weight", fontSettings.fontWeight)

      root.style.setProperty(
        "--general-line-height",
        fontSettings.lineHeight.toString(),
      )
      this.applyToSiyuanElements(
        "line-height",
        fontSettings.lineHeight.toString(),
      )
    } catch (error) {
      console.error("应用全局字体样式失败:", error)
    }
  }

  private applyToSiyuanElements(property: string, value: string) {
    try {
      const editorElements = document.querySelectorAll(
        ".protyle-content, .protyle-wysiwyg",
      )
      editorElements.forEach((el: any) => {
        el.style[property as any] = value
      })

      const contentElements = document.querySelectorAll(
        ".b3-typography, .render-node",
      )
      contentElements.forEach((el: any) => {
        el.style[property as any] = value
      })
    } catch (error) {
      console.error(`应用字体样式到思源元素失败:`, error)
    }
  }

  public getCurrentFontSettings(): FontSettings {
    try {
      return this._cachedFontSettings
    } catch (error) {
      console.error("获取字体设置失败:", error)
    }

    return {
      fontFamily: "",
      fontSize: 14,
      fontWeight: "normal",
      lineHeight: 1.6,
    }
  }

  public async applySavedSettings() {
    const settings = await this.storage.font.load()
    this._cachedFontSettings = settings ?? {
      fontFamily: "",
      fontSize: 14,
      fontWeight: "normal",
      lineHeight: 1.6,
    }
    this.applyGlobalFontStyles(this._cachedFontSettings)
  }

  public async applyCodeBlockStyle() {
    try {
      const settings = await this.storage.codeblock.loadOrDefault()
      this.applyCodeBlockStyleFromSettings(settings)
    } catch (error) {
      console.error("应用代码块样式失败:", error)
    }
  }

  public async applyListStyle() {
    try {
      const settings = await this.storage.list.loadOrDefault()
      this.applyListStyles(settings)
    } catch (error) {
      console.error("应用列表样式失败:", error)
    }
  }

  public async applyHeadingStyle() {
    try {
      const settings = await this.storage.loadHeadingOrDefault()

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => {
            this.applyHeadingStyles(settings)
          }, 200)
        })
      } else {
        setTimeout(() => {
          this.applyHeadingStyles(settings)
        }, 200)
      }
    } catch (error) {
      console.error("应用标题样式失败:", error)
    }
  }

  public async applyDocumentFontStyle() {
    try {
      const settings = await this.storage.documentFont.load()
      if (settings) {
        applyDocumentFontStyles(settings)
      }
    } catch (error) {
      console.error("应用文档字体样式失败:", error)
    }
  }

  public async applyTableStyle() {
    try {
      const settings = await this.storage.tableStyle.load()
      if (settings) {
        this.applyTableStyles(settings)
      }
    } catch (error) {
      console.error("应用表格样式失败:", error)
    }
  }

  private applyTableStyles(tableSettings: TableStyleSettings) {
    try {
      if (!tableSettings.enabled) {
        removeStyle("table-style-settings")
        return
      }

      const css = `
        .protyle-wysiwyg table {
          border-collapse: collapse;
          border-radius: ${tableSettings.borderRadius}px;
          overflow: hidden;
        }
        .protyle-wysiwyg table th,
        .protyle-wysiwyg table td {
          border: 1px solid ${tableSettings.cellBorderColor};
        }
        .protyle-wysiwyg table th {
          background-color: ${tableSettings.headerBackground};
          color: ${tableSettings.textColor};
        }
        .protyle-wysiwyg table tr:nth-child(odd) {
          background-color: ${tableSettings.oddRowBackground};
        }
        .protyle-wysiwyg table tr:nth-child(even) {
          background-color: ${tableSettings.evenRowBackground};
        }
        .protyle-wysiwyg table td {
          color: ${tableSettings.textColor};
        }
      `

      injectStyle("table-style-settings", css)
    } catch (error) {
      console.error("应用表格样式失败:", error)
    }
  }

  public async applyListStyleEnhanced() {
    try {
      const settings = await this.storage.listStyle.load()
      if (settings) {
        this.applyListStylesEnhanced(settings)
      }
    } catch (error) {
      console.error("应用列表样式失败:", error)
    }
  }

  public async applyDocCountStyle() {
    try {
      const settings = await this.storage.docCount.load()
      if (settings && settings.enableDocCount) {
        this.docCountManager = new DocCountManager()
        this.docCountManager.start()
        this.docCountManager.setUpdateInterval(
          Number.parseInt(settings.updateInterval),
        )
        this.docCountManager.setDisplayFormat(settings.displayFormat || "bracket")
        this.docCountManager.setFontStyle({
          fontSize: settings.fontSize,
          color: settings.fontColor,
          fontWeight: settings.fontWeight,
          opacity: settings.opacity ?? 0.8,
        })
      }
    } catch (error) {
      console.error("应用文档数统计样式失败:", error)
    }
  }

  public async applyHighlightStyle() {
    try {
      const settings = await this.storage.highlight.load()
      if (settings && settings.enableHighlight === false) {
        return
      }
      const options = settings
        ? {
            backgroundColor: settings.backgroundColor,
            fontSize: settings.fontSize,
            bold: settings.bold,
            minTextLength: settings.minTextLength,
            minLetterLength: settings.minLetterLength,
            maxTextLength: settings.maxTextLength,
            maxLetterLength: settings.maxLetterLength,
          }
        : undefined
      this.highlightManager = new HighlightManager(options)
      this.highlightManager.enable()
    } catch (error) {
      console.error("应用双击高亮功能失败:", error)
    }
  }

  public getHighlightManager(): HighlightManager | null {
    return this.highlightManager
  }

  public async applyTabPinStyle() {
    try {
      const settings = await this.storage.tabPin.load()
      if (settings) {
        this.applyTabPinStyles(settings)
      }
    } catch (error) {
      console.error("应用钉住页签样式失败:", error)
    }
  }

  public async updateHighlight(enabled: boolean) {
    if (!this.highlightManager) {
      this.highlightManager = new HighlightManager()
    }
    if (enabled) {
      this.highlightManager.enable()
    } else {
      this.highlightManager.disable()
    }
    const current = await this.storage.highlight.load()
    this.storage.highlight.save({
      enableHighlight: enabled,
      backgroundColor: current?.backgroundColor ?? "rgb(255, 220, 60)",
      fontSize: current?.fontSize ?? 0,
      bold: current?.bold ?? false,
      minTextLength: current?.minTextLength ?? 1,
      minLetterLength: current?.minLetterLength ?? 1,
      maxTextLength: current?.maxTextLength ?? 50,
      maxLetterLength: current?.maxLetterLength ?? 100,
    })
  }

  public updateHighlightOptions(options: { backgroundColor?: string, fontSize?: number, bold?: boolean, minTextLength?: number, minLetterLength?: number, maxTextLength?: number, maxLetterLength?: number }) {
    if (this.highlightManager) {
      this.highlightManager.updateOptions(options)
    }
    this.storage.highlight.load().then((current) => {
      this.storage.highlight.save({
        enableHighlight: current?.enableHighlight ?? true,
        backgroundColor: options.backgroundColor ?? current?.backgroundColor ?? "rgb(255, 220, 60)",
        fontSize: options.fontSize ?? current?.fontSize ?? 0,
        bold: options.bold ?? current?.bold ?? false,
        minTextLength: options.minTextLength ?? current?.minTextLength ?? 1,
        minLetterLength: options.minLetterLength ?? current?.minLetterLength ?? 1,
        maxTextLength: options.maxTextLength ?? current?.maxTextLength ?? 50,
        maxLetterLength: options.maxLetterLength ?? current?.maxLetterLength ?? 100,
      })
    })
  }

  private applyTabPinStyles(tabPinSettings: { enabled: boolean, displayMode: string, backgroundColor: string }) {
    try {
      if (!tabPinSettings.enabled) {
        removeStyle("tab-pin-settings-style")
        return
      }

      injectStyle("tab-pin-settings-style", generateTabPinCSS(tabPinSettings))
    } catch (error) {
      console.error("应用钉住页签样式失败:", error)
    }
  }

  private applyListStylesEnhanced(listSettings: ListStyleSettings) {
    try {
      if (!listSettings.enabled) {
        removeStyle("list-style-settings")
        return
      }

      // 有序列表颜色
      const orderedListCss = listSettings.orderedListColors
        .map((color: string, index: number) => {
          const depth = '.li[data-subtype="o"] '.repeat(index)
          return `
          ${depth}.li[data-subtype="o"] > .protyle-action--order {
            color: ${color} !important;
            font-weight: bold !important;
          }
        `
        })
        .join("\n")

      // 无序列表颜色和符号
      const unorderedListCss = listSettings.unorderedListColors
        .map((color: string, index: number) => {
          const depth = '[data-subtype="u"] > '.repeat(index)
          const symbol = index % 2 === 0 ? "•" : "▪"
          return `
          ${depth}.li[data-subtype="u"] > .protyle-action::before {
            content: "${symbol}";
            font-size: ${listSettings.symbolSize}em;
            font-weight: bold;
            font-family: Arial;
            position: absolute;
            color: ${color} !important;
          }
        `
        })
        .join("\n")

      const css = `
        /* 有序列表样式 */
        ${orderedListCss}

        /* 无序列表样式 - 隐藏原始符号 */
        [data-subtype="u"] > .li[data-subtype="u"] > .protyle-action svg {
          color: transparent;
        }

        /* 无序列表符号 */
        ${unorderedListCss}

        /* 暗色主题适配 */
        :root[data-theme-mode="dark"] .li[data-subtype="o"] > .protyle-action--order,
        :root[data-theme-mode="dark"] .li[data-subtype="u"] > .protyle-action::before {
          opacity: 0.9;
        }
      `

      injectStyle("list-style-settings", css)
    } catch (error) {
      console.error("应用列表样式失败:", error)
    }
  }

  private applyHeadingStyles(settings: HeadingSettings) {
    try {
      const colors = settings.colors || {}
      const colorCss = Object.entries(colors)
        .map(([level, color]) => {
          return `
            .protyle-wysiwyg [data-node-id].${level},
            .protyle-wysiwyg .${level},
            .b3-typography .${level} {
              color: ${color} !important;
            }
          `
        })
        .join("\n")

      const fontSizes = settings.fontSizes || {}
      const fontSizeCss = Object.entries(fontSizes)
        .map(
          ([level, size]) => `
          .protyle-wysiwyg [data-node-id].${level},
          .protyle-wysiwyg .${level},
          .b3-typography .${level} {
            font-size: ${size}px !important;
          }
        `,
        )
        .join("\n")

      let levelCss = ""
      if (settings.levelDisplay && settings.levelDisplay !== "none") {
        levelCss = generateLevelDisplayCss(
          settings.levelDisplay,
          settings.customMarkers || [],
        )
      }

      const centerAlignCss = settings.titleCenterAlign
        ? `
        .protyle-title__input {
          text-align: center !important;
        }
      `
        : ""

      const titleColorCss = settings.titleColor
        ? `
        .protyle-title__input {
          color: ${settings.titleColor} !important;
        }
      `
        : ""

      const titleFontSizeCss = settings.titleFontSize
        ? `
        .protyle-title__input {
          font-size: ${settings.titleFontSize}px !important;
        }
      `
        : ""

      const css = `${colorCss
      }\n${
        fontSizeCss
      }\n${
        levelCss
      }\n${
        centerAlignCss
      }\n${
        titleColorCss
      }\n${
        titleFontSizeCss}`

      injectStyle("heading-colors-style", css)
    } catch (error) {
      console.error("应用标题样式失败:", error)
    }
  }

  private applyListStyles(settings: ListSettings) {
    try {
      if (settings.css) {
        this.applyListCSS(settings.css)
      } else {
        removeStyle("custom-list-styles")
      }
    } catch (error) {
      console.error("应用列表样式失败:", error)
    }
  }

  private applyListCSS(css: string) {
    if (!css) {
      removeStyle("custom-list-styles")
      return
    }
    injectStyle("custom-list-styles", css)
  }

  private applyCodeBlockStyleFromSettings(settings: CodeBlockSettings) {
    try {
      applyCodeBlockStyle(settings.style || "default")

      applyCodeBlockCollapse(
        settings.enableCollapse ?? true,
        settings.collapseHeight ?? 400,
      )

      applyCodeBlockEnhancedStyles(settings)
    } catch (error) {
      console.error("应用代码块样式失败:", error)
    }
  }

  private observeContentChanges() {
    try {
      const observer = new MutationObserver((mutations) => {
        let shouldReapplyStyles = false

        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element
                if (
                  element.classList?.contains("protyle-wysiwyg")
                  || element.classList?.contains("b3-typography")
                  || element.querySelector?.(".protyle-wysiwyg")
                  || element.querySelector?.(".b3-typography")
                ) {
                  shouldReapplyStyles = true
                }
              }
            })
          }
        })

        if (shouldReapplyStyles) {
          setTimeout(async () => {
            await this.applyHeadingStyle()
          }, 100)
        }
      })

      const observerOptions = {
        childList: true,
        subtree: true,
        attributes: false,
      }

      observer.observe(document.body, observerOptions)
      this.contentObserver = observer
    } catch (error) {
      console.error("启动内容变化观察器失败:", error)
    }
  }

  public destroy() {
    if (this.contentObserver) {
      this.contentObserver.disconnect()
      this.contentObserver = null
    }
    if (this.docCountManager) {
      this.docCountManager.stop()
      this.docCountManager = null
    }
    if (this.highlightManager) {
      this.highlightManager.disable()
      this.highlightManager = null
    }
  }
}
