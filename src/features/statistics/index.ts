/**
 * 数据统计功能模块
 */
import { Plugin } from "siyuan";
import { Statistics } from "./core";

let statisticsInstance: Statistics | null = null;

/**
 * 注册数据统计功能
 */
export function registerStatistics(plugin: Plugin) {
	statisticsInstance = new Statistics(plugin);
	statisticsInstance.init();
}

/**
 * 获取统计实例
 */
export function getStatisticsInstance(): Statistics | null {
	return statisticsInstance;
}
