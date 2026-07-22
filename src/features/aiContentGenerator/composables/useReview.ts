/**
 * 审核系统 Composable
 * 封装审核状态、审核执行、自动修正和定向修复逻辑
 */
import { computed, ref, type Ref } from "vue"
import { showMessage } from "siyuan"
import type { GenerateOptions, ReviewResult, SkillItem, TargetDoc } from "@/types/ai"
import { buildSkillSystemPrompt } from "./useGeneration"

// ============ 类型 ============

export interface FixEntry {
  timestamp: number
  issuesAddressed: string[]
  ratingBefore: string
  ratingAfter: string
}

const MAX_AUTO_FIX_ITERATIONS = 2

export interface UseReviewDeps {
  /** 当前生成内容 */
  generatedContent: Ref<string>
  /** 当前技能 */
  currentSkill: Ref<SkillItem | null>
  /** 编辑目标文档 */
  editTargetDoc: Ref<TargetDoc | null>
  /** 自定义输入 */
  editCustomInput: Ref<string>
  /** 执行生成（来自 useGeneration） */
  executeGeneration: (
    context: string,
    buildOptions: () => GenerateOptions,
    onSuccess?: () => void,
    skipReview?: boolean,
  ) => Promise<void>
  /** 构建选项 */
  buildGenerateOptions: (userInput: string, systemPrompt: string, searchQueryOverride?: string) => GenerateOptions
  /** 外部审核回调 */
  onReview: (
    userRequest: string,
    generatedContent: string,
    skill?: SkillItem,
  ) => Promise<ReviewResult>
}

// ============ Composable ============

export function useReview(deps: UseReviewDeps) {
  const enableReview = ref(false)
  const isReviewing = ref(false)
  const reviewResult = ref<ReviewResult | null>(null)
  const isAutoFixing = ref(false)
  const autoFixCount = ref(0)
  const fixHistory = ref<FixEntry[]>([])

  const needsFix = computed(() =>
    reviewResult.value?.rating === "需改进"
    && (reviewResult.value?.issues?.length ?? 0) > 0,
  )

  const resetReview = () => {
    reviewResult.value = null
    isReviewing.value = false
    isAutoFixing.value = false
    autoFixCount.value = 0
  }

  const recordFixEntry = (issuesAddressed: string[], ratingBefore: string) => {
    fixHistory.value.push({
      timestamp: Date.now(),
      issuesAddressed,
      ratingBefore,
      ratingAfter: reviewResult.value?.rating || ratingBefore,
    })
  }

  // ===== 审核逻辑 =====

  const { generatedContent, currentSkill, editTargetDoc,
    editCustomInput, executeGeneration, buildGenerateOptions, onReview } = deps

  /**
   * 执行交叉审核
   */
  const performReview = async () => {
    if (!enableReview.value || !generatedContent.value) return
    if (!onReview) return

    const userRequest = editCustomInput.value
      || (editTargetDoc.value ? `对文档"${editTargetDoc.value.title}"进行编辑` : "AI 内容生成")

    isReviewing.value = true
    reviewResult.value = null

    reviewResult.value = await onReview(
      userRequest,
      generatedContent.value,
      currentSkill.value || undefined,
    )
    isReviewing.value = false
  }

  /**
   * 手动重新审核
   */
  const handleReReview = () => {
    reviewResult.value = null
    isReviewing.value = false
    performReview()
  }

  /**
   * 自动修正：根据审核结果修复生成内容
   */
  const handleAutoFix = async () => {
    if (!reviewResult.value || !generatedContent.value) return

    autoFixCount.value++
    if (autoFixCount.value > MAX_AUTO_FIX_ITERATIONS) {
      showMessage(`已达到自动修复次数上限（${MAX_AUTO_FIX_ITERATIONS}次）`, 3000, "info")
      isAutoFixing.value = false
      autoFixCount.value = 0
      return
    }

    const ratingBefore = reviewResult.value.rating
    isAutoFixing.value = true
    const currentContent = generatedContent.value

    const issuesText = reviewResult.value.issues
      .map((issue) => `- [${issue.severity}] ${issue.description}`)
      .join("\n")
    const suggestionsText = reviewResult.value.suggestions.join("\n")

    const fixInstruction = `请修正以下内容中的问题：

问题清单：
${issuesText}

改进建议：
${suggestionsText}`

    const systemPrompt = buildSkillSystemPrompt(
      currentSkill.value,
      "你是一个专业的文档编辑助手，擅长根据审核反馈修正Markdown文档。请直接输出修正后的完整文档，不要添加任何解释性文字。",
    )

    await executeGeneration("内容修正", () =>
      buildGenerateOptions(
        `${fixInstruction}\n\n待修正内容：\n${currentContent}`,
        systemPrompt,
      ),
      () => {
        isAutoFixing.value = false
        recordFixEntry(
          reviewResult.value?.issues.map((i) => i.description) || [],
          ratingBefore,
        )
      },
      true, // skipReview 避免循环
    )
  }

  /**
   * 定向修复单个问题
   */
  const handleFixIssue = async (issueIndex: number) => {
    if (!reviewResult.value || !generatedContent.value) return
    const issue = reviewResult.value.issues[issueIndex]
    if (!issue) return

    const suggestion = reviewResult.value.suggestions[issueIndex] || ""
    const ratingBefore = reviewResult.value.rating
    isAutoFixing.value = true
    const currentContent = generatedContent.value

    const fixInstruction = `请修复以下文档中的第 ${issueIndex + 1} 个问题。
仅修改相关内容，保持文档其他部分不变。

问题描述：${issue.description}
严重程度：${issue.severity}
${suggestion ? `改进建议：${suggestion}` : ""}

直接输出修复后的完整文档。`

    const systemPrompt = buildSkillSystemPrompt(
      currentSkill.value,
      "你是一个专业的文档编辑助手。请根据描述的问题定向修改，仅修正相关问题部分，保持其他内容不变。直接输出修改后的完整文档。",
    )

    await executeGeneration("定向修复", () =>
      buildGenerateOptions(
        `${fixInstruction}\n\n当前文档：\n${currentContent}`,
        systemPrompt,
      ),
      () => {
        isAutoFixing.value = false
        recordFixEntry([issue.description], ratingBefore)
      },
      true,
    )
  }

  return {
    enableReview, isReviewing, reviewResult, isAutoFixing,
    autoFixCount, fixHistory, MAX_AUTO_FIX_ITERATIONS,
    needsFix, resetReview, recordFixEntry,
    performReview, handleAutoFix, handleReReview, handleFixIssue,
  }
}
