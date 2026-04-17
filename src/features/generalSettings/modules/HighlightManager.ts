/**
 * 双击高亮管理器
 * 在文档编辑器中双击选中文本，自动高亮所有匹配内容
 *
 * 使用 DOM 标记（<mark> 标签）替代 CSS Custom Highlight API，
 * 解决浏览器兼容性问题（Firefox 及旧版 Chromium 不支持 CSS.highlights）。
 */
const HIGHLIGHT_STYLE_ID = "highlight-feature-styles";
const HIGHLIGHT_MARK_CLASS = "plugin-highlight-mark";

export class HighlightManager {
	private selectedText = "";
	private styleAdded = false;
	private active = false;
	private toastEl: HTMLDivElement | null = null;
	private toastTimer: ReturnType<typeof setTimeout> | null = null;
	private toastHideTimer: ReturnType<typeof setTimeout> | null = null;

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

		const style = document.createElement("style");
		style.id = HIGHLIGHT_STYLE_ID;
		style.textContent = `
      .${HIGHLIGHT_MARK_CLASS} {
        background-color: rgb(255, 220, 60);
        color: rgb(0, 0, 0);
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
        padding: 0 1px;
        margin: 0 -1px;
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
	 * 在文本节点中插入 <mark> 高亮标记
	 * 处理匹配跨节点边界的情况
	 */
	private highlightText(value: string): number {
		this.clearHighlights();

		const docRoot = document.querySelector(
			".layout-tab-container > div:not(.fn__none) .protyle-wysiwyg",
		);
		if (!docRoot) return 0;

		const str = value.trim();
		if (!str) return 0;

		// 收集所有文本节点
		const allTextNodes: Text[] = [];
		const treeWalker = document.createTreeWalker(docRoot, NodeFilter.SHOW_TEXT);
		let node: Node | null;
		while ((node = treeWalker.nextNode())) {
			allTextNodes.push(node as Text);
		}

		// 拼接纯文本并记录每个字符对应的节点索引
		const textParts: { node: Text; start: number; length: number }[] = [];
		let fullText = "";
		for (const tn of allTextNodes) {
			const text = tn.textContent ?? "";
			if (text.length === 0) continue;
			textParts.push({ node: tn, start: fullText.length, length: text.length });
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
				this.wrapRange(
					textParts,
					firstPartIdx,
					lastPartIdx,
					searchFrom,
					matchEnd,
				);
				matchCount++;
			} catch {
				// 跳过无效范围
			}

			searchFrom = matchEnd;
		}

		return matchCount;
	}

	/**
	 * 将匹配的文本范围用 <mark> 标签包裹
	 */
	private wrapRange(
		textParts: { node: Text; start: number; length: number }[],
		firstIdx: number,
		lastIdx: number,
		matchStart: number,
		matchEnd: number,
	) {
		for (let i = firstIdx; i <= lastIdx; i++) {
			const part = textParts[i];
			const node = part.node;
			const text = node.textContent ?? "";

			// 计算在当前文本节点内的偏移
			const localStart = Math.max(0, matchStart - part.start);
			const localEnd = Math.min(part.length, matchEnd - part.start);

			if (localStart >= localEnd) continue;

			const before = text.slice(0, localStart);
			const matched = text.slice(localStart, localEnd);
			const after = text.slice(localEnd);

			const mark = document.createElement("mark");
			mark.className = HIGHLIGHT_MARK_CLASS;
			mark.textContent = matched;

			const parent = node.parentNode;
			if (!parent) continue;

			const frag = document.createDocumentFragment();
			if (before) frag.appendChild(document.createTextNode(before));
			frag.appendChild(mark);
			if (after) frag.appendChild(document.createTextNode(after));

			parent.replaceChild(frag, node);

			// 后续节点不受影响，因为 textParts 已在循环外构建
			// 但最后一个文本节点已被替换，如果还有后续节点需要更新引用
			if (i === lastIdx && after) {
				// after 变成了新的文本节点，不影响 textParts（因为循环结束）
			}
		}
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
		if (this.toastTimer) {
			clearTimeout(this.toastTimer);
			this.toastTimer = null;
		}
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
