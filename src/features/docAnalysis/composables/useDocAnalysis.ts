/**
 * 文档分析功能 - 核心业务逻辑
 */
import { ref, reactive } from "vue";
import { sql, lsNotebooks } from "@/api";
import type { DocInfo, FilterOptions, QueryState, SizeUnit } from "../types/index";
import { unitToBytes } from "../types/storage";
import { DocAnalysisStorage, DEFAULT_FILTER_OPTIONS } from "../types/storage";
import type { Plugin } from "siyuan";

/** 笔记本信息 */
interface NotebookInfo {
	id: string;
	name: string;
}

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
	 * 执行查询 - 获取小文档列表
	 */
	async function querySmallDocs() {
		queryState.status = "loading";
		queryState.errorMessage = "";
		queryState.hasQueried = true;

		try {
			// 计算字节数阈值
			const thresholdBytes = unitToBytes(filterOptions.threshold, filterOptions.unit);

			// 构建 SQL 查询
			// 先获取所有文档块，然后按 root_id 分组计算内容大小
			let notebookCondition = "";
			if (filterOptions.notebookId) {
				notebookCondition = `AND b.box = '${filterOptions.notebookId}'`;
			}

			const sqlStmt = `
				SELECT 
					b.id as doc_id,
					b.content as doc_title,
					b.hpath as doc_path,
					b.box as notebook_id,
					COALESCE(s.total_size, 0) as content_size
				FROM blocks b
				LEFT JOIN (
					SELECT root_id, SUM(length) as total_size 
					FROM blocks 
					WHERE type != 'd'
					GROUP BY root_id
				) s ON b.id = s.root_id
				WHERE b.type = 'd' ${notebookCondition}
				AND COALESCE(s.total_size, 0) < ${thresholdBytes}
				ORDER BY content_size ASC
				LIMIT 2000
			`;

			const rows = await sql(sqlStmt);

			if (!rows || rows.length === 0) {
				queryState.results = [];
				queryState.status = "empty";
				return;
			}

			// 构建笔记本名称映射
			const notebookMap = new Map<string, string>();
			for (const nb of notebooks.value) {
				notebookMap.set(nb.id, nb.name);
			}

			// 转换结果
			const docs: DocInfo[] = rows.map((row: any) => ({
				id: row.doc_id,
				title: row.doc_title || "无标题",
				hpath: row.doc_path || "",
				notebookId: row.notebook_id || "",
				notebookName: notebookMap.get(row.notebook_id) || "未知笔记本",
				contentSize: row.content_size || 0,
			}));

			// 排序
			const sortedDocs = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder);

			queryState.results = sortedDocs;
			queryState.status = "success";

			// 保存当前配置
			await saveOptions();
		} catch (error) {
			console.error("查询小文档失败:", error);
			queryState.errorMessage = (error as Error).message || "查询失败";
			queryState.status = "error";
			queryState.results = [];
		}
	}

	/**
	 * 排序文档列表
	 */
	function sortDocs(docs: DocInfo[], field: string, order: string): DocInfo[] {
		return [...docs].sort((a, b) => {
			let compare = 0;
			switch (field) {
				case "size":
					compare = a.contentSize - b.contentSize;
					break;
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
		loadNotebooks,
		loadSavedOptions,
		querySmallDocs,
		openDoc,
		updateSort,
		resetQuery,
		saveOptions,
	};
}
