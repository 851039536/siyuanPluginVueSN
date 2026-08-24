/**
 * 灵感生成器 — 引导发散状态机（主题输入 → 多轮方向深挖 → 发散灵感）
 * 方向生成与灵感发散走 callAI 非流式，详情/细化复用 useIdeaDetail
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
  GuideDirection,
  GuideStage,
  IdeaGeneratorI18n,
  IdeaItem,
} from "../types"
import {
  buildDirectionsPrompt,
  buildDivergePrompt,
  parseDirectionsResponse,
  parseIdeasResponse,
  SYSTEM_PROMPT_DIRECTIONS,
  SYSTEM_PROMPT_DIVERGE,
} from "../utils"
import { useIdeaDetail } from "./useIdeaDetail"

export function useGuideDiverge(plugin: Plugin, i18n: IdeaGeneratorI18n) {
  /** 当前引导阶段 */
  const stage = ref<GuideStage>("input")
  /** 用户输入的发散主题 */
  const topic = ref("")
  /** 当前轮的方向选项 */
  const directions = ref<GuideDirection[]>([])
  /** 已选方向路径（按选择顺序） */
  const steps = ref<GuideDirection[]>([])
  /** 发散出的灵感列表 */
  const ideas = ref<IdeaItem[]>([])
  /** 错误信息 */
  const errorMessage = ref("")
  /** 是否正在生成方向/发散灵感 */
  const isBusy = ref(false)

  let abort: AbortController | null = null

  /** 详情/细化公共逻辑 */
  const detail = useIdeaDetail(plugin, i18n)

  /** 当前展开的灵感对象 */
  const expandedIdea = computed<IdeaItem | null>(() =>
    ideas.value.find((i) => i.id === detail.expandedId.value) || null,
  )

  /** 已选方向路径文本（用于面包屑与细化上下文） */
  const pathText = computed<string>(() =>
    steps.value.map((d) => d.label).join(" > "),
  )

  /** 取消进行中的请求 */
  function cancelPending(): void {
    abort?.abort()
    abort = null
  }

  /** 开始发散：重置状态并生成首轮方向 */
  async function startDiverge(): Promise<void> {
    const t = topic.value.trim()
    if (!t) {
      errorMessage.value = i18n.guideEmptyTopic || ""
      return
    }
    errorMessage.value = ""
    steps.value = []
    ideas.value = []
    detail.resetDetail()
    await generateDirections()
  }

  /** 生成当前轮方向（基于主题 + 已选路径） */
  async function generateDirections(): Promise<void> {
    cancelPending()
    abort = new AbortController()
    stage.value = "guiding"
    isBusy.value = true
    errorMessage.value = ""

    try {
      const config = getApiConfigFromPlugin(plugin)
      const result = await callAI(
        buildDirectionsPrompt(topic.value.trim(), steps.value),
        config,
        {
          systemPrompt: SYSTEM_PROMPT_DIRECTIONS,
          temperature: 0.9,
          maxTokens: 1200,
          signal: abort.signal,
        },
      )
      directions.value = parseDirectionsResponse(result)
    } catch (error: unknown) {
      if ((error as Error)?.name === "AbortError") return
      console.error("[IdeaGenerator] 生成方向失败:", error)
      errorMessage.value = (error as Error)?.message || i18n.generateError || ""
    } finally {
      abort = null
      isBusy.value = false
    }
  }

  /** 选择方向继续深挖：追加到路径并生成下一轮方向 */
  async function selectDirection(dir: GuideDirection): Promise<void> {
    if (isBusy.value) return
    steps.value = [...steps.value, dir]
    await generateDirections()
  }

  /** 换一批：重新生成当前轮方向（路径不变） */
  async function regenerateDirections(): Promise<void> {
    await generateDirections()
  }

  /** 回退一步：撤销上一次选择；路径为空时回到输入态 */
  async function stepBack(): Promise<void> {
    if (isBusy.value) return
    if (steps.value.length === 0) {
      stage.value = "input"
      directions.value = []
      return
    }
    steps.value = steps.value.slice(0, -1)
    await generateDirections()
  }

  /** 发散灵感：基于完整路径产出具体灵感 */
  async function divergeIdeas(): Promise<void> {
    if (steps.value.length === 0) return
    cancelPending()
    abort = new AbortController()
    stage.value = "ideas"
    isBusy.value = true
    errorMessage.value = ""
    detail.resetDetail()

    try {
      const config = getApiConfigFromPlugin(plugin)
      const result = await callAI(
        buildDivergePrompt(topic.value.trim(), steps.value),
        config,
        {
          systemPrompt: SYSTEM_PROMPT_DIVERGE,
          temperature: 0.9,
          maxTokens: 1600,
          signal: abort.signal,
        },
      )
      ideas.value = parseIdeasResponse(result)
    } catch (error: unknown) {
      if ((error as Error)?.name === "AbortError") return
      console.error("[IdeaGenerator] 发散灵感失败:", error)
      errorMessage.value = (error as Error)?.message || i18n.generateError || ""
    } finally {
      abort = null
      isBusy.value = false
    }
  }

  /** 重新开始：清空所有状态回到输入态 */
  function restart(): void {
    cancelPending()
    stage.value = "input"
    topic.value = ""
    directions.value = []
    steps.value = []
    ideas.value = []
    errorMessage.value = ""
    detail.resetDetail()
  }

  /** 细化当前灵感（传入发散路径作为上下文） */
  function refineIdea(idea: IdeaItem): Promise<void> {
    return detail.refineIdea(idea, pathText.value)
  }

  return {
    stage,
    topic,
    directions,
    steps,
    ideas,
    errorMessage,
    isBusy,
    expandedIdea,
    pathText,
    startDiverge,
    selectDirection,
    regenerateDirections,
    stepBack,
    divergeIdeas,
    restart,
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
