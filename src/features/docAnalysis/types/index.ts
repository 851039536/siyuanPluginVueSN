/**
 * 文档分析功能 - 类型定义和注册函数
 */
import { Plugin } from "siyuan";
import { createApp, h } from "vue";
import DocAnalysisPanel from "../index.vue";

// ============================================================
// 类型定义
// ============================================================

/** 文档信息 */
export interface DocInfo {
	/** 文档ID */
	id: string;
	/** 文档标题 */
	title: string;
	/** 文档路径（人类可读） */
	hpath: string;
	/** 笔记本ID */
	notebookId: string;
	/** 笔记本名称 */
	notebookName: string;
	/** 内容大小（字节） */
	contentSize: number;
}

/** 内容大小单位 */
export type SizeUnit = "B" | "KB" | "MB";

/** 排序方式 */
export type SortField = "size" | "title" | "notebook";
export type SortOrder = "asc" | "desc";

/** 查询状态 */
export type QueryStatus = "idle" | "loading" | "success" | "error" | "empty";

/** 过滤选项 */
export interface FilterOptions {
	/** 内容大小阈值 */
	threshold: number;
	/** 阈值单位 */
	unit: SizeUnit;
	/** 标题模糊查询关键词 */
	titleKeyword: string;
	/** 选中的笔记本ID（空字符串表示全部） */
	notebookId: string;
	/** 排序字段 */
	sortField: SortField;
	/** 排序方向 */
	sortOrder: SortOrder;
}

/** 查询结果状态 */
export interface QueryState {
	/** 状态 */
	status: QueryStatus;
	/** 结果列表 */
	results: DocInfo[];
	/** 错误信息 */
	errorMessage: string;
	/** 是否已查询过 */
	hasQueried: boolean;
}

/** 重名文档组 */
export interface DuplicateNameGroup {
	/** 重复的文档标题 */
	title: string;
	/** 重复数量 */
	count: number;
}

/** 文档统计信息 */
export interface DocStats {
	/** 总文档数 */
	totalDocs: number;
	/** 0B 空文档数 */
	zeroByteDocs: number;
	/** < 1KB 文档数 */
	smallDocs: number;
	/** 1~10KB 文档数 */
	mediumDocs: number;
	/** 重名文档组数（有多少组同名文档） */
	duplicateNameGroups: number;
	/** 重名文档总数（所有重名组的文档数之和） */
	duplicateNameDocs: number;
}

// ============================================================
// 注册函数
// ============================================================

/**
 * 注册文档分析功能（Dock 侧边栏面板）
 */
export function registerDocAnalysis(plugin: Plugin) {
	plugin.addDock({
		config: {
			position: "RightTop",
			size: { width: 400, height: 0 },
			icon: "iconAnalytics",
			title:
				(plugin.i18n as any)?.docAnalysis?.title || "文档分析",
			show: false,
		},
		data: {},
		type: "doc-analysis-dock",
		init: (dock: any) => {
			const container = document.createElement("div");
			container.style.height = "100%";
			container.style.overflow = "hidden";

			const app = createApp({
				setup() {
					return () =>
						h(DocAnalysisPanel, {
							i18n: (plugin.i18n as any)?.docAnalysis || {},
							plugin: plugin,
						});
				},
			});

			app.mount(container);
			dock.element?.appendChild(container);

			dock.__app = app;
			dock.__container = container;
		},
	});

	// 注册快捷键命令 - 触发 Dock 显示
	plugin.addCommand({
		langKey: "docAnalysis",
		langText: "文档分析",
		hotkey: "⌃⌥D",
		callback: () => {
			const dockEvent = new CustomEvent("dock-click", {
				detail: { dockId: "doc-analysis-dock" },
			});
			window.dispatchEvent(dockEvent);
		},
	});
}
