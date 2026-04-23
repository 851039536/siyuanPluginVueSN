/**
 * 浮动工具栏 - 谐音翻译功能模块
 * 为选中的英文单词生成谐音记忆
 */
import { Plugin } from "siyuan";
import { ToolbarAction } from "../../types";
import { createDialogAction } from "../utils";

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
		icon: `<svg><use xlink:href="#iconLanguage"></use></svg>`,
		eventName: "openPronunciationDialog",
	});
}
