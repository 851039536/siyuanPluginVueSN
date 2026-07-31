/**
 * 单词解释器
 * 双击英文单词后优先从共享单词本（flashcard-cards 存储）读取释义，
 * 未收录时调用统一 AI API 生成简短中文释义；另提供单词发音播放。
 * 数据经 @/utils/sharedStorage 共享模块读取，不直接依赖 flashcardReading 功能。
 */
import type { Plugin } from "siyuan"
import type { Flashcard } from "@/utils/sharedStorage/flashcardStorage"
import type { PronunciationSource } from "../types/storage"
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
  /** 例句（英文例句 + 中文翻译） */
  example: string
  /** 词形变化（复数/时态/比较级等，逗号分隔） */
  forms: string
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

/** 将单词本内容或 AI 输出解析为结构化字段（音标/谐音/释义/例句/词形变化） */
function parseExplainFields(word: string, raw: string, source: "local" | "ai"): ExplainResult {
  const phonetic = extractField(raw, ["音标"])
  const homophone = extractField(raw, ["谐音"])
  let definition = extractField(raw, ["释义", "中文", "含义"])
  const example = extractField(raw, ["例句"])
  // “词形变化”须排在“词形”前，避免前缀标签被短标签抢先匹配
  const forms = extractField(raw, ["词形变化", "词形", "变形"])
  // 无任何结构字段时（如用户自定义纯文本卡片），整段作为释义
  if (!phonetic && !homophone && !definition && !example && !forms) {
    definition = raw.trim()
  }
  return { word, phonetic, homophone, definition, example, forms, source }
}

export class WordExplainer {
  private plugin: Plugin
  private storage: FlashcardStorage
  private cardsCache: Flashcard[] | null = null
  private cardsCacheTimestamp = 0
  /** 当前在线发音音频实例（用于取消与回退判断） */
  private audio: HTMLAudioElement | null = null

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
    const prompt = `请为英文单词 "${word}" 提供信息，严格按以下五行格式输出，不要有任何其他内容：
音标：[英式音标]
谐音：[中文谐音，使用带声调拼音标注]
释义：[简短中文释义]
例句：[一个英文例句，附中文翻译]
词形变化：[常见词形，如复数/时态/比较级，用逗号分隔；没有则填“无”]`
    const text = await callAI(prompt, config, {
      systemPrompt: "你是一个专业的英汉词典助手，擅长给出准确的音标、谐音记忆、简洁中文释义、例句和词形变化。",
      temperature: 0.3,
      maxTokens: 500,
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

  /** 播放单词发音：youdao 在线真人（失败回退），否则 Web Speech；固定英式 */
  play(word: string, source: PronunciationSource = "webSpeech") {
    this.cancelSpeech()
    if (source === "youdao") {
      this.playYoudao(word)
    } else {
      this.playWebSpeech(word)
    }
  }

  /** 有道词典在线发音（type=1 英式），加载/播放失败时回退 Web Speech */
  private playYoudao(word: string) {
    try {
      const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=1`
      const audio = new Audio(url)
      this.audio = audio
      audio.onerror = () => {
        if (this.audio !== audio) return
        this.audio = null
        this.playWebSpeech(word)
      }
      audio.play().catch(() => {
        if (this.audio !== audio) return
        this.audio = null
        this.playWebSpeech(word)
      })
    } catch {
      this.playWebSpeech(word)
    }
  }

  /** 浏览器内置语音合成（离线），固定英式 en-GB / 0.8 倍速 */
  private playWebSpeech(word: string) {
    try {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = "en-GB"
      utterance.rate = 0.8
      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("播放单词发音失败:", error)
    }
  }

  /** 取消正在播放的发音（禁用功能/清理 toast 时调用，同时停掉在线音频与语音合成） */
  cancelSpeech() {
    try {
      speechSynthesis.cancel()
    } catch {
      // speechSynthesis 不可用时静默忽略
    }
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
  }
}
