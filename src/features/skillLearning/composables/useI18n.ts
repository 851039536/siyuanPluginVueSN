/**
 * 技能学习 - 国际化 composable
 */
import type { SkillI18n } from "../types"
import { computed } from "vue"

export const DEFAULT_I18N: Required<SkillI18n> = {
  panelTitle: "技能学习",
  listView: "列表",
  flashcardView: "闪卡",
  reviewView: "复习",
  addCard: "添加卡片",
  editCard: "编辑卡片",
  deleteCard: "删除卡片",
  importCards: "批量导入",
  searchPlaceholder: "搜索卡片...",
  allLanguages: "全部语言",
  allCategories: "全部分类",
  allDifficulties: "全部难度",
  category: "分类",
  language: "语言",
  difficulty: "难度",
  title_: "题目",
  answer: "答案",
  codeSnippet: "代码片段",
  tags: "标签",
  practiceCount: "练习次数",
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
  remembered: "记得",
  fuzzy: "模糊",
  forgot: "忘记",
  prevCard: "上一张",
  nextCard: "下一张",
  randomCard: "随机",
  flipCard: "翻转",
  progress: "进度",
  save: "保存",
  cancel: "取消",
  confirmDelete: "确定要删除这张卡片吗？",
  deleteSuccess: "卡片已删除",
  saveSuccess: "保存成功",
  createSuccess: "卡片已创建",
  updateSuccess: "卡片已更新",
  importSuccess: "导入完成",
  noCards: "暂无卡片，点击右上角添加",
  noReviewCards: "复习已完成，所有卡片都已练习",
  reviewComplete: "本轮复习完成！",
  totalCards: "总卡片数",
  practicedCards: "已练习",
  presetDataLoaded: "预设数据已加载",
  importPreview: "导入预览",
  importMarkdown: "导入 Markdown",
  importHint: "每张卡片格式：## 标题 \\n\\n 描述内容 \\n\\n ```language\\n  代码 \\n```",
  parseResult: "解析结果",
  willImport: "将导入",
  cards: "张卡片",
  close: "关闭",
  confirmImport: "确认导入",
  noValidCards: "未解析到有效卡片，请检查格式",
}

export function useI18n(i18n: SkillI18n | undefined) {
  return computed<Required<SkillI18n>>(() => ({
    ...DEFAULT_I18N,
    ...(i18n || {}),
  }))
}
