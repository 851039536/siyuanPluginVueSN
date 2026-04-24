/**
 * 通用设置功能模块
 * 提供模块化的通用配置功能，包括字体设置、外观设置等
 */
import { Plugin } from "siyuan";
import { createApp, h } from "vue";
import {
	loadCodeBlockSettings,
	loadListSettingsFromDB,
	loadHeadingSettings,
} from "@/config/settings";
import { GeneralSettingsStorage } from "./storage";
import { DocCountManager } from "../modules/DocCountManager";
import { HighlightManager } from "../modules/HighlightManager";
import { SkillsViewerManager } from "../modules/SkillsViewerManager";
// @ts-ignore
import GeneralSettingsPanel from "../index.vue";

export const CODEBLOCK_STYLES = [
	"default",
	"github",
	"mac",
] as const;
export type CodeBlockStyle = (typeof CODEBLOCK_STYLES)[number];

export const HEADING_LEVEL_MAPPINGS: Record<string, string[]> = {
	number: ["1", "2", "3", "4", "5", "6"],
	roman: ["I", "II", "III", "IV", "V", "VI"],
	chinese: ["一", "二", "三", "四", "五", "六"],
	chineseUpper: ["壹", "贰", "叁", "肆", "伍", "陆"],
	dots: ["•", "••", "•••", "••••", "•••••", "••••••"],
	emoji: ["😀", "😁", "😂", "🤣", "😊", "😎"],
	star: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐", "⭐⭐⭐⭐⭐⭐"],
	arrow: ["→", "→→", "→→→", "→→→→", "→→→→→", "→→→→→→"],
	tag: ["H1", "H2", "H3", "H4", "H5", "H6"],
	bracket: ["[1]", "[2]", "[3]", "[4]", "[5]", "[6]"],
};

export function checkIsMobile(): boolean {
	const userAgent = navigator.userAgent.toLowerCase();
	const mobileUA =
		/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(
			userAgent,
		);
	const screenWidth = window.innerWidth <= 768;
	const hasTouchScreen =
		"ontouchstart" in window || navigator.maxTouchPoints > 0;
	const isSiyuanMobile = (window as any)._siyuan_mobile === true;
	return (
		mobileUA || screenWidth || (hasTouchScreen && mobileUA) || isSiyuanMobile
	);
}

export function applyCodeBlockStyle(style: CodeBlockStyle | string): void {
	CODEBLOCK_STYLES.forEach((s) =>
		document.body.classList.remove(`codeblock-style-${s}`),
	);
	document.body.classList.add(`codeblock-style-${style}`);
}

export function applyCodeBlockEnhancedStyles(codeSettings: any): void {
	try {
		// 移除现有样式
		const existingStyle = document.getElementById("codeblock-enhanced-style");
		if (existingStyle) {
			existingStyle.remove();
		}

		if (!codeSettings.enabled) {
			return;
		}

		// 创建新的样式元素
		const style = document.createElement("style");
		style.id = "codeblock-enhanced-style";

		style.textContent = `
      /* 代码块基础样式 */
      .protyle-wysiwyg .code-block {
        background-color: ${codeSettings.backgroundColor} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        box-shadow: ${codeSettings.boxShadow !== "none" ? codeSettings.boxShadow : "none"} !important;
      }

      /* 代码块内容 */
      .protyle-wysiwyg .code-block .hljs {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 行号样式 */
      .protyle-wysiwyg .code-block .hljs .ln {
        color: ${codeSettings.lineNumberColor} !important;
        background-color: ${codeSettings.lineNumberBackground} !important;
      }

      ${
				codeSettings.showLineNumber
					? ""
					: `
      /* 隐藏行号 */
      .protyle-wysiwyg .code-block .hljs .ln {
        display: none !important;
      }
      `
			}

      /* 代码高亮颜色 */
      .protyle-wysiwyg .code-block .hljs-keyword,
      .protyle-wysiwyg .code-block .hljs-selector-tag,
      .protyle-wysiwyg .code-block .hljs-built_in,
      .protyle-wysiwyg .code-block .hljs-name,
      .protyle-wysiwyg .code-block .hljs-tag {
        color: ${codeSettings.keywordColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-string,
      .protyle-wysiwyg .code-block .hljs-title,
      .protyle-wysiwyg .code-block .hljs-section,
      .protyle-wysiwyg .code-block .hljs-attribute,
      .protyle-wysiwyg .code-block .hljs-literal,
      .protyle-wysiwyg .code-block .hljs-template-tag,
      .protyle-wysiwyg .code-block .hljs-template-variable,
      .protyle-wysiwyg .code-block .hljs-type {
        color: ${codeSettings.stringColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-comment,
      .protyle-wysiwyg .code-block .hljs-quote {
        color: ${codeSettings.commentColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-function {
        color: ${codeSettings.functionColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-number {
        color: ${codeSettings.numberColor} !important;
      }

      /* 预览区域代码块 */
      .b3-typography pre,
      .b3-typography pre code {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        background-color: ${codeSettings.backgroundColor} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 暗色主题适配 */
      :root[data-theme-mode="dark"] .protyle-wysiwyg .code-block {
        box-shadow: ${codeSettings.boxShadow !== "none" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "none"} !important;
      }
    `;

		document.head.appendChild(style);
	} catch (error) {
		console.error("应用代码块增强样式失败:", error);
	}
}

