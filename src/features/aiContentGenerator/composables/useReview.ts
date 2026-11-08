/**
 * 审核系统 Composable
 * 封装审核状态、审核执行、自动修正和定向修复逻辑
 */
import type { Ref } from "vue"
import type { ExecuteGenerationOptions } from "./useGeneration"
import type {
  GenerateOptions,
  ReviewResult,
  SkillItem,
  TargetDoc,
} from "@/types/ai"
import { showMessage } from "siyuan"
import { ref } from "vue"
import { isAbortError } from "@/utils/abortSignal"
import { DEFAULT_SYSTEM_PROMPTS } from "../types"
import { buildSkillSystemPrompt, localize } from "../utils"

// ============ 类型 ============

const MAX_AUTO_FIX_ITERATIONS = 2

export interface UseReviewDeps {
  /** 当前生成内容 */
  generatedContent: Ref<string>
  /** 打字机渲染缓存（自动修复失败时需与 generatedContent 一并恢复） */
  displayedContent: Ref<string>
  /** 当前技能 */
  currentSkill: Ref<SkillItem | null>
  /** 编辑目标文档 */
  editTargetDoc: Ref<TargetDoc | null>
  /** 自定义输入 */
  editCustomInput: Ref<string>
  /** 运行时文案（提示/toast/修复上下文）的国际化数据源 */
  i18n: Record<string, string>
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
    signal?: AbortSignal,
  ) => Promise<ReviewResult>
}

// ============ Composable ============

