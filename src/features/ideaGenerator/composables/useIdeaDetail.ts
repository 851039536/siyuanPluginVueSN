/**
 * 灵感生成器 — 灵感详情与细化公共逻辑（展开/复制/流式细化）
 * 快捷生成与引导发散两模式共用，避免复制粘贴
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
  callAIStream,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import type {
  IdeaGeneratorI18n,
  IdeaItem,
} from "../types"
import {
  buildIdeaCopyText,
  buildRefinePrompt,
  SYSTEM_PROMPT_REFINE,
} from "../utils"

/** 技术方案细化状态 */
export type RefineStatus = "idle" | "loading" | "streaming" | "done" | "error"

/** 灵感详情与细化公共逻辑（两模式共用） */
export function useIdeaDetail(plugin: Plugin, i18n: IdeaGeneratorI18n) {
  /** 当前展开的灵感 ID */
  const expandedId = ref<string | null>(null)
  /** 流式细化的技术方案文本 */
  const detailText = ref("")
  /** 细化状态 */
  const refineStatus = ref<RefineStatus>("idle")

  let refineAbort: AbortController | null = null

  /** 正在流式细化中 */
  const isRefining = computed(() =>
    refineStatus.value === "loading" || refineStatus.value === "streaming",
  )

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

  /** AI 流式细化为完整技术方案（contextLabel 为「所属分类」或「发散路径」） */
  async function refineIdea(idea: IdeaItem, contextLabel: string): Promise<void> {
    if (!idea) return
    expandedId.value = idea.id
    cancelRefine()
    detailText.value = ""
    refineStatus.value = "loading"

    refineAbort = new AbortController()
    try {
      const config = getApiConfigFromPlugin(plugin)
      const prompt = buildRefinePrompt(idea, contextLabel)
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

  /** 重置详情区状态（切换生成时清空） */
  function resetDetail(): void {
    cancelRefine()
    expandedId.value = null
    detailText.value = ""
    refineStatus.value = "idle"
  }

  return {
    expandedId,
    detailText,
    refineStatus,
    isRefining,
    toggleExpand,
    copyIdea,
    refineIdea,
    cancelRefine,
    copyDetail,
    resetDetail,
  }
}
