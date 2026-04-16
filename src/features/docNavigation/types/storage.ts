import type {
	Block,
	DocHierarchyCacheItem,
	DocHierarchy,
	BreadcrumbItem,
	BreadcrumbCacheItem,
	SiblingDocs,
	SiblingCacheItem,
} from "./index";
import { DEFAULT_OPTIONS } from "./index";
import * as api from "@/api";

/** 文档路径信息，由 getPathByID 返回 */
export interface DocPathInfo {
	notebook: string;
	path: string;
}

export class DocNavigationCache {
	private hierarchyCache = new Map<string, DocHierarchyCacheItem>();
	private breadcrumbCache = new Map<string, BreadcrumbCacheItem>();
	private siblingCache = new Map<string, SiblingCacheItem>();
	private htmlCache = new Map<string, string>();
	private maxCacheSize: number;
	private cacheTTL: number;

	constructor(
		maxCacheSize = DEFAULT_OPTIONS.maxCacheSize,
		cacheTTL = DEFAULT_OPTIONS.cacheTTL,
	) {
		this.maxCacheSize = maxCacheSize;
		this.cacheTTL = cacheTTL;
	}

	stripHtml(html: string): string {
		let text = this.htmlCache.get(html);
		if (!text) {
			text = html.replace(/<[^>]*>/g, "");
			if (this.htmlCache.size > 100) this.htmlCache.clear();
			this.htmlCache.set(html, text);
		}
		return text;
	}

	private getCacheKey(box: string, docId: string): string {
		return `${box}:${docId}`;
	}

	getHierarchyCacheKey(box: string, docId: string): string {
		return this.getCacheKey(box, docId);
	}

	getCachedHierarchy(box: string, docId: string): DocHierarchyCacheItem | null {
		const cacheKey = this.getCacheKey(box, docId);
		const cached = this.hierarchyCache.get(cacheKey);
		const now = Date.now();

		if (cached && now - cached.timestamp < this.cacheTTL) {
			this.hierarchyCache.delete(cacheKey);
			this.hierarchyCache.set(cacheKey, cached);
			return cached;
		}

		return null;
	}

	setCachedHierarchy(
		box: string,
		docId: string,
		hierarchy: DocHierarchy,
	): void {
		const cacheKey = this.getCacheKey(box, docId);
		const now = Date.now();

		this.hierarchyCache.set(cacheKey, {
			parent: hierarchy.parent,
			children: hierarchy.children,
			timestamp: now,
		});

		if (this.hierarchyCache.size > this.maxCacheSize) {
			const firstKey = this.hierarchyCache.keys().next().value;
			firstKey && this.hierarchyCache.delete(firstKey);
		}
	}

	getCachedBreadcrumb(box: string, docId: string): BreadcrumbCacheItem | null {
		const cacheKey = this.getCacheKey(box, docId);
		const cached = this.breadcrumbCache.get(cacheKey);
		const now = Date.now();

		if (cached && now - cached.timestamp < this.cacheTTL) {
			this.breadcrumbCache.delete(cacheKey);
			this.breadcrumbCache.set(cacheKey, cached);
			return cached;
		}

		return null;
	}

	setCachedBreadcrumb(
		box: string,
		docId: string,
		items: BreadcrumbItem[],
	): void {
		const cacheKey = this.getCacheKey(box, docId);
		const now = Date.now();

		this.breadcrumbCache.set(cacheKey, {
			items,
			timestamp: now,
		});

		if (this.breadcrumbCache.size > this.maxCacheSize) {
			const firstKey = this.breadcrumbCache.keys().next().value;
			firstKey && this.breadcrumbCache.delete(firstKey);
		}
	}

	getCachedSibling(box: string, docId: string): SiblingCacheItem | null {
		const cacheKey = this.getCacheKey(box, docId);
		const cached = this.siblingCache.get(cacheKey);
		const now = Date.now();

		if (cached && now - cached.timestamp < this.cacheTTL) {
			this.siblingCache.delete(cacheKey);
			this.siblingCache.set(cacheKey, cached);
			return cached;
		}

		return null;
	}

