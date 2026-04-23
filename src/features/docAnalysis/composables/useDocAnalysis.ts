/**
 * 文档分析功能 - 核心业务逻辑
 */
import { ref, reactive } from "vue";
import { sql, lsNotebooks } from "@/api";
import type { DocInfo, FilterOptions, QueryState, DocStats } from "../types/index";
import type { DuplicateNameGroup, UpdateTimeStats, DepthStats, RefStats, ImageStats } from "../types/index";
import { DocAnalysisStorage, DEFAULT_FILTER_OPTIONS } from "../types/storage";
import type { Plugin } from "siyuan";

/** 笔记本信息 */
interface NotebookInfo {
	id: string;
	name: string;
}

/** 子查询：统计每个文档的内容大小和字数（合并减少扫描次数） */
const SIZE_WORDCOUNT_SUBQUERY = `
	SELECT root_id, 
		SUM(length) as total_size,
		SUM(LENGTH(content)) as total_word_count
	FROM blocks 
	WHERE type != 'd'
	GROUP BY root_id
`;

/** 子查询：统计每个文档的引用块数量（思源引用语法 ((id "标题")) 在 markdown 字段中） */
const REF_SUBQUERY = `
	SELECT root_id, COUNT(*) as ref_count
	FROM blocks
	WHERE type != 'd' AND markdown LIKE '%((%'
	GROUP BY root_id
`;

/** 子查询：统计每个文档的图片/资源数量（markdown 语法中包含 ![ ） */
const IMAGE_SUBQUERY = `
	SELECT root_id, COUNT(*) as image_count
	FROM blocks
	WHERE type != 'd' AND markdown LIKE '%![%'
	GROUP BY root_id
`;

