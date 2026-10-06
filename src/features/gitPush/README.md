# Git 推送 (gitPush)

完整的 Git 图形界面：推送/拉取/暂存/提交/差异/分支切换/提交搜索/统计视图，持久化项目路径映射。

## 功能

- **项目映射**：添加本地 Git 项目路径，持久化保存（不影响项目本身）
- **远程检测**：自动检测 `github.com`、`gitee.com`、`gitcode.com`、Gitea 远程仓库，支持远程名称辅助识别（不区分大小写）
- **多平台推送/拉取**：一键推送到/拉取自 GitHub / Gitee / Gitea，或全部操作，并发信号量限流
- **路径检查**：添加时检查路径是否为合法 Git 仓库
- **工作区变更**：查看暂存/未暂存/未跟踪文件，支持暂存、取消暂存、查看着色 diff、丢弃更改
- **差异查看弹窗**：着色 diff + 词级高亮 + 行号双列；新增/未跟踪文件同样展示完整内容（`git diff` 对未跟踪文件恒为空，数据层回退 `git diff --no-index`）；「已暂存且工作区又改动」的文件可切换查看暂存区/工作区两份差异（另一份后台预取）；取差异期间显示加载态（不再与空态混淆）；标题含全路径 tooltip、文件状态与重命名原路径；支持复制差异全文/文件路径；Esc 关闭、←/→ 切换文件
- **提交功能**：Conventional Commit 快捷类型选择、AI 生成提交信息（基于变更统计摘要，输出单行信息，支持思考模式控制）与 AI 深度生成提交信息（读取暂存区完整 diff 理解实际改动，输出「标题行 + 改动要点列表」的多行信息；与提交历史修正弹窗的两档生成同构）
- **AI 错误分析**：推送/拉取失败时日志面板提供「AI 分析」按钮，弹窗内流式分析失败日志，输出错误原因、解决方案与预防建议
- **提交历史**：查看当前分支最近 N 条提交记录，支持关键词/作者搜索过滤；行内支持删除任意历史提交（记录级删除、内容不变语义——被删提交的变更并入下一提交，最终文件内容不变；merge/HEAD 提交阻止；弹窗内「删除前自动备份」开关默认开启，执行前自动 bundle 备份、可经 reflog 恢复，关闭后跳过备份直接删除且选择持久化跨会话恢复；后代 hash 必然重写，已推送需手动强推）；修正提交信息弹窗提供两档 AI 生成：AI 生成修正（基于变更统计摘要，输出单行提交信息）与 AI 深度分析（读取该提交完整 diff 理解实际改动，输出「标题行 + 改动要点列表」的多行提交信息）
- **分支管理**：查看本地分支列表，一键切换分支（自动检测未提交变更）
- **Stash 暂存**：Git stash 存取恢复，支持 AI 生成描述
- **项目分类**：按颜色标签分组管理项目（管理入口在设置弹窗左侧导航底部）
- **标签/状态/备注**：多标签筛选、状态徽章循环切换（活跃/维护中/暂停）、项目备注
- **提交规则检查**：校验各项目提交信息是否符合 Conventional Commits 规则（type 限 feat/fix/chore/docs/style/refactor/test）与 GitHub 提交建议（scope 仅小写字母/数字/连字符、描述不以句号结尾、描述不少于最短字数、多行消息正文前空行），集中展示不合规提交及原因；「描述过短」阈值可在设置弹窗「常规」分区自定义（默认 10 字）；另含 3 条可选规则（默认开启，可在设置中单独关闭）：描述首字母大写（仅小写英文字母开头判违规）、WIP 临时提交检测（描述以 wip/todo/fixme/tbd 开头判违规）、正文行长限制（body 每行超限判违规，阈值默认 72 可配）；支持 AI 生成修正建议，并可修正 HEAD 或任意本地历史提交（个人项目版，历史重写后需自行 force push）；支持多选违规提交进行批量修正（批量弹窗内 AI 逐条生成 + 逐条保存，同项目内按新→旧顺序处理保证链式违规不丢修正）；违规行支持直接删除历史提交（与 LOG Tab 共用 DropCommitDialog：记录级删除、内容不变语义，merge/HEAD/rebase 残留拦截，bundle 备份可恢复且「删除前自动备份」开关持久化）
- **仓库清理视图**：两段式 — ① 仓库体检（纯 git：.git 打包体积/对象总数 + 可达大文件 Top 50 与占比条形，非本地引用锚定的残留标注「远程引用/其他引用」徽章）；② BFG 历史清理（[BFG Repo-Cleaner](https://github.com/rtyley/bfg-repo-cleaner)）：大文件阈值清理 / 按名删除文件·文件夹 / 敏感文本全历史替换，走 mirror 裸仓库安全工作流（bundle 全量备份 → clone --mirror → BFG → gc → CAS 回写），六步步骤条 + 实时日志；Java 运行时自动探测，bfg.jar 首次使用自动下载（Maven Central 主源 + GitHub 备源），结果页一键强推远端（强推后自动 fetch --prune + gc 收尾，清除本地残留）
- **统计视图**：远程覆盖率、待处理项目合并视图（推送状态概览 + 待推送/暂存/未暂存表格）、平台配置状态
- **报告一键导出 HTML**：统计报告视图工具条「导出HTML」按钮，把当前项目 + 当前时间范围的报告导出为**单个自包含 HTML 文件**（内联 CSS + 内联 SVG 图表，零外部依赖、断网可打开、可直接分享或存档）；覆盖团队总览 / 代码贡献度 / 技术债务 / 代码热点 / 提交趋势五个分区全部内容，K 线图按 `MAX_CANDLES` 分桶压缩保证宽度有界；弹原生保存对话框选定路径，写盘后自动打开；未生成/git 失败/零提交时不产出空文件
- **远程与本地一致性分析**：头部按钮打开弹窗，批量比对所有项目各本地分支与各远程分支（存在性/领先/落后/分叉），可选先 fetch --prune（默认开启），支持进度显示、七态汇总与"仅显示问题"过滤；结果持久化缓存（打开弹窗直接展示上次结果并显示分析时间）
- **行数统计视图**：独立 Tab，统计各项目/作者的代码新增、删除、净增行数排行（千位分隔数字，净增正绿负红）；统计范围固定为「全部提交历史 + 工作区全部已跟踪文件」（无条数选择入口）；可配置文件格式过滤（扩展名多选排除列表，勾选后跳过对应格式，不选则统计所有文件）
- **本地提交索引（增量刷新）**：插件数据目录下的 NDJSON 提交索引，使统计视图「秒开 + 后台增量」而非每次重跑全量 `git log`。HEAD 未变的项目零 git 调用、零逐文件读盘；行数统计的「当前总行数」按 HEAD 复用缓存；索引不可用时全部路径自动回退直接扫描 git（详见「性能优化 § 本地提交索引」）
- **扫描导入**：递归扫描目录批量导入 Git 仓库
- **远程配置**：添加/编辑/删除远程仓库，支持行内编辑 URL
- **独立窗口承载**：面板头部「在独立窗口打开」按钮，将面板弹出为独立浮动窗口（`addTab + openTab + openWindow` 官方 API，浮动窗口内自动隐藏该按钮）

## 目录结构

```
src/features/gitPush/
├── index.ts                         # registerGitPush() 入口
├── index.vue                        # 主面板（Dock / 独立窗口 tab 双形态，列表/统计/日志/分析/行数统计/报告多视图）
├── GitPushManager.ts                # 门面：组合 managers/ 协作者 + addTab/openWindow 独立窗口承载
├── reportMetrics.ts                 # 代码统计报告纯函数层：numstat 解析 + 作者/文件聚合 + 债务/热点评分 + K 线分桶压缩
├── reportChart.ts                   # 提交 K 线图绘制配置：chart.js 数据集/坐标轴/影线插件（自 CandlestickSection 迁出）
├── htmlReport.ts                    # 报告导出纯函数层：CodeReportData → 单文件 HTML（内联 CSS + 内联 SVG 图表 + HTML 转义）
├── debtInsights.ts                  # 技术债务洞察纯函数：趋势推断 + 共变索引 + 严重度汇总（自 composables 迁出）
├── utils/                           # 纯函数层（按域拆分 + index.ts 汇聚，导出面与拆分前一致）
│   ├── index.ts                     # 汇聚导出（消费方统一从 "../utils" 导入，路径零改动）
│   ├── project.ts                   # 项目查找/排序/多设备路径解析/打开本地与网页
│   ├── platform.ts                  # 平台标志与远程识别、URL 归一化、推送需求判定
│   ├── fileStatus.ts                # 文件状态标记与 i18n 文案（图标/字符 + titleKey 解析）
│   ├── diffText.ts                  # diff 着色行解析、词级高亮、AI 上下文预算采样
│   ├── gitOutput.ts                 # git 输出解析：porcelain / 提交日志 / 提交文件 / stash / 分支
│   ├── analysis.ts                  # 提交分析：类型前缀、日期聚合、热力等级、计数排行
│   ├── format.ts                    # 展示格式化：相对与绝对时间、年份选项、分析状态、日志标签
│   ├── metrics.ts                   # 百分比与条形宽度、净增语义 class、行数排行预计算
│   ├── search.ts                    # 搜索高亮片段切分
│   ├── runtime.ts                   # 缓存裁剪、连续并发池、并发标志计数
│   └── errors.ts                    # 抓取失败分类与专用错误类型
├── managers/
│   ├── GitExecutor.ts               # git 子进程执行器（双池信号量限流 + abort 生命周期 + stdin 流式长驻进程）
│   ├── ProjectStore.ts              # 项目/分类/标签 CRUD 与内存缓存
│   ├── ReportOps.ts                 # numstat 提交日志/首提交日期/已跟踪文件/文件历史补丁（弹窗懒取）+ 增量扫描与 HEAD 快照
│   ├── CommitIndex.ts               # 本地提交索引引擎（NDJSON 追加写 + 游标查询 + 崩溃丢尾自愈）
│   ├── indexCoverage.ts             # 索引覆盖范围决策纯函数（能否跳过扫描 / 截断项目不重扫全历史）
│   ├── indexIo.ts                   # 索引磁盘 IO 抽象（FsIndexIO 生产实现 / 接口注入使纯逻辑可单测）
│   ├── indexDir.ts                  # 索引目录解析（plugin.dataDir → storage/petal/<plugin>/git-push-index）
│   ├── RemoteOps.ts                 # push/pull/fetch 全平台与单平台、推送状态检查
│   ├── WorktreeOps.ts               # 工作区状态/差异/暂存/提交/stash/分支/提交日志（含历史提交消息重写）
│   ├── RepoOps.ts                   # Tag 管理、冲突检测、远程配置、Git 配置查看、仓库扫描
│   ├── HistoryRewriter.ts           # 提交历史 DAG 重建器（消息改写/提交删除双策略：预计算重建计划 + 侧链 identity 跳过 + CAS 切回）
│   ├── FastImportRewriter.ts        # fast-import 流式重建执行器（cat-file --batch 批量查 tree + deleteall 全量 M 导入临时 ref）
│   ├── historyRewritePlan.ts        # 历史重写计划类型（RewriteEntry/RewritePlan，HistoryRewriter 与 FastImportRewriter 共享）
│   ├── BfgOps.ts                    # BFG 运行时层：Java 探测 + bfg.jar 下载缓存 + bfg 进程执行
│   ├── RepoCleanOps.ts              # 仓库清理编排：体检扫描（纯 git）+ BFG mirror 六步工作流
│   └── CommitMsgGenerator.ts        # AI 提交信息与 stash 描述生成（含启发式降级）
├── types/
│   ├── index.ts                     # 类型桶（重导出 meta/storage + GitPushManager）
│   ├── meta.ts                      # PLATFORM_META/FILE_STATUS_META 等共享常量（独立模块切断循环引用）
│   ├── indexCache.ts                # 本地提交索引的记录形状与元数据常量（零依赖，保证引擎可在 Node 单测加载）
│   ├── queryScheduler.ts            # 查询调度契约（ProjectQueryKind/ProjectQueryScheduler，切断 cardServices ↔ composable 循环）
│   └── storage.ts                   # 类型定义 + TypedStorage 持久化
├── composables/
│   ├── useGitPush.ts                # Vue 3 响应式状态层（聚合入口）
│   ├── useProjectCrud.ts            # 项目 CRUD 响应式封装
│   ├── useGitOps.ts                 # 推送/拉取/工作区/stash 响应式封装
│   ├── useGitTagsConflicts.ts       # Tag/冲突/模板/扫描导入
│   ├── useGitStats.ts               # 统计视图 computed
│   ├── useCardServices.ts           # 卡片服务注入（inject CARD_SERVICES_KEY + 按项目 id 派生单项目 computed）
│   ├── useCardMenu.ts               # 卡片内联下拉菜单共享（provide/inject，顶栏与操作栏菜单互斥）
│   ├── useProjectQueryScheduler.ts  # 项目查询调度器（单飞去重 + 分支名复用 + 新鲜度节流 + 脏标记，查询调度唯一权威）
│   ├── useCardData.ts               # 卡片 Tab 数据自包含（log/branches/stash/tags/冲突/diff/md）
│   └── useReportExport.ts           # 报告导出编排（校验 → 保存对话框 → 渲染 → 写盘 → 提示并打开）
├── components/
│   ├── common/                      # 复用组件（跨 ≥2 个视图引用，29 个；二次确认统一用共享 ConfirmDialog）
│   │   ├── AddProjectDialog.vue     # 添加项目弹窗
│   │   ├── CategoryDialog.vue       # 分类管理弹窗
│   │   ├── SettingsDialog.vue       # 设置汇总弹窗（左侧分区导航：常规=并发数+分支模式 / 显示=分析显示设置 / Git 配置=全局 Git 配置管理；导航底部=管理分类入口）
│   │   ├── GitConfigSection.vue     # Git 配置管理面板（查看/编辑/新增/删除，全局/项目级）
│   │   ├── IdeManagementDialog.vue  # IDE 管理弹窗
│   │   ├── ScanImportDialog.vue     # 扫描导入弹窗
│   │   ├── EditProjectDialog.vue    # 编辑项目弹窗
│   │   ├── MarkdownPreviewDialog.vue# Markdown 预览弹窗
│   │   ├── GitConfigDialog.vue      # 项目级 Git 配置弹窗（内嵌 GitConfigSection，可读写；全局配置走设置弹窗分区）
│   │   ├── ConsistencyAuditDialog.vue # 远程与本地一致性分析弹窗（自包含，内嵌 useConsistencyAudit）
│   │   ├── SearchBox.vue            # 搜索框
│   │   ├── EditableRemoteList.vue   # 可编辑远程列表
│   │   ├── CloneLogPanel.vue        # 克隆日志面板
│   │   ├── EmptyState.vue           # 空态提示（无项目/无数据）
│   │   ├── LoadMoreButton.vue       # 加载更多按钮
│   │   ├── CommitFixDialog.vue      # 提交信息修正弹窗（HEAD amend + AI 生成，列表 LOG Tab 与规则检查共用）
│   │   ├── DropCommitDialog.vue     # 删除历史提交弹窗（四项前置校验 + bundle 备份 + fast-import 历史重建删除，LOG Tab 与规则检查共用）
│   │   ├── BatchFixDialog.vue       # 提交信息批量修正弹窗（规则检查多选：AI 逐条生成 + 逐条保存 + 逐项状态）
│   │   ├── PanelHeader.vue          # 面板头部（搜索 + 视图切换 + 批量旋转进度指示器）
│   │   ├── CommitCountSelect.vue    # 分析条数选择下拉（共享 Select xsmall 档，提交分析与规则检查工具条共用）
│   │   ├── AnalysisToolbar.vue      # 分析类视图统一工具条（状态文案 + run 按钮 + controls 插槽；提交分析/规则检查/行数统计共用）
│   │   ├── AnalysisGate.vue         # 分析类视图状态门（分析中占位/未分析空态/失败提示条 + 默认插槽；四分析视图共用）
│   │   ├── StatCardGrid.vue         # KPI 卡片网格（数值+标签+语义色，stat-card mixin 驱动；五处总览卡片共用）
│   │   ├── CommitFilesDialog.vue    # 提交文件列表弹窗
│   │   ├── CommitFilesList.vue      # 提交文件列表
│   │   ├── CommitFileDiffDialog.vue # 提交文件差异弹窗
│   │   ├── DiffLines.vue            # diff 着色行共享渲染片段
│   │   ├── TagCommitDialog.vue      # 标签提交弹窗
│   │   ├── LineRankRow.vue          # 行数排行行（排名/名称/增删净/占比/可选总行数；clickable 时原生 button 可键盘激活；行数统计面板与详情弹窗共用）
│   │   └── LineShareBar.vue         # 行数占比迷你条（轨道 + 填充 + 百分比文本，填充按净增正负着色；详情弹窗文件明细占比列用）
│   ├── ListView/                    # 列表视图专属（16 个）
│   │   ├── index.vue               # 列表视图入口容器（工具栏 + 分组循环卡片，纯渲染）
│   │   ├── ListViewToolbar.vue      # 列表工具栏
│   │   ├── ProjectCard.vue          # 项目卡片编排层（仅 project prop，数据/操作全注入 + CardTabs 面板切换）
│   │   ├── CardHeader.vue           # 卡片顶栏信息区（星标/名称/路径/md 徽章/分支/备注；操作按钮区委托 CardHeaderActions）
│   │   ├── CardHeaderActions.vue    # 卡片顶栏操作按钮区（分类/平台/IDE/刷新/编辑/Git配置/删除，自包含 services/menu）
│   │   ├── CardRemotes.vue          # 远程仓库状态 + 冲突警告
│   │   ├── CardActionBar.vue        # 拉取/推送操作栏（单远程/推送全部/强制推送/Fetch）
│   │   ├── CardTabs.vue             # 多面板 Tab 切换条（CHANGES/LOG/STASH/TAG + 计数徽标，v-model）
│   │   ├── BranchCommitList.vue     # 提交历史（含搜索）
│   │   ├── ConflictSection.vue      # 冲突区
│   │   ├── OutputPanel.vue          # 命令输出面板（失败时内置 AI 分析入口）
│   │   ├── AiErrorAnalysisDialog.vue# AI 错误日志分析弹窗（流式）
│   │   ├── StashSection.vue         # Stash 管理区
│   │   ├── TagPanel.vue             # 标签面板
│   │   ├── WorkingTreePanel.vue     # 工作区变更面板
│   │   └── WorkingTreeDiffDialog.vue# 工作区文件差异弹窗（加载态/范围切换/复制/键盘导航，diff 文本由父层缓存下发）
│   ├── StatsView/                   # 统计视图专属（3 层信息架构 + common/ 共享组件）
│   │   ├── index.vue               # 统计视图入口容器（空态 + 工具条 + 概览/行动/明细三层编排）
│   │   ├── StatsToolbar.vue        # 顶部工具条（快照状态文案 + 刷新全部；与提交分析 AnalysisToolbar 同构）
│   │   ├── HealthOverview.vue      # 健康概览（推送状态分布条 + 四态图例 + 精简 KPI 行）
│   │   ├── PendingProjectsSection.vue # 待处理项目区块（全站唯一一份待处理清单表格）
│   │   ├── PlatformSection.vue     # 平台区块（覆盖率行内汇总 + 一致性问题汇总 + 每项目平台配置/一致性矩阵）
│   │   └── common/                 # 统计区块共享组件（StatsSection 区块包裹器 / PlatformTable 平台矩阵表格 / AllClear 全部正常空态）
│   ├── LogPanel/                    # 操作日志视图专属（6 个）
│   │   ├── index.vue                # 操作日志视图入口容器（筛选/分页/日期分组编排 + 区块组合）
│   │   ├── LogStatsBar.vue          # 状态统计条（按操作类型聚合成功/失败）
│   │   ├── LogToolbar.vue           # 顶部工具条（搜索 + 类型筛选 + 仅失败 + 清空）
│   │   ├── LogTable.vue             # 日志表格（表头 + 日期分组循环）
│   │   ├── LogTableRow.vue          # 日志表格行（数据行 + 平台/commit 子行，展开/复制状态自持）
│   │   └── LogDetailDialog.vue      # 日志条目详情弹窗
│   ├── CommitAnalysis/              # 提交分析视图（三视角 Tab：提交概览 / 规则检查 / 行数排行；11 个）
│   │   ├── index.vue                # 视图入口容器（三 Tab 编排 + 共用工具条/四态门；规则检查与行数排行的区块在此组合）
│   │   ├── AnalysisTabs.vue         # 三视角切换条（三者同属一次 runCore 抓取的不同切面）
│   │   ├── ProjectRankingSection.vue# 项目提交排行区块（条形 + 百分比，点击跳转）
│   │   ├── RecentCommitsSection.vue # 最近提交记录区块（条目 + 分页加载）
│   │   ├── HeatmapCalendarSection.vue# 热力图/日历区块（viewSettings 切换）
│   │   ├── DailyTrendSection.vue    # 最近 30 天提交趋势区块（每日柱状）
│   │   ├── AuthorTypeSection.vue    # 作者排行 + 内容类型双栏区块
│   │   ├── CommitAnalysisSettings.vue# 分析设置（齿轮 popover 薄壳，表单复用 AnalysisSettingsForm）
│   │   ├── AnalysisSettingsForm.vue # 分析显示设置表单（视图/范围/周起始/颜色，popover 与设置汇总弹窗共用）
│   │   ├── CommitCalendar.vue       # 提交日历
│   │   └── CommitHeatmap.vue        # 提交热力图
│   ├── CommitRuleCheck/             # 规则检查视角的区块组件（无独立入口，由 CommitAnalysis 组合）
│   │   ├── RuleCheckOverview.vue    # 总览区块（检查数/不合规/合规率卡片 + 规则提示）
│   │   ├── ReasonDistributionSection.vue # 违规类型分布区块（紧凑 chips：标题与计数圆片同行）
│   │   └── ViolationListSection.vue # 不合规提交列表区块（条目 + 修正/删除入口 + 分页）
│   ├── RepoCleanPanel/              # 仓库清理视图专属（4 个）
│   │   ├── index.vue                # 仓库清理视图入口容器（体检扫描编排 + 区块组合 + 清理向导入口）
│   │   ├── RepoCleanToolbar.vue     # 顶部工具条（项目选择 + 大文件阈值 + 扫描按钮）
│   │   ├── LargeBlobSection.vue     # 大文件列表区块（体积 + 占比条形 + 分页）
│   │   ├── CleanWizardDialog.vue    # BFG 清理向导弹窗（策略表单 → 前置检查 → 执行 → 结果，四段式）
│   │   └── format.ts                # 字节人类可读化工具（formatBytes）
│   └── LineStats/                   # 行数排行视角的区块组件（无独立入口，由 CommitAnalysis 组合）
│       ├── LineRankingSection.vue   # 项目代码行数排行区块（吸顶表头 + 共享 LineRankRow 行，点击行打开详情）
│       ├── ExtFilterDialog.vue      # 文件格式过滤配置弹窗（扩展名多选排除列表）
│       ├── ProjectLineDetail.vue    # 项目行数详情弹窗
│       └── FetchFailuresDialog.vue  # 项目抓取失败明细弹窗（项目名 + 本地路径 + 原因分类 + 原始报错）
│   └── CodeReport/                  # 代码统计报告视图专属（9 个；分区首次激活后才挂载）
│       ├── index.vue                # 报告视图入口容器（项目/时间范围选择 + 分区 Tab 编排）
│       ├── TeamOverviewSection.vue  # 团队总览分区（KPI 卡片：成员/总提交/总代码量/最活跃）
│       ├── AuthorContributionSection.vue # 代码贡献度分区（作者贡献排行 + 文件详情弹窗）
│       ├── TechDebtSection.vue      # 技术债务分区（债务摘要 + 严重度分组列表）
│       ├── HotspotSection.vue       # 代码热点分区（热点文件）
│       ├── CandlestickSection.vue   # 提交趋势分区（K 线/趋势图）
│       ├── DebtSummaryBar.vue       # 债务摘要条
│       ├── DebtFileDetail.vue       # 债务文件详情（LOC 懒加载）
│       └── FileDetailModal.vue      # 文件详情弹窗（diff 打开时按需懒取）
└── styles/
    ├── index.scss                   # 主面板样式（卡片骨架 + Stash/Tag/Output/Conflict 等；Tab 条已迁出）
    ├── CardHeader.scss              # 卡片顶栏信息区样式（操作按钮区 → CardHeaderActions.scss）
    ├── CardHeaderActions.scss       # 卡片顶栏操作按钮区样式（自 CardHeader.scss 迁出）
    ├── CardTabs.scss                # 多面板 Tab 切换条样式（自 index.scss 迁出）
    ├── CardRemotes.scss             # 远程状态区样式（从 index.scss 提取）
    ├── CardActionBar.scss           # 操作栏样式（从 index.scss 提取）
    ├── StatsPanel.scss              # 统计视图样式
    ├── CommitAnalysisPanel.scss     # 提交分析面板样式
    ├── CommitAnalysisSettings.scss  # 提交分析显示设置样式（齿轮浮层 + 设置表单）
    ├── CommitHeatmap.scss           # 提交热力图样式（周列网格 + 分级着色 + 图例）
    ├── CommitCalendar.scss          # 提交日历网格样式（月卡 + 日格 + 今天/未来态）
    ├── CommitRuleCheckPanel.scss    # 提交规则检查面板样式
    ├── CommitFixDialog.scss         # 提交信息修正弹窗样式
    ├── DropCommitDialog.scss        # 删除历史提交弹窗样式
    ├── BatchFixDialog.scss          # 提交信息批量修正弹窗样式
    ├── RepoCleanPanel.scss          # 仓库清理面板样式（体检卡片 + 大文件列表 + BFG 向导弹窗）
    ├── LineStatsPanel.scss          # 行数统计面板样式（面板基座 + 单栏堆叠；工具条/汇总卡片/失败提示已收敛至共享）
    ├── AnalysisToolbar.scss         # 分析类视图统一工具条样式（三视图共用）
    ├── AnalysisGate.scss            # 分析类视图状态门样式（失败提示条 .gp-analysishint）
    ├── StatCardGrid.scss            # KPI 卡片网格样式（五视图共用；原 .gp-stat-card/.gpa-card/.grc-card/.gls-card/.gpr-card 五份合一）
    ├── LineRankRow.scss             # 行数排行行样式（列模板单点定义 + 表头吸顶 + 数字列 + lrr-net 语义色）
    ├── LineShareBar.scss            # 行数占比迷你条样式
    ├── ProjectLineDetail.scss       # 项目行数详情弹窗样式（弹窗尺寸 + 头部 + 文件明细表格）
    ├── ExtFilterDialog.scss         # 文件格式过滤弹窗样式
    ├── FetchFailuresDialog.scss     # 项目抓取失败明细弹窗样式
    ├── WorkingTreePanel.scss        # 工作区面板样式
    ├── WorkingTreeDiffDialog.scss   # 差异弹窗样式
    ├── AiErrorAnalysisDialog.scss   # AI 错误分析弹窗样式
    ├── BranchCommitList.scss        # 提交历史列表样式
    ├── variables.scss               # 全局 Token 透传（已废弃：引用方已统一为 @/variables.scss，可删除）
    ├── _mixins.scss                 # 共享混入
    ├── Buttons.scss                 # .vp-btn 按钮体系
    └── Shared.scss                  # .gp-spin 旋转动画
```

## 架构

`GitPushManager` 为**门面（Facade）**，自身不含业务逻辑，按职责委托给 8 个协作者：

```
GitPushManager (facade)
  ├── GitExecutor      ← 唯一接触 child_process 的类；execGit 双池并发 + abort/destroy
  ├── ProjectStore     ← 依赖 Executor（detectRemotes）+ Storage；项目/分类/标签 CRUD
  ├── RemoteOps        ← 依赖 Executor + Store + Storage；push/pull/fetch/checkPushStatus
  ├── WorktreeOps      ← 依赖 Executor；工作区/stash/分支/提交日志/历史消息重写
  ├── RepoOps          ← 依赖 Executor；Tag/冲突/远程配置/Git 配置/扫描
  ├── BfgOps           ← Java 探测 + bfg.jar 下载缓存 + bfg 进程执行（直接接触 child_process/https）
  ├── RepoCleanOps     ← 依赖 Executor + BfgOps + WorktreeOps；体检扫描 + BFG 六步清理编排
  └── CommitMsgGenerator ← 依赖 Executor + WorktreeOps + Storage；AI 提交信息
```

外部调用方（composables / 组件）只与门面交互，协作者不对外暴露。

## API

### GitPushManager 核心方法

| 方法 | 说明 |
|------|------|
| `addProject(name, path, categoryId)` | 添加项目并自动检测远程 |
| `removeProject(id)` | 删除项目映射 |
| `updateProjectMeta(id, patch)` | 更新项目元信息（名称/标签/状态/备注/URL） |
| `pushToAll(id)` | 推送到全部已配置远程 |
| `pushSingle(id, target)` | 推送到指定远程 |
| `pullToAll(id)` | 从全部已配置远程拉取（--ff-only） |
| `pullSingle(id, target)` | 从指定远程拉取 |
| `checkPushStatus(id, opts?)` | 检查 ahead/behind/noUpstream（纯本地比对跟踪 ref，不发起网络请求） |
| `getWorkingTreeStatus(path, opts?)` | 解析 `git status --porcelain` |
| `getFileDiff(path, file, staged)` | 获取文件 diff（未跟踪/新增文件常规 diff 为空时回退 `--no-index` 展示完整内容；失败返回空串，文案由视图层 i18n 呈现） |
| `stageFile / stageAll / unstageFile / unstageAll` | 暂存操作 |
| `discardFile(path, file, staged, status)` | 丢弃更改 |
| `commit(path, message)` | 提交暂存内容 |
| `generateCommitMessage(path)` | AI / 启发式生成提交信息（单行，上下文为变更统计摘要） |
| `generateCommitMessageDeep(path)` | AI / 启发式深度生成提交信息（多行，上下文为暂存区完整 diff 按文件分块；无 API Key / 生成失败时降级为单行启发式） |
| `getAiConfig()` | 读取超级面板 AI 配置（统一入口 `@/utils/aiApi`，供 AI 错误分析弹窗使用） |
| `getCommitLog(path, count?)` | 获取最近 N 条提交记录 |
| `getCommitShortStats(path, count?)` | 获取最近 N 条提交的变更规模（文件数/增删行数），供 LOG Tab 行悬停提示；`--shortstat` 批量单命令（须批量：逐条 `git show --shortstat` 约 260ms/条），上限 500 条 |
| `getNumstatLog(path, since?, maxCount?)` | 获取 numstat 提交日志（每文件增删行；供代码统计报告聚合） |
| `getCommitStatsLog(path, maxCount?)` | 行数统计专用单命令抓取：numstat + hash/message/author/date（替代原 getCommitLog + getNumstatLog 双命令） |
| `getIndexedCommitLog(project, {maxCount?, sinceDays?, forceRebuild?})` | **索引驱动的提交抓取**：HEAD 未变零 git 扫描，否则增量补抓后落盘；返回 `source`（`index`/`incremental`/`git`）标识数据来源 |
| `getIndexedFileLines(project)` | 已跟踪文件存量行数（索引按 HEAD 复用，未变时零 `ls-files`、零逐文件读盘） |
| `getIndex(project)` / `getIndexStatus()` | 获取索引实例 / 索引状态摘要（目录 + 各项目提交数与截断标记） |
| `clearIndex()` / `setIndexEnabled(on)` / `isIndexEnabled()` | 清空索引 / 索引开关读写 |
| `getIndexMaxCommits()` / `setIndexMaxCommits(n)` | 单项目索引提交上限读写（钳位 1000~100000） |
| `getBranches(path)` | 获取本地分支列表 |
| `switchBranch(path, branch)` | 切换分支（检测未提交变更） |
| `getCategories / addCategory / updateCategory / deleteCategory` | 分类 CRUD |
| `moveProject(projectId, categoryId)` | 移动项目到指定分类 |
| `addRemote / removeRemote / setRemoteUrl / renameRemote` | 远程仓库管理 |
| `getStashList / stashSave / stashPop / stashApply / stashDrop` | Stash 操作 |
| `generateStashDescription(path)` | AI 生成 Stash 描述 |
| `scanForGitRepos(dirPath)` | 递归扫描目录查找 Git 仓库 |
| `getGitGlobalConfig / setGitGlobalConfig / unsetGitGlobalConfig` | Git 全局配置查看/写入/删除（设置弹窗内管理） |

### 共享常量

- `PLATFORM_META`：远程平台元数据（GitHub/Gitee/Gitea 单个数据源），供 index.vue / StatsPanel / useGitPush 共用
- `COMMIT_TYPE_VALUES`：Conventional Commit 类型数组，单一数据源
- `FILE_STATUS_META`：文件变更状态元数据（`icon` + `titleKey`，**模块层零文案**）——文案统一经 `utils/fileStatus.ts` 的 `fileStatusText(file, i18n)` / `fileStatusTitle(file, i18n)` 在视图层解析（列表 tooltip、差异弹窗徽章同源）

## 使用

1. 在超级面板中启用「Git 推送」
2. 点击「添加项目」，输入名称和选择项目路径
3. 面板自动检测 GitHub/Gitee/Gitea 远程
4. **列表视图**：打开面板不自动选择分类（显示「请选择分类」提示，零 git 调用）；点选顶部分类 TAB 后加载该分类下项目的工作区变更与推送状态
5. **统计视图**：查看远程覆盖率、待处理项目汇总、平台配置状态
6. **行数统计视图**：点击「开始行数分析」统计各项目/作者的代码新增/删除/净增行数排行；可按需点击过滤按钮勾选要排除的文件格式
7. **代码统计报告**：进入视图即展示**上次结果**（毫秒级，头部标注生成时间）并在后台增量刷新——
   仓库 HEAD 未变的项目不产生任何 `git log`；有提交的项目只补抓新增提交。切换时间范围/项目会立即重算并刷新
8. 使用拉取/推送按钮同步远程仓库
9. 暂存文件 → 生成/输入提交信息 → 提交
10. 点击头部「在独立窗口打开」按钮，将面板弹出为独立浮动窗口（关闭浮动窗口页签自动移回主窗口）

## 存储

项目映射和分类通过 `PluginStorage` + `TypedStorage` 持久化，存储 key：
- `git-push-projects`：项目列表
- `git-push-categories`：分类列表
- `git-push-concurrency`：Git 并发数配置
- `git-push-report-cache`：代码统计报告结果缓存（秒开上次结果；数据新鲜度由提交索引的后台增量刷新保证）
- `git-push-index-meta`：本地提交索引元数据（每项目的仓库身份/HEAD 判据、截断游标、覆盖范围）
- `git-push-index-enabled`：提交索引总开关（默认开启；关闭后统计路径全部回退直接跑 git）
- `git-push-index-max-commits`：单项目索引提交上限（默认 20000，钳位 1000~100000）

> **索引数据本体不走 `loadData`**：提交与文件变更存在插件数据目录
> `<workspace>/data/storage/petal/<plugin.name>/git-push-index/` 下的 NDJSON 追加日志中，
> 避免把体积可观的提交明细塞进思源的数据文件（`localStorage`/`loadData` 均为整文件读写）。
> 该目录可被用户直接删除，删除后下次统计自动重建。

## 性能优化

- **并发信号量**：git 命令并发上限可配置（默认 3，范围 1~10，设置页修改），本地命令与网络命令独立双池且各自受该上限约束（双池分离使本地命令洪流不挤占 push/fetch 通道），批量加载/刷新的批内并发跟随该设置
- **批次加载**：打开列表视图不加载任何项目（未选择分类 = 零 git 调用），点选分类后仅加载该分类的项目状态；提交日志/分支/Stash 按展开懒加载
- **查询调度器**（`useProjectQueryScheduler`，查询调度的唯一权威，三档职责互不重叠）：
  - **单飞**：同 `(项目, 查询域)` 在飞时共享同一 Promise，任何入口的并发调用都不产生额外 git 子进程；失败不缓存，允许立即重试
  - **分支名复用**：`rev-parse --abbrev-ref HEAD` 是 pushStatus 与 workingTree 的共同前置，解析一次后缓存分发，每轮操作至多 1 次
  - **新鲜度节流**：成功后记录时间戳，`ensure` 模式跳过已有缓存的项目，`minIntervalMs` 抑制自动刷新的重复查询
  - **脏标记**：父层写操作标脏 + 单值 `epoch` 递增，卡片消费脏集按需重载（取代原先每卡片 5 个 watch 读取同一个 Record 的 O(卡片数 × 域数) 求值）
- **远程刷新单管线**：`refreshRemote` 统一「刷新远程配置 → fetch 一次 → 状态重查」，原先「Fetch」与「刷新远程状态」两条各自 fetch 的路径合并为同一单飞键，同时触发只产生一轮网络请求
- **共享 rev-parse**：统计视图与列表视图经调度器 `loadStatus` 单次获取分支名分发给 pushStatus + workingTree
- **干净工作区快速路径**：批量统计/显式刷新时传 `fastWhenClean`，先跑 `status --porcelain --untracked-files=no` 探测已跟踪文件变更
  （`.gitignore` 保证不会误报），无变更时少解析一次全量输出。实测本仓库 ~1000ms → ~250ms；
  但**有变更时会多花一次探测**，故只由批量场景开启，卡片交互路径不传该参数保持单命令行为。
  注意：全量 `--porcelain` 仍会执行（未跟踪清单必须由它得出），因此 index 的 stat 缓存刷新语义与改造前一致
  ——不做「跳过全量」的短路，否则后续 `git add` 等写操作要重新哈希全部文件。

### 本地提交索引（`managers/CommitIndex.ts`）

统计慢的根因是「每次进视图 → 对全部项目重跑全量 `git log --numstat`（全历史）」，且结果只落在无法按提交增量的 JSON 缓存里。索引把这部分变成增量：

- **为什么不是 sqlite**：思源桌面端为 Electron 33（内置 Node 20，无 `node:sqlite`）；`better-sqlite3` 需原生编译且随思源升级易失效；`sql.js` 需把全库载入内存（大仓库比 `git log` 更慢）。故采用零依赖的 NDJSON 追加日志 + 内存游标。
- **数据模型**（每个项目一段，按「提交序号 = `commits.ndjson` 行号」关联）：
  `commits.ndjson`（一提交一行）/ `files.ndjson`（一「提交×文件」一行）/ `filelines.ndjson`（已跟踪文件存量行数）/ `meta.json`（每项目 `rootHash` 判据与游标）
- **命中判据**：`rootHash = "<HEAD oid>:<gitdir 绝对路径>"`。gitdir 参与判据使「换机器 / 换仓库指向同一路径」自然失效重建，避免误用他仓库数据；同时它天然覆盖「切回某个已索引分支」的场景。
- **增量扫描**（`ReportOps.fetchIncremental`）：**不带 `--since`**，改为「扫到已索引提交即停」。
  不带 `--since` 的原因：`--since` 会把边界内已索引的提交重复输出（浪费），且历史重写（amend/rebase）后的旧提交保持原始日期、可能落在 `--since` 之外而被漏掉；而重写过的提交 hash 必然变化，靠 hash 集合去重不会漏。
  取回后在内存索引上按时间范围过滤，语义等价且**范围切换零 git 调用**。
- **崩溃自愈**：两个 NDJSON 分开追加，进程被 kill 时可能出现「提交行写坏、其文件行完好」（残骸引用不存在的提交序号）。加载时统一「丢弃损坏行 + 丢弃孤儿文件行」并裁齐磁盘尾部，代价仅是下次增量重抓这几个尾部提交，远优于整份索引作废。提交行先于文件行落盘，从顺序上消除该类残骸。
- **降级**：索引目录不可写 / Node 不可用 / 任何环节抛错 → 自动回退直接跑 git（`getIndexedCommitLog` 的 `source: "git"`），功能零影响；`indexEnabled=false` 可整体关闭。
- **上限与截断**：单项目提交数超过 `indexMaxCommits` 或单次扫描超过 20000 条时标记 `complete=false`，该仓库不再使用「切回老分支」捷径，并按需重建。
  截断项目的 `sinceCoveredDays` **沿用旧值**（决策集中在 `managers/indexCoverage.ts` 并有 16 条单测）——
  否则每次刷新都会从历史根重扫，正是本方案要消除的开销。
- **多设备**：索引以 `resolveValidPath(project)` 解析出的当前设备路径为准，跨设备天然重建。

**统计读取侧的其他收敛**：报告的文件存在性过滤改用目录级 `readdirSync` 缓存（原为每个排名文件一次 `statSync`，且每次都重复 `resolveValidPath`）；热点榜仍只对最终 Top N 读取 `loc`。

### 如何确认索引生效

「感觉变快了」不可靠。以下四种方式按可量化程度从高到低排列：

**① 控制台日志（最直接）**

每次索引调用都会打印一行，`source=index` 且 `新扫描=0` 即表示**完全没有跑 `git log`**：

```
[gitPush][索引] my-project source=index 耗时=42ms 返回=180 条 新扫描=0 条 索引总量=3742 条
[gitPush][索引] my-project filelines=hit 耗时=3ms 文件数=412
```

对照关系：

| 日志 | 含义 | 期望 |
|---|---|---|
| `source=index` `新扫描=0` | 完全复用索引 | 第二次起进报告视图应为此值，耗时通常 < 100ms |
| `source=incremental` `新扫描=N` | 补抓了 N 条新提交 | 你在该项目提交过代码后应出现，N 等于新增提交数 |
| `source=git` | 索引不可用，回退全量扫描 | 只在索引被关闭/目录不可写时出现 |
| `source=git(fallback)` | 索引环节抛错后回退 | 伴随 `[gitPush] 索引路径失败…` 告警，需排查 |
| `filelines=hit` / `=scan` | 存量行数复用 / 重算 | 同一 HEAD 下重复分析应为 `hit` |

若改造前是 2~10s 而现在是几十毫秒，且日志显示 `source=index`，索引即已生效。

**② 磁盘产物**

索引落盘后可直接查看（路径在设置弹窗「本地提交索引」处展示，也可自行拼接）：

```
<工作空间>/data/storage/petal/siyuan-plugin-vite-vue-sn/git-push-index/
├── commits.ndjson      # 一行一个提交（行号即提交序号）
├── files.ndjson        # 一行一个「提交×文件」变更
├── filelines.ndjson    # 已跟踪文件存量行数
└── meta.json           # 每项目 rootHash（HEAD oid + gitdir）与覆盖范围
```

`wc -l commits.ndjson` 的条数应约等于该仓库的提交总数（受 `git-push-index-max-commits` 限制）。
文件不存在 = 索引从未建立（检查索引开关或索引目录是否可写）。

**③ 设置弹窗状态**

设置弹窗「常规」分区 → 「本地提交索引」→「查看状态」，显示已索引项目数与提交总数。
打开弹窗会自动查询一次，无需手动点击。此处也提供「重建索引」。

**④ 进程观察（辅助）**

改造前每次进报告视图必然拉起 1~N 个 `git log --numstat` 子进程；索引命中时该项目**不产生任何 git 子进程**。
用任务管理器/Process Explorer 观察 `git.exe` 的出现次数即可旁证（注意 `rev-parse HEAD` 仍会执行一次，用于校验 HEAD 是否变化——这是索引命中判据本身的开销）。

**反向验证（确认索引确实省了事）**

关闭索引（`git-push-index-enabled=false`，或临时把索引目录改名）后重进报告视图：
日志应变为 `source=git` 且耗时应回到改造前的量级。两者对比即索引的净收益。



- 纯逻辑用例与被测源码同目录、命名 `*.spec.ts`；**会真实拉起 git 子进程**的用例命名 `*.git.spec.ts`（已在 `vitest.config.ts` 说明用途）。
- 被测模块必须可在 Node 环境加载：`siyuan` 包的 `exports` 字段在 node 条件下不可解析，**任何值导入都会让相关单测整体失败**。
  故纯类型/纯常量统一从具体模块直连（`../types/storage`、`../types/report`、`../types/meta`），不走 `types/index.ts` 桶。
  校验工具：`node scripts/check-module-purity.mjs <入口文件...>`（报告可达的运行时 siyuan 依赖及其引入路径）。
- git 用例通过 `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` 指向空文件 + 固定 `TZ`/`LC_ALL` 隔离开发机配置，避免结果随机器漂移。
