import type { Plugin } from "siyuan"
/**
 * 文档分析 - 发布功能存储管理
 */
import type {
  DocPublishState,
  PlatformConfig,
} from "./publish"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 发布功能设置 */
export interface PublishSettings {
  /** 已配置的平台列表 */
  platforms: PlatformConfig[]
  /** 默认选中的平台 ID */
  defaultPlatformIds: string[]
  /** 是否自动添加 Front Matter */
  autoFrontMatter: boolean
  /** 是否发布时自动替换图片链接 */
  autoReplaceImages: boolean
  /** 发布后自动标记书签为"已发布" */
  autoMarkPublished: boolean
  /** Front Matter 模板 */
  frontMatterTemplate: string
}

/** 发布设置默认值 */
export const DEFAULT_PUBLISH_SETTINGS: PublishSettings = {
  platforms: [],
  defaultPlatformIds: [],
  autoFrontMatter: true,
  autoReplaceImages: false,
  autoMarkPublished: true,
  frontMatterTemplate: `---
title: {{title}}
date: {{date}}
tags:
  - {{tags}}
categories:
  - {{categories}}
---`,
}

/** 发布历史记录（文档 ID -> 发布状态） */
export type PublishHistory = Record<string, DocPublishState>

/**
 * 发布功能存储管理类
 */
export class PublishStorage {
  readonly settings: TypedStorage<PublishSettings>
  readonly history: TypedStorage<PublishHistory>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "doc-analysis-publish-settings", DEFAULT_PUBLISH_SETTINGS)
    this.history = new TypedStorage(storage, "doc-analysis-publish-history", {})
  }

  /** 加载设置 */
  async loadSettings(): Promise<PublishSettings> {
    return this.settings.loadOrDefault()
  }

  /** 保存设置 */
  async saveSettings(settings: PublishSettings): Promise<void> {
    await this.settings.save(settings)
  }

  /** 加载发布历史 */
  async loadHistory(): Promise<PublishHistory> {
    return this.history.loadOrDefault()
  }

  /** 保存发布历史 */
  async saveHistory(history: PublishHistory): Promise<void> {
    await this.history.save(history)
  }

  /** 获取指定文档的发布状态 */
  async getDocPublishState(docId: string): Promise<DocPublishState | null> {
    const history = await this.loadHistory()
    return history[docId] || null
  }

  /** 更新指定文档的发布状态 */
  async updateDocPublishState(docId: string, state: DocPublishState): Promise<void> {
    const history = await this.loadHistory()
    history[docId] = state
    await this.saveHistory(history)
  }

  /** 获取已配置的平台 */
  async getPlatforms(): Promise<PlatformConfig[]> {
    const settings = await this.loadSettings()
    return settings.platforms.filter((p) => p.enabled)
  }

  /** 通过 ID 获取平台 */
  async getPlatformById(id: string): Promise<PlatformConfig | null> {
    const settings = await this.loadSettings()
    return settings.platforms.find((p) => p.id === id) || null
  }

  /** 添加或更新平台 */
  async savePlatform(platform: PlatformConfig): Promise<void> {
    const settings = await this.loadSettings()
    const idx = settings.platforms.findIndex((p) => p.id === platform.id)
    if (idx >= 0) {
      settings.platforms[idx] = platform
    } else {
      settings.platforms.push(platform)
    }
    await this.saveSettings(settings)
  }

  /** 删除平台 */
  async removePlatform(id: string): Promise<void> {
    const settings = await this.loadSettings()
    settings.platforms = settings.platforms.filter((p) => p.id !== id)
    settings.defaultPlatformIds = settings.defaultPlatformIds.filter((pid) => pid !== id)
    await this.saveSettings(settings)
  }
}