	setCachedSibling(
		box: string,
		docId: string,
		siblings: Block[],
		currentIndex: number,
	): void {
		const cacheKey = this.getCacheKey(box, docId);
		const now = Date.now();

		this.siblingCache.set(cacheKey, {
			siblings,
			currentIndex,
			timestamp: now,
		});

		if (this.siblingCache.size > this.maxCacheSize) {
			const firstKey = this.siblingCache.keys().next().value;
			firstKey && this.siblingCache.delete(firstKey);
		}
	}

	clearAll(): void {
		this.hierarchyCache.clear();
		this.breadcrumbCache.clear();
		this.siblingCache.clear();
		this.htmlCache.clear();
	}
}

/**
 * 去除 .sy 后缀（思源物理路径/文件名格式）
 */
function stripSySuffix(str: string): string {
	return str.replace(/\.sy$/i, "");
}

/**
 * 将 IFile 转换为 Block 格式
 */
function iFileToBlock(file: api.IFile): Block {
	return {
		id: file.id,
		content: stripSySuffix(file.name),
		hpath: stripSySuffix(file.path),
	};
}

/**
 * 获取文档层级（父文档 + 子文档）
 * 使用 listDocsByPath 官方 API 替代 SQL 查询
 */
export async function fetchDocHierarchy(
	currentDoc: Block,
	cache: DocNavigationCache,
	pathInfo: DocPathInfo,
): Promise<DocHierarchy> {
	try {
		if (!currentDoc.box) {
			return { parent: null, children: [] };
		}

		const cached = cache.getCachedHierarchy(currentDoc.box, currentDoc.id);
		if (cached) {
			return { parent: cached.parent, children: cached.children };
		}

		// 并行获取子文档和父文档
		const childDocsPromise = api.listDocsByPath(
			pathInfo.notebook,
			pathInfo.path,
			0,
		);

		// 计算父文档物理路径
		// 当前文档路径如 "/20210808180117-czj9bvb/20220808180117-abc123"
		// 父目录路径如 "/20210808180117-czj9bvb"
		// 祖父目录路径如 "/"
		const parentDirPath = pathInfo.path.substring(
			0,
			pathInfo.path.lastIndexOf("/"),
		) || "/";

		// 判断是否有父文档（路径层数 > 1 才有父文档）
		// 路径 "/20210808180117-czj9bvb" 是根级文档，无父文档
		// 路径 "/20210808180117-czj9bvb/20220808180117-abc123" 有父文档
		const pathParts = pathInfo.path.split("/").filter(Boolean);
		const hasParent = pathParts.length > 1;
		// listDocsByPath 返回的是指定路径下的直接子文档
		// 要找到父文档，需要在祖父目录下查找 path === parentDirPath 的文档
		const grandParentDirPath = parentDirPath === "/"
			? "/"
			: parentDirPath.substring(0, parentDirPath.lastIndexOf("/")) || "/";

		const parentDocsPromise = hasParent
			? api.listDocsByPath(pathInfo.notebook, grandParentDirPath, 0)
			: Promise.resolve(null);

		const [childDocsResult, parentDocsResult] = await Promise.all([
			childDocsPromise,
			parentDocsPromise,
		]);

		// 从祖父目录的子文档列表中找到父文档
		let parent: Block | null = null;
		if (parentDocsResult?.files) {
			const parentFile = parentDocsResult.files.find(
				(f) => stripSySuffix(f.path) === parentDirPath,
			);
			if (parentFile) {
				parent = iFileToBlock(parentFile);
			}
		}

		// 获取子文档列表
		const children: Block[] = (childDocsResult?.files || []).map(iFileToBlock);

		cache.setCachedHierarchy(currentDoc.box, currentDoc.id, {
			parent,
			children,
		});

		return { parent, children };
	} catch (error) {
		console.error("获取文档层级失败:", error);
		return { parent: null, children: [] };
	}
}

/**
 * 获取面包屑导航
 * 使用 listDocsByPath 官方 API 替代 SQL 查询
 *
 * 优化策略：利用路径层级特点，先从根目录逐级获取，
 * 每个 listDocsByPath 结果会命中兄弟文档的缓存，减少后续请求
 */
