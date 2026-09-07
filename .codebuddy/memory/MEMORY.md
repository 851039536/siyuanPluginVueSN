# 项目记忆

## 编码规范偏好
- 严格遵守统一入口原则：存储用 PluginStorage/TypedStorage、Node 模块用 getNodeModules、事件用 emitCustomEvent、SQL 用 @/api
- UI 风格使用 Codex 设计语言（等宽字体、大写标签、边框卡片、focus 发光）
- Vue emit 事件必须 camelCase，禁止 kebab-case
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- 优先思源内置图标或 @iconify/vue
- if 语句必须有花括号 `{}`，即使只有一行
- i18n 只改分片文件（`src/i18n/{zh_CN,en_US}/<feature>.json`）；顶层合并 JSON（`src/i18n/zh_CN.json` / `en_US.json`）由 `pnpm i18n:merge` 脚本自动生成，**禁止手动修改**
- **独立窗体 UI 精简规则**（2026-08-24）：addTab + openWindow 独立窗体/浮动窗口中，页签标题已标识功能名，面板头部不再显示重复标题字样（如 toolCollection 的"工具合集" header-title），用 `isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏，仅移除显示、功能逻辑零改动。规则已写入 AGENTS.md / AGENTS_API.md

## 代码风格硬规则
- 单文件行数：300 行警戒，500 行硬阈值，≥1000 行必须重构
- SCSS 分离：样式必须从 .vue 提取到独立 SCSS 文件
- 文件头注释：每个 .ts/.vue 顶部必须有功能说明（10~30字）
- 模块内代码分层：共享常量→types/index.ts，纯工具函数→utils.ts，禁止复制粘贴
- 禁止 emoji 图标，使用 Iconify 图标
- 禁止硬编码 font-size/font-weight/line-height/颜色，使用设计 Token
- 颜色 Token 统一用 `$color-*` 语义色（`$color-fg/bg/muted/surface/border/primary/secondary/accent/danger/danger-bright/success/warning/info`）；旧 `$brand-*` 系列已于 2026-08 全部迁移删除，禁止使用

## 重构模式（已验证可复用）
- **巨型文件拆分**：Manager 类独立文件 + composable 按领域拆分 + 子组件提取
- **样式合规**：硬编码值→设计 Token、box-shadow→border、SCSS 提取到独立文件
- **冗余消除**：公共函数提取、watch 合并、computed 预计算映射
- **响应式布局**：纯 CSS flex-wrap 替代 JS 监听

## 功能模块状态
- gitPush StatsView 布局已重构（2026-09-07）：瀑布流 → 区块卡片化 + 自适应网格（.gp-stats-grid，表格区块 --full 全宽），总览卡升级语义色图标块三段式（--gp-accent-lightest 为新增变量）；经验：surface 卡片化后原 surface 对比元素（行 hover/条形轨道）需改 theme-background 或语义 lightest 色
- gitPush：已完成多本地路径配置、响应式双列、commit log 数量选择；历史重写已 fast-import 化（2026-09-07）：cat-file --batch 批量查 tree + deleteall/全量 M 完整 tree 模型 + 临时 ref refs/gprw/<branch> + CAS 切回，managers/ 内 GitExecutor.execGitStreaming（spawn stdin 流式）+ FastImportRewriter.ts + historyRewritePlan.ts（共享类型）+ HistoryRewriter.ts（buildPlan 预计算）协作，拒绝 fast-export 增量模型（drop 会引入冲突），drop 根提交由静默无效改为显式报错
- gitPush 提交规则检查共 14 条规则（2026-09-07 两轮扩展）：原 7 条 + 第一轮 4 条（invalidScopeFormat/subjectEndsWithPeriod/subjectTooShort/missingBlankLine）+ 第二轮 3 条可选规则（subjectNotCapitalized 描述未大写开头、wipSubject 临时提交标记 /^(wip|todo|fixme|tbd)\b/i、bodyLineTooLong 正文行长超限），可选规则默认全开、设置弹窗可单独关闭。架构要点：checkCommitRule 等纯函数用可选参数 `config: CommitRuleConfig = DEFAULT_COMMIT_RULE_CONFIG` 向后兼容 6 处调用点；CommitRuleConfig 5 字段（minSubjectLength=10 + 3 个 boolean 开关 + maxBodyLineLength=72，默认值全在 DEFAULT_COMMIT_RULE_CONFIG）；持久化 ruleCheckPrefs 槽位全部 `?` 可选字段，读取统一走 meta.ts 的 `readCommitRuleConfig(prefs)`（逐字段回退，4 处共用）；useCommitAnalysis 用 `ruleConfig` 整对象 ref + `updateCommitRuleConfig(patch)`（load-merge-save + clamp）；SettingsDialog emit `saveRuleConfig: [patch]` 统一入口（checkbox 即时/阈值保存按钮+Enter，gp-set-switch 样式类在 styles/index.scss）；subject 按首个换行拆分，长度/句号/中文判定只作用于首行；启发式修正结果经 checkCommitRule 终验，仅返回完全合规结果；buildCommitRulePrompt(config) 按开关动态拼接（首字母大写无需 prompt 因描述须中文；scope 文案含"模块名转小写连字符 HidHelper → hid-helper"）；AI 3 处 prompt + 生成后 `normalizeCommitMessageFormat(trimmed, config)` 规范化（commitRuleChecker 导出：仅对标题行做 type 小写/scope 规范化/去句号，多行正文原样保留，结果终验，失败才降级启发式——修复 AI 生成 feat(HidHelper) 因 scope 大写被一票否决丢弃的问题）+ heuristic 同 config（type 也小写规范化）；WorkingTreePanel/ProjectCard 无 manager 用默认 config（默认全开保证一致）
- S3 备份：已改为直接上传模式（无 zip 打包），状态栏集成
- toolCollection：底部面板 + Tab 切换，首个工具 base64Image
- compactMode：独立模块，3 档密度 + 5 档字号 + 5 区域开关
- skillLearning：代码片段练习库 + 闪卡记忆

## 禁止事项
- 禁止私自执行 `dotnet build`（太慢太卡）
- 禁止执行 `pnpm vite build` 和 `pnpm lint`（用户自行验证）
- 禁止跨 feature 直接导入（必须通过事件总线 + App.vue 调度）
