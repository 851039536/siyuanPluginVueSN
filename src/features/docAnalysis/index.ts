/**
 * 文档分析功能模块
 */
import { Plugin } from "siyuan";
import { createApp, h } from "vue";
import DocAnalysisPanel from "./index.vue";
import { emitCustomEvent } from "@/utils/eventBus";

/**
 * 注册文档分析功能（Dock 侧边栏面板）
 */
export function registerDocAnalysis(plugin: Plugin) {
	plugin.addDock({
		config: {
			position: "RightTop",
			size: { width: 400, height: 0 },
			icon: "iconSearch",
			title:
				(plugin.i18n as any)?.docAnalysis?.title || "文档分析",
			show: false,
		},
		data: {},
		type: "doc-analysis-dock",
		init: (dock: any) => {
			const container = document.createElement("div");
			container.style.height = "100%";
			container.style.overflow = "hidden";

			const app = createApp({
				setup() {
					return () =>
						h(DocAnalysisPanel, {
							i18n: (plugin.i18n as any)?.docAnalysis || {},
							plugin: plugin,
						});
				},
			});

			app.mount(container);
			dock.element?.appendChild(container);

			dock.__app = app;
			dock.__container = container;
		},
	});

	// 注册快捷键命令 - 触发 Dock 显示
	plugin.addCommand({
		langKey: "docAnalysis",
		langText: "文档分析",
		hotkey: "⌃⌥D",
		callback: () => {
			emitCustomEvent("dock-click", { dockId: "doc-analysis-dock" });
		},
	});
}

export * from "./types";
