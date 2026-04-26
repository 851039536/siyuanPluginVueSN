import { createApp, h } from "vue";
import type PluginSample from "@/index";
// @ts-ignore
import UnitConverterPanel from "../index.vue";

/**
 * 转换器类型定义
 */
export interface ConverterTab {
	key: string;
	name: string;
	i18nKey?: string;
}

/**
 * 单位转换器配置
 */
export interface UnitConverterOptions {
	defaultTab?: string;
}

/**
 * 单位转换器管理类
 */
export class UnitConverterManager {
	private plugin: PluginSample;

	constructor(plugin: PluginSample) {
		this.plugin = plugin;
	}

	public init() {
		this.addDock();
	}

	private addDock() {
		const self = this;
		this.plugin.addDock({
			config: {
				position: "RightTop",
				size: { width: 360, height: 0 },
				icon: "iconList",
				title: this.plugin.i18n.unitConverter || "单位转换",
				show: false,
			},
			data: {},
			type: "unit-converter-dock",
			init: (dock: any) => {
				const container = document.createElement("div");
				container.style.height = "100%";
				container.style.overflow = "hidden";

				const app = createApp({
					setup() {
						return () =>
							h(UnitConverterPanel, {
								i18n: self.plugin.i18n || {},
								plugin: self.plugin,
							});
					},
				});

				app.mount(container);
				dock.element?.appendChild(container);

				dock.__app = app;
				dock.__container = container;
			},
		});
	}

	public destroy() {
		// 清理逻辑
	}
}
