import { computed, reactive, onMounted, onUnmounted } from "vue";
import {
	THRESHOLDS,
	MONITOR_INTERVAL_MS,
	STATISTICS_INTERVAL_MS,
	INITIAL_DELAY_MS,
	DEFAULT_TOTAL_MEMORY_GB,
	type ResourceLevel,
	type SystemMonitorState,
} from "../types/index";

const TOTAL_MEMORY_BYTES = DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024;
const TOTAL_MEMORY_MB = DEFAULT_TOTAL_MEMORY_GB * 1024;

function formatUptime(seconds: number): { hours: number; minutes: number } {
	return {
		hours: Math.floor(seconds / 3600),
		minutes: Math.floor((seconds % 3600) / 60),
	};
}

export function useSystemMonitor() {
	const state = reactive<SystemMonitorState>({
		cpuPercent: 0,
		memPercent: 0,
		uptimeSeconds: 0,
		showMonitor: false,
		totalNotes: 0,
		totalWords: 0,
	});

	let intervalId: ReturnType<typeof setInterval> | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastCPU: NodeJS.CpuUsage | null = null;
	let lastTime: number | null = null;
	let statisticsIntervalId: ReturnType<typeof setInterval> | null = null;

	const cpuUsageDisplay = computed(() => `${Math.round(state.cpuPercent)}%`);

	const memoryUsageDisplay = computed(() => {
		const mbs = (state.memPercent / 100) * TOTAL_MEMORY_MB;
		return mbs > 1000 ? `${(mbs / 1024).toFixed(1)}G` : `${Math.round(mbs)}M`;
	});

	const uptimeDisplay = computed(() => {
		const { hours, minutes } = formatUptime(state.uptimeSeconds);
		return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
	});

	const totalNotesDisplay = computed(() => {
		const count = state.totalNotes;
		if (count >= 10000) return `${(count / 10000).toFixed(1)}w`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
		return String(count);
	});

	const totalWordsDisplay = computed(() => {
		const count = state.totalWords;
		if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
		if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
		return String(count);
	});

	const statisticsTooltip = computed(() => {
		return `文档数: ${state.totalNotes} 篇\n总字数: ${state.totalWords.toLocaleString()} 字`;
	});

	const systemInfoTooltip = computed(() => {
		const platform =
			typeof process !== "undefined"
				? `${process.platform} ${process.arch}`
				: "Unknown";
		const { hours, minutes } = formatUptime(state.uptimeSeconds);
		return `系统: ${platform}\n运行时间: ${hours}小时 ${minutes}分\n内存限制: ${DEFAULT_TOTAL_MEMORY_GB}GB`;
	});

	const getLevel = (
		percent: number,
		{ HIGH, MEDIUM }: { HIGH: number; MEDIUM: number },
	): ResourceLevel => {
		if (percent >= HIGH) return "high";
		if (percent >= MEDIUM) return "medium";
		return "normal";
	};

	const cpuLevel = computed(() => getLevel(state.cpuPercent, THRESHOLDS.CPU));
	const memLevel = computed(() => getLevel(state.memPercent, THRESHOLDS.MEM));

	async function fetchStatistics() {
		try {
			// 优化：使用预存的 length 字段代替 LENGTH(content)，避免对每行数据计算长度
			const sql = `
        SELECT
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
          (SELECT SUM(length) FROM blocks WHERE type = 'p' AND length > 0) as totalWords
      `;
			const response = await fetch("/api/query/sql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stmt: sql }),
			});
			const data = await response.json();
			if (data.code === 0 && data.data?.[0]) {
				state.totalNotes = Number(data.data[0].totalNotes || 0);
				state.totalWords = Number(data.data[0].totalWords || 0);
			}
		} catch (error) {
			console.error("获取统计数据失败:", error);
		}
	}

	function updateStats() {
		if (typeof process === "undefined") return;

		const currCPU = process.cpuUsage();
		const currTime = Date.now();

		if (lastCPU && lastTime) {
			const timeDiff = currTime - lastTime;
			if (timeDiff > 0) {
				const cpuDiff =
					currCPU.user + currCPU.system - (lastCPU.user + lastCPU.system);
				state.cpuPercent = Math.max(
					0,
					Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100),
				);
			}
		}

		lastCPU = currCPU;
		lastTime = currTime;

		const memUsage = process.memoryUsage();
		state.memPercent = Math.min(100, (memUsage.rss / TOTAL_MEMORY_BYTES) * 100);
		state.uptimeSeconds = Math.floor(process.uptime());
	}

	function start() {
		if (intervalId) return;
		updateStats();
		intervalId = setInterval(updateStats, MONITOR_INTERVAL_MS);
	}

	function startStatistics() {
		if (statisticsIntervalId) return;
		fetchStatistics();
		statisticsIntervalId = setInterval(fetchStatistics, STATISTICS_INTERVAL_MS);
	}

	function stop() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		if (statisticsIntervalId) {
			clearInterval(statisticsIntervalId);
			statisticsIntervalId = null;
		}
	}

	onMounted(() => {
		timeoutId = setTimeout(() => {
			state.showMonitor = true;
			start();
			startStatistics();
		}, INITIAL_DELAY_MS);
	});

	onUnmounted(() => {
		if (timeoutId) clearTimeout(timeoutId);
		stop();
	});

	return {
		state,
		cpuUsageDisplay,
		memoryUsageDisplay,
		uptimeDisplay,
		systemInfoTooltip,
		cpuLevel,
		memLevel,
		totalNotesDisplay,
		totalWordsDisplay,
		statisticsTooltip,
	};
}
