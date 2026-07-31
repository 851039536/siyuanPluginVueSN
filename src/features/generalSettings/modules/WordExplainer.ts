/**
 * 单词解释器
 * 双击英文单词后优先从共享单词本（flashcard-cards 存储）读取释义，
 * 未收录时调用统一 AI API 生成简短中文释义；另提供单词发音播放。
 * 数据经 @/utils/sharedStorage 共享模块读取，不直接依赖 flashcardReading 功能。
 */
import type { Plugin } from "siyuan"
import type { Flashcard } from "@/utils/sharedStorage/flashcardStorage"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { FlashcardStorage } from "@/utils/sharedStorage/flashcardStorage"

/** 卡片缓存有效期（毫秒）：短 TTL 兼顾查询性能与单词本编辑后的时效性 */
const CARDS_CACHE_TTL_MS = 5000

export interface ExplainResult {
  word: string
  /** 音标 */
  phonetic: string
  /** 谐音记忆 */
  homophone: string
  /** 中文释义 */
  definition: string
  /** 释义来源：local = 单词本命中，ai = AI 生成 */
  source: "local" | "ai"
}

/** 从文本中提取“标签：值”形式的字段值，命中首个非空标签即返回 */
function extractField(text: string, labels: string[]): string {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[：:]\\s*(.+)`))
    if (match && match[1].trim()) return match[1].trim()
  }
  return ""
}

/** 将单词本内容或 AI 输出解析为结构化字段（音标/谐音/释义） */
function parseExplainFields(word: string, raw: string, source: "local" | "ai"): ExplainResult {
  const phonetic = extractField(raw, ["音标"])
  const homophone = extractField(raw, ["谐音"])
  let definition = extractField(raw, ["释义", "中文", "含义"])
  // 无任何结构字段时（如用户自定义纯文本卡片），整段作为释义
  if (!phonetic && !homophone && !definition) {
    definition = raw.trim()
  }
  return { word, phonetic, homophone, definition, source }
}

export class WordExplainer {
  private plugin: Plugin
  private storage: FlashcardStorage
  private cardsCache: Flashcard[] | null = null
  private cardsCacheTimestamp = 0

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new FlashcardStorage(plugin)
  }

  /** 解释单词：本地单词本优先，未命中调用 AI 生成；统一解析为音标/谐音/释义 */
  async explain(word: string): Promise<ExplainResult> {
    const local = await this.queryFromLocal(word)
    if (local) {
      return parseExplainFields(word, local.content, "local")
    }

    const config = getApiConfigFromPlugin(this.plugin)
    const prompt = `请为英文单词 "${word}" 提供信息，严格按以下三行格式输出，不要有任何其他内容：
音标：[英式音标]
谐音：[中文谐音，使用带声调拼音标注]
释义：[简短中文释义]`
    const text = await callAI(prompt, config, {
      systemPrompt: "你是一个专业的英汉词典助手，擅长给出准确的音标、谐音记忆和简洁中文释义。",
      temperature: 0.3,
      maxTokens: 300,
    })
    return parseExplainFields(word, text, "ai")
  }

  /** 从本地单词本查询（getAllCards 结果做 TTL 缓存，title 小写精确匹配） */
  private async queryFromLocal(word: string): Promise<Flashcard | null> {
    try {
      // 缓存过期或未初始化时刷新
      if (!this.cardsCache || Date.now() - this.cardsCacheTimestamp > CARDS_CACHE_TTL_MS) {
        this.cardsCache = await this.storage.getAllCards()
        this.cardsCacheTimestamp = Date.now()
      }
      const lower = word.toLowerCase()
      return this.cardsCache.find((card) => card.title.toLowerCase() === lower) || null
    } catch (error) {
      console.error("查询本地单词本失败:", error)
      return null
    }
  }

  /** 播放单词发音（与 flashcardReading 的 usePlayWord 同参数：en-US / 0.8 倍速） */
  play(word: string) {
    try {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = "en-US"
      utterance.rate = 0.8
      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("播放单词发音失败:", error)
    }
  }

  /** 取消正在播放的发音（禁用功能/清理 toast 时调用） */
  cancelSpeech() {
    try {
      speechSynthesis.cancel()
    } catch {
      // speechSynthesis 不可用时静默忽略
    }
  }
}
