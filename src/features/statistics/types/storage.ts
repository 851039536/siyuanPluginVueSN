/**
 * 统计模块存储类型定义
 */

/**
 * 周目标设置
 */
export interface WeeklyGoalSettings {
	/** 目标新建笔记数 */
	created: number;
	/** 目标写作字数 */
	words: number;
}

/**
 * 统计设置存储键
 */
export const STATISTICS_STORAGE_KEYS = {
	WEEKLY_GOAL: "statistics-weekly-goal",
} as const;

/**
 * 默认周目标设置
 */
export const DEFAULT_WEEKLY_GOAL: WeeklyGoalSettings = {
	created: 30,
	words: 100000,
};
