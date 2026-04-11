/**
 * 目录索引插件 - 类型定义和注册函数
 * 参考: https://github.com/TinkMingKing/siyuan-plugins-index
 */
import { Plugin } from "siyuan";
import { showMessage } from "siyuan";
import * as api from "@/api";
import {
	getCurrentBlockId,
	getDocIdByBlockId,
	getCurrentDocId,
	escapeSqlString,
	findExistingIndexBlock,
} from "../utils/helpers";

/**
 * 索引类型枚举
 */
export type IndexType = "index" | "subdocs-ref" | "subdocs-outline";

/**
 * 目录索引功能管理类
 */
export class TableOfContentsManager {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	/**
	 * 初始化功能
	 */
	public init() {
		this.registerCommands();
	}

	/**
	 * 注册快捷键命令
	 */
	private registerCommands() {
		// CTRL + ALT + I: 插入索引（当前文档的子文档列表）
		this.plugin.addCommand({
			langKey: "insertIndex",
			hotkey: "⌃⌥I",
			callback: () => {
				this.insertIndex();
			},
		});

		// CTRL + ALT + O: 插入子文档及其大纲
		this.plugin.addCommand({
			langKey: "insertSubDocsWithOutline",
			hotkey: "⌃⌥O",
			callback: () => {
				this.insertSubDocsWithOutline();
			},
		});

		// CTRL + ALT + R: 插入子文档引用列表
		this.plugin.addCommand({
			langKey: "insertSubDocsRef",
			hotkey: "⌃⌥R",
			callback: () => {
				this.insertSubDocsRef();
			},
		});
	}

	/**
	 * 插入内容到当前光标位置
	 * @param content 要插入的内容
	 * @param indexType 索引类型标识,用于区分不同类型的索引
	 */
	private async insertContent(content: string, indexType: IndexType) {
		try {
			// 获取当前光标所在的块ID
			const currentBlockId = getCurrentBlockId();

			if (!currentBlockId) {
				showMessage("请先将光标放在文档中的某个块上", 3000, "error");
				return;
			}

			// 通过块ID获取文档ID,确保在同一文档内操作
			const docId = await getDocIdByBlockId(currentBlockId);
			if (!docId) {
				showMessage("无法获取当前文档信息", 3000, "error");
				return;
			}

			// 查找整个文档中是否存在同类型的索引块
			const existingIndexBlock = await findExistingIndexBlock(docId, indexType);

			if (existingIndexBlock) {
				// 获取已存在块的内容
				const existingContent = await api.getBlockKramdown(
					existingIndexBlock.id,
				);
				const existingMarkdown = existingContent?.kramdown || "";

				// 规范化内容进行比较(统一换行符,去除首尾空白)
				const normalizedExisting = existingMarkdown
					.replace(/\r\n/g, "\n")
					.trim();
				const normalizedNew = content.replace(/\r\n/g, "\n").trim();

				if (normalizedExisting === normalizedNew) {
					showMessage("内容无变化,无需更新", 2000, "info");
					return;
				}

				// 内容有变化,更新块
				await api.updateBlock("markdown", content, existingIndexBlock.id);
				showMessage("索引已更新", 2000, "info");
			} else {
				// 不存在索引块,插入新内容到当前块之后
				const result = await api.insertBlock(
					"markdown",
					content,
					undefined,
					currentBlockId,
					undefined,
				);

				// 为新插入的块添加自定义属性标记
				if (result && result.length > 0 && result[0].doOperations) {
					const newBlockId = result[0].doOperations[0]?.id;
					if (newBlockId) {
						await api.setBlockAttrs(newBlockId, {
							"custom-toc-type": indexType,
							"custom-toc-generated": "true",
						});
					}
				}

				showMessage(this.plugin.i18n.insertSuccess, 2000, "info");
			}
		} catch (error) {
			console.error("插入内容失败:", error);
			const errorMsg = error?.message || String(error);
			showMessage(this.plugin.i18n.insertFailed + errorMsg, 3000, "error");
		}
	}

