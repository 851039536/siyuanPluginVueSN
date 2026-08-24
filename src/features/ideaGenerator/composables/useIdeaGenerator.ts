/**
 * 灵感生成器 — 生成/细化/复制/展开状态与副作用
 * 批量生成走 callAI 非流式，方案细化走 callAIStream 流式，均支持 AbortController 取消
 */
import type { Plugin } from "siyuan"
import {
  showMessage,
} from "siyuan"
import {
  computed,
  ref,
} from "vue"
import {
  callAI,
  callAIStream,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import type {
  IdeaCategory,
  IdeaGeneratorI18n,
  IdeaItem,
} from "../types"
import { IDEA_CATEGORIES } from "../types"
import {
  buildIdeaCopyText,
  buildIdeasPrompt,
  buildRefinePrompt,
  parseIdeasResponse,
  resolveI18nLabel,
  SYSTEM_PROMPT_GENERATE,
  SYSTEM_PROMPT_REFINE,
} from "../utils"

export type GenerateStatus = "idle" | "generating" | "done" | "error"
export type RefineStatus = "idle" | "loading" | "streaming" | "done" | "error"

export function useIdeaGenerator(plugin: Plugin, i18n: IdeaGeneratorI18n) {
  /** 当前选中分类 ID */
  const selectedCategoryId = ref(IDEA_CATEGORIES[0].id)
  /** 额外关键词（可选） */
  const keyword = ref("")
  /** 批量生成结果 */
  const ideas = ref<IdeaItem[]>([])
  /** 批量生成状态 */
  const status = ref<GenerateStatus>("idle")
  /** 批量生成错误信息 */
  const errorMessage = ref("")

  /** 当前展开的灵感 ID */
  const expandedId = ref<string | null>(null)
  /** 流式细化的技术方案文本 */
  const detailText = ref("")
  /** 细化状态 */
  const refineStatus = ref<RefineStatus>("idle")

  let generateAbort: AbortController | null = null
  let refineAbort: AbortController | null = null

  /** 当前选中分类对象 */
  const selectedCategory = computed<IdeaCategory>(() =>
    IDEA_CATEGORIES.find((c) => c.id === selectedCategoryId.value) || IDEA_CATEGORIES[0],
  )

  /** 当前选中分类的中文标签（从 i18n 取值） */
  const categoryLabel = computed<string>(() => labelOfCategory(selectedCategory.value))

  /** 根据 i18n 键解析分类标签（点路径索引） */
  function labelOfCategory(cat: IdeaCategory): string {
    return resolveI18nLabel(i18n as Record<string, unknown>, cat.labelKey, cat.id)
  }

  /** 当前展开的灵感对象 */
  const expandedIdea = computed<IdeaItem | null>(() =>
    ideas.value.find((i) => i.id === expandedId.value) || null,
  )

  /** 正在批量生成中 */
  const isGenerating = computed(() => status.value === "generating")
  /** 正在流式细化中 */
  const isRefining = computed(() =>
    refineStatus.value === "loading" || refineStatus.value === "streaming",
  )

  /** 批量生成灵感 */
  async function generateIdeas(): Promise<void> {
    // 先取消进行中的细化与展开
    cancelRefine()
    expandedId.value = null
    detailText.value = ""

    generateAbort?.abort()
    generateAbort = new AbortController()
    status.value = "generating"
    errorMessage.value = ""

    try {
      const config = getApiConfigFromPlugin(plugin)
      const prompt = buildIdeasPrompt(
        selectedCategory.value,
        categoryLabel.value,
        keyword.value.trim(),
      )
      const result = await callAI(prompt, config, {
        systemPrompt: SYSTEM_PROMPT_GENERATE,
        temperature: 0.9,
        maxTokens: 1600,
        signal: generateAbort.signal,
      })
      ideas.value = parseIdeasResponse(result)
      status.value = ideas.value.length > 0 ? "done" : "error"
      if (ideas.value.length === 0) {
        errorMessage.value = i18n.generateError || ""
      }
    } catch (error: unknown) {
      if ((error as Error)?.name === "AbortError") return
      console.error("[IdeaGenerator] 生成灵感失败:", error)
      errorMessage.value = (error as Error)?.message || i18n.generateError || ""
      status.value = "error"
    } finally {
      generateAbort = null
    }
  }

  /** 切换灵感展开状态 */
  function toggleExpand(id: string): void {
    expandedId.value = expandedId.value === id ? null : id
  }

  /** 复制单条灵感文本 */
  async function copyIdea(idea: IdeaItem): Promise<void> {
    const ok = await copyToClipboard(buildIdeaCopyText(idea))
    showMessage(
      ok ? i18n.copied || "" : i18n.generateError || "",
      2000,
      ok ? "info" : "error",
    )
  }

  /** AI 流式细化为完整技术方案 */
  async function refineIdea(idea: IdeaItem): Promise<void> {
    if (!idea) return
    expandedId.value = idea.id
    cancelRefine()
    detailText.value = ""
    refineStatus.value = "loading"

    refineAbort = new AbortController()
    try {
      const config = getApiConfigFromPlugin(plugin)
      const prompt = buildRefinePrompt(idea, categoryLabel.value)
      await callAIStream(
        prompt,
        config,
        (chunk: string) => {
          detailText.value += chunk
          refineStatus.value = "streaming"
        },
        {
          systemPrompt: SYSTEM_PROMPT_REFINE,
          temperature: 0.6,
          maxTokens: 2500,
          signal: refineAbort.signal,
        },
      )
      refineStatus.value = "done"
    } catch (error: unknown) {
      if ((error as Error)?.name === "AbortError") return
      console.error("[IdeaGenerator] 细化方案失败:", error)
      refineStatus.value = "error"
      detailText.value = (error as Error)?.message || i18n.refineError || ""
    } finally {
      refineAbort = null
    }
  }

  /** 取消进行中的细化 */
  function cancelRefine(): void {
    refineAbort?.abort()
    refineAbort = null
  }

  /** 复制完整技术方案文本 */
  async function copyDetail(): Promise<void> {
    if (!detailText.value) return
    const ok = await copyToClipboard(detailText.value)
    showMessage(
      ok ? i18n.copied || "" : i18n.generateError || "",
      2000,
      ok ? "info" : "error",
    )
  }

  return {
    selectedCategoryId,
    keyword,
    ideas,
    status,
    errorMessage,
    expandedId,
    detailText,
    refineStatus,
    expandedIdea,
    isGenerating,
    isRefining,
    categoryLabel,
    generateIdeas,
    toggleExpand,
    copyIdea,
    refineIdea,
    cancelRefine,
    copyDetail,
  }
}
