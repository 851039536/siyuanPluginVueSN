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
	style: "default" | "github" | "mac" | "cartoon";
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

export class GeneralSettingsStorage {
	private storage: PluginStorage;

	private readonly KEYS = {
		FONT: "general-font-settings",
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
	};

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	async saveFontSettings(settings: FontSettings): Promise<boolean> {
		localStorage.setItem(this.KEYS.FONT, JSON.stringify(settings));
		return true;
	}

	async loadFontSettings(): Promise<FontSettings | null> {
		const saved = localStorage.getItem(this.KEYS.FONT);
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch {
				return null;
			}
		}
		return null;
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
		localStorage.setItem(this.KEYS.LIST, JSON.stringify(settings));
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

	async clearAllSettings(): Promise<void> {
		localStorage.removeItem(this.KEYS.FONT);
		localStorage.removeItem(this.KEYS.LIST);
		await this.storage.remove(this.KEYS.CODEBLOCK);
		await this.storage.remove(this.KEYS.HEADING);
		await this.storage.remove(this.KEYS.HIGHLIGHT);
		await this.storage.remove(this.KEYS.BACKUP);
	}
}