export function applyCodeBlockCollapse(
	enable: boolean,
	height: number,
): void {
	// 移除现有的折叠样式和功能
	const existingStyle = document.getElementById("codeblock-collapse-style");
	if (existingStyle) {
		existingStyle.remove();
	}

	const existingScript = document.getElementById("codeblock-collapse-script");
	if (existingScript) {
		// 清理滚动监听器
		const cleanupEvent = new Event("codeblock-collapse-cleanup");
		document.dispatchEvent(cleanupEvent);
		existingScript.remove();
	}

	if (!enable) {
		return;
	}

	// 添加折叠样式
	const style = document.createElement("style");
	style.id = "codeblock-collapse-style";
	style.innerHTML = `
    .code-block.code-block-collapse-wrapper {
      position: relative;
    }

    .code-block.code-block-collapse-wrapper .hljs {
      transition: max-height 0.3s ease;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .code-block.code-block-collapse-wrapper .code-collapse-fade {
      position: absolute;
      bottom: 40px;
      left: 0;
      right: 0;
      height: 40px;
      background: linear-gradient(to bottom, transparent, var(--b3-theme-surface));
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 1;
    }

    .code-block.code-block-collapse-wrapper:not(.code-block-collapsed) .code-collapse-fade {
      opacity: 0;
    }

    .code-block .code-collapse-bar {
      position: sticky;
      bottom: 0;
      display: flex;
      justify-content: center;
      padding: 4px 0;
      background: var(--b3-theme-surface);
      border-top: 1px solid var(--b3-border-color);
      z-index: 2;
    }

    .code-block .code-collapse-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      background: none;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: var(--b3-theme-on-surface);
      line-height: 1.4;
      transition: background 0.2s ease;
    }

    .code-block .code-collapse-btn:hover {
      background: var(--b3-theme-surface-variant);
    }

    .code-block .code-collapse-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
      transition: transform 0.3s ease;
    }

    .code-block .code-collapse-btn svg.collapsed {
      transform: rotate(-90deg);
    }

    .code-block .code-collapse-line-info {
      font-size: 11px;
      color: var(--b3-theme-on-surface);
      opacity: 0.6;
      margin-left: 6px;
    }
  `;
	document.head.appendChild(style);

	// 添加折叠功能脚本
	const script = document.createElement("script");
	script.id = "codeblock-collapse-script";
	script.innerHTML = `
    (function() {
      const codeMaxHeight = ${height};
      let running = false;
      const scrollCleanupFns = [];

      function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      }

      function countLines(hljs) {
        const codeEl = hljs.querySelector('code');
        if (!codeEl) return 0;
        const text = codeEl.textContent || '';
        return text.split('\\n').length;
      }

      function addCodeExtends(codeBlocks) {
        if(codeBlocks.length === 0) return;
        if(running) return;
        running = true;
        setTimeout(() => {running = false;}, 300);
        codeBlocks.forEach(async codeBlock => {
          if(isCursorInCodeBlock(codeBlock)) return;
          const hljs = await whenElementExist(() => codeBlock.querySelector('.hljs'));
          if(!hljs || hljs.scrollHeight <= codeMaxHeight) return;
          if(codeBlock.querySelector('.code-collapse-bar')) return;

          codeBlock.classList.add('code-block-collapse-wrapper');
          codeBlock.classList.add('code-block-collapsed');
          hljs.style.maxHeight = codeMaxHeight + 'px';

          const totalLines = countLines(hljs);
          const isZh = document.documentElement.lang === 'zh_CN';

          // 渐变遮罩
          const fade = document.createElement('div');
          fade.className = 'code-collapse-fade protyle-custom';
          fade.contentEditable = 'false';
          codeBlock.appendChild(fade);

          // 底部操作栏
          const bar = document.createElement('div');
          bar.className = 'code-collapse-bar protyle-custom';
          bar.contentEditable = 'false';
          const lineInfo = totalLines > 0
            ? '<span class=\"code-collapse-line-info\">(' + totalLines + ' ' + (isZh ? '行' : 'lines') + ')</span>'
            : '';
          bar.innerHTML = \`
            <button class=\"code-collapse-btn\" contenteditable=\"false\">
              <svg class=\"collapsed\" viewBox=\"0 0 16 16\" xmlns=\"http://www.w3.org/2000/svg\">
                <path d=\"M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z\"/>
              </svg>
              <span contenteditable=\"false\">\${isZh ? '展开代码' : 'Expand'}</span>
            </button>
            \${lineInfo}
          \`;
          codeBlock.appendChild(bar);

          bar.querySelector('.code-collapse-btn').onclick = () => {
            const isCollapsed = codeBlock.classList.contains('code-block-collapsed');
            const svg = bar.querySelector('svg');
            const label = bar.querySelector('.code-collapse-btn span');
            if (isCollapsed) {
              codeBlock.classList.remove('code-block-collapsed');
              hljs.style.maxHeight = 'none';
              svg.classList.remove('collapsed');
              label.textContent = isZh ? '收起代码' : 'Collapse';
            } else {
              codeBlock.classList.add('code-block-collapsed');
              hljs.style.maxHeight = codeMaxHeight + 'px';
              hljs.scrollTop = 0;
              svg.classList.add('collapsed');
              label.textContent = isZh ? '展开代码' : 'Expand';
            }
          };
        });
      }

      function isCursorInCodeBlock(codeBlock) {
        if(!codeBlock) return false;
        let cursorEl = getCursorElement();
        if(!cursorEl) return false;
        cursorEl = cursorEl.closest('.code-block');
        if(!cursorEl) return false;
        return cursorEl === codeBlock;
      }

      function getCursorElement() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const startContainer = range.startContainer;
          const cursorElement = startContainer.nodeType === Node.TEXT_NODE
              ? startContainer.parentElement
              : startContainer;
          return cursorElement;
        }
        return null;
      }

      function whenElementExist(selector) {
        return new Promise(resolve => {
          const checkForElement = () => {
            let element = null;
            if (typeof selector === 'function') {
              element = selector();
            } else {
              element = document.querySelector(selector);
            }
            if (element) {
              resolve(element);
            } else {
              requestAnimationFrame(checkForElement);
            }
          };
          checkForElement();
        });
      }

      function observeProtyleAddition(el, callback) {
        const config = { attributes: false, childList: true, subtree: true };
        const observer = new MutationObserver((mutationsList) => {
          mutationsList.forEach(mutation => {
            if (mutation.type === 'childList') {
              const protyles = Array.from(mutation.addedNodes).filter(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node.classList.contains('protyle') || node.classList.contains('protyle-content'))
              );
              if (protyles.length > 0) {
                callback(protyles);
              }
            }
          });
        });
        observer.observe(el, config);
        return () => {
          observer.disconnect();
        };
      }

      // 初始化代码块折叠功能
      function initCodeBlockCollapse() {
        whenElementExist('body').then(async el => {
          let protyle;
          await whenElementExist(() => {
            protyle = el.querySelector('.protyle');
            return protyle && protyle?.dataset?.loading === 'finished';
          });
          addCodeExtends(protyle.querySelectorAll('.code-block'));

          let scrollContainer = isMobile() ? window : protyle.querySelector(".protyle-content");
          let debounceTimer;
          const scrollHandler = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              addCodeExtends(protyle.querySelectorAll('.code-block'));
            }, 100);
          };
          scrollContainer.addEventListener('scroll', scrollHandler);
          scrollCleanupFns.push(() => scrollContainer.removeEventListener('scroll', scrollHandler));

          observeProtyleAddition(el, protyles => {
            protyles.forEach(async protyle => {
              if(!protyle.classList.contains('protyle')) {
                protyle = protyle.closest('.protyle');
              }
              addCodeExtends(protyle.querySelectorAll('.code-block'));
              let scrollContainer = isMobile() ? window : protyle.querySelector(".protyle-content");
              const handler = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  addCodeExtends(protyle.querySelectorAll('.code-block'));
                }, 100);
              };
              scrollContainer.addEventListener('scroll', handler);
              scrollCleanupFns.push(() => scrollContainer.removeEventListener('scroll', handler));
            });
          });
        });
      }

      // 如果页面已加载，立即初始化
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCodeBlockCollapse);
      } else {
        initCodeBlockCollapse();
      }

      // 监听清理事件，移除所有滚动监听器
      document.addEventListener('codeblock-collapse-cleanup', () => {
        scrollCleanupFns.forEach(fn => fn());
        scrollCleanupFns.length = 0;
      });
    })();
  `;
	document.head.appendChild(script);
}

