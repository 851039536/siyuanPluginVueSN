/**
 * 通用设置 - 样式工具函数
 */
import { emitCustomEvent } from "@/utils/eventBus"

export const CODEBLOCK_STYLES = [
  "default",
  "github",
  "mac",
] as const
export type CodeBlockStyle = (typeof CODEBLOCK_STYLES)[number]

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
}

export function checkIsMobile(): boolean {
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileUA =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(
      userAgent,
    )
  const screenWidth = window.innerWidth <= 768
  const hasTouchScreen =
    "ontouchstart" in window || navigator.maxTouchPoints > 0
  const isSiyuanMobile = (window as any)._siyuan_mobile === true
  return (
    mobileUA || screenWidth || (hasTouchScreen && mobileUA) || isSiyuanMobile
  )
}

export function applyCodeBlockStyle(style: CodeBlockStyle | string): void {
  CODEBLOCK_STYLES.forEach((s) =>
    document.body.classList.remove(`codeblock-style-${s}`),
  )
  document.body.classList.add(`codeblock-style-${style}`)
}

/** 将 hex 颜色转为 rgba，支持透明度 */
function hexToRgba(hex: string, opacity: number): string {
  if (opacity >= 1) return hex
  const h = hex.replace(/^#/, "")
  const r = Number.parseInt(h.substring(0, 2), 16)
  const g = Number.parseInt(h.substring(2, 4), 16)
  const b = Number.parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Number(opacity.toFixed(2))})`
}

export function applyCodeBlockEnhancedStyles(codeSettings: any): void {
  try {
    const existingStyle = document.getElementById("codeblock-enhanced-style")
    if (existingStyle) {
      existingStyle.remove()
    }

    if (!codeSettings.enabled) {
      return
    }

    const bg = hexToRgba(codeSettings.backgroundColor, codeSettings.backgroundColorOpacity ?? 1)

    const style = document.createElement("style")
    style.id = "codeblock-enhanced-style"

    style.textContent = `
      /* 代码块基础样式 */
      .protyle-wysiwyg .code-block {
        background-color: ${bg} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        box-shadow: ${codeSettings.boxShadow !== "none" ? codeSettings.boxShadow : "none"} !important;
      }

      /* 代码块内容 — hljs + 内层 code/span 均需覆盖，因为 SiYuan 的 code 元素自带 font-family */
      .protyle-wysiwyg .code-block .hljs,
      .protyle-wysiwyg .code-block .hljs code,
      .protyle-wysiwyg .code-block .hljs span {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
      }
      .protyle-wysiwyg .code-block .hljs {
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
      .b3-typography pre code,
      .b3-typography pre span {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
      }
      .b3-typography pre,
      .b3-typography pre code {
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        background-color: ${bg} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 暗色主题适配 */
      :root[data-theme-mode="dark"] .protyle-wysiwyg .code-block {
        box-shadow: ${codeSettings.boxShadow !== "none" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "none"} !important;
      }
    `

    document.head.appendChild(style)
  } catch (error) {
    console.error("应用代码块增强样式失败:", error)
  }
}

export function applyCodeBlockCollapse(
  enable: boolean,
  height: number,
): void {
  const existingStyle = document.getElementById("codeblock-collapse-style")
  if (existingStyle) {
    existingStyle.remove()
  }

  const existingScript = document.getElementById("codeblock-collapse-script")
  if (existingScript) {
    emitCustomEvent("codeblock-collapse-cleanup", undefined, { target: document })
    existingScript.remove()
  }

  if (!enable) {
    return
  }

  const style = document.createElement("style")
  style.id = "codeblock-collapse-style"
  style.innerHTML = `
    .code-block.code-block-collapse-wrapper {
      position: relative;
    }

    .code-block.code-block-collapse-wrapper .hljs {
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
    }

    .code-block .code-collapse-btn:hover {
      background: var(--b3-theme-surface-variant);
    }

    .code-block .code-collapse-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
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
  `
  document.head.appendChild(style)

  const script = document.createElement("script")
  script.id = "codeblock-collapse-script"
  script.innerHTML = `
    (function() {
      const codeMaxHeight = ${height};
      let running = false;
      const scrollCleanupFns = [];

      function isMobile() {
        var ua = navigator.userAgent.toLowerCase();
        var mobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
        var screenWidth = window.innerWidth <= 768;
        var hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        var isSiyuanMobile = window._siyuan_mobile === true;
        return mobileUA || screenWidth || (hasTouchScreen && mobileUA) || isSiyuanMobile;
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

          const fade = document.createElement('div');
          fade.className = 'code-collapse-fade protyle-custom';
          fade.contentEditable = 'false';
          codeBlock.appendChild(fade);

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

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCodeBlockCollapse);
      } else {
        initCodeBlockCollapse();
      }

      document.addEventListener('codeblock-collapse-cleanup', () => {
        scrollCleanupFns.forEach(fn => fn());
        scrollCleanupFns.length = 0;
      });
    })();
  `
  document.head.appendChild(script)
}

export function generateLevelDisplayCss(
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

export interface DocumentFontSettingsData {
  enabled: boolean
  fontFamily: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  paragraphSpacing: number
  fontWeight: string
}

export function applyDocumentFontStyles(fontSettings: DocumentFontSettingsData): void {
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

    let fontFamily = ""
    if (fontSettings.fontFamily) {
      const fonts = fontSettings.fontFamily.split(",").map((f) => f.trim())
      fontFamily = `${fonts.map((f) => `'${f}'`).join(", ")}, `
    }

    style.textContent = `
      /* 编辑器内容区域 - 基础样式 */
      .protyle-wysiwyg {
        font-family: ${fontFamily}var(--b3-font-family) !important;
        font-size: ${fontSettings.fontSize}px !important;
        letter-spacing: ${fontSettings.letterSpacing}px !important;
        font-weight: ${fontSettings.fontWeight} !important;
      }

      /* 行高 */
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

export function generateTabPinCSS(settings: { enabled: boolean, displayMode: string, backgroundColor: string }): string {
  const defaultBackgroundColor = "rgba(var(--b3-theme-primary-rgb), 0.1)"

  let css = `
    .layout-tab-bar .item.item--pin .item__text {
      width: auto !important;
      max-width: none !important;
      display: flex !important;
    }
  `

  if (settings.displayMode === "textOnly") {
    css += `
      .layout-tab-bar .item.item--pin .item__icon {
        display: none !important;
      }
    `
  }

  css += `
    .layout-tab-bar .item.item--pin {
      ${settings.backgroundColor !== defaultBackgroundColor ? `background: ${settings.backgroundColor} !important;` : ""}
    }
  `

  return css
}
