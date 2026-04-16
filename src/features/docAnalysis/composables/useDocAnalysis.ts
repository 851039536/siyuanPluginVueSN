/**
 * 文档分析功能 - 核心业务逻辑
 */
import { ref, reactive } from "vue";
import { sql, lsNotebooks } from "@/api";
import type { DocInfo, FilterOptions, QueryState, DocStats } from "../types/index";
import { unitToBytes } from "../types/storage";
import { DocAnalysisStorage, DEFAULT_FILTER_OPTIONS } from "../types/storage";
import type { Plugin } from "siyuan";

/** 笔记本信息 */
interface NotebookInfo {
	id: string;
	name: string;
}

/** 子查询：统计每个文档的内容大小 */
const SIZE_SUBQUERY = `
	SELECT root_id, SUM(length) as total_size 
	FROM blocks 
	WHERE type != 'd'
	GROUP BY root_id
`;

/**
 * 文档分析 composable
 */
export function useDocAnalysis(plugin: Plugin) {
	// 存储管理
	const storage = new DocAnalysisStorage(plugin);

	// 笔记本列表
	const notebooks = ref<NotebookInfo[]>([]);

	// 查询状态
	const queryState = reactive<QueryState>({
		status: "idle",
		results: [],
		errorMessage: "",
		hasQueried: false,
	});

	// 过滤选项
	const filterOptions = reactive<FilterOptions>({ ...DEFAULT_FILTER_OPTIONS });

	// 文档统计信息
	const docStats = reactive<DocStats>({
		totalDocs: 0,
		zeroByteDocs: 0,
		smallDocs: 0,
		mediumDocs: 0,
	});
	const statsLoading = ref(false);
	const hasAnalyzed = ref(false);

	// 当前选中的统计类别过滤
	const statsFilter = ref<string>(""); // "" | "0B" | "small" | "medium"

	// ============================================================
	// 公共辅助函数
	// ============================================================

	/** 构建笔记本过滤条件 */
	function buildNotebookCondition(): string {
		if (filterOptions.notebookId) {
			return `AND b.box = '${filterOptions.notebookId}'`;
		}
		return "";
	}

	/** 构建笔记本名称映射 */
	function buildNotebookMap(): Map<string, string> {
		const map = new Map<string, string>();
		for (const nb of notebooks.value) {
			map.set(nb.id, nb.name);
		}
		return map;
	}

	/** 将 SQL 行映射为 DocInfo */
	function mapRowsToDocs(rows: any[]): DocInfo[] {
		const notebookMap = buildNotebookMap();
		return rows.map((row: any) => ({
			id: row.doc_id,
			title: row.doc_title || "无标题",
			hpath: row.doc_path || "",
			notebookId: row.notebook_id || "",
			notebookName: notebookMap.get(row.notebook_id) || "未知笔记本",
			contentSize: row.content_size || 0,
		}));
	}

	/** 查询文档列表（带大小条件），公共核心逻辑 */
	async function fetchDocList(sizeCondition: string) {
		queryState.status = "loading";
		queryState.errorMessage = "";
		queryState.hasQueried = true;

		try {
			const notebookCondition = buildNotebookCondition();

			const sqlStmt = `
				SELECT 
					b.id as doc_id,
					b.content as doc_title,
					b.hpath as doc_path,
					b.box as notebook_id,
					COALESCE(s.total_size, 0) as content_size
				FROM blocks b
				LEFT JOIN (${SIZE_SUBQUERY}) s ON b.id = s.root_id
				WHERE b.type = 'd' ${notebookCondition}
				${sizeCondition}
				ORDER BY content_size ASC
				LIMIT 2000
			`;

			const rows = await sql(sqlStmt);

			if (!rows || rows.length === 0) {
				queryState.results = [];
				queryState.status = "empty";
				return;
			}

			const docs = mapRowsToDocs(rows);
			const sortedDocs = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder);

			queryState.results = sortedDocs;
			queryState.status = "success";
		} catch (error) {
			console.error("查询文档列表失败:", error);
			queryState.errorMessage = (error as Error).message || "查询失败";
			queryState.status = "error";
			queryState.results = [];
		}
	}

	// ============================================================
	// 业务操作
	// ============================================================

	/**
	 * 加载笔记本列表
	 */
	async function loadNotebooks() {
		try {
			const data = await lsNotebooks();
			if (data && data.notebooks) {
				notebooks.value = data.notebooks
					.filter((nb: any) => !nb.closed)
					.map((nb: any) => ({
						id: nb.id,
						name: nb.name,
					}));
			}
		} catch (error) {
			console.error("加载笔记本列表失败:", error);
		}
	}

	/**
	 * 加载保存的配置
	 */
	async function loadSavedOptions() {
		try {
			const saved = await storage.loadOptions();
			Object.assign(filterOptions, saved);
		} catch (error) {
			console.error("加载文档分析配置失败:", error);
		}
	}

	/**
	 * 保存配置
	 */
	async function saveOptions() {
		try {
			await storage.saveOptions({ ...filterOptions });
		} catch (error) {
			console.error("保存文档分析配置失败:", error);
		}
	}

	/**
	 * 执行分析 - 获取文档统计概览
	 */
	async function analyzeDocStats() {
		statsLoading.value = true;
		try {
			const notebookCondition = buildNotebookCondition();

			const sqlStmt = `
				SELECT 
					COUNT(*) as total,
					SUM(CASE WHEN COALESCE(s.total_size, 0) = 0 THEN 1 ELSE 0 END) as zero_count,
					SUM(CASE WHEN COALESCE(s.total_size, 0) > 0 AND COALESCE(s.total_size, 0) < 1024 THEN 1 ELSE 0 END) as small_count,
					SUM(CASE WHEN COALESCE(s.total_size, 0) >= 1024 AND COALESCE(s.total_size, 0) < 10240 THEN 1 ELSE 0 END) as medium_count
				FROM blocks b
				LEFT JOIN (${SIZE_SUBQUERY}) s ON b.id = s.root_id
				WHERE b.type = 'd' ${notebookCondition}
			`;

			const rows = await sql(sqlStmt);
			if (rows && rows.length > 0) {
				const row = rows[0];
				docStats.totalDocs = row.total || 0;
				docStats.zeroByteDocs = row.zero_count || 0;
				docStats.smallDocs = row.small_count || 0;
				docStats.mediumDocs = row.medium_count || 0;
			}
			hasAnalyzed.value = true;
		} catch (error) {
			console.error("分析文档统计失败:", error);
		} finally {
			statsLoading.value = false;
		}
	}

	/**
	 * 点击统计卡片 - 按类别查询文档列表
	 */
	async function queryByStatsCategory(category: string) {
		if (statsFilter.value === category) {
			// 再次点击取消过滤，清除列表
			statsFilter.value = "";
			queryState.hasQueried = false;
			queryState.results = [];
			queryState.status = "idle";
			return;
		}
		statsFilter.value = category;

		const sizeConditions: Record<string, string> = {
			"0B": "AND COALESCE(s.total_size, 0) = 0",
			small: "AND COALESCE(s.total_size, 0) > 0 AND COALESCE(s.total_size, 0) < 1024",
			medium: "AND COALESCE(s.total_size, 0) >= 1024 AND COALESCE(s.total_size, 0) < 10240",
		};

		await fetchDocList(sizeConditions[category] || "");
	}

	/**
	 * 执行查询 - 获取小文档列表
	 */
	async function querySmallDocs() {
		const thresholdBytes = unitToBytes(filterOptions.threshold, filterOptions.unit);

		let sizeCondition = `AND COALESCE(s.total_size, 0) < ${thresholdBytes}`;
		if (filterOptions.titleKeyword.trim()) {
			const keyword = filterOptions.titleKeyword.trim().replace(/'/g, "''");
			sizeCondition += ` AND b.content LIKE '%${keyword}%'`;
		}

		await fetchDocList(sizeCondition);
		await saveOptions();
	}

	/**
	 * 排序文档列表
	 */
	function sortDocs(docs: DocInfo[], field: string, order: string): DocInfo[] {
		return [...docs].sort((a, b) => {
			let compare = 0;
			switch (field) {
				case "title":
					compare = a.title.localeCompare(b.title, "zh-CN");
					break;
				case "notebook":
					compare = a.notebookName.localeCompare(b.notebookName, "zh-CN");
					break;
				default:
					compare = a.contentSize - b.contentSize;
			}
			return order === "desc" ? -compare : compare;
		});
	}

	/**
	 * 打开文档 - 在思源编辑器中打开
	 */
	function openDoc(docId: string) {
		if (docId) {
			window.open(`siyuan://blocks/${docId}`);
		}
	}

	/**
	 * 更新排序
	 */
	function updateSort(field: string, order: string) {
		filterOptions.sortField = field as any;
		filterOptions.sortOrder = order as any;
		if (queryState.results.length > 0) {
			queryState.results = sortDocs(queryState.results, field, order);
		}
		saveOptions();
	}

	/**
	 * 重置查询
	 */
	function resetQuery() {
		queryState.status = "idle";
		queryState.results = [];
		queryState.errorMessage = "";
		queryState.hasQueried = false;
		Object.assign(filterOptions, { ...DEFAULT_FILTER_OPTIONS });
	}

	return {
		notebooks,
		queryState,
		filterOptions,
		docStats,
		statsLoading,
		hasAnalyzed,
		statsFilter,
		loadNotebooks,
		loadSavedOptions,
		querySmallDocs,
		analyzeDocStats,
		queryByStatsCategory,
		openDoc,
		updateSort,
		resetQuery,
		saveOptions,
	};
}
