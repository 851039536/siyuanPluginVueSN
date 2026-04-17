/**
 * 双击高亮管理器
 * 在文档编辑器中双击选中文本，自动高亮所有匹配内容
 *
 * 使用 DOM 标记（<mark> 标签）替代 CSS Custom Highlight API，
 * 解决浏览器兼容性问题（Firefox 及旧版 Chromium 不支持 CSS.highlights）。
 */
const HIGHLIGHT_STYLE_ID = "highlight-feature-styles";
const HIGHLIGHT_MARK_CLASS = "plugin-highlight-mark";

export interface HighlightOptions {
	backgroundColor?: string;
	fontSize?: number;
	bold?: boolean;
}

const DEFAULT_OPTIONS: Required<HighlightOptions> = {
	backgroundColor: "rgb(255, 220, 60)",
	fontSize: 0,
	bold: false,
};

export class HighlightManager {
	private selectedText = "";
	private styleAdded = false;
	private active = false;
	private toastEl: HTMLDivElement | null = null;
	private toastHideTimer: ReturnType<typeof setTimeout> | null = null;
	private options: Required<HighlightOptions> = { ...DEFAULT_OPTIONS };

	constructor(options?: HighlightOptions) {
		if (options) this.updateOptions(options);
	}

	updateOptions(options: HighlightOptions) {
		Object.assign(this.options, options);
		if (this.active) {
			this.removeStyles();
			this.addStyles();
		}
	}

	enable() {
		if (this.active) return;
		this.active = true;
		this.addStyles();
		document.addEventListener("mouseup", this.handleMouseUp);
		document.addEventListener("mousedown", this.handleMouseDown);
	}

	disable() {
		if (!this.active) return;
		this.active = false;
		document.removeEventListener("mouseup", this.handleMouseUp);
		document.removeEventListener("mousedown", this.handleMouseDown);
		this.clearHighlights();
		this.selectedText = "";
		this.clearToast();
	}

	isActive(): boolean {
		return this.active;
	}

	private handleMouseUp = (event: MouseEvent) => {
		const selection = window.getSelection()?.toString().trim();
		if (!selection || selection === this.selectedText) return;

		const target = event.target as HTMLElement;
		if (!target.closest(".protyle-wysiwyg")) return;

		// 如果点击的是已有高亮标记内的文本，不重新触发（避免闪烁）
		if (target.closest(`.${HIGHLIGHT_MARK_CLASS}`)) return;

		this.selectedText = selection;
		const matchCount = this.highlightText(selection);
		this.showToast(selection, matchCount);
	};

	private handleMouseDown = () => {
		this.clearHighlights();
		this.selectedText = "";
	};

	private addStyles() {
		if (this.styleAdded) return;
		if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
			this.styleAdded = true;
			return;
		}

		const { backgroundColor, fontSize, bold } = this.options;
		const fontSizeRule = fontSize > 0 ? `font-size: ${fontSize}px !important;` : "";
		const boldRule = bold ? "font-weight: bold !important;" : "";

