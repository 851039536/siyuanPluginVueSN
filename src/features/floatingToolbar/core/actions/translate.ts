/**
 * 浮动工具栏 - 翻译替换功能模块
 * 将选中的英文翻译成中文并自动替换当前内容
 * 支持 Ctrl+Z 撤销
 */
import { Plugin } from "siyuan";
import { ToolbarAction } from "../../types";
import { showMessage, getSelectedBlockId, isEnglishText } from "../utils";
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi";
import * as api from "@/api";

/**
 * 获取当前 protyle 实例
 * 通过 DOM 查找当前激活的 protyle 编辑器实例
 */
function getActiveProtyleInstance(): any | null {
	const protyleElement = document.querySelector(
		".layout__wnd--active .protyle:not(.fn__none)",
	);
	if (protyleElement && (protyleElement as any).protyle?.getInstance) {
		return (protyleElement as any).protyle.getInstance();
	}
	// 备选：通过选中块的父级 protyle 查找
	const selectedBlock = document.querySelector(
		".protyle-wysiwyg--select[data-node-id]",
	);
	if (selectedBlock) {
		const protyle = selectedBlock.closest(".protyle") as any;
		if (protyle?.protyle?.getInstance) {
			return protyle.protyle.getInstance();
		}
	}
	return null;
}

/**
 * 创建翻译替换功能
 * @param plugin 插件实例
 * @returns 翻译替换工具栏功能
 */
export function createTranslateAction(plugin: Plugin): ToolbarAction {
	return {
		id: "translate",
		name: (plugin.i18n as any).floatingToolbar?.translate || "英译中替换",
		icon: `<svg viewBox="0 0 24 24" width="14" height="14">
      <path fill="currentColor" d="M12.87,15.07L10.33,12.56L13.06,11.14C13.06,11.14 13.11,10.89 13.11,10.67C13.11,9.82 12.53,9.12 11.72,9.03C11.5,9 10.89,9 10.5,9.12C9.5,9.37 8.69,10.21 8.69,11.25C8.69,11.45 8.75,11.64 8.84,11.81L7.15,12.94C6.91,12.5 6.77,12 6.77,11.5C6.77,9.57 8.3,8 10.23,8C11.77,8 13.08,9 13.5,10.37C13.75,11.17 13.75,12 13.5,12.81C13.39,13.16 13.19,13.5 12.87,13.73L12.87,15.07M12,20C8.13,20 5,16.87 5,13C5,10.36 6.5,7.95 8.77,6.77L8.77,5.5C8.77,4.12 9.89,3 11.27,3C12.65,3 13.77,4.12 13.77,5.5L13.77,6.77C16.04,7.95 17.54,10.36 17.54,13C17.54,16.87 14.41,20 10.54,20H12M10,1L9,8L11,8L10,1M15,1L14,8L16,8L15,1M2,11L3,13L5,13L4,11L2,11Z M12.5,2C12.5,2 12.5,2 12.5,2C13.33,2 14,2.67 14,3.5V8.5C14,9.33 13.33,10 12.5,10C11.67,10 11,9.33 11,8.5V3.5C11,2.67 11.67,2 12.5,2Z M8.5,5H7V3.5C7,2.67 7.67,2 8.5,2C9.33,2 10,2.67 10,3.5V8.5C10,9.33 9,9.33 9,10C7.67,10 7,9.33 7,8.5V5H8.5Z"/>
    </svg>`,
		handler: async (selectedText: string) => {
			await translateAndReplace(plugin, selectedText);
		},
	};
}

/**
 * 翻译并替换选中的文本
 */
async function translateAndReplace(plugin: Plugin, text: string) {
	if (!text.trim()) {
		showMessage(
			(plugin.i18n as any).floatingToolbar?.noTextSelected || "未选中文本",
			{ timeout: 3000 },
		);
		return;
	}

	if (!isEnglishText(text)) {
		showMessage("请选择英文文本进行翻译", { timeout: 3000 });
		return;
	}

	const blockId = getSelectedBlockId();
	if (!blockId) {
		showMessage("无法获取当前块ID", { timeout: 3000 });
		return;
	}

	try {
		showMessage("正在翻译...", { timeout: 2000 });

		// 获取 protyle 实例用于注册撤销事务
		const protyleInstance = getActiveProtyleInstance();

		// 在更新前保存块的原始内容（kramdown 格式的 DOM 数据）
		let originalDom = "";
		if (protyleInstance) {
			const blockElement = document.querySelector(
				`[data-node-id="${blockId}"]`,
			);
			if (blockElement) {
				originalDom = blockElement.outerHTML;
			}
		}

		const aiConfig = getApiConfigFromPlugin(plugin);

		const prompt = `请将以下英文文本翻译成中文，只输出翻译结果，不要有任何解释或说明：\n\n${text}`;

		const translatedText = await callAI(prompt, aiConfig, {
			systemPrompt: "你是一个专业的翻译助手，擅长将英文翻译成流畅的中文。",
			temperature: 0.3,
			maxTokens: 2000,
		});

		if (translatedText) {
			// 获取更新后的块 DOM
			let updatedDom = "";
			const blockElement = document.querySelector(
				`[data-node-id="${blockId}"]`,
			);
			if (blockElement) {
				updatedDom = blockElement.outerHTML;
			}

			// 执行更新
			await api.updateBlock("markdown", translatedText, blockId);

			// 重新获取更新后的 DOM
			if (protyleInstance && originalDom) {
				// 等待 DOM 更新
				await new Promise((resolve) => setTimeout(resolve, 100));
				const updatedElement = document.querySelector(
					`[data-node-id="${blockId}"]`,
				);
				if (updatedElement) {
					updatedDom = updatedElement.outerHTML;

					// 使用 updateTransaction 注册撤销信息到思源的撤销栈
					// 这样用户按 Ctrl+Z 即可撤回翻译操作
					try {
						protyleInstance.updateTransaction(
							blockId,
							updatedDom,
							originalDom,
						);
					} catch (txError) {
						console.warn(
							"注册撤销事务失败（不影响翻译结果）:",
							txError,
						);
					}
				}
			}

			showMessage("翻译完成（支持 Ctrl+Z 撤回）", { timeout: 2000 });
		} else {
			showMessage("翻译失败，请重试", { timeout: 3000 });
		}
	} catch (error) {
		console.error("Translation error:", error);
		const errorMsg = (error as Error).message || "未知错误";
		showMessage("翻译失败: " + errorMsg, { timeout: 5000 });
	}
}
