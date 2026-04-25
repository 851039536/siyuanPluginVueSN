/**
 * 通用设置数据存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";

export interface FontSettings {
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	lineHeight: number;
}

export interface DocumentFontSettings {
	enabled: boolean;
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	letterSpacing: number;
	paragraphSpacing: number;
	fontWeight: string;
}

export interface TableStyleSettings {
	enabled: boolean;
	borderColor: string;
	cellBorderColor: string;
	headerBackground: string;
	oddRowBackground: string;
	evenRowBackground: string;
	textColor: string;
	borderRadius: number;
}

export interface ListStyleSettings {
	enabled: boolean;
	orderedListColors: string[];
	unorderedListColors: string[];
	symbolSize: number;
}

export interface DocCountSettings {
	enableDocCount: boolean;
	updateInterval: string;
	fontSize: string;
	fontColor: string;
	fontWeight: string;
}

export interface TabPinSettings {
	enabled: boolean;
	displayMode: "iconAndText" | "textOnly";
	backgroundColor: string;
}

export interface CodeBlockSettings {
	style: "default" | "github" | "mac";
	enableCollapse: boolean;
	collapseHeight: number;
	// 样式增强
	enabled: boolean;
	backgroundColor: string;
	borderColor: string;
	borderWidth: number;
	borderRadius: number;
	boxShadow: string;
	// 行号样式
	lineNumberColor: string;
	lineNumberBackground: string;
	showLineNumber: boolean;
	// 代码字体
	codeFontFamily: string;
	codeFontSize: number;
	codeLineHeight: number;
	// 代码颜色
	textColor: string;
	keywordColor: string;
	stringColor: string;
	commentColor: string;
	functionColor: string;
	numberColor: string;
}

export interface HeadingColors {
	h1: string;
	h2: string;
	h3: string;
	h4: string;
	h5: string;
	h6: string;
}

export interface HeadingSizes {
	h1: number;
	h2: number;
	h3: number;
	h4: number;
	h5: number;
	h6: number;
}

export interface HeadingSettings {
	colors: HeadingColors;
	fontSizes: HeadingSizes;
	levelDisplay: string;
	customMarkers: string[];
	titleCenterAlign: boolean;
	titleColor: string;
	titleFontSize: number;
}

export interface ListSettings {
	enableCustomUnorderedList: boolean;
	enableCustomOrderedList: boolean;
	firstLevelSymbol: string;
	secondLevelSymbol: string;
	thirdLevelSymbol: string;
	customFirstLevelSymbol: string;
	customSecondLevelSymbol: string;
	customThirdLevelSymbol: string;
	symbolSize: number;
	symbolMarginLeft: number;
	numberFormat: string;
	applyToListBlocks: boolean;
	applyToEmbedBlocks: boolean;
	applyToFloatWindows: boolean;
	css?: string;
}

export interface HighlightSettings {
	enableHighlight: boolean;
	backgroundColor: string;
	fontSize: number;
	bold: boolean;
	minTextLength: number;
	minLetterLength: number;
	maxTextLength: number;
	maxLetterLength: number;
}

export interface BackupSettings {
	autoBackupEnabled: boolean;
	backupFrequency: string;
	backupTime: string;
	keepBackupCount: number;
	lastBackupTime: string;
	lastBackupTimestamp: number;
	workspacePath: string;
	workspaceRoot: string;
}

export interface SkillsViewerSettings {
	enabled: boolean;
	projectPath: string;
	selectedTool: string;
}

export class GeneralSettingsStorage {
	private storage: PluginStorage;

	private readonly KEYS = {
		FONT: "font-settings",
		CODEBLOCK: "codeblock-settings",
		HEADING: "heading-settings",
		LIST: "list-settings",
		HIGHLIGHT: "highlight-settings",
		BACKUP: "data-backup-settings",
		DOCUMENT_FONT: "document-font-settings",
		TABLE_STYLE: "table-style-settings",
		LIST_STYLE: "list-style-settings",
		DOC_COUNT: "doc-count-settings",
		TAB_PIN: "tabpin-settings",
		SKILLS_VIEWER: "skills-viewer-settings",
	};

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	async saveFontSettings(settings: FontSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.FONT, settings);
	}

	async loadFontSettings(): Promise<FontSettings | null> {
		return this.storage.load<FontSettings>(this.KEYS.FONT);
	}

	async saveCodeBlockSettings(settings: CodeBlockSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.CODEBLOCK, settings);
	}

	async loadCodeBlockSettings(): Promise<CodeBlockSettings | null> {
		return this.storage.load<CodeBlockSettings>(this.KEYS.CODEBLOCK);
	}

	async saveHeadingSettings(settings: HeadingSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.HEADING, settings);
	}

	async loadHeadingSettings(): Promise<HeadingSettings | null> {
		return this.storage.load<HeadingSettings>(this.KEYS.HEADING);
	}

	async saveListSettings(settings: ListSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.LIST, settings);
	}

	async loadListSettings(): Promise<ListSettings | null> {
		return this.storage.load<ListSettings>(this.KEYS.LIST);
	}

	async saveHighlightSettings(settings: HighlightSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.HIGHLIGHT, settings);
	}

	async loadHighlightSettings(): Promise<HighlightSettings | null> {
		return this.storage.load<HighlightSettings>(this.KEYS.HIGHLIGHT);
	}

	async saveBackupSettings(settings: BackupSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.BACKUP, settings);
	}

	async loadBackupSettings(): Promise<BackupSettings | null> {
		return this.storage.load<BackupSettings>(this.KEYS.BACKUP);
	}

	async saveDocumentFontSettings(
		settings: DocumentFontSettings,
	): Promise<boolean> {
		return this.storage.save(this.KEYS.DOCUMENT_FONT, settings);
	}

	async loadDocumentFontSettings(): Promise<DocumentFontSettings | null> {
		return this.storage.load<DocumentFontSettings>(this.KEYS.DOCUMENT_FONT);
	}

	async saveTableStyleSettings(settings: TableStyleSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.TABLE_STYLE, settings);
	}

	async loadTableStyleSettings(): Promise<TableStyleSettings | null> {
		return this.storage.load<TableStyleSettings>(this.KEYS.TABLE_STYLE);
	}

	async saveListStyleSettings(settings: ListStyleSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.LIST_STYLE, settings);
	}

	async loadListStyleSettings(): Promise<ListStyleSettings | null> {
		return this.storage.load<ListStyleSettings>(this.KEYS.LIST_STYLE);
	}

	async saveDocCountSettings(settings: DocCountSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.DOC_COUNT, settings);
	}

	async loadDocCountSettings(): Promise<DocCountSettings | null> {
		return this.storage.load<DocCountSettings>(this.KEYS.DOC_COUNT);
	}

	async saveTabPinSettings(settings: TabPinSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.TAB_PIN, settings);
	}

	async loadTabPinSettings(): Promise<TabPinSettings | null> {
		return this.storage.load<TabPinSettings>(this.KEYS.TAB_PIN);
	}

	async saveSkillsViewerSettings(settings: SkillsViewerSettings): Promise<boolean> {
		return this.storage.save(this.KEYS.SKILLS_VIEWER, settings);
	}

	async loadSkillsViewerSettings(): Promise<SkillsViewerSettings | null> {
		return this.storage.load<SkillsViewerSettings>(this.KEYS.SKILLS_VIEWER);
	}

	async clearAllSettings(): Promise<void> {
		await Promise.all([
			this.storage.remove(this.KEYS.FONT),
			this.storage.remove(this.KEYS.CODEBLOCK),
			this.storage.remove(this.KEYS.HEADING),
			this.storage.remove(this.KEYS.LIST),
			this.storage.remove(this.KEYS.HIGHLIGHT),
			this.storage.remove(this.KEYS.BACKUP),
			this.storage.remove(this.KEYS.DOCUMENT_FONT),
			this.storage.remove(this.KEYS.TABLE_STYLE),
			this.storage.remove(this.KEYS.LIST_STYLE),
			this.storage.remove(this.KEYS.DOC_COUNT),
			this.storage.remove(this.KEYS.TAB_PIN),
			this.storage.remove(this.KEYS.SKILLS_VIEWER),
		]);
	}
}

/**
 * 存储键常量（外部模块可直接引用，避免硬编码字符串）
 */
