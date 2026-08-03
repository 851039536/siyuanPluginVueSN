/**
 * 审核系统 Composable
 * 封装审核状态、审核执行、自动修正和定向修复逻辑
 */
import { ref, type Ref } from "vue"
import { showMessage } from "siyuan"
import type { GenerateOptions, ReviewResult, SkillItem, TargetDoc } from "@/types/ai"
import type { ExecuteGenerationOptions } from "./useGeneration"
import { DEFAULT_SYSTEM_PROMPTS } from "../types"
import { buildSkillSystemPrompt } from "../utils"

// ============ 类型 ============

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
    options?: ExecuteGenerationOptions,
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

  const { generatedContent, currentSkill, editTargetDoc,
    editCustomInput, executeGeneration, buildGenerateOptions, onReview } = deps

  // ===== 审核逻辑 =====

  /**
   * 执行交叉审核
   * @param override 优先使用的用户需求描述（生成发起方传入的真实指令，避免被 onSuccess 清空的输入兜底）
   */
  const performReview = async (override?: string) => {
    if (!enableReview.value || !generatedContent.value) return

    const userRequest = override
      || editCustomInput.value
      || (editTargetDoc.value ? `对文档"${editTargetDoc.value.title}"进行编辑` : "AI 内容生成")

    isReviewing.value = true
    reviewResult.value = null

    reviewResult.value = await onReview(
      userRequest,
      generatedContent.value,
      currentSkill.value || undefined,
    )
    isReviewing.value = false
    // 新一轮审核完成，重置自动修复计数（上限按审核周期计）
    autoFixCount.value = 0
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

    // 先判上限再自增：超限直接提示并返回，不重置计数也不改 isAutoFixing
    if (autoFixCount.value >= MAX_AUTO_FIX_ITERATIONS) {
      showMessage(`已达到自动修复次数上限（${MAX_AUTO_FIX_ITERATIONS}次）`, 3000, "info")
      return
    }
    autoFixCount.value++

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
      DEFAULT_SYSTEM_PROMPTS.fixByReview,
    )

    await executeGeneration(
      "内容修正",
      () => buildGenerateOptions(
        `${fixInstruction}\n\n待修正内容：\n${currentContent}`,
        systemPrompt,
      ),
      undefined,
      { skipReview: true }, // 自动修复内部循环，跳过审核避免死循环
    )
    // 无论成功/失败/中止，退出时复位修复态，避免卡死 canApplyEdit
    isAutoFixing.value = false
  }

  /**
   * 定向修复单个问题
   */
  const handleFixIssue = async (issueIndex: number) => {
    if (!reviewResult.value || !generatedContent.value) return
    const issue = reviewResult.value.issues[issueIndex]
    if (!issue) return

    isAutoFixing.value = true
    const currentContent = generatedContent.value

    // 修复指令仅基于 issue 自身信息：suggestions 与 issues 由 AI 独立返回，索引并不对齐，不能按下标取建议
    const fixInstruction = `请修复以下文档中的第 ${issueIndex + 1} 个问题。
仅修改相关内容，保持文档其他部分不变。

问题描述：${issue.description}
严重程度：${issue.severity}

直接输出修复后的完整文档。`

    const systemPrompt = buildSkillSystemPrompt(
      currentSkill.value,
      DEFAULT_SYSTEM_PROMPTS.fixIssue,
    )

    await executeGeneration(
      "定向修复",
      () => buildGenerateOptions(
        `${fixInstruction}\n\n当前文档：\n${currentContent}`,
        systemPrompt,
      ),
      undefined,
      { skipReview: true },
    )
    // 无论成功/失败/中止，退出时复位修复态，避免卡死 canApplyEdit
    isAutoFixing.value = false
  }

  /** 清除审核态（结果/修复状态），供"清除"按钮组合调用 */
  const clearReviewState = () => {
    reviewResult.value = null
    isAutoFixing.value = false
    autoFixCount.value = 0
  }

  return {
    enableReview, isReviewing, reviewResult, isAutoFixing,
    performReview, handleAutoFix, handleReReview, handleFixIssue,
    clearReviewState,
  }
}
