/**
 * 技能学习功能 - 内置预设卡片数据（按语言分文件，此处聚合导出）
 */
import type { CreateSkillDTO } from "../types"
import { PRESET_CARDS_CSHARP } from "./presetCSharp"
import { PRESET_CARDS_JAVASCRIPT } from "./presetJavaScript"
import { PRESET_CARDS_TYPESCRIPT } from "./presetTypeScript"
import { PRESET_CARDS_VUE } from "./presetVue"

export const PRESET_CARDS: CreateSkillDTO[] = [
  ...PRESET_CARDS_CSHARP,
  ...PRESET_CARDS_JAVASCRIPT,
  ...PRESET_CARDS_TYPESCRIPT,
  ...PRESET_CARDS_VUE,
]