export const STORAGE_KEYS = {
	FONT: "font-settings",
	CODEBLOCK: "codeblock-settings",
	HEADING: "heading-settings",
	LIST: "list-settings",
	HIGHLIGHT: "highlight-settings",
	BACKUP: "data-backup-settings",
	DOCUMENT_FONT: "document-font-settings",
	TABLE_STYLE: "table-style-settings",
	LIST_STYLE: "list-style-settings",
	DOC_COUNT: "doc-count-settings",
	TAB_PIN: "tabpin-settings",
	SKILLS_VIEWER: "skills-viewer-settings",
} as const;

// ============================================================
// 独立函数：提供与 config/settings.ts 相同的函数签名，便于迁移
// ============================================================

import type { Plugin } from "siyuan";

/** 默认字体设置 */
export const DEFAULT_FONT_SETTINGS: FontSettings = {
	fontFamily: "",
	fontSize: 14,
	fontWeight: "normal",
	lineHeight: 1.6,
};

/** 默认代码块设置 */
export const DEFAULT_CODEBLOCK_SETTINGS: CodeBlockSettings = {
	style: "default",
	enableCollapse: true,
	collapseHeight: 400,
	enabled: false,
	backgroundColor: "#282c34",
	borderColor: "#3e4451",
	borderWidth: 1,
	borderRadius: 6,
	boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
	lineNumberColor: "#495162",
	lineNumberBackground: "#21252b",
	showLineNumber: true,
	codeFontFamily: "Consolas",
	codeFontSize: 14,
	codeLineHeight: 1.6,
	textColor: "#abb2bf",
	keywordColor: "#c678dd",
	stringColor: "#98c379",
	commentColor: "#5c6370",
	functionColor: "#61afef",
	numberColor: "#d19a66",
};

