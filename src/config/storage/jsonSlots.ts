/**
 * 存储槽注册表 - JSON 槽
 *
 * 一行一槽，按 owner 分组。key 必须与功能侧 TypedStorage 的 key 完全一致；
 * 存量不合规命名标 legacyName: true（冻结，不做 kebab 校验）。
 */
import { jsonSlot } from "./helpers"

export const JSON_SLOTS = [
  // ==================== core ====================
  jsonSlot("core.pluginSettings", ["core"], "plugin-settings", "插件全局配置", {
    sensitive: true,
    resettable: false,
    notes: "AI 密钥 / 档案经 AES-GCM 加密；导出默认排除，导入需显式确认",
  }),

  // ==================== generalSettings ====================
  jsonSlot("generalSettings.font", ["generalSettings"], "font-settings", "字体设置"),
  jsonSlot("generalSettings.codeblock", ["generalSettings"], "codeblock-settings", "代码块设置"),
  jsonSlot("generalSettings.heading", ["generalSettings"], "heading-settings", "标题设置"),
  jsonSlot("generalSettings.list", ["generalSettings"], "list-settings", "列表设置"),
  jsonSlot("generalSettings.highlight", ["generalSettings"], "highlight-settings", "高亮设置"),
  jsonSlot("generalSettings.documentFont", ["generalSettings"], "document-font-settings", "文档字体设置"),
  jsonSlot("generalSettings.tableStyle", ["generalSettings"], "table-style-settings", "表格样式设置"),
  jsonSlot("generalSettings.listStyle", ["generalSettings"], "list-style-settings", "列表样式设置"),
  jsonSlot("generalSettings.docCount", ["generalSettings"], "doc-count-settings", "文档数设置"),
  jsonSlot("generalSettings.tabPin", ["generalSettings"], "tabpin-settings", "页签钉住设置"),
  jsonSlot("generalSettings.appearance", ["generalSettings"], "appearance-settings", "外观设置"),

  // ==================== pageLock / generalSettings（共享） ====================
  jsonSlot("pageLock.globalPassword", ["pageLock", "generalSettings"], "global-password", "全局锁定密码", {
    sensitive: true,
    resettable: false,
    notes: "仅存 PBKDF2 哈希 + 盐；禁止在通用设置恢复默认时删除",
  }),
  jsonSlot("pageLock.locks", ["pageLock"], "page-lock-data", "页面锁定记录", {
    growth: true,
    sensitive: true,
    notes: "仅存密码哈希 + 盐；随锁定文档数增长",
  }),

  // ==================== gitPush ====================
  jsonSlot("gitPush.projects", ["gitPush"], "git-push-projects", "Git 项目", { growth: true }),
  jsonSlot("gitPush.categories", ["gitPush"], "git-push-categories", "Git 项目分类"),
  jsonSlot("gitPush.concurrency", ["gitPush"], "git-push-concurrency", "Git 并发数"),
  jsonSlot("gitPush.concurrencyMigration", ["gitPush"], "git-push-concurrency-migration", "并发迁移标记"),
  jsonSlot("gitPush.networkTimeout", ["gitPush"], "git-push-network-timeout", "网络超时"),
  jsonSlot("gitPush.localTimeout", ["gitPush"], "git-push-local-timeout", "本地超时"),
  jsonSlot("gitPush.tags", ["gitPush"], "git-push-tags", "Git 标签"),
  jsonSlot("gitPush.commitTemplates", ["gitPush"], "git-push-commit-templates", "提交模板"),
  jsonSlot("gitPush.opsPaused", ["gitPush"], "git-push-ops-paused", "Git 操作暂停状态"),
  jsonSlot("gitPush.showArchived", ["gitPush"], "git-push-show-archived", "显示归档项目"),
  jsonSlot("gitPush.branchMode", ["gitPush"], "git-push-branch-mode", "推送分支模式"),
  jsonSlot("gitPush.cardLayout", ["gitPush"], "git-push-card-layout", "项目卡片布局"),
  jsonSlot("gitPush.cardCompact", ["gitPush"], "git-push-card-compact", "项目卡片紧凑密度"),
  jsonSlot("gitPush.compareBase", ["gitPush"], "git-push-compare-base", "对比基准分支"),
  jsonSlot("gitPush.opLogs", ["gitPush"], "git-push-op-logs", "Git 操作日志", {
    growth: true,
    notes: "上限 300 条；整份 JSON 重写，P0 迁 SQLite",
  }),
  jsonSlot("gitPush.analysisCache", ["gitPush"], "git-push-analysis-cache", "提交分析缓存", {
    growth: true,
    notes: "实测 1.49MB / 6786 条；P0 迁 SQLite",
  }),
  jsonSlot("gitPush.lineStatsCache", ["gitPush"], "git-push-line-stats-cache", "行数统计缓存", {
    growth: true,
    notes: "与 gp_project_stats / gp_file_lines / filelines.ndjson 重复，P0 下线",
  }),
  jsonSlot("gitPush.analysisView", ["gitPush"], "git-push-analysis-view", "分析视图偏好"),
  jsonSlot("gitPush.reportPrefs", ["gitPush"], "git-push-report-prefs", "提交报告偏好"),
  jsonSlot("gitPush.consistencyCache", ["gitPush"], "git-push-consistency-cache", "一致性检查缓存", {
    growth: true,
  }),
  jsonSlot("gitPush.ruleCheckPrefs", ["gitPush"], "git-push-rulecheck-prefs", "提交规则检查偏好"),
  jsonSlot("gitPush.commitFixPrefs", ["gitPush"], "git-push-commitfix-prefs", "提交信息修正偏好"),
  jsonSlot("gitPush.dropCommitPrefs", ["gitPush"], "git-push-dropcommit-prefs", "丢弃提交偏好"),
  jsonSlot("gitPush.repoCleanPrefs", ["gitPush"], "git-push-repoclean-prefs", "仓库清理偏好"),
  jsonSlot("gitPush.bfgPrefs", ["gitPush"], "git-push-bfg-prefs", "BFG 清理偏好"),
  jsonSlot("gitPush.reportCache", ["gitPush"], "git-push-report-cache", "提交报告缓存", {
    growth: true,
    notes: "整份 JSON 重写，P0 迁 SQLite",
  }),
  jsonSlot("gitPush.indexMeta", ["gitPush"], "git-push-index-meta", "提交索引元数据"),
  jsonSlot("gitPush.indexEnabled", ["gitPush"], "git-push-index-enabled", "提交索引开关"),
  jsonSlot("gitPush.indexMaxCommits", ["gitPush"], "git-push-index-max-commits", "索引最大提交数"),
  jsonSlot("gitPush.scanDir", ["gitPush"], "git-push-scan-dir", "扫描导入目录"),
  jsonSlot("gitPush.probeConfig", ["gitPush"], "git-push-probe-config", "实时探测配置"),
  jsonSlot("gitPush.profiles", ["gitPush"], "git-push-profiles", "推送账号", {
    sensitive: true,
    notes: "推送令牌密文落盘；导出默认排除",
  }),
  jsonSlot("gitPush.defaultProfile", ["gitPush"], "git-push-default-profile", "默认推送账号"),
  jsonSlot("gitPush.customIdes", ["gitPush"], "git-push-custom-ides", "自定义 IDE 列表"),
  jsonSlot("gitPush.scriptSessionPids", ["gitPush"], "script-session-pids", "脚本会话进程 ID"),

  // ==================== passwordVault ====================
  jsonSlot("passwordVault.masterPassword", ["passwordVault"], "password-vault-master-password", "主密码哈希", {
    sensitive: true,
    resettable: false,
    notes: "仅存哈希；清空将导致条目永久不可解密",
  }),
  jsonSlot("passwordVault.verifySalt", ["passwordVault"], "password-vault-verify-salt", "验证盐", {
    sensitive: true,
    resettable: false,
    notes: "与主密码绑定，清空将导致无法验证",
  }),
  jsonSlot("passwordVault.encryptionSalt", ["passwordVault"], "password-vault-encryption-salt", "加密盐", {
    sensitive: true,
    resettable: false,
    notes: "与条目加密绑定，清空将导致无法解密",
  }),
  jsonSlot("passwordVault.hint", ["passwordVault"], "password-vault-hint", "密码提示", {
    sensitive: true,
    notes: "提示语可能泄露线索；导出默认排除",
  }),
  jsonSlot("passwordVault.entries", ["passwordVault"], "password-vault-entries", "密码条目", {
    growth: true,
    sensitive: true,
    notes: "条目整体加密；导出需用户显式勾选",
  }),
  jsonSlot("passwordVault.categories", ["passwordVault"], "password-vault-categories", "密码分类"),

  // ==================== docAnalysis ====================
  jsonSlot("docAnalysis.options", ["docAnalysis"], "doc-analysis-options", "文档分析选项"),
  jsonSlot("docAnalysis.platforms", ["docAnalysis"], "doc-analysis-platforms", "发布平台元数据"),
  jsonSlot("docAnalysis.dupFilter", ["docAnalysis"], "doc-analysis-dup-filter", "重名过滤规则"),
  jsonSlot("docAnalysis.publishPromote", ["docAnalysis"], "doc-analysis-publish-promote", "发布推广配置"),
  jsonSlot("docAnalysis.healthSettings", ["docAnalysis"], "doc-analysis-health-settings", "健康度设置"),
  jsonSlot("docAnalysis.viewSettings", ["docAnalysis"], "doc-analysis-view-settings", "视图设置"),

  // ==================== s3Backup / s3FileManager ====================
  jsonSlot("s3Backup.config", ["s3Backup", "s3FileManager"], "s3-backup-config", "S3 连接配置", {
    sensitive: true,
    resettable: false,
    notes: "AK/SK 经 AES-GCM 加密；s3FileManager 只读共享",
  }),
  jsonSlot("s3Backup.settings", ["s3Backup"], "s3-backup-settings", "S3 备份设置"),
  jsonSlot("s3Backup.history", ["s3Backup"], "s3-backup-history", "本地备份历史", { growth: true, notes: "上限 50" }),
  jsonSlot("s3Backup.log", ["s3Backup"], "s3-backup-log", "S3 备份日志", { growth: true, notes: "上限 200" }),
  jsonSlot("s3Backup.checksums", ["s3Backup"], "s3-backup-checksums", "备份校验值", { growth: true, notes: "上限 100" }),
  jsonSlot("s3Backup.uploadHostMap", ["s3Backup"], "s3-backup-upload-host-map", "备份上传设备映射", {
    growth: true,
    notes: "上限 200",
  }),
  jsonSlot("s3FileManager.config", ["s3FileManager"], "s3-file-manager-config", "S3 文件管理配置", {
    sensitive: true,
    resettable: false,
    notes: "AK/SK 经 AES-GCM 加密",
  }),
  jsonSlot("s3FileManager.prefs", ["s3FileManager"], "s3-file-manager-prefs", "S3 文件管理偏好"),

  // ==================== rssReader ====================
  jsonSlot("rssReader.settings", ["rssReader"], "rssReader-settings", "RSS 设置", { legacyName: true }),
  jsonSlot("rssReader.feeds", ["rssReader"], "rssReader-feeds", "RSS 订阅源", { growth: true, legacyName: true }),
  jsonSlot("rssReader.items", ["rssReader"], "rssReader-items", "RSS 文章", {
    growth: true,
    legacyName: true,
    notes: "标记单篇已读会重写约 1.2MB；P0 迁 SQLite",
  }),

  // ==================== htmlViewer ====================
  jsonSlot("htmlViewer.snippets", ["htmlViewer"], "html-viewer-snippets", "HTML 片段", { growth: true }),
  jsonSlot("htmlViewer.categories", ["htmlViewer"], "html-viewer-categories", "HTML 片段分类"),

  // ==================== prompts ====================
  jsonSlot("prompts.prompts", ["prompts"], "siyuan-prompts", "提示词", { growth: true, legacyName: true }),
  jsonSlot("prompts.categories", ["prompts"], "siyuan-categories", "提示词分类", { legacyName: true }),
  jsonSlot("prompts.legacySkills", ["prompts"], "siyuan-skills", "旧版技能（已迁移）", {
    legacyName: true,
    exportable: false,
    resettable: false,
    notes: "只回读不删除",
  }),

  // ==================== quickNote ====================
  jsonSlot("quickNote.data", ["quickNote"], "quick-note-data", "速记数据", { growth: true }),
  jsonSlot("quickNote.settings", ["quickNote"], "quick-note-settings", "速记设置"),

  // ==================== statusBar ====================
  jsonSlot("statusBar.shortcuts", ["statusBar"], "statusBar-shortcuts", "状态栏快捷入口", { legacyName: true }),
  jsonSlot("statusBar.monitors", ["statusBar"], "statusBar-monitors", "状态栏监控项", { legacyName: true }),
  jsonSlot("statusBar.categories", ["statusBar"], "statusBar-categories", "状态栏分类", { legacyName: true }),
  jsonSlot("statusBar.featureCategory", ["statusBar"], "statusBar-feature-category", "功能分类映射", { legacyName: true }),

  // ==================== statistics ====================
  jsonSlot("statistics.history", ["statistics"], "statistics-history", "统计历史快照", {
    growth: true,
    notes: "每天 +1 且无裁剪，整份重写；P1 迁 SQLite",
  }),
  jsonSlot("statistics.settings", ["statistics"], "statistics-settings", "统计设置"),
  jsonSlot("statistics.milestoneRules", ["statistics"], "milestone-rules", "里程碑规则"),
  jsonSlot("statistics.milestoneAchievements", ["statistics"], "milestone-custom-achievements", "自定义成就"),
  jsonSlot("statistics.milestoneLevelConfig", ["statistics"], "milestone-level-config", "等级配置"),

  // ==================== flashcardReading / floatingToolbar ====================
  jsonSlot("flashcardReading.cards", ["flashcardReading", "floatingToolbar"], "flashcard-cards", "闪卡", {
    growth: true,
    notes: "改一张卡重写约 126KB（实测）",
  }),
  jsonSlot("flashcardReading.typingSettings", ["flashcardReading"], "flashcard-typing-settings", "打字练习设置"),

  // ==================== skillLearning ====================
  jsonSlot("skillLearning.cards", ["skillLearning"], "skill-learning-cards", "技能卡片", { growth: true }),
  jsonSlot("skillLearning.presetLoaded", ["skillLearning"], "skill-learning-preset-loaded", "预设加载标记"),

  // ==================== encryption ====================
  jsonSlot("encryption.password", ["encryption"], "encryption-password", "文档加密密码", {
    sensitive: true,
    resettable: false,
    notes: "经 settingsCrypto 加密落盘；清空将导致既有密文无法解密",
  }),
  jsonSlot("encryption.legacyPassword", ["encryption"], "encryption_password.json", "旧版加密密码", {
    legacyName: true,
    exportable: false,
    resettable: false,
    notes: "旧 key：明文且带 .json 后缀；迁移到 encryption-password 后删除",
  }),

  // ==================== apiDebugger ====================
  jsonSlot("apiDebugger.settings", ["apiDebugger"], "api-debugger-settings", "API 调试器历史", {
    growth: true,
    sensitive: true,
    notes: "请求头/体可能含密钥；上限 50；导出默认排除",
  }),

  // ==================== everythingSearch ====================
  jsonSlot("everythingSearch.config", ["everythingSearch"], "everything-search-config", "Everything 配置"),
  jsonSlot("everythingSearch.options", ["everythingSearch"], "everything-search-options", "Everything 选项"),
  jsonSlot("everythingSearch.cacheClean", ["everythingSearch"], "everything-search-cache-clean", "缓存清理偏好"),

  // ==================== imageCreation ====================
  jsonSlot("imageCreation.cover", ["imageCreation"], "image-creation-cover-settings", "封面设置"),
  jsonSlot("imageCreation.codeImage", ["imageCreation"], "image-creation-code-image-settings", "代码图片设置"),

  // ==================== 单设置功能 ====================
  jsonSlot("docNavigation.settings", ["docNavigation"], "docNavigation-settings", "文档导航设置", { legacyName: true }),
  jsonSlot("diskBrowser.settings", ["diskBrowser"], "disk-browser-settings", "本地磁盘设置"),
  jsonSlot("minimalBrowser.settings", ["minimalBrowser"], "minimal-browser-settings", "极简浏览器设置"),
  jsonSlot("bookmarkMarker.settings", ["bookmarkMarker"], "bookmark-marker-settings", "书签标记设置"),
  jsonSlot("textDiff.settings", ["textDiff"], "textdiff-settings", "文本对比设置", { legacyName: true }),
  jsonSlot("formatAssistant.settings", ["formatAssistant"], "format-assistant-settings", "排版助手设置"),
  jsonSlot("aiContentGenerator.settings", ["aiContentGenerator"], "ai-content-generator-settings", "AI 信息生成设置"),
  jsonSlot("componentPreview.size", ["componentPreview"], "component-preview-size", "组件预览尺寸"),

  // ==================== toolCollection ====================
  jsonSlot("toolCollection.tabOrder", ["toolCollection"], "toolCollection-tabOrder", "工具排序", { legacyName: true }),
  jsonSlot("toolCollection.width", ["toolCollection"], "toolCollection-width", "面板宽度", { legacyName: true }),
  jsonSlot("toolCollection.height", ["toolCollection"], "toolCollection-height", "面板高度", { legacyName: true }),
  jsonSlot("toolCollection.wordQuery", ["toolCollection"], "word-query-settings", "单词查询设置"),
  jsonSlot("toolCollection.shortcutCustom", ["toolCollection"], "plugin-toolCollection-shortcut-custom", "快捷键自定义", {
    legacyName: true,
  }),
  jsonSlot("toolCollection.legacyShortcutCustom", ["toolCollection"], "plugin-shortcuts-custom", "旧版快捷键（已迁移）", {
    legacyName: true,
    exportable: false,
    resettable: false,
    notes: "迁移后应删除",
  }),
  jsonSlot("toolCollection.legacyShortcutAll", ["toolCollection"], "plugin-shortcuts-all", "旧版快捷键全量（已迁移）", {
    legacyName: true,
    exportable: false,
    resettable: false,
    notes: "迁移后应删除",
  }),

  // ==================== scriptLauncher ====================
  jsonSlot("scriptLauncher.scripts", ["scriptLauncher"], "scriptLauncher-scripts", "脚本清单", { legacyName: true }),
  jsonSlot("scriptLauncher.settings", ["scriptLauncher"], "scriptLauncher-settings", "脚本启动器设置", { legacyName: true }),
  jsonSlot("scriptLauncher.runningProcesses", ["scriptLauncher"], "scriptLauncher-running-processes", "运行中进程", {
    legacyName: true,
    notes: "会话级记录，重启后可恢复查看",
  }),

  // ==================== resourceManager ====================
  jsonSlot("resourceManager.customCategories", ["resourceManager"], "resourceManager-customCategories", "自定义分类", {
    legacyName: true,
  }),
  jsonSlot("resourceManager.hiddenBuiltIn", ["resourceManager"], "resourceManager-hiddenBuiltIn", "隐藏的内置分类", {
    legacyName: true,
  }),
] as const
