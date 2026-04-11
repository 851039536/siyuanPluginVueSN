/**
 * 超级面板 - 类型定义和注册函数
 */
import { Plugin, showMessage } from "siyuan";
import { createApp, reactive, type App as VueApp } from "vue";
// @ts-ignore
import SuperPanelPanel from "../index.vue";
import { replaceTopBarIcon } from "@/utils/iconHelper";
import { FEATURE_ICONS, type IconKey } from "@/config/icons";
import { TextDiffManager } from "../../textDiff/types";
import type { PluginSettings } from "@/config/settings";

/**
 * 功能操作
 */
export interface FeatureAction {
	/** 操作键名 */
	key: string;
	/** 操作标签 */
	label: string;
	/** 快捷键 */
	hotkey: string;
}

/**
 * 功能配置
 */
export interface Feature {
	/** 功能ID */
	id: string;
	/** 图标键名 */
	iconKey: IconKey;
	/** 功能标题 */
	title: string;
	/** 功能描述 */
	desc: string;
	/** 是否启用 */
	enabled: boolean;
	/** 操作列表 */
	actions: FeatureAction[];
}

/**
 * AI设置
 */
export interface AiSettings {
	provider: string;
	model: string;
	customModel: string;
	apiKey: string;
	customEndpoint: string;
}

let vueApp: VueApp | null = null;
let panelContainer: HTMLElement | null = null;
let reactiveSettings: PluginSettings | null = null;

/**
 * 功能ID到设置键的映射表（单一数据源）
 */
const FEATURE_SETTINGS_MAP: Record<string, string> = {
	tableOfContents: "enableTableOfContents",
	imageCompressor: "enableImageCompressor",
	docNavigation: "enableDocNavigation",
	pageLock: "enablePageLock",
	wordQuery: "enableWordQuery",
	generalSettings: "enableGeneralSettings",
	qrCode: "enableQRCode",
	unitConverter: "enableUnitConverter",
	shortcuts: "enableShortcuts",
	diskBrowser: "enableDiskBrowser",
	codeImageGenerator: "enableCodeImageGenerator",
	aiContentGenerator: "enableAIContentGenerator",
	statistics: "enableStatistics",
	pronunciation: "enablePronunciation",
	encryption: "enableEncryption",
	video: "enableVideo",
	everythingSearch: "enableEverythingSearch",
	systemMonitor: "enableSystemMonitor",
	floatingToolbar: "enableFloatingToolbar",
	floatingBox: "enableFloatingBox",
	textDiff: "enableTextDiff",
	base64Image: "enableBase64Image",
	skills: "enableSkills",
	flashcardReading: "enableFlashcardReading",
	translate: "enableTranslate",
	codeTranslation: "enableCodeTranslation",
	webDAV: "enableWebDAV",
};

/**
 * 所有功能的设置键列表（从映射表自动生成）
 */
const ALL_FEATURE_SETTINGS = Object.values(FEATURE_SETTINGS_MAP);

/**
 * 简单事件映射表：action -> CustomEvent 名称
 */
const SIMPLE_ACTION_EVENTS: Record<string, string> = {
	insertIndex: "executeCommand",
	insertOutline: "executeCommand",
	insertRef: "executeCommand",
	openCompressor: "openImageCompressor",
	openVideoManager: "openVideoManager",
	openEverythingSearch: "openEverythingSearch",
	openFlashcardReading: "openFlashcardReading",
	openWebDAV: "openWebDAV",
};

/**
 * 需要检查设置键的 action 映射
 */
const ACTION_SETTINGS_MAP: Record<
	string,
	{ event: string; settingKey: string }
> = {
	openStatistics: { event: "openStatistics", settingKey: "enableStatistics" },
	openBase64Image: {
		event: "openBase64Image",
		settingKey: "enableBase64Image",
	},
};

/**
 * 超级面板管理器
 */
