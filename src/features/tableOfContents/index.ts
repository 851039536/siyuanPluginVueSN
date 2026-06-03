/**
 * 目录索引功能模块
 * 参考: https://github.com/TinkMingKing/siyuan-plugins-index
 */
import type { Plugin } from "siyuan"
import type {
  IndexType,
  SubDocInfo,
} from "./types"
import { showMessage } from "siyuan"
import * as api from "@/api"
import {
  escapeSqlString,
  findExistingIndexBlockIds,
  getCurrentContext,
} from "./utils/helpers"

// 模块级引用，避免 (plugin as any) 绕过类型系统
let _manager: TableOfContentsManager | null = null

export function getTableOfContentsManager(): TableOfContentsManager | null {
  return _manager
}

/** 去除 .sy 后缀 */
function stripSySuffix(str: string): string {
  return str.replace(/\.sy$/i, "")
}

/** 从 error 中提取消息字符串 */
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? "")
}

/**
 * 目录索引功能管理类
 */
export class TableOfContentsManager {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /** 初始化：注册快捷键命令 */
  init() {
    this.plugin.addCommand({
      langKey: "insertIndex",
      hotkey: "⌃⌥I",
      callback: () => this.insertIndex(),
    })
    this.plugin.addCommand({
      langKey: "insertSubDocsWithOutline",
      hotkey: "⌃⌥O",
      callback: () => this.insertSubDocsWithOutline(),
    })
    this.plugin.addCommand({
      langKey: "insertSubDocsRef",
      hotkey: "⌃⌥R",
      callback: () => this.insertSubDocsRef(),
    })
  }

  /**
   * 插入内容到当前光标位置。
   * 先删除文档中同类型的旧索引块（全部），再重新插入，确保永不累加。
   * 变更检测通过块属性 custom-toc-ids 做指纹对比（不依赖易出错的 getBlockKramdown）。
   */
  private async insertContent(
    content: string,
    indexType: IndexType,
    docId: string,
    currentBlockId: string,
    subDocCount: number,
  ) {
    try {
      const oldIds = await findExistingIndexBlockIds(docId, indexType)

      if (oldIds.length > 0) {
        // outline 含可变标题数不精确 —— 但用 custom-toc-ids 指纹 + 块数量辅助判断
        let unchanged = false
        if (indexType !== "subdocs-outline") {
          // index / subdocs-ref: 标题行 + 空行 + N 条条目 = N+2 个块
          if (oldIds.length === subDocCount + 2) {
            // 读取首块属性中的指纹比较，替代 getBlockMarkdown（可能对某些块返回空）
            const attrs = await api.getBlockAttrs(oldIds[0])
            unchanged = attrs?.["custom-toc-ids"] === content
          }
        }

        if (unchanged) {
          showMessage("内容无变化,无需更新", 2000, "info")
          return
        }

        await Promise.allSettled(oldIds.map((id) => api.deleteBlock(id)))
      }

      // 插入新内容
      const result = await api.insertBlock(
        "markdown",
        content,
        undefined,
        currentBlockId,
        undefined,
      )

      if (result?.length) {
        const newIds = result.flatMap((r) =>
          (r.doOperations || [])
            .map((op: any) => op.id)
            .filter(Boolean),
        )

        // 给每个新块打上标记
        await Promise.allSettled(newIds.map((id) =>
          api.setBlockAttrs(id, {
            "custom-toc-type": indexType,
            "custom-toc-generated": "true",
          }),
        ))

        // 首块额外存内容指纹，供后续 getBlockAttrs 变更检测
        if (newIds.length > 0) {
          await api.setBlockAttrs(newIds[0], { "custom-toc-ids": content })
        }
      }

      showMessage(this.plugin.i18n.insertSuccess, 2000, "info")
    } catch (error) {
      console.error("插入内容失败:", error)
      showMessage(`${this.plugin.i18n.insertFailed}${getErrorMessage(error)}`, 3000, "error")
    }
  }

  /** 使用 listDocsByPath 获取当前文档的直接子文档（替代手写 SQL） */
  private async getSubDocs(docId: string): Promise<SubDocInfo[]> {
    try {
      const pathInfo = await api.getPathByID(docId)
      if (!pathInfo?.notebook || !pathInfo.path) return []

      const result = await api.listDocsByPath(pathInfo.notebook, pathInfo.path)
      return (result?.files || []).map((f) => ({
        id: f.id,
        name: stripSySuffix(f.name),
      }))
    } catch (error) {
      console.error("获取子文档失败:", error)
      return []
    }
  }