	/**
	 * 1. 插入索引(当前文档的子文档列表)
	 * CTRL + ALT + I
	 */
	private async insertIndex() {
		try {
			const docId = await getCurrentDocId();
			if (!docId) {
				showMessage(this.plugin.i18n.noActiveDocument, 3000, "error");
				return;
			}

			// 获取当前文档信息
			const currentDoc = await api.getBlockByID(docId);
			if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
				showMessage("无法获取当前文档信息", 3000, "error");
				return;
			}

			// 使用hpath查询子文档(人类可读路径)
			const subDocs = await api.sql(`
        SELECT id, content, hpath
        FROM blocks
        WHERE box = '${escapeSqlString(currentDoc.box)}'
        AND type = 'd'
        AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
        AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
        ORDER BY hpath ASC
      `);

			if (!subDocs || subDocs.length === 0) {
				showMessage(this.plugin.i18n.noSubDocuments, 3000, "info");
				return;
			}

			// 生成索引内容
			let indexContent = "## 📑 子文档索引\n\n";

			for (let i = 0; i < subDocs.length; i++) {
				const subDoc = subDocs[i];
				const docName = subDoc.content.replace(/<[^>]*>/g, "");
				const index = String(i + 1).padStart(2, "0");
				indexContent += `${index}. [${docName}](siyuan://blocks/${subDoc.id})\n`;
			}

			await this.insertContent(indexContent, "index");
		} catch (error) {
			console.error("插入索引失败:", error);
			const errorMsg = error?.message || String(error);
			showMessage(this.plugin.i18n.insertFailed + errorMsg, 3000, "error");
		}
	}

	/**
	 * 2. 插入子文档引用列表
	 * CTRL + ALT + R
	 */
	private async insertSubDocsRef() {
		try {
			const docId = await getCurrentDocId();
			if (!docId) {
				showMessage(this.plugin.i18n.noActiveDocument, 3000, "error");
				return;
			}

			// 获取当前文档信息
			const currentDoc = await api.getBlockByID(docId);
			if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
				showMessage("无法获取当前文档信息", 3000, "error");
				return;
			}

			// 使用hpath查询子文档(人类可读路径)
			const subDocs = await api.sql(`
        SELECT id, content, hpath
        FROM blocks
        WHERE box = '${escapeSqlString(currentDoc.box)}'
        AND type = 'd'
        AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
        AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
        ORDER BY hpath ASC
      `);

			if (!subDocs || subDocs.length === 0) {
				showMessage(this.plugin.i18n.noSubDocuments, 3000, "info");
				return;
			}

			// 生成引用内容
			let refContent = "## 🔗 子文档引用\n\n";

			for (let i = 0; i < subDocs.length; i++) {
				const subDoc = subDocs[i];
				// 使用引用块语法 ((id "锚文本"))
				const docName = subDoc.content.replace(/<[^>]*>/g, "");
				const index = String(i + 1).padStart(2, "0");
				refContent += `${index}. ((${subDoc.id} "${docName}"))\n`;
			}

			await this.insertContent(refContent, "subdocs-ref");
		} catch (error) {
			console.error("插入子文档引用失败:", error);
			const errorMsg = error?.message || String(error);
			showMessage(this.plugin.i18n.insertFailed + errorMsg, 3000, "error");
		}
	}

	/**
	 * 3. 插入子文档及其大纲（使用引用块）
	 * CTRL + ALT + O
	 */
	private async insertSubDocsWithOutline() {
		try {
			const docId = await getCurrentDocId();
			if (!docId) {
				showMessage(this.plugin.i18n.noActiveDocument, 3000, "error");
				return;
			}

			// 获取当前文档信息
			const currentDoc = await api.getBlockByID(docId);
			if (!currentDoc || !currentDoc.box || !currentDoc.hpath) {
				showMessage("无法获取当前文档信息", 3000, "error");
				return;
			}

			// 使用hpath查询直接子文档
			const subDocs = await api.sql(`
        SELECT id, content, hpath
        FROM blocks
        WHERE box = '${escapeSqlString(currentDoc.box)}'
        AND type = 'd'
        AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
        AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
        ORDER BY hpath ASC
      `);

			if (!subDocs || subDocs.length === 0) {
				showMessage(this.plugin.i18n.noSubDocuments, 3000, "info");
				return;
			}

			// 生成内容
			let content = "## 📋 子文档大纲\n\n";

			// 优化：一次性查询所有子文档的标题，避免 N+1 查询问题
			const subDocIds = subDocs
				.map((d) => `'${escapeSqlString(d.id)}'`)
				.join(",");
			const allHeadings = await api.sql(`
        SELECT id, root_id, content, subtype, sort
        FROM blocks
        WHERE root_id IN (${subDocIds})
        AND type = 'h'
        ORDER BY root_id, sort ASC
      `);

			// 按文档ID分组标题
			const headingMap = new Map<string, any[]>();
			for (const h of allHeadings || []) {
				if (!headingMap.has(h.root_id)) {
					headingMap.set(h.root_id, []);
				}
				headingMap.get(h.root_id)!.push(h);
			}

			for (let i = 0; i < subDocs.length; i++) {
				const subDoc = subDocs[i];
				const docName = subDoc.content.replace(/<[^>]*>/g, "");

				// 使用引用块语法，添加图标美化
				content += `### 📄 ((${subDoc.id} "${docName}"))\n\n`;

				// 从预查询结果中获取该子文档的标题
				const headings = headingMap.get(subDoc.id);

				if (headings && headings.length > 0) {
					for (const heading of headings) {
						const level = parseInt(heading.subtype.replace("h", ""));
						const indent = "  ".repeat(level - 1);
						const headingContent = heading.content.replace(/<[^>]*>/g, "");
						// 标题使用引用块语法，保持原有的列表符号
						content += `${indent}- ((${heading.id} "${headingContent}"))\n`;
					}
					content += "\n";
				}
			}

			await this.insertContent(content, "subdocs-outline");
		} catch (error) {
			console.error("插入子文档及大纲失败:", error);
			const errorMsg = error?.message || String(error);
			showMessage(this.plugin.i18n.insertFailed + errorMsg, 3000, "error");
		}
	}

	/**
	 * 销毁功能
	 */
	public destroy() {
		// 清理逻辑（如需要）
	}
}

/**
 * 注册目录索引插件功能
 */
export function registerTableOfContents(plugin: Plugin) {
	const manager = new TableOfContentsManager(plugin);
	manager.init();
	(plugin as any).__tableOfContents = manager;
	return manager;
}
