/**
 * 浮动工具栏 - 翻译替换功能模块
 * 将选中的英文翻译成中文并自动替换当前内容
 * 支持 Ctrl+Z 撤销
 */
import { Plugin } from "siyuan";
import { ToolbarAction } from "../../types";
import {
	showMessage,
	getSelectedBlockId,
	isEnglishText,
	getI18nText,
} from "../utils";
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi";
import * as api from "@/api";

/** Protyle 实例接口（思源内部 API，仅声明所需方法） */
interface ProtyleInstance {
	updateTransaction(blockId: string, updatedDom: string, originalDom: string): void;
}

/**
 * 获取当前 protyle 实例
 * 通过 DOM 查找当前激活的 protyle 编辑器实例
 */
function getActiveProtyleInstance(): ProtyleInstance | null {
	const protyleElement = document.querySelector(
		".layout__wnd--active .protyle:not(.fn__none)",
	);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (protyleElement && (protyleElement as any).protyle?.getInstance) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (protyleElement as any).protyle.getInstance();
	}
	// 备选：通过选中块的父级 protyle 查找
	const selectedBlock = document.querySelector(
		".protyle-wysiwyg--select[data-node-id]",
	);
	if (selectedBlock) {
		const protyle = selectedBlock.closest(".protyle");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((protyle as any)?.protyle?.getInstance) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (protyle as any).protyle.getInstance();
		}
	}
	return null;
}

/** 并发保护锁，防止重复触发翻译 */
let isTranslating = false;

/** I18n key 前缀 */
const I18N_PREFIX = "floatingToolbar";

/**
 * 创建翻译替换功能
 * @param plugin 插件实例
 * @returns 翻译替换工具栏功能
 */
export function createTranslateAction(plugin: Plugin): ToolbarAction {
	return {
		id: "translate",
		name: getI18nText(plugin, `${I18N_PREFIX}.translate`, "翻译替换"),
		icon: `<svg><use xlink:href="#iconLanguage"></use></svg>`,
		handler: async (selectedText: string) => {
			await translateAndReplace(plugin, selectedText);
		},
	};
}

/**
 * 等待下一帧 DOM 渲染完成
 */
function waitForNextFrame(): Promise<void> {
	return new Promise<void>((resolve) =>
		requestAnimationFrame((_time: number) =>
			requestAnimationFrame(() => resolve()),
		),
	);
}

/**
 * 翻译并替换选中的文本
 */
async function translateAndReplace(plugin: Plugin, text: string) {
	if (isTranslating) return;

	if (!text.trim()) {
		showMessage(
			getI18nText(plugin, `${I18N_PREFIX}.noTextSelected`, "未选中文本"),
			{ timeout: 3000 },
		);
		return;
	}

	if (!isEnglishText(text)) {
		showMessage(
			getI18nText(
				plugin,
				`${I18N_PREFIX}.selectEnglishToTranslate`,
				"请选择英文文本进行翻译",
			),
			{ timeout: 3000 },
		);
		return;
	}

	const blockId = getSelectedBlockId();
	if (!blockId) {
		showMessage(
			getI18nText(plugin, `${I18N_PREFIX}.cannotGetBlockId`, "无法获取当前块ID"),
			{ timeout: 3000 },
		);
		return;
	}

	isTranslating = true;
	try {
		showMessage(
			getI18nText(plugin, `${I18N_PREFIX}.translating`, "正在翻译..."),
			{ timeout: 2000 },
		);

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
			// 执行更新
			await api.updateBlock("markdown", translatedText, blockId);

			// 等待 DOM 更新后注册撤销事务
			if (protyleInstance && originalDom) {
				await waitForNextFrame();
				const updatedElement = document.querySelector(
					`[data-node-id="${blockId}"]`,
				);
				if (updatedElement) {
					const updatedDom = updatedElement.outerHTML;

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

			showMessage(
				getI18nText(
					plugin,
					`${I18N_PREFIX}.translateSuccess`,
					"翻译完成（支持 Ctrl+Z 撤回）",
				),
				{ timeout: 2000 },
			);
		} else {
			showMessage(
				getI18nText(
					plugin,
					`${I18N_PREFIX}.translateFailed`,
					"翻译失败，请重试",
				),
				{ timeout: 3000 },
			);
		}
	} catch (error) {
		console.error("Translation error:", error);
		showMessage(
			getI18nText(plugin, `${I18N_PREFIX}.translateError`, "翻译失败"),
			{ timeout: 5000 },
		);
	} finally {
		isTranslating = false;
	}
}
