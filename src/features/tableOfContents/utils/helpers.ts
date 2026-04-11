/**
 * 目录索引工具函数
 */
import * as api from "@/api";

/**
 * 获取当前光标所在的块ID
 */
export function getCurrentBlockId(): string | null {
	// 方法1: 获取当前选中的块
	const selectedBlock = document.querySelector(".protyle-wysiwyg--select");
	if (selectedBlock) {
		return selectedBlock.getAttribute("data-node-id");
	}

	// 方法2: 获取光标所在的块（聚焦的块）
	const focusedBlock = document.querySelector(
		".protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus",
	);
	if (focusedBlock) {
		return focusedBlock.getAttribute("data-node-id");
	}

	// 方法3: 通过 window.getSelection() 精确获取光标位置
	const selection = window.getSelection();
	if (selection && selection.rangeCount > 0) {
		const range = selection.getRangeAt(0);
		let node: Node | null = range.startContainer;

		// 向上查找直到找到带有 data-node-id 和 data-type 的元素
		while (node) {
			if (node instanceof Element) {
				const nodeId = node.getAttribute("data-node-id");
				const dataType = node.getAttribute("data-type");

				// 必须同时有 data-node-id 和 data-type 才是有效的块
				if (nodeId && dataType) {
					return nodeId;
				}
			}
			node = node.parentNode;
		}
	}

	return null;
}

/**
 * 通过块ID获取其所属的文档ID
 */
export async function getDocIdByBlockId(
	blockId: string,
): Promise<string | null> {
	try {
		const block = await api.getBlockByID(blockId);
		return block?.root_id || null;
	} catch (error) {
		console.error("获取文档ID失败:", error);
		return null;
	}
}

/**
 * 获取当前激活的编辑器
 */
export function getActiveProtyle(): any {
	const activeTab = document.querySelector(
		".layout__wnd--active .protyle:not(.fn__none)",
	);
	return activeTab;
}

/**
 * 获取当前文档ID（优先使用光标所在文档，其次使用激活窗口）
 */
export async function getCurrentDocId(): Promise<string | null> {
	// 优先方案：通过光标所在的块获取文档ID
	const currentBlockId = getCurrentBlockId();
	if (currentBlockId) {
		const docId = await getDocIdByBlockId(currentBlockId);
		if (docId) {
			return docId;
		}
	}

	// 备用方案：使用激活窗口的文档
	const protyle = getActiveProtyle();
	const docId = protyle
		?.querySelector(".protyle-background")
		?.getAttribute("data-node-id");
	return docId || null;
}

/**
 * 转义SQL字符串,防止SQL注入
 */
export function escapeSqlString(str: string): string {
	if (!str) return "";
	// 转义单引号,防止SQL注入
	return str.replace(/'/g, "''");
}

/**
 * 查找整个文档中该类型的索引块
 * @param docId 文档ID
 * @param indexType 索引类型
 */
export async function findExistingIndexBlock(
	docId: string,
	indexType: string,
): Promise<any> {
	try {
		// 使用SQL直接查询带有自定义属性的块,避免循环调用API
		// 通过JOIN attributes表一次性查询,性能更优
		const blocks = await api.sql(`
      SELECT DISTINCT b.id, b.type
      FROM blocks b
      JOIN attributes a1 ON b.id = a1.block_id AND a1.name = 'custom-toc-type' AND a1.value = '${escapeSqlString(indexType)}'
      JOIN attributes a2 ON b.id = a2.block_id AND a2.name = 'custom-toc-generated' AND a2.value = 'true'
      WHERE b.root_id = '${escapeSqlString(docId)}'
      ORDER BY b.sort ASC
      LIMIT 1
    `);

		return blocks && blocks.length > 0 ? blocks[0] : null;
	} catch (error) {
		console.error("查找索引块失败:", error);
		return null;
	}
}
