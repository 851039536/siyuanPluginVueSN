/**
 * 笔记本文档数统计管理器
 * 用于在笔记本列表中显示文档数量
 */
export class DocCountManager {
	private updateTimer: number | null = null;
	private updateInterval = 3600000; // 默认1小时
	private fontStyle: {
		fontSize: string;
		color: string;
		fontWeight: string;
	} = {
		fontSize: "12px",
		color: "#8c8c8c",
		fontWeight: "normal",
	};

	/**
	 * 启动文档数统计功能
	 */
	public start(): void {
		this.setBoxCount();
		this.startAutoUpdate();
	}

	/**
	 * 停止文档数统计功能
	 */
	public stop(): void {
		this.stopAutoUpdate();
		this.clearAllCounts();
	}

	/**
	 * 设置更新间隔
	 */
	public setUpdateInterval(interval: number): void {
		this.updateInterval = interval;
		if (this.updateTimer) {
			this.stopAutoUpdate();
			this.startAutoUpdate();
		}
	}

	/**
	 * 设置字体样式
	 */
	public setFontStyle(style: {
		fontSize: string;
		color: string;
		fontWeight: string;
	}): void {
		this.fontStyle = style;
		this.updateCountStyles();
	}

	/**
	 * 给笔记本添加文档数
	 */
	private async setBoxCount(): Promise<void> {
		const boxes = document.querySelectorAll("ul[data-url]");
		for (const box of boxes) {
			const response = await this.query(
				`SELECT count(*) as count FROM blocks where box = '${(box as HTMLElement).dataset.url}' and type = 'd';`,
			);
			if (!response[0] || !response[0]["count"]) continue;

			const count = response[0]["count"];
			const li = box.querySelector('li[data-type="navigation-root"]');
			if (!li) continue;

			const boxText = li.querySelector("span.b3-list-item__text");
			if (!boxText) continue;

			// 移除旧的文档数显示（包括带样式的span）
			const oldCountSpan = boxText.querySelector(".doc-count-number");
			if (oldCountSpan) {
				oldCountSpan.remove();
			}

			// 移除文本中的文档数
			const text = boxText.textContent?.replace(/\s*\(\d+\)$/, "") || "";
			boxText.textContent = text;

			// 创建带样式的文档数显示
			const countSpan = document.createElement("span");
			countSpan.className = "doc-count-number";
			countSpan.textContent = ` (${count})`;
			countSpan.style.fontSize = this.fontStyle.fontSize;
			countSpan.style.color = this.fontStyle.color;
			countSpan.style.fontWeight = this.fontStyle.fontWeight;
			boxText.appendChild(countSpan);
		}
	}

	/**
	 * 启动自动更新定时器
	 */
	private startAutoUpdate(): void {
		this.updateTimer = window.setInterval(() => {
			this.setBoxCount();
		}, this.updateInterval);
	}

	/**
	 * 停止自动更新定时器
	 */
	private stopAutoUpdate(): void {
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
			this.updateTimer = null;
		}
	}

	/**
	 * 更新所有文档数的样式
	 */
	private updateCountStyles(): void {
		const countSpans = document.querySelectorAll(".doc-count-number");
		countSpans.forEach((span) => {
			const htmlSpan = span as HTMLElement;
			htmlSpan.style.fontSize = this.fontStyle.fontSize;
			htmlSpan.style.color = this.fontStyle.color;
			htmlSpan.style.fontWeight = this.fontStyle.fontWeight;
		});
	}

	/**
	 * 清除所有文档数显示
	 */
	private clearAllCounts(): void {
		const countSpans = document.querySelectorAll(".doc-count-number");
		countSpans.forEach((span) => {
			span.remove();
		});
	}

	/**
	 * 查询SQL函数
	 */
	private async query(sql: string): Promise<any[]> {
		const result = await this.fetchSyncPost("/api/query/sql", { stmt: sql });
		if (result.code !== 0) {
			console.error("查询数据库出错", result.msg);
			return [];
		}
		return result.data;
	}

	/**
	 * 发送同步POST请求
	 */
	private async fetchSyncPost(
		url: string,
		data: any,
		returnType: "json" | "text" = "json",
	): Promise<any> {
		const init: RequestInit = {
			method: "POST",
		};
		if (data) {
			if (data instanceof FormData) {
				init.body = data;
			} else {
				init.body = JSON.stringify(data);
			}
		}
		try {
			const res = await fetch(url, init);
			const res2 = returnType === "json" ? await res.json() : await res.text();
			return res2;
		} catch (e: any) {
			console.log(e);
			return returnType === "json"
				? { code: e.code || 1, msg: e.message || "", data: null }
				: "";
		}
	}
}
