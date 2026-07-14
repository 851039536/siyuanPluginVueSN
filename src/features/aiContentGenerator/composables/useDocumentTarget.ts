/**
 * 文档/块目标选择 Composable
 * 封装 selectTargetDocument/selectTargetBlock/loadTargetDocument/setTargetDocState 逻辑
 */
import { ref, type Ref } from "vue"
import { showMessage } from "siyuan"
import type { TargetDoc } from "@/types/ai"
import * as api from "@/api"
import { removeFrontmatter, getCurrentBlockId, getDocIdByBlockId } from "../utils"

export interface UseDocumentTargetDeps {
  editTargetDoc: Ref<TargetDoc | null>
  originalContent: Ref<string>
  generatedContent: Ref<string>
  displayedContent: Ref<string>
  /** 清除自定义输入的回调 */
  onClearCustomInput: () => void
}

export function useDocumentTarget(deps: UseDocumentTargetDeps) {
  const {
    editTargetDoc, originalContent, generatedContent,
    displayedContent, onClearCustomInput,
  } = deps

  /** 加载文档内容 */
  const loadDocument = async (
    docId: string,
  ): Promise<{ title: string; content: string } | null> => {
    try {
      const docBlock = await api.getBlockByID(docId)
      if (!docBlock) {
        showMessage("无法获取文档信息", 3000, "error")
        return null
      }
      const docContent = await api.exportMdContent(docId)
      if (!docContent || !docContent.content) {
        showMessage("无法获取文档内容", 3000, "error")
        return null
      }
      return {
        title: docBlock.content || "未命名文档",
        content: docContent.content,
      }
    } catch (error) {
      console.error("加载文档失败:", error)
      showMessage("加载文档失败: " + (error as Error).message, 3000, "error")
      return null
    }
  }

  /** 设置目标文档状态 */
  const setTargetDocState = (doc: TargetDoc, content: string) => {
    editTargetDoc.value = doc
    originalContent.value = content
    generatedContent.value = content
    displayedContent.value = content
    onClearCustomInput()
  }

  /** 加载目标文档 */
  const loadTargetDocument = async (docId: string) => {
    const result = await loadDocument(docId)
    if (!result) return
    const cleanContent = removeFrontmatter(result.content)
    setTargetDocState(
      { id: docId, title: result.title, content: cleanContent, isBlock: false },
      cleanContent,
    )
  }

  /** 选择目标文档 */
  const selectTargetDocument = async () => {
    try {
      const protyle = document.querySelector(
        ".layout__wnd--active .protyle:not(.fn__none)",
      )
      let docId = protyle
        ?.querySelector(".protyle-background")
        ?.getAttribute("data-node-id") || null

      if (!docId) {
        const currentBlockId = getCurrentBlockId()
        if (currentBlockId) {
          docId = await getDocIdByBlockId(currentBlockId)
        }
      }

      if (!docId) {
        showMessage("无法获取当前文档，请将光标放在文档中", 2000, "error")
        return
      }

      await loadTargetDocument(docId)
    } catch (error) {
      console.error("选择文档失败:", error)
    }
  }

  /** 选择当前光标所在的块 */
  const selectTargetBlock = async () => {
    try {
      const blockId = getCurrentBlockId()
      if (!blockId) {
        showMessage("无法获取当前块，请将光标放在目标块中", 2000, "error")
        return
      }

      const blockContent = await api.getBlockMarkdown(blockId)
      if (!blockContent) {
        showMessage("无法获取块内容", 2000, "error")
        return
      }

      const blockInfo = await api.getBlockByID(blockId)
      const docTitle = blockInfo?.content || "块内容"

      setTargetDocState(
        { id: blockId, title: docTitle, content: blockContent, isBlock: true },
        blockContent,
      )
    } catch (error) {
      console.error("选择块失败:", error)
      showMessage("选择块失败: " + (error as Error).message, 3000, "error")
    }
  }

  return {
    setTargetDocState,
    loadTargetDocument,
    selectTargetDocument,
    selectTargetBlock,
  }
}
