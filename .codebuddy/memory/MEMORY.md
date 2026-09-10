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
- **快捷键冲突检查**（2026-09-10）：核查 hotkey 占用必须**递归搜索整个 `src/features/**`**（`Get-ChildItem -Recurse`），不能用 `features/*/index.ts` 通配符——hotkey 也注册在 `features/<name>/types/index.ts`（video ⌃⌥V、formatAssistant ⌃⌥G、superPanel ⌃⌥P 都在 types 里）。新功能加 addCommand 前先跑一遍全量占用表。补充：思源 `ICommand.hotkey?: string` 为可选，不写 hotkey 时命令仅作命令面板入口（不占快捷键）

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
- S3 备份：已改为直接上传模式（无 zip 打包上传），状态栏集成
- S3 备份审查修复（2026-09-09）：6 阶段完成——P0 双日期 key（utils.buildBackupUploadKey 统一手动/自动上传 key 规则，日期段取备份文件自身日期）+ ZIP 失败 pipeline 化写盘（.pipe 源 error 不销毁 dest，Windows unlink 必失败；cleanupFailedZip 改名 .part 兜底）；P1 互斥「进入即置位」（ensureWorkspaceReady 样板收敛）+ addLog 落盘 catch + busy 日志 5min 节流 + MAX_CHECKSUM_COUNT/MAX_UPLOAD_HOST_MAP 上限；P2 manifest/扫描失败补日志 + backupTime 草稿失焦提交 + watch deep；类型收敛（WorkspaceFile=Pick/ManifestEntry=Omit/DropResult=Omit<FileChecksum,"time">/toLocalBackupInfo）+ BackupLog.type 增 s3IncrementalRestore；拆分 index.vue 855→228（BackupTab+useBackupOrchestrator 453）、BackupManager 510→392（backupScanner 外迁）、FileChecksumsCard 421→63（checksums/ 两子组件）；instance.ts 断开循环依赖（工作区路径唯一事实源=useWorkspaceSettings.workspaceRoot，lastBackupTimestamp 唯一事实源=S3Backup 实例 getLastBackupTimestamp）。经验：重构 import 来源必须同轮全量切换（用户 build 报 MISSING_EXPORT）；非 deep watch 对原地 splice 数组引用永不触发
- S3 增量实验 Tab（2026-09-09）：增量备份/还原手动入口迁至第五个「增量」Tab（实验性 badge），配置 Tab 三备份模式开关保留。P1 修复：删除阶段并发+重试+失败回填 manifest（消除永久孤儿）、还原不安全路径过滤计数上报、非桌面端静默返回改显式提示。新增 useIncrementalPanel（208 行，manifest 信息/lastRestoreDir/openRestoreFolder），useBackupOrchestrator 503→476；IncrementalTab.vue 四区块（warning 横幅/清单状态/操作卡/进度复用）。经验：composable 依赖定义顺序冲突时用惰性 getter `() => x.value` 注入规避 TDZ；PowerShell ConvertFrom-Json 按 GBK 读 UTF-8 误报 JSON 错误，跨语言校验用 node JSON.parse
- toolCollection：底部面板 + Tab 切换，首个工具 base64Image
- statistics 分布 Tab（2026-09-08）：已移除「各笔记本块类型分布」堆叠图与「各笔记本文档数」柱状图（后者被排行表格完全覆盖属冗余；组件/SCSS/查询/类型/i18n 全链路清理），最终布局为单列纵向流：汇总栏 → 排行表格（含文档数/字数/总占比）→ 字数饼图（192px 环形图，图例多列 auto-fill 网格填满宽卡片）；BLOCK_TYPE_LABELS 常量与 blockType* i18n 键仍被 baseStats 整体块类型分布使用，勿删；docBarChartTitle 键因摘要栏复用保留
- compactMode：独立模块，3 档密度 + 5 档字号 + 5 区域开关
- skillLearning：代码片段练习库 + 闪卡记忆
- componentPreview（2026-09-10）：组件预览 feature，addTab+openWindow 独立窗口展示 src/components 全部 14 个组件的用法快照 + 可复制代码（静态快照定位，无交互 props 调节）。结构 = types/PreviewManager + types/density.ts（卡片尺寸档位）+ previewData/（5 数据文件聚合）+ components/（PreviewSection/CodeBlock/NavSidebar）+ composables/usePreviewDensity + styles/4 SCSS。**组件尺寸档位**（用户明确：是组件自身 size prop，不是卡片/网格尺寸）XS/S/M/L，`types/size.ts` + `composables/usePreviewSize.ts`（key `component-preview-size`）；`PreviewGroup.sizeable` 标记 11 个支持 size 的组件（Button/Input/FormField/Label/Select/Switch/Slider/Tag/Badge/Avatar/Card，Chart/IconWrapper/Loader 不参与），`PreviewSection.resolveProps` 只向**未显式指定 size** 的示例注入全局档位（显式指定者作尺寸对比用例保持原样）。经验：Select/Input/Slider 的 containerAttrs 会剥离 class/style，预览不能靠 props 传 style 控宽；Loader height:100% 需父容器显式高度；**feature 内常量若被 composable 运行时引用，不能放 types/index.ts（其运行时 import ../index.vue 会与面板形成循环），应拆 types/density.ts 类独立文件**；**不绑定默认快捷键**（⌃⌥V 已被 video 占用，误用后已移除，仅保留命令面板入口）；已集成到底部状态栏功能列表（statusBar/featureRegistry.ts 加一条即自动获得抽屉项 + 开关角标 + pin 快捷 + 自定义分类，开关键由 featureIdToSettingKey 自动推导为 enableComponentPreview）

## 禁止事项
- 禁止私自执行 `dotnet build`（太慢太卡）
- 禁止执行 `pnpm vite build` 和 `pnpm lint`（用户自行验证）
- 禁止跨 feature 直接导入（必须通过事件总线 + App.vue 调度）
