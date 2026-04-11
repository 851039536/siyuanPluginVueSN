/**
 * 格式化数字，添加千分位分隔符
 */
export function formatNumber(num: number): string {
	return (num || 0).toLocaleString("zh-CN");
}

/**
 * 格式化短数字 (K, M)
 */
export function formatShortNumber(num: number): string {
	if (!num) return "0";
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + "M";
	} else if (num >= 1000) {
		return (num / 1000).toFixed(1) + "K";
	}
	return String(num);
}

/**
 * 判断日期是否为今天
 */
export function isToday(dateStr: string): boolean {
	if (!dateStr) return false;
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`;

	if (dateStr.length === 10) {
		return dateStr === todayStr;
	} else if (dateStr.length === 7) {
		return dateStr === todayStr.substring(0, 7);
	} else if (dateStr.length === 4) {
		return dateStr === String(today.getFullYear());
	}
	return false;
}

function padZero(num: number): string {
	return num < 10 ? "0" + num : String(num);
}
