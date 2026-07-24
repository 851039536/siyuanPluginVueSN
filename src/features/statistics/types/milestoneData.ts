// 里程碑卡片静态数据：等级称号、阈值成就、特殊成就、分类定义（不依赖 Vue 响应式与 i18n）

import type { IconKey } from "@/config/icons"

/** 里程碑/成就稀有度 */
export type Tier = "common" | "rare" | "epic" | "legendary"

/** 单个里程碑定义 */
export interface MilestoneDef {
  id: string
  icon: string
  label: string
  target: number
  type: string
  tier: Tier
}

/** 里程碑附带达成状态（供分类视图使用） */
export interface MilestoneState extends MilestoneDef {
  achieved: boolean
  progress: number
  current: number
  isNext: boolean
}

/** 里程碑分类定义（名称由组件侧注入 i18n） */
export interface CategoryDef {
  id: string
  icon: string
  name: string
  types: string[]
}

/** 里程碑分类基础定义（含 i18n 键 + 回退文本，名称在组件侧组装） */
export interface CategoryI18nDef {
  id: string
  icon: string
  types: string[]
  i18nKey: string
  fallback: string
}

/** 分类视图（每分类独立展开状态） */
export interface CategoryView {
  id: string
  icon: string
  name: string
  expanded: boolean
  achievedCount: number
  totalCount: number
  allItems: MilestoneState[]
  previewItems: MilestoneState[]
  hiddenCount: number
}

/** 成就定义 */
export interface AchievementDef {
  id: string
  icon: string
  title: string
  description: string
  tier: Tier
  check: () => boolean
  _custom?: boolean
}

/** 阈值型成就单项 */
export interface ThresholdItem { v: number, icon: string, title: string, desc: string, tier: Tier }
/** 阈值型成就分组 */
export interface ThresholdGroup { prefix: string, type: string, items: ThresholdItem[] }

/** 每个大阶级的等级数 */
export const TIER_SIZE = 20

/** 20 个基础称号（在阶级内循环使用） */
export const BASE_TITLES: { icon: string, title: string }[] = [
  { icon: "edit", title: "笔墨新秀" },
  { icon: "edit", title: "码字练手" },
  { icon: "file", title: "日记录者" },
  { icon: "edit", title: "摘抄达人" },
  { icon: "file", title: "读书笔记" },
  { icon: "list", title: "知识收集" },
  { icon: "folder", title: "整理能手" },
  { icon: "format", title: "归档达人" },
  { icon: "forward", title: "双链编织" },
  { icon: "list", title: "标签管理" },
  { icon: "lightbulb", title: "思维导图" },
  { icon: "format", title: "结构设计" },
  { icon: "search", title: "深度检索" },
  { icon: "lightbulb", title: "灵感捕手" },
  { icon: "star", title: "精准表达" },
  { icon: "star", title: "妙笔生花" },
  { icon: "file", title: "长篇大论" },
  { icon: "star", title: "笔耕不辍" },
  { icon: "star", title: "字字珠玑" },
  { icon: "star", title: "万字长城" },
]

/** 30 个阶级前缀（随等级递增） */
export const TIER_PREFIXES = [
  "初窥·", "入门·", "进阶·", "精通·", "熟手·", "高手·", "精英·", "大师·", "传说·", "神话·",
  "超凡·", "入圣·", "登峰·", "造极·", "通天·", "破界·", "无双·", "绝世·", "独步·", "万古·",
  "永恒·", "不朽·", "天道·", "轮回·", "混沌·", "鸿蒙·", "太初·", "无极·", "至尊·", "超越·",
]

