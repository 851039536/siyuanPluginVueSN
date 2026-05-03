/**
 * 通用设置数据存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import { TypedStorage } from "@/utils/typedStorage";

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
  cloudSyncEnabled?: boolean;
}

export interface SkillsViewerSettings {
  enabled: boolean;
  projectPath: string;
  selectedTool: string;
}

// ============================================================
// 默认值
// ============================================================

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

// ============================================================
// 存储类
// ============================================================

export class GeneralSettingsStorage {
  readonly font: TypedStorage<FontSettings>;
  readonly codeblock: TypedStorage<CodeBlockSettings>;
  readonly heading: TypedStorage<HeadingSettings>;
  readonly list: TypedStorage<ListSettings>;
  readonly highlight: TypedStorage<HighlightSettings>;
  readonly backup: TypedStorage<BackupSettings>;
  readonly documentFont: TypedStorage<DocumentFontSettings>;
  readonly tableStyle: TypedStorage<TableStyleSettings>;
  readonly listStyle: TypedStorage<ListStyleSettings>;
  readonly docCount: TypedStorage<DocCountSettings>;
  readonly tabPin: TypedStorage<TabPinSettings>;
  readonly skillsViewer: TypedStorage<SkillsViewerSettings>;
  readonly appearance: TypedStorage<Record<string, any>>;
  readonly backupHistory: TypedStorage<Record<string, any>>;
  readonly cloudBackupConfig: TypedStorage<Record<string, any>>;
  readonly password: TypedStorage<string>;

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin);
    this.font = new TypedStorage(storage, "font-settings", DEFAULT_FONT_SETTINGS);
    this.codeblock = new TypedStorage(storage, "codeblock-settings", DEFAULT_CODEBLOCK_SETTINGS);
    this.heading = new TypedStorage(storage, "heading-settings", DEFAULT_HEADING_SETTINGS);
    this.list = new TypedStorage(storage, "list-settings", DEFAULT_LIST_SETTINGS);
    this.highlight = new TypedStorage(storage, "highlight-settings", DEFAULT_HIGHLIGHT_SETTINGS);
    this.backup = new TypedStorage(storage, "data-backup-settings");
    this.documentFont = new TypedStorage(storage, "document-font-settings");
    this.tableStyle = new TypedStorage(storage, "table-style-settings");
    this.listStyle = new TypedStorage(storage, "list-style-settings");
    this.docCount = new TypedStorage(storage, "doc-count-settings");
    this.tabPin = new TypedStorage(storage, "tabpin-settings", DEFAULT_TABPIN_SETTINGS);
    this.skillsViewer = new TypedStorage(storage, "skills-viewer-settings");
    this.appearance = new TypedStorage(storage, "appearance-settings");
    this.backupHistory = new TypedStorage(storage, "backup-history");
    this.cloudBackupConfig = new TypedStorage(storage, "cloud-backup-config");
    this.password = new TypedStorage(storage, "global-password");
  }

  /** 加载标题设置（带 colors/fontSizes 深层合并） */
  async loadHeadingOrDefault(): Promise<HeadingSettings> {
    const data = await this.heading.load();
    if (!data) return { ...DEFAULT_HEADING_SETTINGS };
    return {
      ...DEFAULT_HEADING_SETTINGS,
      ...data,
      colors: { ...DEFAULT_HEADING_SETTINGS.colors, ...data.colors },
      fontSizes: { ...DEFAULT_HEADING_SETTINGS.fontSizes, ...data.fontSizes },
    };
  }

  async clearAllSettings(): Promise<void> {
    await Promise.all([
      this.font.remove(),
      this.codeblock.remove(),
      this.heading.remove(),
      this.list.remove(),
      this.highlight.remove(),
      this.backup.remove(),
      this.documentFont.remove(),
      this.tableStyle.remove(),
      this.listStyle.remove(),
      this.docCount.remove(),
      this.tabPin.remove(),
      this.skillsViewer.remove(),
      this.appearance.remove(),
      this.backupHistory.remove(),
      this.cloudBackupConfig.remove(),
      this.password.remove(),
    ]);
  }
}