export async function fetchBreadcrumb(
	currentDoc: Block,
	cache: DocNavigationCache,
	pathInfo: DocPathInfo,
): Promise<BreadcrumbItem[]> {
	try {
		if (!currentDoc.box) {
			return [];
		}

		const cached = cache.getCachedBreadcrumb(currentDoc.box, currentDoc.id);
		if (cached) {
			return cached.items;
		}

		// 拆解物理路径，逐级构建父路径
		// 路径格式如 "/20210808180117-czj9bvb/20220808180117-abc123"
		const pathParts = pathInfo.path.split("/").filter(Boolean);
		if (pathParts.length <= 1) {
			// 根级文档无面包屑
			return [];
		}

		// 构建每一级文档的完整路径
		const ancestorPaths: string[] = [];
		let accumulated = "";
		for (let i = 0; i < pathParts.length - 1; i++) {
			accumulated += "/" + pathParts[i];
			ancestorPaths.push(accumulated);
		}

		// 对每个祖先路径，获取其所在目录的文档列表
		// 相邻层级的 listDocsByPath 可以复用缓存
		const items: BreadcrumbItem[] = [];
		for (const ancestorPath of ancestorPaths) {
			const parentDir =
				ancestorPath.substring(0, ancestorPath.lastIndexOf("/")) || "/";

			const result = await api.listDocsByPath(
				pathInfo.notebook,
				parentDir,
				0,
			);

			if (result?.files) {
				const targetFile = result.files.find(
					(f) => stripSySuffix(f.path) === ancestorPath,
				);
				if (targetFile) {
					items.push({
						id: targetFile.id,
						content: stripSySuffix(targetFile.name),
						hpath: ancestorPath,
					});
				}
			}
		}

		cache.setCachedBreadcrumb(currentDoc.box, currentDoc.id, items);

		return items;
	} catch (error) {
		console.error("获取面包屑导航失败:", error);
		return [];
	}
}

/**
 * 获取同级文档
 * 使用 listDocsByPath 官方 API 替代 SQL 查询
 */
export async function fetchSiblingDocs(
	currentDoc: Block,
	cache: DocNavigationCache,
	pathInfo: DocPathInfo,
): Promise<SiblingDocs> {
	try {
		if (!currentDoc.box) {
			return { prev: null, next: null, siblings: [], currentIndex: -1 };
		}

		const cached = cache.getCachedSibling(currentDoc.box, currentDoc.id);
		if (cached) {
			const siblings = cached.siblings;
			const currentIndex = cached.currentIndex;
			return {
				prev: currentIndex > 0 ? siblings[currentIndex - 1] : null,
				next:
					currentIndex < siblings.length - 1
						? siblings[currentIndex + 1]
						: null,
				siblings,
				currentIndex,
			};
		}

		// 计算父路径
		// 当前文档路径如 "/20210808180117-czj9bvb/20220808180117-abc123"
		// 父目录路径如 "/20210808180117-czj9bvb"
		const parentDirPath =
			pathInfo.path.substring(0, pathInfo.path.lastIndexOf("/")) || "/";

		// 根级文档（path 本身就是 "/"）无同级
		if (pathInfo.path === "/") {
			return { prev: null, next: null, siblings: [], currentIndex: -1 };
		}

		// 获取父路径下的所有文档
		const result = await api.listDocsByPath(
			pathInfo.notebook,
			parentDirPath,
			0,
		);

		const siblings: Block[] = (result?.files || []).map(iFileToBlock);
		const currentIndex = siblings.findIndex((s) => s.id === currentDoc.id);

		cache.setCachedSibling(
			currentDoc.box,
			currentDoc.id,
			siblings,
			currentIndex,
		);

		return {
			prev: currentIndex > 0 ? siblings[currentIndex - 1] : null,
			next:
				currentIndex < siblings.length - 1
					? siblings[currentIndex + 1]
					: null,
			siblings,
			currentIndex,
		};
	} catch (error) {
		console.error("获取同级文档失败:", error);
		return { prev: null, next: null, siblings: [], currentIndex: -1 };
	}
}
