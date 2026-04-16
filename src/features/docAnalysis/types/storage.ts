/**
 * 文档分析功能 - 数据存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import type { FilterOptions, SizeUnit, SortField, SortOrder } from "./index";

/** 存储的设置数据 */
export interface DocAnalysisSettings {
	filterOptions: FilterOptions;
}

/** 默认过滤选项 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
	threshold: 100,
	unit: "B",
	notebookId: "",
	sortField: "size",
	sortOrder: "asc",
};

/**
 * 文档分析存储管理类
 */
export class DocAnalysisStorage {
	private storage: PluginStorage;
	private readonly OPTIONS_KEY = "doc-analysis-options";

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	/**
	 * 保存过滤选项
	 */
	async saveOptions(options: FilterOptions): Promise<boolean> {
		return this.storage.save(this.OPTIONS_KEY, { ...options });
	}

	/**
	 * 加载过滤选项
	 */
	async loadOptions(): Promise<FilterOptions> {
		const data = await this.storage.load<FilterOptions>(this.OPTIONS_KEY);
		return data ? { ...DEFAULT_FILTER_OPTIONS, ...data } : { ...DEFAULT_FILTER_OPTIONS };
	}

	/**
	 * 初始化存储（加载或使用默认值）
	 */
	async init(): Promise<{ filterOptions: FilterOptions }> {
		const filterOptions = await this.loadOptions();
		return { filterOptions };
	}
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 将内容大小转换为字节数
 */
export function unitToBytes(value: number, unit: SizeUnit): number {
	switch (unit) {
		case "B":
			return value;
		case "KB":
			return value * 1024;
		case "MB":
			return value * 1024 * 1024;
		default:
			return value;
	}
}

/**
 * 格式化字节数为可读字符串
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