/** 默认标题设置 */
export const DEFAULT_HEADING_SETTINGS: HeadingSettings = {
	colors: {
		h1: "#F39A94",
		h2: "#F8D694",
		h3: "#B1DCB9",
		h4: "#AAD2FC",
		h5: "#AC9DC0",
		h6: "#D7D7D7",
	},
	fontSizes: {
		h1: 28,
		h2: 24,
		h3: 20,
		h4: 18,
		h5: 16,
		h6: 14,
	},
	levelDisplay: "none",
	customMarkers: ["1", "2", "3", "4", "5", "6"],
	titleCenterAlign: false,
	titleColor: "#2C3E50",
	titleFontSize: 24,
};

/** 默认列表设置 */
export const DEFAULT_LIST_SETTINGS: ListSettings = {
	enableCustomUnorderedList: false,
	enableCustomOrderedList: false,
	firstLevelSymbol: "▪",
	secondLevelSymbol: "•",
	thirdLevelSymbol: "◦",
	customFirstLevelSymbol: "",
	customSecondLevelSymbol: "",
	customThirdLevelSymbol: "",
	symbolSize: 1.5,
	symbolMarginLeft: 13,
	numberFormat: "decimal",
	applyToListBlocks: true,
	applyToEmbedBlocks: true,
	applyToFloatWindows: true,
};

/** 默认高亮设置 */
export const DEFAULT_HIGHLIGHT_SETTINGS: HighlightSettings = {
	enableHighlight: true,
	backgroundColor: "rgb(255, 220, 60)",
	fontSize: 0,
	bold: false,
	minTextLength: 1,
	minLetterLength: 1,
	maxTextLength: 50,
	maxLetterLength: 100,
};

/** 默认钉住页签设置 */
export const DEFAULT_TABPIN_SETTINGS: TabPinSettings = {
	enabled: true,
	displayMode: "iconAndText",
	backgroundColor: "rgba(var(--b3-theme-primary-rgb), 0.1)",
};

export async function loadFontSettings(plugin: Plugin): Promise<FontSettings> {
	const storage = new GeneralSettingsStorage(plugin);
	const data = await storage.loadFontSettings();
	return { ...DEFAULT_FONT_SETTINGS, ...data };
}

export async function saveFontSettings(plugin: Plugin, settings: FontSettings): Promise<boolean> {
	const storage = new GeneralSettingsStorage(plugin);
	return storage.saveFontSettings(settings);
}

export async function loadCodeBlockSettings(plugin: Plugin): Promise<CodeBlockSettings> {
	const storage = new GeneralSettingsStorage(plugin);
	const data = await storage.loadCodeBlockSettings();
	return { ...DEFAULT_CODEBLOCK_SETTINGS, ...data };
}

export async function saveCodeBlockSettings(plugin: Plugin, settings: CodeBlockSettings): Promise<boolean> {
	const storage = new GeneralSettingsStorage(plugin);
	return storage.saveCodeBlockSettings(settings);
}

export async function loadHeadingSettings(plugin: Plugin): Promise<HeadingSettings> {
	const storage = new GeneralSettingsStorage(plugin);
	const data = await storage.loadHeadingSettings();
	if (!data) return { ...DEFAULT_HEADING_SETTINGS };
	return {
		...DEFAULT_HEADING_SETTINGS,
		...data,
		colors: { ...DEFAULT_HEADING_SETTINGS.colors, ...data.colors },
		fontSizes: { ...DEFAULT_HEADING_SETTINGS.fontSizes, ...data.fontSizes },
	};
}

export async function saveHeadingSettings(plugin: Plugin, settings: HeadingSettings): Promise<boolean> {
	const storage = new GeneralSettingsStorage(plugin);
	return storage.saveHeadingSettings(settings);
}

export async function loadListSettings(plugin: Plugin): Promise<ListSettings> {
	const storage = new GeneralSettingsStorage(plugin);
	const data = await storage.loadListSettings();
	return { ...DEFAULT_LIST_SETTINGS, ...data };
}

export async function saveListSettings(plugin: Plugin, settings: ListSettings): Promise<boolean> {
	const storage = new GeneralSettingsStorage(plugin);
	return storage.saveListSettings(settings);
}

export async function loadHighlightSettings(plugin: Plugin): Promise<HighlightSettings> {
	const storage = new GeneralSettingsStorage(plugin);
	const data = await storage.loadHighlightSettings();
	return { ...DEFAULT_HIGHLIGHT_SETTINGS, ...data };
}

export async function saveHighlightSettings(plugin: Plugin, settings: HighlightSettings): Promise<boolean> {
	const storage = new GeneralSettingsStorage(plugin);
	return storage.saveHighlightSettings(settings);
}

export async function loadTabPinSettings(plugin: Plugin): Promise<TabPinSettings> {
	const storage = new GeneralSettingsStorage(plugin);
	const data = await storage.loadTabPinSettings();
	return { ...DEFAULT_TABPIN_SETTINGS, ...data };
}

export async function saveTabPinSettings(plugin: Plugin, settings: TabPinSettings): Promise<boolean> {
	const storage = new GeneralSettingsStorage(plugin);
	return storage.saveTabPinSettings(settings);
}