/** 阈值型成就配置（数据驱动） */
export const THRESHOLD_ACHIEVEMENTS: ThresholdGroup[] = [
  {
    prefix: "ach",
    type: "notes",
    items: [
      { v: 1, icon: "star", title: "破冰之旅", desc: "创建第一篇笔记", tier: "common" },
      { v: 30, icon: "star", title: "小有积累", desc: "累计30篇笔记", tier: "common" },
      { v: 100, icon: "star", title: "百篇大关", desc: "累计100篇笔记", tier: "rare" },
      { v: 300, icon: "star", title: "三百篇成集", desc: "累计300篇笔记", tier: "rare" },
      { v: 500, icon: "star", title: "五百篇山丘", desc: "累计500篇笔记", tier: "epic" },
      { v: 1000, icon: "star", title: "千篇一律", desc: "累计1000篇笔记", tier: "epic" },
      { v: 3000, icon: "star", title: "三千篇帝国", desc: "累计3000篇笔记", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "blocks",
    items: [
      { v: 100, icon: "format", title: "积累起步", desc: "累计100个内容块", tier: "common" },
      { v: 500, icon: "format", title: "五百块基石", desc: "累计500个内容块", tier: "common" },
      { v: 2000, icon: "format", title: "内容大厦", desc: "累计2000个内容块", tier: "rare" },
      { v: 5000, icon: "format", title: "内容工厂", desc: "累计5000个内容块", tier: "rare" },
      { v: 10000, icon: "format", title: "万块之城", desc: "累计10000个内容块", tier: "epic" },
      { v: 30000, icon: "format", title: "三万块都市", desc: "累计30000个内容块", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "words",
    items: [
      { v: 10000, icon: "edit", title: "万字起步", desc: "累计写作1万字", tier: "common" },
      { v: 50000, icon: "edit", title: "五万字小成", desc: "累计写作5万字", tier: "common" },
      { v: 100000, icon: "list", title: "十万字成书", desc: "累计写作10万字", tier: "rare" },
      { v: 300000, icon: "list", title: "三十万字著述", desc: "累计写作30万字", tier: "rare" },
      { v: 1000000, icon: "star", title: "百万字巨著", desc: "累计写作100万字", tier: "epic" },
      { v: 3000000, icon: "star", title: "三百万字殿堂", desc: "累计写作300万字", tier: "epic" },
      { v: 10000000, icon: "star", title: "千万字传说", desc: "累计写作1000万字", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "notebooks",
    items: [
      { v: 1, icon: "file", title: "知识启航", desc: "创建第一个笔记本", tier: "common" },
      { v: 5, icon: "file", title: "知识花园", desc: "拥有5个笔记本", tier: "common" },
      { v: 10, icon: "list", title: "知识殿堂", desc: "拥有10个笔记本", tier: "rare" },
      { v: 20, icon: "star", title: "知识帝国", desc: "拥有20个笔记本", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "streak",
    items: [
      { v: 3, icon: "star", title: "三天打鱼", desc: "连续写作3天", tier: "common" },
      { v: 7, icon: "star", title: "一周坚持", desc: "连续写作7天", tier: "common" },
      { v: 14, icon: "star", title: "两周不辍", desc: "连续写作14天", tier: "rare" },
      { v: 30, icon: "star", title: "月度坚持", desc: "连续写作30天", tier: "rare" },
      { v: 60, icon: "star", title: "双月毅力", desc: "连续写作60天", tier: "epic" },
      { v: 100, icon: "star", title: "百日如一", desc: "连续写作100天", tier: "epic" },
      { v: 200, icon: "star", title: "两百日征程", desc: "连续写作200天", tier: "legendary" },
      { v: 365, icon: "star", title: "年度传奇", desc: "连续写作365天", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "activeDays",
    items: [
      { v: 30, icon: "list", title: "月度活跃", desc: "累计活跃30天", tier: "common" },
      { v: 100, icon: "list", title: "百日活跃", desc: "累计活跃100天", tier: "rare" },
      { v: 365, icon: "list", title: "年度活跃", desc: "累计活跃365天", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "tags",
    items: [
      { v: 1, icon: "list", title: "标签初体验", desc: "使用第一个标签", tier: "common" },
      { v: 10, icon: "list", title: "标签入门", desc: "使用10个标签", tier: "common" },
      { v: 50, icon: "star", title: "标签达人", desc: "使用50个标签", tier: "rare" },
    ],
  },
  {
    prefix: "ach",
    type: "backlinks",
    items: [
      { v: 1, icon: "forward", title: "链接世界", desc: "建立第一条双链", tier: "common" },
      { v: 100, icon: "forward", title: "知识织网", desc: "建立100条双链", tier: "common" },
      { v: 500, icon: "forward", title: "知识网络", desc: "建立500条双链", tier: "rare" },
      { v: 1000, icon: "forward", title: "知识图谱", desc: "建立1000条双链", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "assets",
    items: [
      { v: 1, icon: "folder", title: "资源收集者", desc: "添加第一个附件", tier: "common" },
      { v: 30, icon: "folder", title: "资源小仓", desc: "积累30个附件", tier: "common" },
      { v: 100, icon: "folder", title: "资源宝库", desc: "积累100个附件", tier: "rare" },
    ],
  },
  {
    prefix: "ach",
    type: "images",
    items: [
      { v: 50, icon: "image", title: "图片收藏家", desc: "积累50张图片", tier: "common" },
      { v: 200, icon: "image", title: "影像达人", desc: "积累200张图片", tier: "rare" },
      { v: 1000, icon: "image", title: "万图之王", desc: "积累1000张图片", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "code",
    items: [
      { v: 1, icon: "code", title: "代码新秀", desc: "创建第一个代码块", tier: "common" },
      { v: 10, icon: "code", title: "代码初试", desc: "创建10个代码块", tier: "common" },
      { v: 50, icon: "code", title: "编程爱好者", desc: "创建50个代码块", tier: "rare" },
      { v: 200, icon: "code", title: "代码工匠", desc: "创建200个代码块", tier: "epic" },
    ],
  },
]

/** 特殊（meta）成就（check 由组件侧注入） */
export const META_ACHIEVEMENTS: Omit<AchievementDef, "check">[] = [
  { id: "ach-all-common", icon: "star", title: "全面初成", description: "解锁全部普通里程碑", tier: "epic" },
  { id: "ach-half-all", icon: "star", title: "半程里程碑", description: "达成一半里程碑", tier: "epic" },
  { id: "ach-all-rare", icon: "star", title: "稀有全解锁", description: "解锁全部稀有里程碑", tier: "legendary" },
  { id: "ach-level-10", icon: "star", title: "登峰造极", description: "达到 Lv.10", tier: "legendary" },
]

/** 里程碑分类基础定义（名称由组件侧注入 i18n） */
export const CATEGORY_DEFS: CategoryI18nDef[] = [
  { id: "writing", icon: "edit", types: ["notes", "words", "notebooks"], i18nKey: "catWriting", fallback: "写作达人" },
  { id: "knowledge", icon: "lightbulb", types: ["tags", "backlinks"], i18nKey: "catKnowledge", fallback: "知识管理" },
  { id: "rich", icon: "folder", types: ["blocks", "assets", "images", "code"], i18nKey: "catRich", fallback: "内容丰富" },
  { id: "persistence", icon: "star", types: ["streak", "activeDays"], i18nKey: "catPersistence", fallback: "坚持不懈" },
]

/** 成就墙分类 Tab 定义 */
export interface AchCategory { id: string, icon: string, name: string, types?: string[] }
export const ACH_CATEGORIES: AchCategory[] = [
  { id: "all", icon: "star", name: "全部" },
  { id: "writing", icon: "edit", name: "写作达人", types: ["notes", "words", "notebooks"] },
  { id: "knowledge", icon: "lightbulb", name: "知识管理", types: ["tags", "backlinks"] },
  { id: "rich", icon: "folder", name: "内容丰富", types: ["blocks", "assets", "images", "code"] },
  { id: "persistence", icon: "star", name: "坚持不懈", types: ["streak", "activeDays"] },
  { id: "meta", icon: "star", name: "特殊", types: ["meta", "custom"] },
]

/** 里程碑类型元数据（图标 + 标签格式化函数） */
export type TypeMeta = Record<string, { icon: IconKey, labelFn: (v: number) => string }>
