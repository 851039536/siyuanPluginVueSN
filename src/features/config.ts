/**
 * 功能配置 - 单一数据源
 *
 * 所有功能在此注册，其他模块通过 FeatureId 类型获得编译时验证。
 * 添加/删除功能时，只需修改此文件，TypeScript 将自动检查：
 * - features/index.ts 导出是否一致（通过 `_assertExtends` 编译时断言）
 */

export interface FeatureAction {
  /** 操作键名 */
  key: string
  /** 操作标签 */
  label: string
  /** 快捷键 */
  hotkey: string
}

export interface FeatureMeta {
  id: string
  defaultTitle: string
  defaultDesc: string
  titleI18nKey?: string
  descI18nKey?: string
  actions?: FeatureAction[]
}

export const FEATURE_CONFIG = [
  {
    id: "tableOfContents",
    defaultTitle: "目录索引",
    defaultDesc: "快速生成文档目录和大纲",
  },
  {
    id: "imageCompressor",
    defaultTitle: "图片压缩",
    defaultDesc: "批量压缩文档中的图片",
    actions: [{
      key: "openCompressor",
      label: "打开压缩器",
      hotkey: "Ctrl+Alt+C",
    }],
  },
  {
    id: "docNavigation",
    defaultTitle: "文档导航",
    defaultDesc: "显示父子文档导航链接",
  },
  {
    id: "pageLock",
    defaultTitle: "页面锁定",
    defaultDesc: "锁定页面防止误编辑",
  },
  {
    id: "wordQuery",
    defaultTitle: "单词查询",
    defaultDesc: "快速查询单词释义",
  },
  {
    id: "generalSettings",
    defaultTitle: "通用设置",
    defaultDesc: "字体、标题、代码块等通用配置",
  },
  {
    id: "qrCode",
    defaultTitle: "二维码生成",
    defaultDesc: "生成文本或链接的二维码",
  },
  {
    id: "unitConverter",
    defaultTitle: "单位转换",
    defaultDesc: "快速转换各种单位",
  },
  {
    id: "shortcuts",
    defaultTitle: "快捷键面板",
    defaultDesc: "查看和管理快捷键",
  },
  {
    id: "diskBrowser",
    defaultTitle: "本地磁盘",
    defaultDesc: "浏览本地磁盘和文件夹",
  },
  {
    id: "codeImageGenerator",
    defaultTitle: "代码图片生成",
    defaultDesc: "生成代码截图，支持GitHub、Mac、卡通风格",
    descI18nKey: "enableCodeImageGeneratorDesc",
  },
  {
    id: "aiContentGenerator",
    defaultTitle: "AI信息生成",
    defaultDesc: "使用AI生成Markdown格式内容，支持自定义对话和上下文",
  },
  {
    id: "statistics",
    defaultTitle: "数据统计",
    defaultDesc: "显示笔记数据统计和分析",
  },
  {
    id: "pronunciation",
    defaultTitle: "谐音翻译",
    defaultDesc: "英文单词生成谐音记忆，中文词语翻译成英文后生成谐音",
    titleI18nKey: "pronunciationHelp",
  },
  {
    id: "encryption",
    defaultTitle: "内容加密",
    defaultDesc: "使用 AES-256-GCM 算法对选中文本进行加密和解密",
    descI18nKey: "enableEncryptionDesc",
  },
  {
    id: "video",
    defaultTitle: "视频管理器",
    defaultDesc: "管理和播放文档中的视频文件",
    actions: [{
      key: "openVideoManager",
      label: "打开管理器",
      hotkey: "Ctrl+Alt+V",
    }],
  },
  {
    id: "everythingSearch",
    defaultTitle: "Everything搜索",
    defaultDesc: "本地文件快速搜索工具",
    actions: [{
      key: "openEverythingSearch",
      label: "打开搜索",
      hotkey: "Ctrl+Alt+E",
    }],
  },
  {
    id: "statusBar",
    defaultTitle: "状态栏",
    defaultDesc: "在状态栏显示 CPU、内存使用情况及文档统计",
    titleI18nKey: "statusBar.title",
    descI18nKey: "statusBar.description",
  },
  {
    id: "floatingToolbar",
    defaultTitle: "浮动工具栏",
    defaultDesc: "选中文字时显示包含多种操作的工具栏",
    titleI18nKey: "floatingToolbar.title",
    descI18nKey: "floatingToolbarDescription",
  },
  {
    id: "floatingBox",
    defaultTitle: "悬浮框",
    defaultDesc: "页面右侧显示可展开的功能悬浮框",
    titleI18nKey: "floatingBox.title",
    descI18nKey: "floatingBox.description",
  },
  {
    id: "textDiff",
    defaultTitle: "文本对比",
    defaultDesc: "提供文本差异对比功能，支持字符、词语、行和补丁模式对比",
    titleI18nKey: "textDiff.title",
    descI18nKey: "enableTextDiffDesc",
  },
  {
    id: "base64Image",
    defaultTitle: "Base64图片转换",
    defaultDesc: "图片与Base64编码相互转换",
  },
  {
    id: "passwordVault",
    defaultTitle: "密码箱",
    defaultDesc: "加密存储和管理密码条目，支持分类和搜索",
  },
  {
    id: "skills",
    defaultTitle: "技能库",
    defaultDesc: "管理常用的Claude技能和模板",
    titleI18nKey: "skills.title",
    descI18nKey: "skills.description",
  },
  {
    id: "flashcardReading",
    defaultTitle: "单词阅读",
    defaultDesc: "闪卡式阅读工具，支持分类和翻转",
    titleI18nKey: "flashcardReading.title",
    descI18nKey: "flashcardReading.description",
  },
  {
    id: "heatmapMarker",
    defaultTitle: "热力图标记",
    defaultDesc: "自动标记文档中来自单词本的英文词汇，根据练习次数显示热力渐变",
  },
  {
    id: "translate",
    defaultTitle: "英译中替换",
    defaultDesc: "在浮动工具栏中快速翻译英文并替换",
    titleI18nKey: "floatingToolbar.translate",
  },
  {
    id: "docAnalysis",
    defaultTitle: "文档分析",
    defaultDesc: "分析文档内容大小，查找小文档",
    titleI18nKey: "docAnalysis.title",
    descI18nKey: "docAnalysis.description",
  },
  {
    id: "formatAssistant",
    defaultTitle: "排版助手",
    defaultDesc: "将Markdown文档转换为微信公众号等平台的富文本格式",
    actions: [{
      key: "openFormatAssistant",
      label: "打开排版助手",
      hotkey: "Ctrl+Alt+G",
    }],
  },
  {
    id: "htmlViewer",
    defaultTitle: "HTML展示",
    defaultDesc: "右键选中文本后以HTML方式预览，支持HTML片段的增删改查",
  },
  {
    id: "rssReader",
    defaultTitle: "RSS订阅",
    defaultDesc: "订阅和管理RSS/Atom源，在右侧边栏阅读文章",
    titleI18nKey: "rssReader.title",
    descI18nKey: "rssReader.description",
  },
  {
    id: "resourceManager",
    defaultTitle: "资源管理",
    defaultDesc: "管理思源笔记资源文件：查看、重命名、插入、清理资源",
    titleI18nKey: "resourceManager.panelTitle",
    descI18nKey: "resourceManager.description",
  },
  {
    id: "skillsViewer",
    defaultTitle: "Skills 查看器",
    defaultDesc: "查看和管理 AI 编程工具的 Skills 配置文件",
  },
  {
    id: "superPanel",
    defaultTitle: "超级面板（假）",
    defaultDesc: "test",
    titleI18nKey: "superPanel.title",
    descI18nKey: "superPanel.description",
  },
  {
    id: "themeColor",
    defaultTitle: "主题色",
    defaultDesc: "应用暖橙色全局主题色",
  },
] as const

/**
 * 功能 ID 联合类型 - 由 FEATURE_CONFIG 自动推导
 */
export type FeatureId = (typeof FEATURE_CONFIG)[number]["id"]
