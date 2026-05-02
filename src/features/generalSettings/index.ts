/**
 * 通用设置功能模块
 */
import { Plugin } from "siyuan";
import { GeneralSettings } from "./types";

/**
 * 注册通用设置功能
 */
export function registerGeneralSettings(plugin: Plugin) {
	const settings = new GeneralSettings(plugin);
	settings.init();
	(plugin as any).__generalSettings = settings;
	return settings;
}

export * from "./types";
export { CODEBLOCK_STYLES, type CodeBlockStyle, HEADING_LEVEL_MAPPINGS, checkIsMobile, applyCodeBlockStyle, applyCodeBlockEnhancedStyles, applyCodeBlockCollapse } from "./utils/styles";