		const style = document.createElement("style");
		style.id = HIGHLIGHT_STYLE_ID;
		style.textContent = `
      .${HIGHLIGHT_MARK_CLASS} {
        background-color: ${backgroundColor} !important;
        color: rgb(0, 0, 0) !important;
        border-radius: 2px !important;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important;
        padding: 0 1px !important;
        margin: 0 -1px !important;
        ${fontSizeRule}
        ${boldRule}
      }
      .highlight-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        padding: 10px 18px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: opacity 0.2s, transform 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--b3-border-color);
      }
      .highlight-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(-4px);
      }
      .highlight-toast .count {
        color: var(--b3-theme-primary);
        font-weight: 600;
      }
    `;
		document.head.appendChild(style);
		this.styleAdded = true;
	}

	private removeStyles() {
		const existing = document.getElementById(HIGHLIGHT_STYLE_ID);
		if (existing) {
			existing.remove();
		}
		this.styleAdded = false;
	}

	/**
	 * 清除所有已有的高亮标记
	 */
	private clearHighlights() {
		const marks = document.querySelectorAll(`.${HIGHLIGHT_MARK_CLASS}`);
		for (const mark of marks) {
			const parent = mark.parentNode;
			if (!parent) continue;
			// 将 <mark> 内的文本节点移出，替代 <mark> 自身
			const frag = document.createDocumentFragment();
			while (mark.firstChild) {
				frag.appendChild(mark.firstChild);
			}
			parent.replaceChild(frag, mark);
			// 合并相邻的文本节点，避免残留空白
			parent.normalize();
		}
	}

	/**
	 * 在文本节点中插入 <mark> 高亮标记，处理匹配跨节点边界的情况
	 */
	private highlightText(value: string): number {
		this.clearHighlights();

		const docRoot = document.querySelector(
			".layout-tab-container > div:not(.fn__none) .protyle-wysiwyg",
		);
		if (!docRoot) return 0;

		const str = value.trim();
		if (!str) return 0;

		// 收集文本节点并记录每个节点在拼接全文中的位置
		const textParts: { node: Text; start: number; length: number }[] = [];
		let fullText = "";
		const treeWalker = document.createTreeWalker(docRoot, NodeFilter.SHOW_TEXT);
		let walkerNode: Node | null;
		while ((walkerNode = treeWalker.nextNode())) {
			const text = (walkerNode as Text).textContent ?? "";
			if (text.length === 0) continue;
			textParts.push({ node: walkerNode as Text, start: fullText.length, length: text.length });
			fullText += text;
		}

		const lowerFull = fullText.toLowerCase();
		const lowerStr = str.toLowerCase();
		let matchCount = 0;
		let searchFrom = 0;

		while ((searchFrom = lowerFull.indexOf(lowerStr, searchFrom)) !== -1) {
			const matchEnd = searchFrom + lowerStr.length;

			// 找到匹配涉及的文本节点范围
			let firstPartIdx = -1;
			let lastPartIdx = -1;
			for (let i = 0; i < textParts.length; i++) {
				const p = textParts[i];
				if (p.start + p.length > searchFrom && firstPartIdx === -1) {
					firstPartIdx = i;
				}
				if (p.start < matchEnd) {
					lastPartIdx = i;
				}
				if (p.start >= matchEnd) break;
			}

			if (firstPartIdx === -1 || lastPartIdx === -1) {
				searchFrom = matchEnd;
				continue;
			}

			try {
				// 在涉及的每个文本节点中插入 <mark> 标签
				for (let i = firstPartIdx; i <= lastPartIdx; i++) {
					const part = textParts[i];
					const text = part.node.textContent ?? "";
					const localStart = Math.max(0, searchFrom - part.start);
					const localEnd = Math.min(part.length, matchEnd - part.start);

					if (localStart >= localEnd) continue;

					const mark = document.createElement("mark");
					mark.className = HIGHLIGHT_MARK_CLASS;
					mark.textContent = text.slice(localStart, localEnd);

					const parent = part.node.parentNode;
					if (!parent) continue;

					const frag = document.createDocumentFragment();
					if (localStart > 0) frag.appendChild(document.createTextNode(text.slice(0, localStart)));
					frag.appendChild(mark);
					if (localEnd < part.length) frag.appendChild(document.createTextNode(text.slice(localEnd)));
					parent.replaceChild(frag, part.node);
				}
				matchCount++;
			} catch {
				// 跳过无效范围
			}

			searchFrom = matchEnd;
		}

		return matchCount;
	}

	private showToast(text: string, count: number) {
		this.clearToast();

		if (!this.toastEl) {
			this.toastEl = document.createElement("div");
			this.toastEl.className = "highlight-toast";
		}

		const displayText = text.length > 20 ? text.slice(0, 20) + "..." : text;
		this.toastEl.innerHTML = `"${displayText}" <span class="count">${count}</span> 处`;

		if (!this.toastEl.parentElement) {
			document.body.appendChild(this.toastEl);
		}

		requestAnimationFrame(() => this.toastEl!.classList.add("show"));

		if (this.toastHideTimer) {
			clearTimeout(this.toastHideTimer);
		}
		this.toastHideTimer = setTimeout(() => {
			if (this.toastEl) {
				this.toastEl.classList.remove("show");
				setTimeout(() => this.toastEl?.remove(), 200);
			}
		}, 1800);
	}

	private clearToast() {
		if (this.toastHideTimer) {
			clearTimeout(this.toastHideTimer);
			this.toastHideTimer = null;
		}
		if (this.toastEl) {
			this.toastEl.remove();
			this.toastEl = null;
		}
	}
}
