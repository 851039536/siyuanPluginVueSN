/**
 * 文档分析功能 - 数据存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import type { FilterOptions } from "./index";

/** 存储的设置数据 */
export interface DocAnalysisSettings {
	filterOptions: FilterOptions;
}

/** 默认过滤选项 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
	titleKeyword: "",
	notebookId: "",
	sortField: "wordCount",
	sortOrder: "asc",
	wordCountMin: 0,
	wordCountMax: 30000,
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
 * 格式化字节数为可读字符串
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 格式化字数为可读字符串
 */
export function formatWordCount(count: number): string {
	if (count === 0) return "0 字";
	if (count < 10000) return `${count} 字`;
	return `${(count / 10000).toFixed(1)} 万字`;
}