export function useReview(deps: UseReviewDeps) {
  const enableReview = ref(false)
  const isReviewing = ref(false)
  const reviewResult = ref<ReviewResult | null>(null)
  const isAutoFixing = ref(false)
  const autoFixCount = ref(0)
  /** 进行中审核的取消句柄（每次审核独立，避免旧审核取消影响新审核） */
  const reviewAbortController = ref<AbortController | null>(null)
  /** 审核会话序号：新审核/清除会自增，迟到的旧结果据此丢弃 */
  let reviewSessionId = 0

  const {
    generatedContent,
    displayedContent,
    currentSkill,
    editTargetDoc,
    editCustomInput,
    i18n,
    executeGeneration,
    buildGenerateOptions,
    onReview,
  } = deps

  // ===== 审核逻辑 =====

  /**
   * 执行交叉审核
   * @param override 优先使用的用户需求描述（生成发起方传入的真实指令，避免被 onSuccess 清空的输入兜底）
   * @param force 强制审核：跳过 enableReview 开关检查，供"直接审查"按钮调用
   */
  const performReview = async (override?: string, force = false) => {
    if ((!enableReview.value && !force) || !generatedContent.value) return

    const userRequest = override
      || editCustomInput.value
      || (editTargetDoc.value ? `对文档"${editTargetDoc.value.title}"进行编辑` : "AI 内容生成")

    const controller = new AbortController()
    reviewAbortController.value = controller
    // 本次审核对应的会话号与内容快照：任一失效即视为过期结果
    const sessionId = ++reviewSessionId
    const reviewedContent = generatedContent.value

    isReviewing.value = true
    reviewResult.value = null

    try {
      const result = await onReview(
        userRequest,
        reviewedContent,
        currentSkill.value || undefined,
        controller.signal,
      )
      // 已取消：丢弃迟到结果，避免取消后仍展示审核结论
      if (controller.signal.aborted) return
      // 审核期间内容被新一轮生成替换 / 审核会话已作废：丢弃结果，避免旧评分挂到新内容上
      if (sessionId !== reviewSessionId || generatedContent.value !== reviewedContent) return
      reviewResult.value = result
    } catch (error) {
      // 取消不视为审核失败；非取消异常由审核回调内部转为错误结果，此处仅兜底记录
      if (!isAbortError(error)) {
        console.error("审核失败:", error)
      }
    } finally {
      // 仅当本次审核仍是当前审核时才复位，避免旧审核覆盖新审核状态
      if (reviewAbortController.value === controller) {
        reviewAbortController.value = null
        isReviewing.value = false
      }
      // 新一轮审核完成，重置自动修复计数（上限按审核周期计）
      if (sessionId === reviewSessionId) autoFixCount.value = 0
    }
  }

  /** 取消进行中的审核 */
  const handleStopReview = () => {
    const controller = reviewAbortController.value
    if (!controller) return
    controller.abort()
    // 立即复位审核态，取消反馈无需等待请求 rejection
    reviewAbortController.value = null
    isReviewing.value = false
  }

  /**
   * 手动重新审核
   */
  const handleReReview = () => {
    if (!generatedContent.value) return
    // 重新审核语义上等同强制审核：首次经"直接审查"进入时 enableReview 可能为关
    performReview(undefined, true)
  }

  /**
   * 修复执行（自动修复与定向修复共用）：
   * 统一快照、失败/中止恢复、成功计数与过期审核结果清理
   */
  const runFix = async (
    context: string,
    fixInstruction: string,
    systemPrompt: string,
    countAttempt: boolean,
  ): Promise<void> => {
    const currentContent = generatedContent.value
    if (!currentContent) return

    isAutoFixing.value = true
    // 修复前快照：失败/中止时原样恢复，避免半截修复内容覆盖原内容
    const snapshot = {
      generated: currentContent,
      displayed: displayedContent.value,
    }
    let succeeded = false

    try {
      await executeGeneration(
        context,
        () => buildGenerateOptions(
          `${fixInstruction}\n\n${currentContent}`,
          systemPrompt,
          // 搜索词用文档标题：fixInstruction 是固定模板，截前 128 字会让 query 与文档无关
          editTargetDoc.value?.title?.trim() || undefined,
        ),
        () => {
          // 仅在成功产出新内容后才计数，失败/中止不占用修复次数
          succeeded = true
        },
        { skipReview: true }, // 修复内部循环，跳过审核避免死循环
      )
    } finally {
      if (!succeeded) {
        generatedContent.value = snapshot.generated
        displayedContent.value = snapshot.displayed
      } else {
        // 仅自动修复消耗次数上限；定向修复不计数
        if (countAttempt) autoFixCount.value++
        // 修复后旧审核结论必然过期：清空，避免继续展示修复前的问题
        reviewResult.value = null
      }
      // 无论成功/失败/中止，退出时复位修复态，避免卡死 canApplyEdit
      isAutoFixing.value = false
    }
  }

  /**
   * 自动修正：根据审核结果修复生成内容
   */
  const handleAutoFix = async () => {
    const result = reviewResult.value
    if (!result || !generatedContent.value) return

    // 先判上限：超限直接提示并返回，不重置计数也不改 isAutoFixing
    if (autoFixCount.value >= MAX_AUTO_FIX_ITERATIONS) {
      showMessage(
        localize(i18n, "reviewAutoFixLimit", { n: MAX_AUTO_FIX_ITERATIONS }),
        3000,
        "info",
      )
      return
    }

    const issuesText = result.issues
      .map((issue) => `- [${issue.severity}] ${issue.description}`)
      .join("\n")
    const suggestionsText = result.suggestions.join("\n")

    const fixInstruction = `请修正以下内容中的问题：

问题清单：
${issuesText}

改进建议：
${suggestionsText}`

    await runFix(
      localize(i18n, "fixContextAuto"),
      fixInstruction,
      buildSkillSystemPrompt(currentSkill.value, DEFAULT_SYSTEM_PROMPTS.fixByReview),
      true,
    )
  }

  /**
   * 定向修复单个问题
   */
  const handleFixIssue = async (issueIndex: number) => {
    if (!reviewResult.value || !generatedContent.value) return
    const issue = reviewResult.value.issues[issueIndex]
    if (!issue) return

    // 修复指令仅基于 issue 自身信息：suggestions 与 issues 由 AI 独立返回，索引并不对齐，不能按下标取建议
    const fixInstruction = `请修复以下文档中的第 ${issueIndex + 1} 个问题。
仅修改相关内容，保持文档其他部分不变。

问题描述：${issue.description}
严重程度：${issue.severity}

直接输出修复后的完整文档。`

    await runFix(
      localize(i18n, "fixContextIssue"),
      fixInstruction,
      buildSkillSystemPrompt(currentSkill.value, DEFAULT_SYSTEM_PROMPTS.fixIssue),
      false,
    )
  }

  /** 清除审核态（结果/修复状态），供"清除"按钮组合调用 */
  const clearReviewState = () => {
    // 作废审核会话（含已取消但尚未结算的审核），迟到结果不得再写入
    reviewSessionId++
    // 同时取消进行中的审核，避免清除后迟到结果重新出现
    reviewAbortController.value?.abort()
    reviewAbortController.value = null
    isReviewing.value = false
    reviewResult.value = null
    isAutoFixing.value = false
    autoFixCount.value = 0
  }

  return {
    enableReview, isReviewing, reviewResult, isAutoFixing,
    performReview, handleAutoFix, handleReReview, handleFixIssue,
    handleStopReview, clearReviewState,
  }
}
