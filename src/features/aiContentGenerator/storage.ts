/**
 * AI内容生成器数据存储管理
 */
import { Plugin } from 'siyuan'

/**
 * AI生成器设置接口
 */
export interface AIGeneratorSettings {
  systemPrompt: string
  temperature: number
  maxTokens: number
  enableTypewriter: boolean
  contextMessageLimit: number
}

/**
 * AI提示词配置接口
 */
export interface AIPromptConfig {
  id: string
  name: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  enableTypewriter: boolean
  contextMessageLimit: number
  createdAt: number
}

/**
 * AI内容生成器存储管理器
 */
export class AIGeneratorStorage {
  private plugin: Plugin
  private readonly SETTINGS_STORAGE_KEY = 'ai-content-generator-settings'
  private readonly PROMPTS_STORAGE_KEY = 'ai-content-generator-prompts'
  private readonly CURRENT_PROMPT_STORAGE_KEY = 'ai-content-generator-current-prompt'

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 保存设置
   */
  async saveSettings(settings: AIGeneratorSettings): Promise<boolean> {
    try {
      await this.plugin.saveData(this.SETTINGS_STORAGE_KEY, settings)
      return true
    } catch (error) {
      console.error('保存AI生成器设置失败:', error)
      return false
    }
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<AIGeneratorSettings | null> {
    try {
      const data = await this.plugin.loadData(this.SETTINGS_STORAGE_KEY)
      return data as AIGeneratorSettings
    } catch (error) {
      console.error('加载AI生成器设置失败:', error)
      return null
    }
  }

  /**
   * 保存提示词配置列表
   */
  async savePrompts(prompts: AIPromptConfig[]): Promise<boolean> {
    try {
      await this.plugin.saveData(this.PROMPTS_STORAGE_KEY, prompts)
      return true
    } catch (error) {
      console.error('保存提示词配置失败:', error)
      return false
    }
  }

  /**
   * 加载提示词配置列表
   */
  async loadPrompts(): Promise<AIPromptConfig[]> {
    try {
      const data = await this.plugin.loadData(this.PROMPTS_STORAGE_KEY)
      return data || []
    } catch (error) {
      console.error('加载提示词配置失败:', error)
      return []
    }
  }

  /**
   * 保存当前选中的提示词
   */
  async saveCurrentPrompt(promptName: string): Promise<boolean> {
    try {
      await this.plugin.saveData(this.CURRENT_PROMPT_STORAGE_KEY, promptName)
      return true
    } catch (error) {
      console.error('保存当前提示词失败:', error)
      return false
    }
  }

  /**
   * 加载当前选中的提示词
   */
  async loadCurrentPrompt(): Promise<string | null> {
    try {
      const data = await this.plugin.loadData(this.CURRENT_PROMPT_STORAGE_KEY)
      return data as string || null
    } catch (error) {
      console.error('加载当前提示词失败:', error)
      return null
    }
  }

  /**
   * 清除当前提示词选择
   */
  async clearCurrentPrompt(): Promise<boolean> {
    try {
      await this.plugin.saveData(this.CURRENT_PROMPT_STORAGE_KEY, '')
      return true
    } catch (error) {
      console.error('清除当前提示词失败:', error)
      return false
    }
  }

  /**
   * 初始化存储（从插件存储加载数据）
   */
  async init(): Promise<void> {
    try {
      // 确保设置存在
      const settings = await this.loadSettings()
      if (!settings) {
        const defaultSettings: AIGeneratorSettings = {
          systemPrompt: '',
          temperature: 0.7,
          maxTokens: 10000,
          enableTypewriter: true,
          contextMessageLimit: 5
        }
        await this.saveSettings(defaultSettings)
      }

      // 确保提示词列表存在
      const prompts = await this.loadPrompts()
      if (!prompts) {
        await this.savePrompts([])
      }
    } catch (error) {
      console.error('初始化AI生成器存储失败:', error)
    }
  }
}
