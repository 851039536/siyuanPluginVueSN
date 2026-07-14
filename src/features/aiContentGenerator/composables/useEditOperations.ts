/**
 * 编辑操作 Composable
 * 封装 applyEdit/undoEdit/insertSubDocument/copyContent/clearContent 逻辑
 */
import { ref, computed, type Ref } from "vue"
import { showMessage } from "siyuan"
import type { TargetDoc } from "@/types/ai"
import * as api from "@/api"
import {
  processContentByType,
  splitMarkdownBlocks,
  convertToSiyuanMarkdown,
} from "../utils"

// ============ 类型 ============

interface EditHistory {
  docId: string
  docTitle: string
  originalContent: string
  timestamp: number
  isBlock?: boolean
  insertedBlockIds?: string[]
}

const MAX_EDIT_HISTORY = 20

export interface UseEditOperationsDeps {
  editTargetDoc: Ref<TargetDoc | null>
  originalContent: Ref<string>
  generatedContent: Ref<string>
  displayedContent: Ref<string>
  errorMessage: Ref<string>
  generationElapsed: Ref<string>
}

// ============ Composable ============

export function useEditOperations(deps: UseEditOperationsDeps) {
  const {
    editTargetDoc, originalContent, generatedContent,
    displayedContent, errorMessage, generationElapsed,
  } = deps

  const isApplying = ref(false)
  const isUndoing = ref(false)
  const isInsertingSubDoc = ref(false)
  const editHistoryStack = ref<EditHistory[]>([])

  const canUndoEdit = computed(() => editHistoryStack.value.length > 0)

  /** 清除内容显示 */
  const clearContent = () => {
    generatedContent.value = ""
    displayedContent.value = ""
    errorMessage.value = ""
    generationElapsed.value = ""
  }

  /** 清理编辑模式状态 */
  const clearEditState = () => {
    editTargetDoc.value = null
    originalContent.value = ""
    // editCustomInput is managed externally
    editHistoryStack.value = []
  }

  /** 清除目标文档 */
  const clearTargetDocument = () => {
    clearEditState()
    clearContent()
  }

  /** 复制内容到剪贴板 */
  const copyContent = async () => {
    if (!generatedContent.value) return
    try {
      const siyuanContent = convertToSiyuanMarkdown(generatedContent.value)
      await navigator.clipboard.writeText(siyuanContent)
    } catch (error) {
      console.error("复制失败:", error)
      showMessage("复制失败", 2000, "error")
    }
  }

  /** 应用编辑 */
  const applyEdit = async () => {
    if (!editTargetDoc.value) return

    isApplying.value = true
    let insertedBlockIds: string[] = []

    try {
      const siyuanContent = processContentByType(
        generatedContent.value,
        editTargetDoc.value.isBlock ?? false,
      )
      const docId = editTargetDoc.value.id

      if (editTargetDoc.value.isBlock) {
        const blocks = splitMarkdownBlocks(siyuanContent)
        if (blocks.length === 0) {
          throw new Error("生成的内容为空")
        }

        // 第一个块：更新原始块
        const result = await api.updateBlock("markdown", blocks[0], docId)
        if (!result) {
          throw new Error("updateBlock API 返回为空，更新可能未生效")
        }

        // 剩余块：逐个追加
        if (blocks.length > 1) {
          let prevId = docId
          for (let i = 1; i < blocks.length; i++) {
            const insertResult = await api.insertBlock(
              "markdown", blocks[i], undefined, prevId,
            )
            if (!insertResult || insertResult.length === 0) {
              throw new Error("insertBlock API 返回为空，追加内容可能未生效")
            }
            const newBlockId = insertResult[0]?.doOperations?.[0]?.id
            if (newBlockId) {
              insertedBlockIds.push(newBlockId)
              prevId = newBlockId
            }
          }
        }
      } else {
        const result = await api.updateBlock("markdown", siyuanContent, docId)
        if (!result) {
          throw new Error("updateBlock API 返回为空，更新可能未生效")
        }
      }

      // 保存编辑历史
      editHistoryStack.value.push({
        docId: editTargetDoc.value.id,
        docTitle: editTargetDoc.value.title,
        originalContent: originalContent.value,
        timestamp: Date.now(),
        isBlock: editTargetDoc.value.isBlock,
        insertedBlockIds: insertedBlockIds.length > 0 ? insertedBlockIds : undefined,
      })
      if (editHistoryStack.value.length > MAX_EDIT_HISTORY) {
        editHistoryStack.value.shift()
      }

      originalContent.value = generatedContent.value
      editTargetDoc.value.content = generatedContent.value
    } catch (error) {
      console.error("应用编辑失败:", error)
      showMessage("应用编辑失败: " + (error as Error).message, 3000, "error")
    } finally {
      isApplying.value = false
    }
  }

  /** 撤回编辑 */
  const undoEdit = async () => {
    if (editHistoryStack.value.length === 0) return

    isUndoing.value = true
    try {
      const lastHistory = editHistoryStack.value.pop()!
      const historyDocId = lastHistory.docId

      // 块模式下先删除追加的块
      if (lastHistory.isBlock && lastHistory.insertedBlockIds?.length) {
        for (const blockId of lastHistory.insertedBlockIds) {
          try { await api.deleteBlock(blockId) }
          catch (e) { console.warn("删除追加块失败，可能已被手动删除:", blockId, e) }
        }
      }

      const result = await api.updateBlock(
        "markdown", lastHistory.originalContent, historyDocId,
      )
      if (!result) {
        throw new Error("updateBlock API 返回为空，恢复可能未生效")
      }

      showMessage(`已撤回对文档的编辑: ${lastHistory.docTitle}`, 2000, "info")

      if (editTargetDoc.value && editTargetDoc.value.id === lastHistory.docId) {
        generatedContent.value = lastHistory.originalContent
        displayedContent.value = lastHistory.originalContent
        originalContent.value = lastHistory.originalContent
        editTargetDoc.value.content = lastHistory.originalContent
      }
    } catch (error) {
      console.error("撤回编辑失败:", error)
    } finally {
      isUndoing.value = false
    }
  }

  /** 插入子文档 */
  const insertSubDocument = async () => {
    if (!editTargetDoc.value || !generatedContent.value) {
      showMessage("请先选择文档并生成内容", 2000, "info")
      return
    }

    const parentHPath = await api.getHPathByID(editTargetDoc.value.id)
    const parentDocName = parentHPath ? parentHPath.split("/").pop() || "文档" : "文档"
    const subDocTitle = `${parentDocName}总结`
    const timestamp = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")
    const finalSubDocTitle = `${subDocTitle}_${timestamp}`

    isInsertingSubDoc.value = true

    try {
      const siyuanContent = processContentByType(generatedContent.value, false)
      const parentDoc = await api.getBlockByID(editTargetDoc.value.id)
      if (!parentDoc || !parentDoc.box) {
        throw new Error("无法获取父文档信息")
      }

      const subDocPath = `${parentHPath}/${finalSubDocTitle}`
      const subDocId = await api.createDocWithMd(parentDoc.box, subDocPath, siyuanContent)

      if (subDocId) {
        showMessage(
          `已在文档"${parentDoc.content || editTargetDoc.value.title}"下创建子文档: ${finalSubDocTitle}`,
          3000, "info",
        )
      } else {
        throw new Error("创建子文档失败")
      }
    } catch (error) {
      console.error("插入子文档失败:", error)
      showMessage("插入子文档失败: " + (error as Error).message, 3000, "error")
    } finally {
      isInsertingSubDoc.value = false
    }
  }

  return {
    isApplying, isUndoing, isInsertingSubDoc,
    editHistoryStack, canUndoEdit,
    clearContent, clearEditState, clearTargetDocument,
    copyContent, applyEdit, undoEdit, insertSubDocument,
  }
}