/** 生成 N 天前的 yyyyMMddHHmmss 格式字符串（思源 updated 字段格式） */
function daysAgoStr(days: number): string {
	const d = new Date(Date.now() - days * 86400000);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

	// 文档统计信息
	const docStats = reactive<DocStats>({
		totalDocs: 0,
		zeroByteDocs: 0,
		smallDocs: 0,
		mediumDocs: 0,
		duplicateNameGroups: 0,
		duplicateNameDocs: 0,
		updatedIn7Days: 0,
		updatedIn30Days: 0,
		updatedOverHalfYear: 0,
		maxDepth: 0,
		avgDepth: 0,
		deepDocs: 0,
		refDocs: 0,
		totalRefs: 0,
		imageDocs: 0,
		totalImages: 0,
	});
	const statsLoading = ref(false);
	const hasAnalyzed = ref(false);

	// 重名文档详情（供列表展示）
	const duplicateGroups = ref<DuplicateNameGroup[]>([]);

	// 更新时间分析详情
	const updateTimeStats = ref<UpdateTimeStats>({
		in7Days: 0,
		in30Days: 0,
		inHalfYear: 0,
		overHalfYear: 0,
	});

	// 深度分析详情
	const depthStats = ref<DepthStats>({
		depthDistribution: [],
		maxDepth: 0,
		avgDepth: 0,
	});

	// 引用分析详情
	const refStats = ref<RefStats>({
		topRefDocs: [],
		refDocCount: 0,
		totalRefCount: 0,
	});

	// 图片分析详情
	const imageStats = ref<ImageStats>({
		topImageDocs: [],
		imageDocCount: 0,
		totalImageCount: 0,
	});

	// 当前选中的统计类别过滤
	const statsFilter = ref<string>("");

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

	/** 将 SQL 行映射为 DocInfo（扩展版） */
	function mapRowsToDocs(rows: any[]): DocInfo[] {
		const notebookMap = buildNotebookMap();
		return rows.map((row: any) => ({
			id: row.doc_id,
			title: row.doc_title || "无标题",
			hpath: row.doc_path || "",
			notebookId: row.notebook_id || "",
			notebookName: notebookMap.get(row.notebook_id) || "未知笔记本",
			contentSize: row.content_size || 0,
			wordCount: row.word_count || 0,
			updated: row.doc_updated || undefined,
			created: row.doc_created || undefined,
			depth: row.doc_depth ?? undefined,
			refCount: row.ref_count ?? undefined,
			imageCount: row.image_count ?? undefined,
		}));
	}

	/** 查询文档列表（带条件），公共核心逻辑 */
	async function fetchDocList(extraCondition: string) {
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
					b.updated as doc_updated,
					b.created as doc_created,
					COALESCE(sw.total_size, 0) as content_size,
					COALESCE(sw.total_word_count, 0) as word_count,
					LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth
				FROM blocks b
				LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
				WHERE b.type = 'd' ${notebookCondition}
				${extraCondition}
				ORDER BY word_count ASC
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
	 * 执行分析 - 获取文档统计概览（含新增维度）
	 */
	async function analyzeDocStats() {
		statsLoading.value = true;
		try {
			const notebookCondition = buildNotebookCondition();

			// 大小统计
			const sizeSql = `
				SELECT 
					COUNT(*) as total,
					SUM(CASE WHEN COALESCE(sw.total_size, 0) = 0 THEN 1 ELSE 0 END) as zero_count,
					SUM(CASE WHEN COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024 THEN 1 ELSE 0 END) as small_count,
					SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240 THEN 1 ELSE 0 END) as medium_count
				FROM blocks b
				LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
				WHERE b.type = 'd' ${notebookCondition}
			`;

			const sizeRows = await sql(sizeSql);
			if (sizeRows && sizeRows.length > 0) {
				const row = sizeRows[0];
				docStats.totalDocs = row.total || 0;
				docStats.zeroByteDocs = row.zero_count || 0;
				docStats.smallDocs = row.small_count || 0;
				docStats.mediumDocs = row.medium_count || 0;
			}

			// 重名统计
			const dupSql = `
				SELECT b.content as doc_title, COUNT(*) as cnt
				FROM blocks b
				WHERE b.type = 'd' ${notebookCondition}
				GROUP BY b.content
				HAVING COUNT(*) > 1
				ORDER BY cnt DESC
				LIMIT 500
			`;

			const dupRows = await sql(dupSql);
			if (dupRows && dupRows.length > 0) {
				docStats.duplicateNameGroups = dupRows.length;
				docStats.duplicateNameDocs = dupRows.reduce((sum: number, r: any) => sum + (r.cnt || 0), 0);
				duplicateGroups.value = dupRows.map((r: any) => ({
					title: r.doc_title || "无标题",
					count: r.cnt || 0,
				}));
			} else {
				docStats.duplicateNameGroups = 0;
				docStats.duplicateNameDocs = 0;
				duplicateGroups.value = [];
			}

			// 更新时间分析
			await analyzeUpdateTime(notebookCondition);

			// 文档深度分析
			await analyzeDepth(notebookCondition);

			// 引用分析
			await analyzeRefs(notebookCondition);

			// 图片/资源分析
			await analyzeImages(notebookCondition);

			hasAnalyzed.value = true;
		} catch (error) {
			console.error("分析文档统计失败:", error);
		} finally {
			statsLoading.value = false;
		}
	}

	/**
	 * 更新时间分析
	 * 思源 blocks.updated 格式为 yyyyMMddHHmmss（14位字符串，如 "20210604222535"）
	 */
	async function analyzeUpdateTime(notebookCondition: string) {
		try {
			const ts7 = daysAgoStr(7);
			const ts30 = daysAgoStr(30);
			const ts180 = daysAgoStr(180);

			const timeSql = `
				SELECT
					SUM(CASE WHEN b.updated >= '${ts7}' THEN 1 ELSE 0 END) as in_7_days,
					SUM(CASE WHEN b.updated >= '${ts30}' AND b.updated < '${ts7}' THEN 1 ELSE 0 END) as in_30_days,
					SUM(CASE WHEN b.updated >= '${ts180}' AND b.updated < '${ts30}' THEN 1 ELSE 0 END) as in_half_year,
					SUM(CASE WHEN b.updated < '${ts180}' THEN 1 ELSE 0 END) as over_half_year
				FROM blocks b
				WHERE b.type = 'd' ${notebookCondition}
			`;

			const timeRows = await sql(timeSql);
			if (timeRows && timeRows.length > 0) {
				const row = timeRows[0];
				updateTimeStats.value = {
					in7Days: row.in_7_days || 0,
					in30Days: row.in_30_days || 0,
					inHalfYear: row.in_half_year || 0,
					overHalfYear: row.over_half_year || 0,
				};
				docStats.updatedIn7Days = row.in_7_days || 0;
				docStats.updatedIn30Days = row.in_30_days || 0;
				docStats.updatedOverHalfYear = row.over_half_year || 0;
			}
		} catch (error) {
			console.error("更新时间分析失败:", error);
		}
	}

	/**
	 * 文档深度/层级分析
	 */
	async function analyzeDepth(notebookCondition: string) {
		try {
			const depthSql = `
				SELECT
					COALESCE(LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1, 0) as depth,
					COUNT(*) as cnt
				FROM blocks b
				WHERE b.type = 'd' ${notebookCondition}
				GROUP BY depth
				ORDER BY depth ASC
			`;

			const depthRows = await sql(depthSql);
			if (depthRows && depthRows.length > 0) {
				const distribution = depthRows.map((r: any) => ({
					depth: r.depth || 0,
					count: r.cnt || 0,
				}));

				const maxDepth = Math.max(...distribution.map((d) => d.depth));
				const totalDocs = distribution.reduce((sum: number, d) => sum + d.count, 0);
				const avgDepth = totalDocs > 0
					? distribution.reduce((sum: number, d) => sum + d.depth * d.count, 0) / totalDocs
					: 0;
				const deepDocs = distribution
					.filter((d) => d.depth >= 5)
					.reduce((sum: number, d) => sum + d.count, 0);

				depthStats.value = {
					depthDistribution: distribution,
					maxDepth,
					avgDepth: Math.round(avgDepth * 10) / 10,
				};
				docStats.maxDepth = maxDepth;
				docStats.avgDepth = Math.round(avgDepth * 10) / 10;
				docStats.deepDocs = deepDocs;
			}
		} catch (error) {
			console.error("文档深度分析失败:", error);
		}
	}

	/**
	 * 引用/嵌入块分析
	 * 思源中引用语法 ((id "标题")) 存储在 markdown 字段中
	 */
	async function analyzeRefs(notebookCondition: string) {
		try {
			// 引用统计概览
			const refCountSql = `
				SELECT
					COUNT(DISTINCT root_id) as ref_doc_count,
					COUNT(*) as total_ref_count
				FROM blocks
				WHERE type != 'd' AND markdown LIKE '%((%'
			`;

			const refCountRows = await sql(refCountSql);
			if (refCountRows && refCountRows.length > 0) {
				const row = refCountRows[0];
				docStats.refDocs = row.ref_doc_count || 0;
				docStats.totalRefs = row.total_ref_count || 0;
				refStats.value.refDocCount = row.ref_doc_count || 0;
				refStats.value.totalRefCount = row.total_ref_count || 0;
			}

			// 被引用最多的文档
			const topRefSql = `
				SELECT r.root_id as doc_id, b.content as doc_title, r.ref_count
				FROM (
					SELECT root_id, COUNT(*) as ref_count
					FROM blocks
					WHERE type != 'd' AND markdown LIKE '%((%'
					GROUP BY root_id
					ORDER BY ref_count DESC
					LIMIT 20
				) r
				JOIN blocks b ON b.id = r.root_id AND b.type = 'd'
				${notebookCondition ? `WHERE b.box = '${filterOptions.notebookId}'` : ""}
				ORDER BY r.ref_count DESC
			`;

			const topRefRows = await sql(topRefSql);
			if (topRefRows && topRefRows.length > 0) {
				refStats.value.topRefDocs = topRefRows.map((r: any) => ({
					docId: r.doc_id,
					title: r.doc_title || "无标题",
					refCount: r.ref_count || 0,
				}));
			}
		} catch (error) {
			console.error("引用分析失败:", error);
		}
	}

	/**
	 * 图片/资源使用分析
	 * 思源中图片是内联元素，通过 markdown 字段中包含 ![ 来识别
	 */
	async function analyzeImages(notebookCondition: string) {
		try {
			// 图片统计概览
			const imgCountSql = `
				SELECT
					COUNT(DISTINCT root_id) as image_doc_count,
					COUNT(*) as total_image_count
				FROM blocks
				WHERE type != 'd' AND markdown LIKE '%![%'
			`;

			const imgCountRows = await sql(imgCountSql);
			if (imgCountRows && imgCountRows.length > 0) {
				const row = imgCountRows[0];
				docStats.imageDocs = row.image_doc_count || 0;
				docStats.totalImages = row.total_image_count || 0;
				imageStats.value.imageDocCount = row.image_doc_count || 0;
				imageStats.value.totalImageCount = row.total_image_count || 0;
			}

			// 包含图片最多的文档
			const topImgSql = `
				SELECT img.root_id as doc_id, b.content as doc_title, img.image_count
				FROM (
					SELECT root_id, COUNT(*) as image_count
					FROM blocks
					WHERE type != 'd' AND markdown LIKE '%![%'
					GROUP BY root_id
					ORDER BY image_count DESC
					LIMIT 20
				) img
				JOIN blocks b ON b.id = img.root_id AND b.type = 'd'
				${notebookCondition ? `WHERE b.box = '${filterOptions.notebookId}'` : ""}
				ORDER BY img.image_count DESC
			`;

			const topImgRows = await sql(topImgSql);
			if (topImgRows && topImgRows.length > 0) {
				imageStats.value.topImageDocs = topImgRows.map((r: any) => ({
					docId: r.doc_id,
					title: r.doc_title || "无标题",
					imageCount: r.image_count || 0,
				}));
			}
		} catch (error) {
			console.error("图片分析失败:", error);
		}
	}

	/**
	 * 点击统计卡片 - 按类别查询文档列表
	 */
	async function queryByStatsCategory(category: string) {
		if (statsFilter.value === category) {
			statsFilter.value = "";
			queryState.hasQueried = false;
			queryState.results = [];
			queryState.status = "idle";
			return;
		}
		statsFilter.value = category;

		// 重名类别走独立查询逻辑
		if (category === "duplicate") {
			await fetchDuplicateDocs();
			return;
		}

		// 大小类别 - 使用通用查询（需要 size 子查询）
		const sizeConditions: Record<string, string> = {
			"0B": "AND COALESCE(sw.total_size, 0) = 0",
			small: "AND COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024",
			medium: "AND COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240",
		};

		if (sizeConditions[category]) {
			await fetchDocList(sizeConditions[category]);
			return;
		}

		// 新类别（时间/深度/引用/图片）使用轻量查询
		queryState.status = "loading";
		queryState.errorMessage = "";
		queryState.hasQueried = true;

		try {
			const notebookCondition = buildNotebookCondition();

			// 根据类别确定额外条件、JOIN 和排序
			let extraWhere = "";
			let extraJoin = "";
			let refCol = "0 as ref_count";
			let imgCol = "0 as image_count";
			let orderBy = "b.updated DESC";

			switch (category) {
				case "7days":
					extraWhere = `AND b.updated >= '${daysAgoStr(7)}'`;
					break;
				case "30days":
					extraWhere = `AND b.updated >= '${daysAgoStr(30)}' AND b.updated < '${daysAgoStr(7)}'`;
					break;
				case "halfYear":
					extraWhere = `AND b.updated < '${daysAgoStr(180)}'`;
					break;
				case "deep":
					extraWhere = "AND LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 >= 5";
					orderBy = "doc_depth DESC";
					break;
				case "hasRef":
					extraJoin = `INNER JOIN (${REF_SUBQUERY}) r ON b.id = r.root_id`;
					refCol = "COALESCE(r.ref_count, 0) as ref_count";
					orderBy = "r.ref_count DESC";
					break;
				case "hasImage":
					extraJoin = `INNER JOIN (${IMAGE_SUBQUERY}) img ON b.id = img.root_id`;
					imgCol = "COALESCE(img.image_count, 0) as image_count";
					orderBy = "img.image_count DESC";
					break;
				default:
					queryState.status = "empty";
					return;
			}

			const sqlStmt = `
				SELECT
					b.id as doc_id,
					b.content as doc_title,
					b.hpath as doc_path,
					b.box as notebook_id,
					b.updated as doc_updated,
					b.created as doc_created,
					COALESCE(sw.total_size, 0) as content_size,
					COALESCE(sw.total_word_count, 0) as word_count,
					LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
					${refCol},
					${imgCol}
				FROM blocks b
				LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
				${extraJoin}
				WHERE b.type = 'd' ${notebookCondition}
				${extraWhere}
				ORDER BY ${orderBy}
				LIMIT 2000
			`;

			const rows = await sql(sqlStmt);

			if (!rows || rows.length === 0) {
				queryState.results = [];
				queryState.status = "empty";
				return;
			}

			const docs = mapRowsToDocs(rows);
			queryState.results = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder);
			queryState.status = "success";
		} catch (error) {
			console.error("按类别查询文档失败:", error);
			queryState.errorMessage = (error as Error).message || "查询失败";
			queryState.status = "error";
			queryState.results = [];
		}
	}

	/**
	 * 查询重名文档列表
	 */
	async function fetchDuplicateDocs() {
		queryState.status = "loading";
		queryState.errorMessage = "";
		queryState.hasQueried = true;

		try {
			const notebookCondition = buildNotebookCondition();

			const dupTitles = duplicateGroups.value.map((g) => g.title);
			if (dupTitles.length === 0) {
				queryState.results = [];
				queryState.status = "empty";
				return;
			}

			const titleList = dupTitles.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");

			const sqlStmt = `
				SELECT 
					b.id as doc_id,
					b.content as doc_title,
					b.hpath as doc_path,
					b.box as notebook_id,
					b.updated as doc_updated,
					b.created as doc_created,
					COALESCE(sw.total_size, 0) as content_size,
					COALESCE(sw.total_word_count, 0) as word_count,
					LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth
				FROM blocks b
				LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
				WHERE b.type = 'd' ${notebookCondition}
				AND b.content IN (${titleList})
				ORDER BY b.content ASC, content_size ASC
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
			console.error("查询重名文档失败:", error);
			queryState.errorMessage = (error as Error).message || "查询失败";
			queryState.status = "error";
			queryState.results = [];
		}
	}

	/**
	 * 执行查询 - 按字数和关键词过滤文档列表
	 */
	async function queryDocs() {
		queryState.status = "loading";
		queryState.errorMessage = "";
		queryState.hasQueried = true;

		try {
			const notebookCondition = buildNotebookCondition();
			const needWordCountFilter = filterOptions.wordCountMin > 0 || filterOptions.wordCountMax > 0;
			let conditions = "";

			if (filterOptions.titleKeyword.trim()) {
				const keyword = filterOptions.titleKeyword.trim().replace(/'/g, "''");
				conditions += `AND b.content LIKE '%${keyword}%' `;
			}

			// 全文内容搜索：查找内容块中包含关键词的文档
			if (filterOptions.contentKeyword.trim()) {
				const keyword = filterOptions.contentKeyword.trim().replace(/'/g, "''");
				conditions += `AND b.id IN (
					SELECT DISTINCT root_id FROM blocks 
					WHERE content LIKE '%${keyword}%' AND type != 'd'
				) `;
			}

			if (needWordCountFilter) {
				// 需要字数过滤时才 JOIN 子查询
				if (filterOptions.wordCountMin > 0) {
					conditions += `AND COALESCE(sw.total_word_count, 0) >= ${filterOptions.wordCountMin} `;
				}
				if (filterOptions.wordCountMax > 0) {
					conditions += `AND COALESCE(sw.total_word_count, 0) <= ${filterOptions.wordCountMax} `;
				}

				const sqlStmt = `
					SELECT 
						b.id as doc_id,
						b.content as doc_title,
						b.hpath as doc_path,
						b.box as notebook_id,
						b.updated as doc_updated,
						b.created as doc_created,
						COALESCE(sw.total_size, 0) as content_size,
						COALESCE(sw.total_word_count, 0) as word_count,
						LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth
					FROM blocks b
					LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
					WHERE b.type = 'd' ${notebookCondition}
					${conditions}
					ORDER BY word_count ASC
					LIMIT 2000
				`;

				const rows = await sql(sqlStmt);
				if (!rows || rows.length === 0) {
					queryState.results = [];
					queryState.status = "empty";
				} else {
					const docs = mapRowsToDocs(rows);
					queryState.results = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder);
					queryState.status = "success";
				}
			} else {
				// 不需要字数过滤时，轻量查询（不 JOIN 子查询）
				const sqlStmt = `
					SELECT 
						b.id as doc_id,
						b.content as doc_title,
						b.hpath as doc_path,
						b.box as notebook_id,
						b.updated as doc_updated,
						b.created as doc_created,
						0 as content_size,
						0 as word_count,
						LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth
					FROM blocks b
					WHERE b.type = 'd' ${notebookCondition}
					${conditions}
					ORDER BY b.content ASC
					LIMIT 2000
				`;

				const rows = await sql(sqlStmt);
				if (!rows || rows.length === 0) {
					queryState.results = [];
					queryState.status = "empty";
				} else {
					const docs = mapRowsToDocs(rows);
					queryState.results = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder);
					queryState.status = "success";
				}
			}
		} catch (error) {
			console.error("查询文档列表失败:", error);
			queryState.errorMessage = (error as Error).message || "查询失败";
			queryState.status = "error";
			queryState.results = [];
		}

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
				case "updated":
					compare = (a.updated || "").localeCompare(b.updated || "");
					break;
				case "depth":
					compare = (a.depth || 0) - (b.depth || 0);
					break;
				case "refCount":
					compare = (a.refCount || 0) - (b.refCount || 0);
					break;
				case "imageCount":
					compare = (a.imageCount || 0) - (b.imageCount || 0);
					break;
				default:
					compare = a.wordCount - b.wordCount;
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

	return {
		notebooks,
		queryState,
		filterOptions,
		docStats,
		depthStats,
		statsLoading,
		hasAnalyzed,
		statsFilter,
		loadNotebooks,
		loadSavedOptions,
		queryDocs,
		analyzeDocStats,
		queryByStatsCategory,
		openDoc,
		updateSort,
		saveOptions,
	};
}
