/**
 * 超级面板类型定义
 */
import type { FeatureIconKey } from '@/config/icons'

/**
 * 功能操作
 */
export interface FeatureAction {
  /** 操作键名 */
  key: string
  /** 操作标签 */
  label: string
  /** 快捷键 */
  hotkey: string
}

/**
 * 功能配置
 */
export interface Feature {
  /** 功能ID */
  id: string
  /** 图标键名 */
  iconKey: FeatureIconKey | 'textDiff' | 'skills' | 'base64Image' | 'translate'
  /** 功能标题 */
  title: string
  /** 功能描述 */
  desc: string
  /** 是否启用 */
  enabled: boolean
  /** 操作列表 */
  actions: FeatureAction[]
}
