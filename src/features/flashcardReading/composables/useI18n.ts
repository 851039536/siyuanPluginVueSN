/**
 * 统一的 I18n composable：提供带默认值的类型安全国际化文本
 */
import type { I18n } from "../types"
import { computed } from "vue"

/**
 * 所有国际化键的默认值
 */
export const DEFAULT_I18N: Required<I18n> = {
  panelTitle: "单词阅读",
  category: "类别",
  allCategories: "全部",
  searchPlaceholder: "搜索标题或内容...",
  total: "总计",
  filtered: "筛选",
  listView: "列表",
  singleView: "单卡",
  statisticsView: "统计",
  play: "播放",
  copyTitle: "复制单词",
  copyContent: "复制内容",
  editCard: "编辑",
  deleteCard: "删除",
  addCard: "添加卡片",
  refresh: "刷新",
  previous: "上一个",
  next: "下一个",
  randomCard: "随机",
  practiceCount: "练习",
  noCards: "暂无卡片",
  noPracticeData: "暂无练习数据",
  startPracticeHint: "开始练习单词，这里将显示你的学习统计",
  title: "标题",
  content: "内容",
  selectCategory: "请选择类别",
  customCategory: "自定义...",
  customCategoryPlaceholder: "输入自定义类别",
  cancel: "取消",
  save: "保存",
  close: "关闭",
  titlePlaceholder: "标题（不可重复）",
  contentPlaceholder: "内容",
  titleEmpty: "标题不能为空",
  titleDuplicate: "标题已存在",
  loadFailed: "加载卡片失败",
  updateSuccess: "卡片已更新",
  createSuccess: "卡片已创建",
  saveFailed: "保存失败",
  deleteSuccess: "卡片已删除",
  deleteFailed: "删除失败",
  confirmDelete: "确定要删除这张卡片吗？",
  playFailed: "播放失败",
  categoryStats: "类别统计",
  topCards: "练习排行榜",
  totalPractice: "总练习次数",
  practicedCards: "已练习卡片",
  totalCards: "总卡片数",
  masteryProgress: "掌握进度",
  typingView: "边学边写",
  typeTheWord: "请输入单词",
  clickToStartTyping: "点击开始输入...",
  correct: "正确!",
  skipCard: "跳过",
  caseInsensitive: "不区分大小写",
  caseSensitive: "区分大小写",
  instantReset: "立即重试",
  delayedReset: "稍后重试",
  coverMode: "盲打",
  revealMode: "看打",
  sessionCorrect: "正确",
  timerLabel: "计时",
  sessionSizeLabel: "每组",
  roundComplete: "本轮完成!",
}

/**
 * 在组件中使用：const t = useI18n(props.i18n)
 * 然后在模板中用 {{ t.xxx }} 替代 {{ i18n.xxx || '默认值' }}
 */
export function useI18n(i18n: I18n) {
  return computed(() => ({
    ...DEFAULT_I18N,
    ...i18n,
  }))
}
