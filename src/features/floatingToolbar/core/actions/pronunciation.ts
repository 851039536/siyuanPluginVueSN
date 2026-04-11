/**
 * 浮动工具栏 - 谐音翻译功能模块
 * 为选中的英文单词生成谐音记忆
 */
import { Plugin } from "siyuan";
import { ToolbarAction } from "../../types";
import { createDialogAction } from "../utils";

// SVG 图标
const PRONUNCIATION_ICON = `<svg viewBox="0 0 24 24" width="14" height="14">
    <path fill="currentColor" d="M12.87,15.07L10.33,12.56L13.06,11.14C13.06,11.14 13.11,10.89 13.11,10.67C13.11,9.82 12.53,9.12 11.72,9.03C11.5,9 10.89,9 10.5,9.12C9.5,9.37 8.69,10.21 8.69,11.25C8.69,11.45 8.75,11.64 8.84,11.81L7.15,12.94C6.91,12.5 6.77,12 6.77,11.5C6.77,9.57 8.3,8 10.23,8C11.77,8 13.08,9 13.5,10.37C13.75,11.17 13.75,12 13.5,12.81C13.39,13.16 13.19,13.5 12.87,13.73L12.87,15.07M12,20C8.13,20 5,16.87 5,13C5,10.36 6.5,7.95 8.77,6.77L8.77,5.5C8.77,4.12 9.89,3 11.27,3C12.65,3 13.77,4.12 13.77,5.5L13.77,6.77C16.04,7.95 17.54,10.36 17.54,13C17.54,16.87 14.41,20 10.54,20H12M10,1L9,8L11,8L10,1M15,1L14,8L16,8L15,1M2,11L3,13L5,13L4,11L2,11Z"/>
</svg>`;

/**
 * 创建谐音翻译功能
 * @param plugin 插件实例
 * @returns 谐音翻译工具栏功能
 */
export function createPronunciationAction(plugin: Plugin): ToolbarAction {
	return createDialogAction(plugin, {
		id: "pronunciation",
		i18nKey: "pronunciation",
		defaultMessage: "谐音翻译",
		icon: PRONUNCIATION_ICON,
		eventName: "openPronunciationDialog",
	});
}
