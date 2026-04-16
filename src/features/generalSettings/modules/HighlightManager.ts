/**
 * 双击高亮管理器
 * 在文档编辑器中双击选中文本，自动高亮所有匹配内容
 */
const HIGHLIGHT_STYLE_ID = "highlight-feature-styles";

export class HighlightManager {
	private selectedText = "";
	private styleAdded = false;
	private active = false;
	private toastEl: HTMLDivElement | null = null;
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

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
		CSS.highlights?.delete("selected-results");
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

		this.selectedText = selection;
		const matchCount = this.highlightText(selection);
		this.showToast(selection, matchCount);
	};

	private handleMouseDown = () => {
		this.selectedText = "";
		CSS.highlights?.delete("selected-results");
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
      ::highlight(selected-results) {
        background-color: rgb(255, 220, 60);
        color: rgb(0, 0, 0);
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
      }
      ::selection {
        color: rgb(0, 0, 0);
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

	private highlightText(value: string): number {
		const docRoot = document.querySelector(
			".layout-tab-container > div:not(.fn__none) .protyle-wysiwyg",
		);
		if (!docRoot) return 0;

		const str = value.trim().toLowerCase();
		if (!str) return 0;

		const docText = docRoot.textContent?.toLowerCase() ?? "";
		const allTextNodes: Text[] = [];
		const cumLengths: number[] = [];
		let cumLen = 0;

		const treeWalker = document.createTreeWalker(docRoot, NodeFilter.SHOW_TEXT);
		let node: Node | null;
		while ((node = treeWalker.nextNode())) {
			allTextNodes.push(node as Text);
			cumLen += node.textContent?.length ?? 0;
			cumLengths.push(cumLen);
		}

		const ranges: Range[] = [];
		let startIndex = 0;
		const nodeCount = allTextNodes.length;

		const findNodeIndex = (pos: number, startIdx: number): number => {
			let left = startIdx;
			let right = nodeCount - 1;
			while (left < right) {
				const mid = Math.floor((left + right + 1) / 2);
				if (cumLengths[mid] <= pos) left = mid;
				else right = mid - 1;
			}
			return left;
		};

		let lastNodeIdx = 0;

		while ((startIndex = docText.indexOf(str, startIndex)) !== -1) {
			const endIndex = startIndex + str.length;
			const range = document.createRange();

			try {
				lastNodeIdx = findNodeIndex(startIndex, lastNodeIdx);
				const startNode = allTextNodes[lastNodeIdx];
				const startOffset =
					startIndex -
					(cumLengths[lastNodeIdx] - startNode.textContent!.length);
				range.setStart(startNode, startOffset);

				const endNodeIdx = findNodeIndex(endIndex - 1, lastNodeIdx);
				const endNode = allTextNodes[endNodeIdx];
				const endOffset =
					endIndex - (cumLengths[endNodeIdx] - endNode.textContent!.length);
				range.setEnd(endNode, endOffset);

				ranges.push(range);
			} catch {
				// Skip invalid range
			}

			startIndex = endIndex;
		}

		if (ranges.length > 0) {
			CSS.highlights?.set("selected-results", new Highlight(...ranges));
		} else {
			CSS.highlights?.delete("selected-results");
		}

		return ranges.length;
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

		this.toastTimer = setTimeout(() => {
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
		if (this.toastEl) {
			this.toastEl.remove();
			this.toastEl = null;
		}
	}
}
