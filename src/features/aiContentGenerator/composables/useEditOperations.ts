/**
 * 编辑操作 Composable
 * 封装 applyEdit/undoEdit/insertSubDocument/copyContent/clearContent 逻辑
 */
import { ref, computed, type Ref } from "vue"
import { showMessage } from "siyuan"
import type { TargetDoc } from "@/types/ai"
import * as api from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import {
  processContentByType,
  splitMarkdownBlocks,
  convertToSiyuanMarkdown,
  localize,
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
  /** 运行时文案（toast/错误提示）的国际化数据源 */
  i18n: Record<string, string>
}

// ============ Composable ============

export function useEditOperations(deps: UseEditOperationsDeps) {
  const {
    editTargetDoc,
    originalContent,
    generatedContent,
    displayedContent,
    errorMessage,
    generationElapsed,
    i18n,
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

  /** 清除目标文档（含编辑模式状态与内容显示） */
  const clearTargetDocument = () => {
    editTargetDoc.value = null
    originalContent.value = ""
    // editCustomInput is managed externally
    editHistoryStack.value = []
    clearContent()
  }

  /** 复制内容到剪贴板 */
  const copyContent = async () => {
    if (!generatedContent.value) return
    try {
      const siyuanContent = convertToSiyuanMarkdown(generatedContent.value)
      const ok = await copyToClipboard(siyuanContent)
      if (!ok) {
        throw new Error(localize(i18n, "copyClipboardFailed"))
      }
    } catch (error) {
      console.error("复制失败:", error)
      showMessage(localize(i18n, "copyFailed"), 2000, "error")
    }
  }

  /** 写入编辑历史（超过上限时丢弃最旧记录） */
  const pushHistory = (targetDoc: TargetDoc, insertedBlockIds: string[]): void => {
    editHistoryStack.value.push({
      docId: targetDoc.id,
      docTitle: targetDoc.title,
      originalContent: originalContent.value,
      timestamp: Date.now(),
      isBlock: targetDoc.isBlock,
      insertedBlockIds: insertedBlockIds.length > 0 ? insertedBlockIds : undefined,
    })
    if (editHistoryStack.value.length > MAX_EDIT_HISTORY) {
      editHistoryStack.value.shift()
    }
  }

  /**
   * 回滚块模式的部分应用：
   * 1. 逆序删除已插入的追加块（先删后者，避免父子块连带影响）
   * 2. 恢复原块内容
   * @returns 是否全部回滚成功（任一删除/恢复失败即视为回滚不完整）
   */
  const rollbackBlockEdit = async (
    docId: string,
    originalContent: string,
    insertedBlockIds: string[],
    firstBlockUpdated: boolean,
  ): Promise<boolean> => {
    let rolledBack = true
    for (const blockId of [...insertedBlockIds].reverse()) {
      try {
        await api.deleteBlock(blockId)
      } catch (error) {
        console.warn("回滚时删除追加块失败，可能需手动清理:", blockId, error)
        rolledBack = false
      }
    }

    if (firstBlockUpdated) {
      try {
        const result = await api.updateBlock("markdown", originalContent, docId)
        if (!result) {
          console.warn("回滚时恢复原块内容失败: updateBlock 返回为空")
          rolledBack = false
        }
      } catch (error) {
        console.warn("回滚时恢复原块内容失败:", error)
        rolledBack = false
      }
    }
    return rolledBack
  }

  /** 应用编辑 */
  const applyEdit = async () => {
    const targetDoc = editTargetDoc.value
    if (!targetDoc) return

    isApplying.value = true
    const insertedBlockIds: string[] = []
    /** 首个块是否已更新成功（决定回滚时是否需要恢复原内容） */
    let firstBlockUpdated = false
    /** 追加请求异常/未返回块 ID 时无法确认是否落库，回滚不能视为完整 */
    let insertionUncertain = false

    try {
      const siyuanContent = processContentByType(
        generatedContent.value,
        targetDoc.isBlock ?? false,
      )
      const docId = targetDoc.id

      if (targetDoc.isBlock) {
        const blocks = splitMarkdownBlocks(siyuanContent)
        if (blocks.length === 0) {
          throw new Error(localize(i18n, "applyEmptyContent"))
        }

        // 第一个块：更新原始块
        const result = await api.updateBlock("markdown", blocks[0], docId)
        if (!result) {
          throw new Error(localize(i18n, "applyUpdateEmptyResult"))
        }
        firstBlockUpdated = true

        // 剩余块：逐个追加
        if (blocks.length > 1) {
          let prevId = docId
          for (let i = 1; i < blocks.length; i++) {
            let insertResult: Awaited<ReturnType<typeof api.insertBlock>>
            try {
              insertResult = await api.insertBlock(
                "markdown", blocks[i], undefined, prevId,
              )
            } catch (error) {
              // 请求已发出但异常：无法确认是否落库
              insertionUncertain = true
              throw error
            }
            if (!insertResult || insertResult.length === 0) {
              insertionUncertain = true
              throw new Error(localize(i18n, "applyInsertEmptyResult"))
            }
            // insertBlock 返回 IResdoOperations[]（数组元素是 { doOperations } 对象），
            // 需在 doOperations 中查找 insert 动作对应的新块 ID
            const newBlockId = insertResult[0]?.doOperations?.find(
              (op) => op.action === "insert",
            )?.id ?? insertResult[0]?.doOperations?.[0]?.id
            if (!newBlockId) {
              insertionUncertain = true
              throw new Error(localize(i18n, "applyInsertNoBlockId"))
            }
            insertedBlockIds.push(newBlockId)
            prevId = newBlockId
          }
        }
      } else {
        const result = await api.updateBlock("markdown", siyuanContent, docId)
        if (!result) {
          throw new Error(localize(i18n, "applyUpdateEmptyResult"))
        }
      }

      // 保存编辑历史
      pushHistory(targetDoc, insertedBlockIds)

      originalContent.value = generatedContent.value
      targetDoc.content = generatedContent.value
    } catch (error) {
      console.error("应用编辑失败:", error)

      // 块模式：更新/追加可能已部分生效，必须回滚，避免文档停留在半成品状态
      let rollbackSucceeded = true
      if (targetDoc.isBlock) {
        rollbackSucceeded = await rollbackBlockEdit(
          targetDoc.id,
          originalContent.value,
          insertedBlockIds,
          firstBlockUpdated,
        ) && !insertionUncertain
      }

      if (!rollbackSucceeded) {
        // 回滚不完整（含无法确认是否落库的追加）：保留历史快照，让用户仍可"撤回"恢复原文
        pushHistory(targetDoc, insertedBlockIds)
        showMessage(localize(i18n, "applyEditPartialRollback"), 5000, "error")
      } else {
        showMessage(
          localize(i18n, "applyEditFailed", { error: (error as Error).message }),
          3000,
          "error",
        )
      }
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

      showMessage(
        localize(i18n, "undoEditSuccess", { title: lastHistory.docTitle }),
        2000,
        "info",
      )

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
      showMessage(localize(i18n, "insertSubDocNoContent"), 2000, "info")
      return
    }

    isInsertingSubDoc.value = true

    try {
      const parentDoc = await api.getBlockByID(editTargetDoc.value.id)
      if (!parentDoc || !parentDoc.box) {
        throw new Error(localize(i18n, "insertSubDocNoParentInfo"))
      }

      // 父文档路径以文档 ID 解析：块模式下目标 ID 是块 ID，getHPathByID 对块 ID 无效
      // （返回空串导致子文档被创建到笔记本根目录）
      const parentDocId = editTargetDoc.value.isBlock
        ? parentDoc.root_id
        : editTargetDoc.value.id
      const parentDocHPath = await api.getHPathByID(parentDocId)
      if (!parentDocHPath) {
        throw new Error(localize(i18n, "insertSubDocNoParentPath"))
      }
      const parentDocName = parentDocHPath.split("/").pop() || "文档"
      const subDocTitle = `${parentDocName}总结`
      const timestamp = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")
      const finalSubDocTitle = `${subDocTitle}_${timestamp}`

      const siyuanContent = processContentByType(generatedContent.value, false)

      const subDocPath = `${parentDocHPath}/${finalSubDocTitle}`
      const subDocId = await api.createDocWithMd(parentDoc.box, subDocPath, siyuanContent)

      if (subDocId) {
        showMessage(
          localize(i18n, "insertSubDocSuccess", {
            parent: parentDoc.content || editTargetDoc.value.title,
            title: finalSubDocTitle,
          }),
          3000,
          "info",
        )
      } else {
        throw new Error(localize(i18n, "insertSubDocCreateFailed"))
      }
    } catch (error) {
      showMessage(
        localize(i18n, "insertSubDocFailed", { error: (error as Error).message }),
        3000,
        "error",
      )
    } finally {
      isInsertingSubDoc.value = false
    }
  }

  return {
    isApplying, isUndoing, isInsertingSubDoc,
    canUndoEdit,
    clearContent, clearTargetDocument,
    copyContent, applyEdit, undoEdit, insertSubDocument,
  }
}