  /**
   * 公共入口：一次 DOM 查询 + 一次 SQL 查询获取当前上下文和子文档，
   * callback 接收 docId / blockId / subDocs，消除各方法间的重复解析。
   */
  private async resolveAndInsert(
    fn: (docId: string, blockId: string, subDocs: SubDocInfo[]) => Promise<void>,
  ) {
    try {
      const {
        docId,
        blockId,
      } = await getCurrentContext()
      if (!docId) {
        showMessage(this.plugin.i18n.noActiveDocument, 3000, "error")
        return
      }
      if (!blockId) {
        showMessage("请先将光标放在文档中的某个块上", 3000, "error")
        return
      }

      const subDocs = await this.getSubDocs(docId)
      if (!subDocs || subDocs.length === 0) {
        showMessage(this.plugin.i18n.noSubDocuments, 3000, "info")
        return
      }

      await fn(docId, blockId, subDocs)
    } catch (error) {
      console.error("插入索引失败:", error)
      showMessage(`${this.plugin.i18n.insertFailed}${getErrorMessage(error)}`, 3000, "error")
    }
  }

  /** 1. 插入索引（当前文档的子文档列表） CTRL+ALT+I */
  private async insertIndex() {
    await this.resolveAndInsert(async (docId, blockId, subDocs) => {
      let content = "## 📑 子文档索引\n\n"
      for (let i = 0; i < subDocs.length; i++) {
        const num = String(i + 1).padStart(2, "0")
        content += `${num}. [${subDocs[i].name}](siyuan://blocks/${subDocs[i].id})\n`
      }
      await this.insertContent(content, "index", docId, blockId, subDocs.length)
    })
  }

  /** 2. 插入子文档引用列表 CTRL+ALT+R */
  private async insertSubDocsRef() {
    await this.resolveAndInsert(async (docId, blockId, subDocs) => {
      let content = "## 🔗 子文档引用\n\n"
      for (let i = 0; i < subDocs.length; i++) {
        const num = String(i + 1).padStart(2, "0")
        content += `${num}. ((${subDocs[i].id} "${subDocs[i].name}"))\n`
      }
      await this.insertContent(content, "subdocs-ref", docId, blockId, subDocs.length)
    })
  }

  /** 3. 插入子文档及其大纲（使用引用块） CTRL+ALT+O */
  private async insertSubDocsWithOutline() {
    await this.resolveAndInsert(async (docId, blockId, subDocs) => {
      // 一次性查询所有子文档标题，避免 N+1 查询
      const subDocIds = subDocs.map((d) => `'${escapeSqlString(d.id)}'`).join(",")
      const allHeadings = await api.sql(`
        SELECT id, root_id, content, subtype, sort
        FROM blocks
        WHERE root_id IN (${subDocIds})
        AND type = 'h'
        ORDER BY root_id, sort ASC
      `)

      const headingMap = new Map<string, any[]>()
      for (const h of allHeadings || []) {
        if (!headingMap.has(h.root_id)) headingMap.set(h.root_id, [])
        headingMap.get(h.root_id)!.push(h)
      }

      let content = "## 📑 子文档大纲\n\n"
      for (const subDoc of subDocs) {
        content += `### 📄 ((${subDoc.id} "${subDoc.name}"))\n\n`

        const headings = headingMap.get(subDoc.id)
        if (headings?.length) {
          for (const heading of headings) {
            const level = Number.parseInt(heading.subtype.replace("h", ""))
            const indent = "  ".repeat(level - 1)
            const headingContent = heading.content.replace(/<[^>]*>/g, "")
            content += `${indent}- ((${heading.id} "${headingContent}"))\n`
          }
          content += "\n"
        }
      }

      await this.insertContent(content, "subdocs-outline", docId, blockId, subDocs.length)
    })
  }

  /** 销毁：清理命令注册 */
  destroy() {
    _manager = null
  }
}

/**
 * 注册目录索引插件功能
 */
export function registerTableOfContents(plugin: Plugin): TableOfContentsManager {
  if (_manager) _manager.destroy()
  _manager = new TableOfContentsManager(plugin)
  _manager.init()
  return _manager
}

