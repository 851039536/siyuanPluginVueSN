/**
 * 单位转换器功能模块
 */
import type PluginSample from "@/index";
import { UnitConverterManager } from "./types";

/**
 * 注册单位转换功能
 */
export function registerUnitConverter(plugin: PluginSample) {
	const manager = new UnitConverterManager(plugin);
	manager.init();
	(plugin as any).__unitConverter = manager;
	return manager;
}

export * from "./types";
