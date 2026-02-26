/**
* AI内容生成器数据存储管理
*/
import { Plugin } from 'siyuan'
import { PluginStorage } from '@/utils/pluginStorage'

/**
* AI生成器设置接口
*/
export interface AIGeneratorSettings {
  systemPrompt: string
  temperature: number
  maxTokens: number
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
  contextMessageLimit: number
  createdAt: number
}

/**
* AI内容生成器存储管理器
*/
export class AIGeneratorStorage {
  private storage: PluginStorage
  private readonly SETTINGS_STORAGE_KEY = 'ai-content-generator-settings'
  private readonly PROMPTS_STORAGE_KEY = 'ai-content-generator-prompts'
  private readonly CURRENT_PROMPT_STORAGE_KEY = 'ai-content-generator-current-prompt'
  private readonly COLLAPSED_SECTIONS_STORAGE_KEY = 'ai-content-generator-collapsed-sections'

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /**
   * 保存设置
   */
  async saveSettings(settings: AIGeneratorSettings): Promise<boolean> {
    return this.storage.save(this.SETTINGS_STORAGE_KEY, settings)
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<AIGeneratorSettings | null> {
    return this.storage.load<AIGeneratorSettings>(this.SETTINGS_STORAGE_KEY)
  }

  /**
   * 保存提示词配置列表
   */
  async savePrompts(prompts: AIPromptConfig[]): Promise<boolean> {
    return this.storage.save(this.PROMPTS_STORAGE_KEY, prompts)
  }

  /**
   * 加载提示词配置列表
   */
  async loadPrompts(): Promise<AIPromptConfig[]> {
    return this.storage.loadWithDefault<AIPromptConfig[]>(this.PROMPTS_STORAGE_KEY, [])
  }

  /**
   * 保存当前选中的提示词
   */
  async saveCurrentPrompt(promptName: string): Promise<boolean> {
    return this.storage.save(this.CURRENT_PROMPT_STORAGE_KEY, promptName)
  }

  /**
   * 加载当前选中的提示词
   */
  async loadCurrentPrompt(): Promise<string | null> {
    return this.storage.load<string>(this.CURRENT_PROMPT_STORAGE_KEY)
  }

  /**
   * 清除当前提示词选择
   */
  async clearCurrentPrompt(): Promise<boolean> {
    return this.storage.remove(this.CURRENT_PROMPT_STORAGE_KEY)
  }

  /**
   * 保存折叠状态
   */
  async saveCollapsedSections(collapsedSections: Record<string, boolean>): Promise<boolean> {
    return this.storage.save(this.COLLAPSED_SECTIONS_STORAGE_KEY, collapsedSections)
  }

  /**
   * 加载折叠状态
   */
  async loadCollapsedSections(): Promise<Record<string, boolean> | null> {
    return this.storage.load<Record<string, boolean>>(this.COLLAPSED_SECTIONS_STORAGE_KEY)
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
