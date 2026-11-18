/**
 * 提示词库类型定义与共享常量
 *
 * 按分层规范：类型 + 被多文件共用的元数据/常量集中于此，禁止在组件内重复定义。
 */

import type { ComputedRef, Ref } from "vue"

/** 默认分类色（新分类表单初值 / 默认与"全部"分类兜底色，全模块单源） */
export const DEFAULT_CATEGORY_COLOR = "#d97757"

/** 内置分类 ID（禁止删除，与用户自定义分类分离） */
export const PROMPTS_DEFAULT_CATEGORY_ID = "default"
export const PROMPTS_ALL_CATEGORY_ID = "all"

/** 数据条数上限（growth 型槽位必须有上限或清理路径，见 AGENTS.md 存储规范） */
export const MAX_PROMPTS = 500
export const MAX_CATEGORIES = 100

/** Modal 尺寸（命名常量，替换散落的字符串字面量） */
export const PROMPTS_MODAL_SIZE = {
  width: "80vw",
  height: "80vh",
} as const

/** 提示词内容块 */
export interface PromptContent {
  id: string
  label: string
  text: string
}

export interface Prompt {
  id: string
  title: string
  description: string
  /** 动态内容块列表 */
  contents: PromptContent[]
  category: string
  /** @deprecated 旧格式字段，仅用于迁移检测 */
  content?: string
  /** @deprecated 旧格式字段，仅用于迁移检测 */
  content2?: string
  /** @deprecated 旧格式字段，仅用于迁移检测 */
  content3?: string
}

export interface PromptCategory {
  id: string
  name: string
  color: string
}

/** 展示层提示词（在 Prompt 基础上注入分类元数据），供网格组件渲染 */
export interface PromptDisplay extends Prompt {
  catName: string
  catColor: string
  catBgColor: string
}

/** 提示词管理器对外接口（供弹窗组件以 manager 实例形式消费） */
export type PromptsManager = {
  prompts: Ref<Prompt[]>
  loading: Ref<boolean>
  load: () => Promise<void>
  add: (prompt: Prompt) => Promise<void>
  update: (updated: Prompt) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** 分类管理器对外接口（供弹窗组件以 manager 实例形式消费） */
export type CategoryManager = {
  categories: Ref<PromptCategory[]>
  allCategories: ComputedRef<PromptCategory[]>
  load: () => Promise<void>
  add: (category: PromptCategory) => Promise<void>
  remove: (id: string) => Promise<void>
}

/**
 * 提示词库弹窗 i18n 契约。
 * 所有文案均为必填 string，配合 DEFAULT_PROMPTS_I18N 默认值消除 `(i18n||{}).x!` 产生 undefined 的缺陷。
 * 键集合与 src/i18n/{zh_CN,en_US}/prompts.json 的 modal 节点一致（edit 为死键，已移除）。
 */
export interface PromptsI18n {
  /** 允许作为 Record<string, string> 传给仍按通用字典声明的子组件 prop */
  [key: string]: string
  title: string
  close: string
  addPrompt: string
  editPrompt: string
  delete: string
  search: string
  titleLabel: string
  description: string
  content: string
  cancel: string
  save: string
  titlePlaceholder: string
  descriptionPlaceholder: string
  contentPlaceholder: string
  noPrompts: string
  noPromptsFound: string
  clickToCopy: string
  contents: string
  contentLabel: string
  contentLabelPlaceholder: string
  addContentBlock: string
  moveUp: string
  moveDown: string
  removeContent: string
  manageCategories: string
  add: string
  categoryName: string
  category: string
  loading: string
  loadFailed: string
  deleteConfirmTitle: string
  deleteConfirmMsg: string
  deleteConfirmOK: string
  categoryNotEmpty: string
  promptDeleted: string
  copyFailed: string
  titleRequired: string
  contentRequired: string
  defaultCategory: string
  allCategory: string
  contentBlockLabel: string
  saveFailed: string
  searchPrompts: string
  promptCardLabel: string
  clickCopyAria: string
  categoryColor: string
  categoryNav: string
  /** 达到条数上限的提示（新增被拒绝，非静默丢弃） */
  limitReached: string
}

/**
 * i18n 缺省兜底（中文）。仅当调用方未传 i18n 或键缺失时生效，
 * 保证 UI 不会出现 undefined 文案，也避免使用 `!` 非空断言。
 */
export const DEFAULT_PROMPTS_I18N: PromptsI18n = {
  title: "提示词库",
  close: "关闭",
  addPrompt: "添加提示词",
  editPrompt: "编辑提示词",
  delete: "删除",
  search: "搜索提示词...",
  titleLabel: "标题",
  description: "描述",
  content: "内容",
  cancel: "取消",
  save: "保存",
  titlePlaceholder: "请输入提示词标题",
  descriptionPlaceholder: "请输入提示词描述",
  contentPlaceholder: "请输入提示词内容",
  noPrompts: "暂无提示词，点击添加",
  noPromptsFound: "未找到匹配的提示词",
  clickToCopy: "复制",
  contents: "内容块",
  contentLabel: "内容标签",
  contentLabelPlaceholder: "内容标签",
  addContentBlock: "添加内容块",
  moveUp: "上移",
  moveDown: "下移",
  removeContent: "删除内容块",
  manageCategories: "管理分类",
  add: "添加",
  categoryName: "分类名称",
  category: "分类",
  loading: "加载中...",
  loadFailed: "加载提示词库失败",
  deleteConfirmTitle: "确认删除",
  deleteConfirmMsg: "确定要删除此提示词吗？此操作不可撤销。",
  deleteConfirmOK: "确认删除",
  categoryNotEmpty: "无法删除：该分类下还有提示词",
  promptDeleted: "提示词已删除",
  copyFailed: "复制失败，请手动复制",
  titleRequired: "标题是必填项",
  contentRequired: "至少需要一个非空内容块",
  defaultCategory: "默认",
  allCategory: "全部",
  contentBlockLabel: "内容块",
  saveFailed: "保存失败",
  searchPrompts: "搜索提示词",
  promptCardLabel: "提示词",
  clickCopyAria: "点击复制",
  categoryColor: "分类颜色",
  categoryNav: "分类导航",
  limitReached: "已达数量上限，请先删除部分条目",
}