export class SuperPanelManager {
	private plugin: Plugin;
	private boundToggleHandler: () => void;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		// 绑定事件处理器，确保 add/remove 使用同一引用
		this.boundToggleHandler = this.toggle.bind(this);
	}

	public init() {
		this.addTopBar();
		this.addCommand();
		this.addEventListeners();
	}

	private addTopBar() {
		const topBarElement = this.plugin.addTopBar({
			icon: "iconMenu",
			title: (this.plugin.i18n as any).superPanel?.title || "超级面板",
			position: "right",
			callback: () => {
				this.toggle();
			},
		});

		// 替换为 Iconify 图标
		const superPanelIcon = FEATURE_ICONS.superPanel;
		replaceTopBarIcon(topBarElement, superPanelIcon.icon, superPanelIcon.color);
	}

	private addCommand() {
		this.plugin.addCommand({
			langKey: "toggleSuperPanel",
			hotkey: "⌃⌥P",
			callback: () => {
				this.toggle();
			},
		});
	}

	private addEventListeners() {
		window.addEventListener("toggleSuperPanel", this.boundToggleHandler);
	}

	private toggle() {
		if (vueApp && panelContainer) {
			this.close();
		} else {
			this.open();
		}
	}

	private open() {
		// 创建容器
		panelContainer = document.createElement("div");
		panelContainer.id = "super-panel-vue-container";
		document.body.appendChild(panelContainer);

		// 创建响应式 settings 对象
		reactiveSettings = reactive<PluginSettings>((this.plugin as any).settings);

		// 创建 Vue 应用
		vueApp = createApp(SuperPanelPanel, {
			visible: true,
			settings: reactiveSettings,
			i18n: (this.plugin.i18n as any).superPanel || {},
			onClose: () => {
				this.close();
			},
			onAction: (action: string) => {
				this.handleFeatureAction(action);
			},
			onToggleFeature: async (featureId: string, enabled: boolean) => {
				await this.handleFeatureToggle(featureId, enabled);
			},
			onToggleAllFeatures: async (enabled: boolean) => {
				await this.handleToggleAllFeatures(enabled);
			},
			onRefresh: async () => {
				await this.handleRefresh();
			},
			onUpdateAiSettings: async (aiSettings: AiSettings) => {
				await this.handleUpdateAiSettings(aiSettings);
			},
		});

		vueApp.mount(panelContainer);
	}

	private close() {
		if (vueApp && panelContainer) {
			vueApp.unmount();
			panelContainer.remove();
			vueApp = null;
			panelContainer = null;
			reactiveSettings = null;
		}
	}

	private async handleRefresh() {
		try {
			showMessage(
				(this.plugin.i18n as any).superPanel?.refreshing || "正在刷新...",
				1000,
				"info",
			);
			this.close();
			await new Promise((resolve) => setTimeout(resolve, 100));
			this.open();
			showMessage(
				(this.plugin.i18n as any).superPanel?.refreshSuccess || "已刷新",
				1500,
				"info",
			);
		} catch (error) {
			console.error("刷新失败:", error);
			showMessage("刷新失败", 2000, "error");
		}
	}

	private async handleFeatureToggle(featureId: string, enabled: boolean) {
		const pluginSample = this.plugin as any;
		const settingKey = FEATURE_SETTINGS_MAP[featureId];
		if (settingKey) {
			const newSettings = {
				...pluginSample.settings,
				[settingKey]: enabled,
			};

			const success = await pluginSample.updateSettings(newSettings);
			if (success) {
				// 更新响应式 settings 对象，触发 UI 实时更新
				if (reactiveSettings) {
					(reactiveSettings as any)[settingKey] = enabled;
				}
				showMessage(
					enabled
						? (this.plugin.i18n as any).featureEnabled || "功能已启用"
						: (this.plugin.i18n as any).featureDisabled || "功能已禁用",
					2000,
					"info",
				);
			} else {
				showMessage(
					(this.plugin.i18n as any).saveFailed || "保存失败",
					3000,
					"error",
				);
			}
		}
	}

	private async handleToggleAllFeatures(enabled: boolean) {
		const pluginSample = this.plugin as any;

		// 构建新设置对象
		const newSettings = { ...pluginSample.settings };
		ALL_FEATURE_SETTINGS.forEach((key) => {
			newSettings[key] = enabled;
		});

		const success = await pluginSample.updateSettings(newSettings);
		if (success) {
			// 更新响应式 settings 对象，触发 UI 实时更新
			if (reactiveSettings) {
				ALL_FEATURE_SETTINGS.forEach((key) => {
					(reactiveSettings as any)[key] = enabled;
				});
			}
			showMessage(
				enabled
					? (this.plugin.i18n as any).superPanel?.allFeaturesEnabled ||
							"所有功能已开启"
					: (this.plugin.i18n as any).superPanel?.allFeaturesDisabled ||
							"所有功能已关闭",
				2000,
				"info",
			);
		} else {
			showMessage(
				(this.plugin.i18n as any).saveFailed || "保存失败",
				3000,
				"error",
			);
		}
	}

	private handleFeatureAction(action: string) {
		// 处理带命令详情的事件
		const commandDetails: Record<string, string> = {
			insertIndex: "insertIndex",
			insertOutline: "insertSubDocsWithOutline",
			insertRef: "insertSubDocsRef",
		};

		// 处理简单事件
		if (SIMPLE_ACTION_EVENTS[action]) {
			const eventName = SIMPLE_ACTION_EVENTS[action];
			if (commandDetails[action]) {
				window.dispatchEvent(
					new CustomEvent(eventName, {
						detail: { command: commandDetails[action] },
					}),
				);
			} else {
				window.dispatchEvent(new CustomEvent(eventName));
			}
			this.close();
			return;
		}

		// 处理需要检查设置的事件
		const actionConfig = ACTION_SETTINGS_MAP[action];
		if (actionConfig) {
			if ((this.plugin as any).settings[actionConfig.settingKey]) {
				window.dispatchEvent(new CustomEvent(actionConfig.event));
				this.close();
			}
			return;
		}

		// 特殊处理：文本对比
		if (action === "openTextDiff") {
			if ((this.plugin as any).settings.enableTextDiff) {
				const manager = (this.plugin as any).__textDiff as TextDiffManager;
				if (manager) {
					manager.toggle();
				}
				this.close();
			}
			return;
		}

		showMessage("功能开发中...", 2000, "info");
	}

	private async handleUpdateAiSettings(aiSettings: AiSettings) {
		const pluginSample = this.plugin as any;

		const newSettings = {
			...pluginSample.settings,
			aiApiProvider: aiSettings.provider,
			aiModel: aiSettings.model,
			aiApiKey: aiSettings.apiKey,
			aiCustomEndpoint: aiSettings.customEndpoint,
		};

		const success = await pluginSample.updateSettings(newSettings);
		if (success) {
			// 更新响应式 settings 对象
			if (reactiveSettings) {
				reactiveSettings.aiApiProvider = aiSettings.provider;
				reactiveSettings.aiModel = aiSettings.model;
				reactiveSettings.aiApiKey = aiSettings.apiKey;
				reactiveSettings.aiCustomEndpoint = aiSettings.customEndpoint;
			}
			// 通知相关功能模块更新配置
			if (pluginSample.__wordQuery) {
				pluginSample.__wordQuery.updateApiConfig(
					aiSettings.provider,
					aiSettings.model,
					aiSettings.apiKey,
					aiSettings.customEndpoint,
				);
			}
			if (pluginSample.__aiContentGenerator) {
				pluginSample.__aiContentGenerator.updateApiConfig(
					aiSettings.provider,
					aiSettings.model,
					aiSettings.apiKey,
					aiSettings.customEndpoint,
				);
			}
			showMessage("AI配置已保存", 2000, "info");
		} else {
			showMessage(
				(this.plugin.i18n as any).saveFailed || "保存失败",
				3000,
				"error",
			);
		}
	}

	public destroy() {
		this.close();
		window.removeEventListener("toggleSuperPanel", this.boundToggleHandler);
	}
}

/**
 * 注册超级面板功能
 */
export function registerSuperPanel(plugin: Plugin) {
	const manager = new SuperPanelManager(plugin);
	manager.init();
	(plugin as any).__superPanel = manager;
	return manager;
}
