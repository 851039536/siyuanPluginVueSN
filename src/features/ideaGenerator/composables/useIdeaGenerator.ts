/**
 * 灵感生成器 — 快捷生成模式状态与副作用
 * 批量生成走 callAI 非流式；详情/细化逻辑复用 useIdeaDetail
 */
import type { Plugin } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import type {
  IdeaCategory,
  IdeaGeneratorI18n,
  IdeaItem,
} from "../types"
import { IDEA_CATEGORIES } from "../types"
import {
  buildIdeasPrompt,
  parseIdeasResponse,
  resolveI18nLabel,
  SYSTEM_PROMPT_GENERATE,
} from "../utils"
import { useIdeaDetail } from "./useIdeaDetail"

export type GenerateStatus = "idle" | "generating" | "done" | "error"
export type { RefineStatus } from "./useIdeaDetail"

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

  let generateAbort: AbortController | null = null

  /** 详情/细化公共逻辑 */
  const detail = useIdeaDetail(plugin, i18n)

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
    ideas.value.find((i) => i.id === detail.expandedId.value) || null,
  )

  /** 正在批量生成中 */
  const isGenerating = computed(() => status.value === "generating")

  /** 批量生成灵感 */
  async function generateIdeas(): Promise<void> {
    // 先清空详情区并取消进行中的细化
    detail.resetDetail()

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

  /** 细化当前灵感（传入所属分类标签作为上下文） */
  function refineIdea(idea: IdeaItem): Promise<void> {
    return detail.refineIdea(idea, categoryLabel.value)
  }

  return {
    selectedCategoryId,
    keyword,
    ideas,
    status,
    errorMessage,
    expandedIdea,
    isGenerating,
    categoryLabel,
    generateIdeas,
    refineIdea,
    // 详情/细化相关（透传公共逻辑）
    expandedId: detail.expandedId,
    detailText: detail.detailText,
    refineStatus: detail.refineStatus,
    isRefining: detail.isRefining,
    toggleExpand: detail.toggleExpand,
    copyIdea: detail.copyIdea,
    cancelRefine: detail.cancelRefine,
    copyDetail: detail.copyDetail,
  }
}
