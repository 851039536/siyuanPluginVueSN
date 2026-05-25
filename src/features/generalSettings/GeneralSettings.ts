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
  createApp,
  h,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import GeneralSettingsPanel from "./index.vue"
import { BookmarkMarker } from "./modules/BookmarkMarker"
import { DocCountManager } from "./modules/DocCountManager"
import { HighlightManager } from "./modules/HighlightManager"
import { SkillsViewerManager } from "./modules/SkillsViewerManager"
import { GeneralSettingsStorage } from "./types/storage"
import {
  applyCodeBlockCollapse,
  applyCodeBlockEnhancedStyles,
  applyCodeBlockStyle,
  checkIsMobile,
  generateTabPinCSS,
  HEADING_LEVEL_MAPPINGS,
} from "./utils/styles"

export class GeneralSettings {
  private plugin: Plugin
  private autoBackupTimer: number | null = null
  private lastBackupTimestamp = 0
  private storage: GeneralSettingsStorage
  private contentObserver: MutationObserver | null = null
  private docCountManager: DocCountManager | null = null
  private highlightManager: HighlightManager | null = null
  public bookmarkMarker: BookmarkMarker | null = null
  private skillsViewerManager: SkillsViewerManager | null = null
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
    await this.applyBookmarkMarkerStyle()
    await this.applyHighlightStyle()
    await this.applySkillsViewerStyle()
    this.observeContentChanges()
    await this.initAutoBackup()
  }

  private addDock() {
    this.plugin.addDock({
      config: {
        position: "RightTop",
        size: {
          width: 360,
          height: 0,
        },
        icon: "iconSettings",
        title: this.plugin.i18n.generalSettings || "通用设置",
        show: false,
      },
      data: {},
      type: "general-settings-dock",
      init: (dock: any) => {
        const container = document.createElement("div")
        container.style.height = "100%"
        container.style.overflow = "hidden"

        const plugin = this.plugin
        const handleSettingsChange = (settings: any) => this.handleSettingsChange(settings)

        const app = createApp({
          setup() {
            return () =>
              h(GeneralSettingsPanel, {
                i18n: plugin.i18n,
                plugin,
                onSettingsChange: handleSettingsChange,
              })
          },
        })

        app.mount(container)
        dock.element?.appendChild(container)

        dock.__app = app
        dock.__container = container
      },
    })
  }

  private handleSettingsChange(settings: { moduleId: string, settings: Record<string, unknown> }) {
    if (settings.moduleId === "font") {
      this.applyGlobalFontStyles(settings.settings as unknown as FontSettings)
    } else if (settings.moduleId === "codeblock") {
      this.applyCodeBlockStyleFromSettings(settings.settings as unknown as CodeBlockSettings)
    } else if (settings.moduleId === "heading") {
      this.applyHeadingStyles(settings.settings as unknown as HeadingSettings)
    } else if (settings.moduleId === "list") {
      this.applyListStyles(settings.settings as unknown as ListSettings)
    } else if (settings.moduleId === "documentFont") {
      this.applyDocumentFontStyles(settings.settings as unknown as DocumentFontSettings)
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
        this.applyDocumentFontStyles(settings)
      }
    } catch (error) {
      console.error("应用文档字体样式失败:", error)
    }
  }

  private applyDocumentFontStyles(fontSettings: DocumentFontSettings) {
    try {
      const existingStyle = document.getElementById("document-font-settings")
      if (existingStyle) {
        existingStyle.remove()
      }

      if (!fontSettings.enabled) {
        return
      }

      const style = document.createElement("style")
      style.id = "document-font-settings"

      const fontFamily = fontSettings.fontFamily
        ? `'${fontSettings.fontFamily}', `
        : ""

      style.textContent = `
        /* 编辑器内容区域 - 基础样式 */
        .protyle-wysiwyg {
          font-family: ${fontFamily}var(--b3-font-family) !important;
          font-size: ${fontSettings.fontSize}px !important;
          letter-spacing: ${fontSettings.letterSpacing}px !important;
          font-weight: ${fontSettings.fontWeight} !important;
        }

        /* 行高 - 需要应用到具体元素 */
        .protyle-wysiwyg [data-node-id][data-type="NodeParagraph"],
        .protyle-wysiwyg [data-node-id][data-type="NodeParagraph"] p,
        .protyle-wysiwyg [data-node-id][data-type="NodeParagraph"] div,
        .protyle-wysiwyg [data-node-id][data-type="NodeHeading"],
        .protyle-wysiwyg [data-node-id][data-type="NodeHeading"] div,
        .protyle-wysiwyg [data-node-id][data-type="NodeList"],
        .protyle-wysiwyg [data-node-id][data-type="NodeList"] li,
        .protyle-wysiwyg [data-node-id][data-type="NodeList"] p,
        .protyle-wysiwyg [data-node-id][data-type="NodeBlockquote"],
        .protyle-wysiwyg [data-node-id][data-type="NodeBlockquote"] p {
          line-height: ${fontSettings.lineHeight} !important;
        }

        /* 段落间距 */
        .protyle-wysiwyg [data-node-id][data-type="NodeParagraph"] {
          margin-bottom: ${fontSettings.paragraphSpacing}px !important;
        }

        /* 预览区域 - 基础样式 */
        .b3-typography {
          font-family: ${fontFamily}var(--b3-font-family) !important;
          font-size: ${fontSettings.fontSize}px !important;
          letter-spacing: ${fontSettings.letterSpacing}px !important;
          font-weight: ${fontSettings.fontWeight} !important;
        }

        /* 预览区域行高 */
        .b3-typography p,
        .b3-typography div,
        .b3-typography li,
        .b3-typography h1,
        .b3-typography h2,
        .b3-typography h3,
        .b3-typography h4,
        .b3-typography h5,
        .b3-typography h6 {
          line-height: ${fontSettings.lineHeight} !important;
        }

        .b3-typography p {
          margin-bottom: ${fontSettings.paragraphSpacing}px !important;
        }

        /* 导出预览 - 基础样式 */
        .render-node {
          font-family: ${fontFamily}var(--b3-font-family) !important;
          font-size: ${fontSettings.fontSize}px !important;
          letter-spacing: ${fontSettings.letterSpacing}px !important;
          font-weight: ${fontSettings.fontWeight} !important;
        }

        /* 导出预览行高 */
        .render-node p,
        .render-node div,
        .render-node li {
          line-height: ${fontSettings.lineHeight} !important;
        }

        /* 代码块保持原字体和行高 */
        .protyle-wysiwyg .code-block,
        .protyle-wysiwyg .code-block *,
        .b3-typography pre,
        .b3-typography pre code {
          font-family: var(--b3-font-family-code) !important;
          line-height: 1.5 !important;
        }
      `

      document.head.appendChild(style)
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
      const existingStyle = document.getElementById("table-style-settings")
      if (existingStyle) {
        existingStyle.remove()
      }

      if (!tableSettings.enabled) {
        return
      }

      const style = document.createElement("style")
      style.id = "table-style-settings"

      style.textContent = `
        /* 表格整体外框 */
        .protyle-wysiwyg table {
          border-collapse: collapse !important;
          border: 1px solid ${tableSettings.borderColor} !important;
          border-radius: ${tableSettings.borderRadius}px !important;
          overflow: hidden;
          box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
        }

        /* 表格内部网格线 */
        .protyle-wysiwyg table th,
        .protyle-wysiwyg table td {
          border: 1.5px solid ${tableSettings.cellBorderColor} !important;
        }

        /* 表头 */
        .protyle-wysiwyg table th {
          background-color: ${tableSettings.headerBackground} !important;
          color: ${tableSettings.textColor};
        }

        /* 奇数行 */
        .protyle-wysiwyg table tr:nth-child(odd) {
          background-color: ${tableSettings.oddRowBackground} !important;
          color: ${tableSettings.textColor};
        }

        /* 偶数行 */
        .protyle-wysiwyg table tr:nth-child(even) {
          background-color: ${tableSettings.evenRowBackground} !important;
          color: ${tableSettings.textColor};
        }

        /* 暗色主题适配 */
        :root[data-theme-mode="dark"] .protyle-wysiwyg table th {
          color: #ffffff;
        }

        :root[data-theme-mode="dark"] .protyle-wysiwyg table tr:nth-child(odd),
        :root[data-theme-mode="dark"] .protyle-wysiwyg table tr:nth-child(even) {
          color: #ffffff;
        }
      `

      document.head.appendChild(style)
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
        this.docCountManager.setFontStyle({
          fontSize: settings.fontSize,
          color: settings.fontColor,
          fontWeight: settings.fontWeight,
        })
      }
    } catch (error) {
      console.error("应用文档数统计样式失败:", error)
    }
  }

  public async applyBookmarkMarkerStyle() {
    try {
      const settings = await this.storage.bookmarkMarker.load()
      if (settings && settings.enableBookmarkMarker) {
        this.bookmarkMarker = new BookmarkMarker({
          rules: settings.rules,
          updateInterval: settings.updateInterval,
        })
        this.bookmarkMarker.start()
      }
    } catch (error) {
      console.error("应用书签标记样式失败:", error)
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

  public async applySkillsViewerStyle() {
    try {
      const settings = await this.storage.skillsViewer.load()
      if (settings && settings.enabled) {
        this.skillsViewerManager = new SkillsViewerManager()
      }
    } catch (error) {
      console.error("初始化 Skills 查看器失败:", error)
    }
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

  public getHighlightManager(): HighlightManager | null {
    return this.highlightManager
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
      const existingStyle = document.getElementById("tab-pin-settings-style")
      if (existingStyle) {
        existingStyle.remove()
      }

      if (!tabPinSettings.enabled) {
        return
      }

      const style = document.createElement("style")
      style.id = "tab-pin-settings-style"
      style.textContent = generateTabPinCSS(tabPinSettings)
      document.head.appendChild(style)
    } catch (error) {
      console.error("应用钉住页签样式失败:", error)
    }
  }

  private applyListStylesEnhanced(listSettings: ListStyleSettings) {
    try {
      const existingStyle = document.getElementById("list-style-settings")
      if (existingStyle) {
        existingStyle.remove()
      }

      if (!listSettings.enabled) {
        return
      }

      const style = document.createElement("style")
      style.id = "list-style-settings"

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

      style.textContent = `
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

      document.head.appendChild(style)
    } catch (error) {
      console.error("应用列表样式失败:", error)
    }
  }

  private applyHeadingStyles(settings: HeadingSettings) {
    try {
      const style =
        document.getElementById("heading-colors-style")
        || document.createElement("style")
      style.id = "heading-colors-style"

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
        levelCss = this.generateLevelDisplayCss(
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

      style.textContent =
        `${colorCss
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

      if (!style.parentElement) {
        document.head.appendChild(style)
      }
    } catch (error) {
      console.error("应用标题样式失败:", error)
    }
  }

  private generateLevelDisplayCss(
    style: string,
    customMarkers: string[],
  ): string {
    const levels =
      style === "custom"
        ? customMarkers
        : HEADING_LEVEL_MAPPINGS[style] || HEADING_LEVEL_MAPPINGS.number

    return levels
      .map((label, index) => {
        const level = index + 1
        const tagStyles =
          style === "tag"
            ? "background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; opacity: 0.7;"
            : ""

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
      `
      })
      .join("\n")
  }

  private applyListStyles(settings: ListSettings) {
    try {
      if (settings.css) {
        this.applyListCSS(settings.css)
      } else {
        this.removeExistingListStyles()
      }
    } catch (error) {
      console.error("应用列表样式失败:", error)
    }
  }

  private applyListCSS(css: string) {
    if (!css) {
      this.removeExistingListStyles()
      return
    }

    this.removeExistingListStyles()

    const styleElement = document.createElement("style")
    styleElement.id = "custom-list-styles"
    styleElement.textContent = css
    document.head.appendChild(styleElement)
  }

  private removeExistingListStyles() {
    const existingStyle = document.getElementById("custom-list-styles")
    if (existingStyle) {
      existingStyle.remove()
    }
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

  private async initAutoBackup() {
    try {
      const data = await this.storage.backup.loadOrDefault()
      this.lastBackupTimestamp = data.lastBackupTimestamp || 0

      const isMobile = checkIsMobile()
      const autoBackupEnabled = data.autoBackupEnabled ?? false
      const backupFrequency = data.backupFrequency ?? "daily"
      const backupTime = data.backupTime ?? "03:00"

      if (!isMobile && autoBackupEnabled) {
        this.startAutoBackupTimer(backupFrequency, backupTime)
      }
    } catch (error) {
      console.error("初始化自动备份失败:", error)
    }
  }

  private startAutoBackupTimer(backupFrequency: string, backupTime: string) {
    this.stopAutoBackupTimer()

    // 记录定时器启动时间，防止重启后立即触发备份
    const timerStartTime = Date.now()
    // 用于防止同一时间点重复触发
    let lastExecutedHour = -1
    let lastExecutedDateStr = ""

    const checkAndBackup = async () => {
      const now = new Date()
      const currentTime = now.getTime()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentDateStr = now.toDateString()
      const timeSinceTimerStart = currentTime - timerStartTime
      const timeSinceLastBackup = currentTime - this.lastBackupTimestamp

      let shouldBackup = false

      switch (backupFrequency) {
        case "minute":
          // 每分钟：间隔触发，跳过启动后首个周期
          if (timeSinceLastBackup >= 60 * 1000 && timeSinceTimerStart >= 60 * 1000) {
            shouldBackup = true
          }
          break

        case "hourly":
          // 每小时：整点触发（分钟数为0时），跳过启动后首个周期
          if (
            currentMinute === 0
            && lastExecutedHour !== currentHour
            && timeSinceTimerStart >= 60 * 1000
          ) {
            shouldBackup = true
            lastExecutedHour = currentHour
          }
          break

        case "daily": {
          // 每天：在用户指定的时间点触发，跳过启动后首个周期
          const [targetHour, targetMinute] = backupTime.split(":").map(Number)
          if (
            currentHour === targetHour
            && currentMinute === targetMinute
            && lastExecutedDateStr !== currentDateStr
            && timeSinceTimerStart >= 60 * 1000
          ) {
            shouldBackup = true
            lastExecutedDateStr = currentDateStr
          }
          break
        }
      }

      if (shouldBackup) {
        emitCustomEvent("autoBackupTrigger")
      }
    }

    this.autoBackupTimer = window.setInterval(checkAndBackup, 60000)
  }

  private stopAutoBackupTimer() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }

  public updateLastBackupTime(timestamp: number) {
    this.lastBackupTimestamp = timestamp
  }

  public restartAutoBackupTimer(enabled: boolean, frequency: string, backupTime: string = "03:00") {
    this.stopAutoBackupTimer()
    if (enabled) {
      this.startAutoBackupTimer(frequency, backupTime)
    }
  }

  public destroy() {
    this.stopAutoBackupTimer()
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
    if (this.bookmarkMarker) {
      this.bookmarkMarker.stop()
      this.bookmarkMarker = null
    }
    if (this.skillsViewerManager) {
      this.skillsViewerManager.destroy()
      this.skillsViewerManager = null
    }
  }
}