export class GeneralSettings {
	private plugin: Plugin;
	private autoBackupTimer: number | null = null;
	private lastBackupTimestamp = 0;
	private storage: GeneralSettingsStorage;
	private contentObserver: MutationObserver | null = null;
	private docCountManager: DocCountManager | null = null;
	private highlightManager: HighlightManager | null = null;
	private skillsViewerManager: SkillsViewerManager | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.storage = new GeneralSettingsStorage(plugin);
	}

	public async init() {
		this.addDock();
		this.applySavedSettings();
		await this.applyCodeBlockStyle();
		await this.applyListStyle();
		await this.applyHeadingStyle();
		await this.applyDocumentFontStyle();
		await this.applyTableStyle();
		await this.applyListStyleEnhanced();
		await this.applyDocCountStyle();
		await this.applyTabPinStyle();
		await this.applyHighlightStyle();
		await this.applySkillsViewerStyle();
		this.observeContentChanges();
		await this.initAutoBackup();
	}

	private addDock() {
		const self = this;
		this.plugin.addDock({
			config: {
				position: "RightTop",
				size: { width: 360, height: 0 },
				icon: "iconSettings",
				title: this.plugin.i18n.generalSettings || "通用设置",
				show: false,
			},
			data: {},
			type: "general-settings-dock",
			init: (dock: any) => {
				const container = document.createElement("div");
				container.style.height = "100%";
				container.style.overflow = "hidden";

				const app = createApp({
					setup() {
						return () =>
							h(GeneralSettingsPanel, {
								i18n: self.plugin.i18n,
								plugin: self.plugin,
								onSettingsChange: (settings: any) => {
									self.handleSettingsChange(settings);
								},
							});
					},
				});

				app.mount(container);
				dock.element?.appendChild(container);

				dock.__app = app;
				dock.__container = container;
			},
		});
	}

	private handleSettingsChange(settings: any) {
		if (settings.moduleId === "font") {
			this.applyGlobalFontStyles(settings.settings);
		} else if (settings.moduleId === "codeblock") {
			this.applyCodeBlockStyleFromSettings(settings.settings);
		} else if (settings.moduleId === "list") {
			this.applyListStyles(settings.settings);
		} else if (settings.moduleId === "documentFont") {
			this.applyDocumentFontStyles(settings.settings);
		} else if (settings.moduleId === "tableStyle") {
			this.applyTableStyles(settings.settings);
		} else if (settings.moduleId === "listStyle") {
			this.applyListStylesEnhanced(settings.settings);
		} else if (settings.moduleId === "tabPin") {
			this.applyTabPinStyles(settings.settings);
		}
		this.dispatchEvent("general-settings-changed", settings);
	}

	private applyGlobalFontStyles(fontSettings: any) {
		try {
			const root = document.documentElement;

			if (fontSettings.fontFamily) {
				root.style.setProperty(
					"--general-font-family",
					fontSettings.fontFamily,
				);
				this.applyToSiyuanElements("font-family", fontSettings.fontFamily);
			}

			root.style.setProperty(
				"--general-font-size",
				`${fontSettings.fontSize}px`,
			);
			this.applyToSiyuanElements("font-size", `${fontSettings.fontSize}px`);

			root.style.setProperty("--general-font-weight", fontSettings.fontWeight);
			this.applyToSiyuanElements("font-weight", fontSettings.fontWeight);

			root.style.setProperty(
				"--general-line-height",
				fontSettings.lineHeight.toString(),
			);
			this.applyToSiyuanElements(
				"line-height",
				fontSettings.lineHeight.toString(),
			);
		} catch (error) {
			console.error("应用全局字体样式失败:", error);
		}
	}

	private applyToSiyuanElements(property: string, value: string) {
		try {
			const editorElements = document.querySelectorAll(
				".protyle-content, .protyle-wysiwyg",
			);
			editorElements.forEach((el: any) => {
				el.style[property as any] = value;
			});

			const contentElements = document.querySelectorAll(
				".b3-typography, .render-node",
			);
			contentElements.forEach((el: any) => {
				el.style[property as any] = value;
			});
		} catch (error) {
			console.error(`应用字体样式到思源元素失败:`, error);
		}
	}

	private dispatchEvent(eventType: string, data: any) {
		try {
			const event = new CustomEvent(eventType, {
				detail: data,
				bubbles: true,
				cancelable: true,
			});
			document.dispatchEvent(event);
		} catch (error) {
			console.error("发送事件失败:", error);
		}
	}

	public getCurrentFontSettings(): any {
		try {
			const saved = localStorage.getItem("general-font-settings");
			if (saved) {
				return JSON.parse(saved);
			}
		} catch (error) {
			console.error("获取字体设置失败:", error);
		}

		return {
			fontFamily: "",
			fontSize: 14,
			fontWeight: "normal",
			lineHeight: 1.6,
		};
	}

	public applySavedSettings() {
		const settings = this.getCurrentFontSettings();
		this.applyGlobalFontStyles(settings);
	}

	public async applyCodeBlockStyle() {
		try {
			const settings = await loadCodeBlockSettings(this.plugin);
			this.applyCodeBlockStyleFromSettings(settings);
		} catch (error) {
			console.error("应用代码块样式失败:", error);
		}
	}

	public async applyListStyle() {
		try {
			const settings = await loadListSettingsFromDB(this.plugin);
			this.applyListStyles(settings);
		} catch (error) {
			console.error("应用列表样式失败:", error);
		}
	}

	public async applyHeadingStyle() {
		try {
			const settings = await loadHeadingSettings(this.plugin);

			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", () => {
					setTimeout(() => {
						this.applyHeadingStyles(settings);
					}, 200);
				});
			} else {
				setTimeout(() => {
					this.applyHeadingStyles(settings);
				}, 200);
			}
		} catch (error) {
			console.error("应用标题样式失败:", error);
		}
	}

	public async applyDocumentFontStyle() {
		try {
			const settings = await this.storage.loadDocumentFontSettings();
			if (settings) {
				this.applyDocumentFontStyles(settings);
			}
		} catch (error) {
			console.error("应用文档字体样式失败:", error);
		}
	}

	private applyDocumentFontStyles(fontSettings: any) {
		try {
			// 移除现有样式
			const existingStyle = document.getElementById("document-font-settings");
			if (existingStyle) {
				existingStyle.remove();
			}

			if (!fontSettings.enabled) {
				return;
			}

			// 创建新的样式元素
			const style = document.createElement("style");
			style.id = "document-font-settings";

			const fontFamily = fontSettings.fontFamily
				? `'${fontSettings.fontFamily}', `
				: "";

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
      `;

			document.head.appendChild(style);
		} catch (error) {
			console.error("应用文档字体样式失败:", error);
		}
	}

	public async applyTableStyle() {
		try {
			const settings = await this.storage.loadTableStyleSettings();
			if (settings) {
				this.applyTableStyles(settings);
			}
		} catch (error) {
			console.error("应用表格样式失败:", error);
		}
	}

	private applyTableStyles(tableSettings: any) {
		try {
			// 移除现有样式
			const existingStyle = document.getElementById("table-style-settings");
			if (existingStyle) {
				existingStyle.remove();
			}

			if (!tableSettings.enabled) {
				return;
			}

			// 创建新的样式元素
			const style = document.createElement("style");
			style.id = "table-style-settings";

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
      `;

			document.head.appendChild(style);
		} catch (error) {
			console.error("应用表格样式失败:", error);
		}
	}

	public async applyListStyleEnhanced() {
		try {
			const settings = await this.storage.loadListStyleSettings();
			if (settings) {
				this.applyListStylesEnhanced(settings);
			}
		} catch (error) {
			console.error("应用列表样式失败:", error);
		}
	}

	public async applyDocCountStyle() {
		try {
			const settings = await this.storage.loadDocCountSettings();
			if (settings && settings.enableDocCount) {
				// 如果功能已启用,启动管理器
				this.docCountManager = new DocCountManager();
				this.docCountManager.start();
				this.docCountManager.setUpdateInterval(
					parseInt(settings.updateInterval),
				);
				this.docCountManager.setFontStyle({
					fontSize: settings.fontSize,
					color: settings.fontColor,
					fontWeight: settings.fontWeight,
				});
			}
		} catch (error) {
			console.error("应用文档数统计样式失败:", error);
		}
	}

	public async applyHighlightStyle() {
		try {
			const settings = await this.storage.loadHighlightSettings();
			if (settings && settings.enableHighlight === false) {
				return;
			}
			const options = settings
				? { backgroundColor: settings.backgroundColor, fontSize: settings.fontSize, bold: settings.bold, minTextLength: settings.minTextLength, minLetterLength: settings.minLetterLength, maxTextLength: settings.maxTextLength, maxLetterLength: settings.maxLetterLength }
				: undefined;
			this.highlightManager = new HighlightManager(options);
			this.highlightManager.enable();
		} catch (error) {
			console.error("应用双击高亮功能失败:", error);
		}
	}

	public async applySkillsViewerStyle() {
		try {
			const settings = await this.storage.loadSkillsViewerSettings();
			if (settings && settings.enabled) {
				this.skillsViewerManager = new SkillsViewerManager();
			}
		} catch (error) {
			console.error("初始化 Skills 查看器失败:", error);
		}
	}

	public async applyTabPinStyle() {
		try {
			const settings = await this.storage.loadTabPinSettings();
			if (settings) {
				this.applyTabPinStyles(settings);
			}
		} catch (error) {
			console.error("应用钉住页签样式失败:", error);
		}
	}

	public getHighlightManager(): HighlightManager | null {
		return this.highlightManager;
	}

	public async updateHighlight(enabled: boolean) {
		if (!this.highlightManager) {
			this.highlightManager = new HighlightManager();
		}
		if (enabled) {
			this.highlightManager.enable();
		} else {
			this.highlightManager.disable();
		}
		const current = await this.storage.loadHighlightSettings();
		this.storage.saveHighlightSettings({
			enableHighlight: enabled,
			backgroundColor: current?.backgroundColor ?? "rgb(255, 220, 60)",
			fontSize: current?.fontSize ?? 0,
			bold: current?.bold ?? false,
			minTextLength: current?.minTextLength ?? 1,
			minLetterLength: current?.minLetterLength ?? 1,
			maxTextLength: current?.maxTextLength ?? 50,
			maxLetterLength: current?.maxLetterLength ?? 100,
		});
	}

	public updateHighlightOptions(options: { backgroundColor?: string; fontSize?: number; bold?: boolean; minTextLength?: number; minLetterLength?: number; maxTextLength?: number; maxLetterLength?: number }) {
		if (this.highlightManager) {
			this.highlightManager.updateOptions(options);
		}
		this.storage.loadHighlightSettings().then((current) => {
			this.storage.saveHighlightSettings({
				enableHighlight: current?.enableHighlight ?? true,
				backgroundColor: options.backgroundColor ?? current?.backgroundColor ?? "rgb(255, 220, 60)",
				fontSize: options.fontSize ?? current?.fontSize ?? 0,
				bold: options.bold ?? current?.bold ?? false,
				minTextLength: options.minTextLength ?? current?.minTextLength ?? 1,
				minLetterLength: options.minLetterLength ?? current?.minLetterLength ?? 1,
				maxTextLength: options.maxTextLength ?? current?.maxTextLength ?? 50,
				maxLetterLength: options.maxLetterLength ?? current?.maxLetterLength ?? 100,
			});
		});
	}

	private applyTabPinStyles(tabPinSettings: any) {
		try {
			// 移除现有样式
			const existingStyle = document.getElementById("tab-pin-settings-style");
			if (existingStyle) {
				existingStyle.remove();
			}

			if (!tabPinSettings.enabled) {
				return;
			}

			// 默认值
			const defaultBackgroundColor = "rgba(var(--b3-theme-primary-rgb), 0.1)";

			// 创建新的样式元素
			const style = document.createElement("style");
			style.id = "tab-pin-settings-style";

			let css = `
        /* 钉住页签：显示标题文本 */
        .layout-tab-bar .item.item--pin .item__text {
          width: auto !important;
          max-width: none !important;
          display: flex !important;
        }
      `;

			// 根据显示模式添加不同的样式
			if (tabPinSettings.displayMode === "textOnly") {
				css += `
          /* 仅显示标题：隐藏图标 */
          .layout-tab-bar .item.item--pin .item__icon {
            display: none !important;
          }
        `;
			}

			css += `
        /* 钉住页签：应用自定义背景颜色 */
        .layout-tab-bar .item.item--pin {
          ${tabPinSettings.backgroundColor !== defaultBackgroundColor ? `background: ${tabPinSettings.backgroundColor} !important;` : ""}
        }
      `;

			style.textContent = css;
			document.head.appendChild(style);
		} catch (error) {
			console.error("应用钉住页签样式失败:", error);
		}
	}

	private applyListStylesEnhanced(listSettings: any) {
		try {
			// 移除现有样式
			const existingStyle = document.getElementById("list-style-settings");
			if (existingStyle) {
				existingStyle.remove();
			}

			if (!listSettings.enabled) {
				return;
			}

			// 创建新的样式元素
			const style = document.createElement("style");
			style.id = "list-style-settings";

			// 有序列表颜色
			const orderedListCss = listSettings.orderedListColors
				.map((color: string, index: number) => {
					const depth = '.li[data-subtype="o"] '.repeat(index);
					return `
          ${depth}.li[data-subtype="o"] > .protyle-action--order {
            color: ${color} !important;
            font-weight: bold !important;
          }
        `;
				})
				.join("\n");

			// 无序列表颜色和符号
			const unorderedListCss = listSettings.unorderedListColors
				.map((color: string, index: number) => {
					const depth = '[data-subtype="u"] > '.repeat(index);
					const symbol = index % 2 === 0 ? "•" : "▪";
					return `
          ${depth}.li[data-subtype="u"] > .protyle-action::before {
            content: "${symbol}";
            font-size: ${listSettings.symbolSize}em;
            font-weight: bold;
            font-family: Arial;
            position: absolute;
            color: ${color} !important;
          }
        `;
				})
				.join("\n");

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
      `;

			document.head.appendChild(style);
		} catch (error) {
			console.error("应用列表样式失败:", error);
		}
	}

	private applyHeadingStyles(settings: any) {
		try {
			const style =
				document.getElementById("heading-colors-style") ||
				document.createElement("style");
			style.id = "heading-colors-style";

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
				.join("\n");

			const fontSizes = settings.fontSizes || {};
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
				.join("\n");

			let levelCss = "";
			if (settings.levelDisplay && settings.levelDisplay !== "none") {
				levelCss = this.generateLevelDisplayCss(
					settings.levelDisplay,
					settings.customMarkers || [],
				);
			}

			const centerAlignCss = settings.titleCenterAlign
				? `
        .protyle-title__input {
          text-align: center !important;
        }
      `
				: "";

			const titleColorCss = settings.titleColor
				? `
        .protyle-title__input {
          color: ${settings.titleColor} !important;
        }
      `
				: "";

			const titleFontSizeCss = settings.titleFontSize
				? `
        .protyle-title__input {
          font-size: ${settings.titleFontSize}px !important;
        }
      `
				: "";

			style.textContent =
				colorCss +
				"\n" +
				fontSizeCss +
				"\n" +
				levelCss +
				"\n" +
				centerAlignCss +
				"\n" +
				titleColorCss +
				"\n" +
				titleFontSizeCss;

			if (!style.parentElement) {
				document.head.appendChild(style);
			}
		} catch (error) {
			console.error("应用标题样式失败:", error);
		}
	}

	private generateLevelDisplayCss(
		style: string,
		customMarkers: string[],
	): string {
		const levels =
			style === "custom"
				? customMarkers
				: HEADING_LEVEL_MAPPINGS[style] || HEADING_LEVEL_MAPPINGS.number;

		return levels
			.map((label, index) => {
				const level = index + 1;
				const tagStyles =
					style === "tag"
						? "background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; opacity: 0.7;"
						: "";

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
			})
			.join("\n");
	}

	private applyListStyles(settings: any) {
		try {
			localStorage.setItem("general-list-settings", JSON.stringify(settings));

			if (settings.css) {
				this.applyListCSS(settings.css);
			} else {
				this.removeExistingListStyles();
			}
		} catch (error) {
			console.error("应用列表样式失败:", error);
		}
	}

	private applyListCSS(css: string) {
		if (!css) {
			this.removeExistingListStyles();
			return;
		}

		this.removeExistingListStyles();

		const styleElement = document.createElement("style");
		styleElement.id = "custom-list-styles";
		styleElement.textContent = css;
		document.head.appendChild(styleElement);
	}

	private removeExistingListStyles() {
		const existingStyle = document.getElementById("custom-list-styles");
		if (existingStyle) {
			existingStyle.remove();
		}
	}

	private applyCodeBlockStyleFromSettings(settings: any) {
		try {
			applyCodeBlockStyle(settings.style || "default");

			// 应用代码块折叠
			applyCodeBlockCollapse(
				settings.enableCollapse ?? true,
				settings.collapseHeight ?? 400,
			);

			// 应用代码块样式增强
			applyCodeBlockEnhancedStyles(settings);
		} catch (error) {
			console.error("应用代码块样式失败:", error);
		}
	}

	private observeContentChanges() {
		try {
			const observer = new MutationObserver((mutations) => {
				let shouldReapplyStyles = false;

				mutations.forEach((mutation) => {
					if (mutation.type === "childList") {
						mutation.addedNodes.forEach((node) => {
							if (node.nodeType === Node.ELEMENT_NODE) {
								const element = node as Element;
								if (
									element.classList?.contains("protyle-wysiwyg") ||
									element.classList?.contains("b3-typography") ||
									element.querySelector?.(".protyle-wysiwyg") ||
									element.querySelector?.(".b3-typography")
								) {
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

			const observerOptions = {
				childList: true,
				subtree: true,
				attributes: false,
			};

			observer.observe(document.body, observerOptions);
			this.contentObserver = observer;
		} catch (error) {
			console.error("启动内容变化观察器失败:", error);
		}
	}

	private async initAutoBackup() {
		try {
			const data = await this.plugin.loadData("data-backup-settings");
			if (data) {
				this.lastBackupTimestamp = data.lastBackupTimestamp || 0;
			}

			const isMobile = checkIsMobile();
			const autoBackupEnabled = data?.autoBackupEnabled ?? false;
			const backupFrequency = data?.backupFrequency ?? "daily";
			const backupTime = data?.backupTime ?? "03:00";

			if (!isMobile && autoBackupEnabled) {
				this.startAutoBackupTimer(backupFrequency, backupTime);
			}
		} catch (error) {
			console.error("初始化自动备份失败:", error);
		}
	}

	private startAutoBackupTimer(backupFrequency: string, backupTime: string) {
		this.stopAutoBackupTimer();

		// 记录定时器启动时间，防止重启后立即触发备份
		const timerStartTime = Date.now();
		// 用于防止同一时间点重复触发
		let lastExecutedHour = -1;
		let lastExecutedDateStr = "";

		const checkAndBackup = async () => {
			const now = new Date();
			const currentTime = now.getTime();
			const currentHour = now.getHours();
			const currentMinute = now.getMinutes();
			const currentDateStr = now.toDateString();
			const timeSinceTimerStart = currentTime - timerStartTime;
			const timeSinceLastBackup = currentTime - this.lastBackupTimestamp;

			let shouldBackup = false;

			switch (backupFrequency) {
				case "minute":
					// 每分钟：间隔触发，跳过启动后首个周期
					if (timeSinceLastBackup >= 60 * 1000 && timeSinceTimerStart >= 60 * 1000) {
						shouldBackup = true;
					}
					break;

				case "hourly":
					// 每小时：整点触发（分钟数为0时），跳过启动后首个周期
					if (
						currentMinute === 0 &&
						lastExecutedHour !== currentHour &&
						timeSinceTimerStart >= 60 * 1000
					) {
						shouldBackup = true;
						lastExecutedHour = currentHour;
					}
					break;

				case "daily": {
					// 每天：在用户指定的时间点触发，跳过启动后首个周期
					const [targetHour, targetMinute] = backupTime.split(":").map(Number);
					if (
						currentHour === targetHour &&
						currentMinute === targetMinute &&
						lastExecutedDateStr !== currentDateStr &&
						timeSinceTimerStart >= 60 * 1000
					) {
						shouldBackup = true;
						lastExecutedDateStr = currentDateStr;
					}
					break;
				}
			}

			if (shouldBackup) {
				window.dispatchEvent(new CustomEvent("autoBackupTrigger"));
			}
		};

		this.autoBackupTimer = window.setInterval(checkAndBackup, 60000);
	}

	private stopAutoBackupTimer() {
		if (this.autoBackupTimer) {
			clearInterval(this.autoBackupTimer);
			this.autoBackupTimer = null;
		}
	}

	public updateLastBackupTime(timestamp: number) {
		this.lastBackupTimestamp = timestamp;
	}

	public restartAutoBackupTimer(enabled: boolean, frequency: string, backupTime: string = "03:00") {
		this.stopAutoBackupTimer();
		if (enabled) {
			this.startAutoBackupTimer(frequency, backupTime);
		}
	}

	public destroy() {
		this.stopAutoBackupTimer();
		if (this.contentObserver) {
			this.contentObserver.disconnect();
			this.contentObserver = null;
		}
		if (this.docCountManager) {
			this.docCountManager.stop();
			this.docCountManager = null;
		}
		if (this.highlightManager) {
			this.highlightManager.disable();
			this.highlightManager = null;
		}
		if (this.skillsViewerManager) {
			this.skillsViewerManager.destroy();
			this.skillsViewerManager = null;
		}
	}
}

export function registerGeneralSettings(plugin: Plugin) {
	const settings = new GeneralSettings(plugin);
	settings.init();
	(plugin as any).__generalSettings = settings;
	return settings;
}
