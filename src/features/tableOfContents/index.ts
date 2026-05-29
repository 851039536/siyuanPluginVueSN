/**
 * 目录索引功能模块
 * 参考: https://github.com/TinkMingKing/siyuan-plugins-index
 */
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import * as api from "@/api"
import type { IndexType, SubDocInfo } from "./types"
import {
  escapeSqlString,
  findExistingIndexBlock,
  getCurrentBlockId,
  getCurrentDocId,
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
   * 插入内容到当前光标位置
   * @param content 要插入的内容
   * @param indexType 索引类型标识
   * @param docId 已解析的文档 ID（由调用方传入，避免重复查询）
   * @param currentBlockId 已解析的当前块 ID（由调用方传入）
   */
  private async insertContent(
    content: string,
    indexType: IndexType,
    docId: string | null,
    currentBlockId: string | null,
  ) {
    try {
      if (!currentBlockId) {
        showMessage("请先将光标放在文档中的某个块上", 3000, "error")
        return
      }

      if (!docId) {
        showMessage("无法获取当前文档信息", 3000, "error")
        return
      }

      // 查找文档中是否存在同类型的索引块
      const existingIndexBlock = await findExistingIndexBlock(docId, indexType)

      if (existingIndexBlock) {
        const existingMarkdown = await api.getBlockMarkdown(existingIndexBlock.id)

        if (existingMarkdown) {
          const normalizedExisting = existingMarkdown.replace(/\r\n/g, "\n").trim()
          const normalizedNew = content.replace(/\r\n/g, "\n").trim()

          if (normalizedExisting === normalizedNew) {
            showMessage("内容无变化,无需更新", 2000, "info")
            return
          }
        }

        await api.updateBlock("markdown", content, existingIndexBlock.id)
        showMessage("索引已更新", 2000, "info")
      } else {
        const result = await api.insertBlock(
          "markdown",
          content,
          undefined,
          currentBlockId,
          undefined,
        )

        if (result && result.length > 0 && result[0].doOperations) {
          const newBlockId = result[0].doOperations[0]?.id
          if (newBlockId) {
            await api.setBlockAttrs(newBlockId, {
              "custom-toc-type": indexType,
              "custom-toc-generated": "true",
            })
          }
        }

        showMessage(this.plugin.i18n.insertSuccess, 2000, "info")
      }
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
      return (result?.files || []).map(f => ({
        id: f.id,
        name: stripSySuffix(f.name),
      }))
    } catch (error) {
      console.error("获取子文档失败:", error)
      return []
    }
  }

  /**
   * 公共入口：解析当前文档/块 ID，然后执行具体插入逻辑
   * 集中一次 DOM 查询 + 一次 SQL 查询，消除各方法间的重复解析
   */
  private async resolveAndInsert(fn: (docId: string, subDocs: SubDocInfo[]) => Promise<void>) {
    try {
      const docId = await getCurrentDocId()
      if (!docId) {
        showMessage(this.plugin.i18n.noActiveDocument, 3000, "error")
        return
      }

      const subDocs = await this.getSubDocs(docId)
      if (!subDocs || subDocs.length === 0) {
        showMessage(this.plugin.i18n.noSubDocuments, 3000, "info")
        return
      }

      await fn(docId, subDocs)
    } catch (error) {
      console.error("插入索引失败:", error)
      showMessage(`${this.plugin.i18n.insertFailed}${getErrorMessage(error)}`, 3000, "error")
    }
  }

  /** 1. 插入索引（当前文档的子文档列表） CTRL+ALT+I */
  private async insertIndex() {
    await this.resolveAndInsert(async (docId, subDocs) => {
      let content = "## 📑 子文档索引\n\n"
      for (let i = 0; i < subDocs.length; i++) {
        const num = String(i + 1).padStart(2, "0")
        content += `${num}. [${subDocs[i].name}](siyuan://blocks/${subDocs[i].id})\n`
      }
      await this.insertContent(content, "index", docId, getCurrentBlockId())
    })
  }

  /** 2. 插入子文档引用列表 CTRL+ALT+R */
  private async insertSubDocsRef() {
    await this.resolveAndInsert(async (docId, subDocs) => {
      let content = "## 🔗 子文档引用\n\n"
      for (let i = 0; i < subDocs.length; i++) {
        const num = String(i + 1).padStart(2, "0")
        content += `${num}. ((${subDocs[i].id} "${subDocs[i].name}"))\n`
      }
      await this.insertContent(content, "subdocs-ref", docId, getCurrentBlockId())
    })
  }

  /** 3. 插入子文档及其大纲（使用引用块） CTRL+ALT+O */
  private async insertSubDocsWithOutline() {
    await this.resolveAndInsert(async (docId, subDocs) => {
      // 一次性查询所有子文档标题，避免 N+1 查询
      const subDocIds = subDocs.map(d => `'${escapeSqlString(d.id)}'`).join(",")
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

      let content = "## 📋 子文档大纲\n\n"
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

      await this.insertContent(content, "subdocs-outline", docId, getCurrentBlockId())
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

export * from "./types"
