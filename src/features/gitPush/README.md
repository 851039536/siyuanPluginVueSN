# Git 推送 (gitPush)

完整的 Git 图形界面：推送/拉取/暂存/提交/差异/分支切换/提交搜索/统计视图，持久化项目路径映射。

## 功能

- **项目映射**：添加本地 Git 项目路径，持久化保存（不影响项目本身）
- **远程检测**：自动检测 `github.com`、`gitee.com`、`gitcode.com`、Gitea 远程仓库，支持远程名称辅助识别（不区分大小写）
- **多平台推送/拉取**：一键推送到/拉取自 GitHub / Gitee / Gitea，或全部操作，并发信号量限流
- **路径检查**：添加时检查路径是否为合法 Git 仓库
- **工作区变更**：查看暂存/未暂存/未跟踪文件，支持暂存、取消暂存、查看着色 diff、丢弃更改
- **提交功能**：Conventional Commit 快捷类型选择、AI 生成提交信息（支持思考模式控制）
- **AI 错误分析**：推送/拉取失败时日志面板提供「AI 分析」按钮，弹窗内流式分析失败日志，输出错误原因、解决方案与预防建议
- **提交历史**：查看当前分支最近 N 条提交记录，支持关键词/作者搜索过滤
- **分支管理**：查看本地分支列表，一键切换分支（自动检测未提交变更）
- **Stash 暂存**：Git stash 存取恢复，支持 AI 生成描述
- **项目分类**：按颜色标签分组管理项目
- **标签/状态/备注**：多标签筛选、状态徽章循环切换（活跃/维护中/暂停）、项目备注
- **提交规则检查**：校验各项目提交信息是否符合 Conventional Commits 规则（type 限 feat/fix/chore/docs/style/refactor/test），集中展示不合规提交及原因；支持 AI 生成修正建议，并可修正 HEAD 或任意本地历史提交（个人项目版，历史重写后需自行 force push）
- **统计视图**：远程覆盖率、待处理项目合并视图（推送状态概览 + 待推送/暂存/未暂存表格）、平台配置状态
- **行数统计视图**：独立 Tab，统计各项目/作者的代码新增、删除、净增行数排行（千位分隔数字，净增正绿负红），支持 30/50/100/200 条数选择；可配置文件格式过滤（扩展名多选排除列表，勾选后跳过对应格式，不选则统计所有文件）
- **扫描导入**：递归扫描目录批量导入 Git 仓库
- **远程配置**：添加/编辑/删除远程仓库，支持行内编辑 URL
- **独立窗口承载**：面板头部「在独立窗口打开」按钮，将面板弹出为独立浮动窗口（`addTab + openTab + openWindow` 官方 API，浮动窗口内自动隐藏该按钮）

## 目录结构

```
src/features/gitPush/
├── index.ts                         # registerGitPush() 入口
├── index.vue                        # 主面板（Dock / 独立窗口 tab 双形态，列表/统计/日志/分析/行数统计/报告多视图）
├── GitPushManager.ts                # 门面：组合 managers/ 协作者 + addTab/openWindow 独立窗口承载
├── managers/
│   ├── GitExecutor.ts               # git 子进程执行器（双池信号量限流 + abort 生命周期）
│   ├── ProjectStore.ts              # 项目/分类/标签 CRUD 与内存缓存
│   ├── RemoteOps.ts                 # push/pull/fetch 全平台与单平台、推送状态检查
│   ├── WorktreeOps.ts               # 工作区状态/差异/暂存/提交/stash/分支/提交日志
│   ├── RepoOps.ts                   # Tag 管理、冲突检测、远程配置、Git 配置查看、仓库扫描
│   └── CommitMsgGenerator.ts        # AI 提交信息与 stash 描述生成（含启发式降级）
├── types/
│   ├── index.ts                     # 类型桶（重导出 meta/storage + GitPushManager）
│   ├── meta.ts                      # PLATFORM_META/FILE_STATUS_META 等共享常量（独立模块切断循环引用）
│   └── storage.ts                   # 类型定义 + TypedStorage 持久化
├── composables/
│   ├── useGitPush.ts                # Vue 3 响应式状态层（聚合入口）
│   ├── useProjectCrud.ts            # 项目 CRUD 响应式封装
│   ├── useGitOps.ts                 # 推送/拉取/工作区/stash 响应式封装
│   ├── useGitTagsConflicts.ts       # Tag/冲突/模板/扫描导入
│   ├── useGitStats.ts               # 统计视图 computed
│   ├── useCardServices.ts           # 卡片服务注入（inject CARD_SERVICES_KEY + 按项目 id 派生单项目 computed）
│   ├── useCardMenu.ts               # 卡片内联下拉菜单共享（provide/inject，顶栏与操作栏菜单互斥）
│   └── useCardData.ts               # 卡片 Tab 数据自包含（log/branches/stash/tags/冲突/diff/md）
├── components/
│   ├── common/                      # 复用组件（跨 ≥2 个视图引用，18 个）
│   │   ├── PanelHeader.vue          # 面板头部（搜索 + 视图切换）
│   │   ├── BatchProgressBar.vue     # 批量进度条
│   │   ├── ConfirmDialog.vue        # 通用确认弹窗
│   │   ├── AddProjectDialog.vue     # 添加项目弹窗
│   │   ├── CategoryDialog.vue       # 分类管理弹窗
│   │   ├── SettingsDialog.vue       # 设置弹窗（并发数 + 分支模式）
│   │   ├── GitConfigSection.vue     # Git 配置管理面板（查看/编辑/新增/删除，全局/项目级）
│   │   ├── IdeManagementDialog.vue  # IDE 管理弹窗
│   │   ├── ScanImportDialog.vue     # 扫描导入弹窗
│   │   ├── EditProjectDialog.vue    # 编辑项目弹窗
│   │   ├── MarkdownPreviewDialog.vue# Markdown 预览弹窗
│   │   ├── GitConfigDialog.vue      # Git 配置弹窗（内嵌 GitConfigSection，可读写）
│   │   ├── SearchBox.vue            # 搜索框
│   │   ├── EditableRemoteList.vue   # 可编辑远程列表
│   │   ├── CloneLogPanel.vue        # 克隆日志面板
│   │   ├── EmptyState.vue           # 空态提示（无项目/无数据）
│   │   ├── LoadMoreButton.vue       # 加载更多按钮
│   │   └── CommitFixDialog.vue      # 提交信息修正弹窗（HEAD amend + AI 生成，列表 LOG Tab 与规则检查共用）
│   ├── ListView/                    # 列表视图专属（15 个）
│   │   ├── index.vue               # 列表视图入口容器（工具栏 + 加载态 + 空态 + 分组循环卡片，纯渲染）
│   │   ├── ListViewToolbar.vue      # 列表工具栏
│   │   ├── ProjectCard.vue          # 项目卡片编排层（仅 project prop，数据/操作全注入）
│   │   ├── CardHeader.vue           # 卡片顶栏（信息区 + 操作按钮区：分类/平台/IDE/刷新/编辑/Git配置/删除；含 Markdown 文件徽章内联渲染）
│   │   ├── CardRemotes.vue          # 远程仓库状态 + 冲突警告
│   │   ├── CardActionBar.vue        # 拉取/推送操作栏（单远程/推送全部/强制推送/Fetch）
│   │   ├── BranchCommitList.vue     # 提交历史（含搜索）
│   │   ├── ConflictSection.vue      # 冲突区
│   │   ├── OutputPanel.vue          # 命令输出面板（失败时内置 AI 分析入口）
│   │   ├── AiErrorAnalysisDialog.vue# AI 错误日志分析弹窗（流式）
│   │   ├── StashSection.vue         # Stash 管理区
│   │   ├── TagPanel.vue             # 标签面板
│   │   ├── WorkingTreePanel.vue     # 工作区变更面板
│   │   └── WorkingTreeDiffDialog.vue# 差异查看弹窗
│   ├── StatsView/                   # 统计视图专属（7 个）
│   │   ├── index.vue               # 统计视图入口容器（空态 + 瀑布流组合各区块）
│   │   ├── OverviewCards.vue       # 总览卡片区（总项目数/已配远程/待推送/未提交/收藏/已归档）
│   │   ├── CoverageSection.vue     # 远程覆盖率区块（四平台 + 多远程合计）
│   │   ├── CategoryDistributionSection.vue # 分类分布区块（category.color 着色条形）
│   │   ├── PendingProjectsSection.vue # 待处理项目区块（推送状态 chips + 待处理表格）
│   │   ├── PlatformStatusSection.vue # 平台配置状态区块（每项目各平台是否已配置）
│   │   └── RepoLinkAuditSection.vue # 仓库链接一致性审计
│   ├── LogPanel/                    # 操作日志视图专属（6 个）
│   │   ├── index.vue                # 操作日志视图入口容器（筛选/分页/日期分组编排 + 区块组合）
│   │   ├── LogStatsBar.vue          # 状态统计条（按操作类型聚合成功/失败）
│   │   ├── LogToolbar.vue           # 顶部工具条（搜索 + 类型筛选 + 仅失败 + 清空）
│   │   ├── LogTable.vue             # 日志表格（表头 + 日期分组循环）
│   │   ├── LogTableRow.vue          # 日志表格行（数据行 + 平台/commit 子行，展开/复制状态自持）
│   │   └── LogDetailDialog.vue      # 日志条目详情弹窗
│   ├── CommitAnalysis/              # 提交分析视图专属（10 个）
│   │   ├── index.vue                # 提交分析视图入口容器（状态编排 + 各区块组合）
│   │   ├── AnalysisToolbar.vue      # 顶部工具条（分析状态 + 条数 + 分析按钮 + 显示设置）
│   │   ├── AnalysisOverviewCards.vue# 总览卡片（总提交/已分析项目 + 失败提示）
│   │   ├── ProjectRankingSection.vue# 项目提交排行区块（条形 + 百分比，点击跳转）
│   │   ├── RecentCommitsSection.vue # 最近提交记录区块（条目 + 分页加载）
│   │   ├── HeatmapCalendarSection.vue# 热力图/日历区块（viewSettings 切换）
│   │   ├── DailyTrendSection.vue    # 最近 30 天提交趋势区块（每日柱状）
│   │   ├── AuthorTypeSection.vue    # 作者排行 + 内容类型双栏区块
│   │   ├── CommitAnalysisSettings.vue# 分析设置
│   │   ├── CommitCalendar.vue       # 提交日历
│   │   └── CommitHeatmap.vue        # 提交热力图
│   ├── CommitRuleCheck/             # 提交规则检查视图专属（5 个）
│   │   ├── index.vue                # 提交规则检查视图入口容器（状态编排 + 区块组合 + 修正弹窗）
│   │   ├── RuleCheckToolbar.vue     # 顶部工具条（分析状态 + 条数 + 分析按钮）
│   │   ├── RuleCheckOverview.vue    # 总览区块（检查数/不合规/合规率卡片 + 规则提示）
│   │   ├── ReasonDistributionSection.vue # 违规类型分布区块（条形）
│   │   └── ViolationListSection.vue # 不合规提交列表区块（条目 + 修正入口 + 分页）
│   └── LineStats/                   # 行数统计专属（6 个）
│       ├── index.vue                # 行数统计视图入口容器（状态编排 + 汇总卡片 + 排行 + 弹窗）
│       ├── LineStatsToolbar.vue     # 顶部工具条（分析状态 + 过滤配置 + 条数 + 分析按钮）
│       ├── LineStatsCards.vue       # 顶部汇总卡片（总新增/删除/净增/当前总行数）
│       ├── LineRankingSection.vue   # 项目/作者行数排行通用区块（mode prop 区分）
│       ├── ExtFilterDialog.vue      # 文件格式过滤配置弹窗（扩展名多选排除列表）
│       └── ProjectLineDetail.vue    # 项目行数详情弹窗
│   └── CodeReport/                  # 代码统计报告视图专属（9 个）
│       ├── index.vue                # 报告视图入口容器（项目/时间范围选择 + 分区 Tab 编排）
│       ├── TeamOverviewSection.vue  # 团队总览分区（KPI 卡片：成员/总提交/总代码量/最活跃）
│       ├── AuthorContributionSection.vue # 代码贡献度分区（作者贡献排行）
│       ├── TechDebtSection.vue      # 技术债务分区（债务摘要 + 文件列表）
│       ├── HotspotSection.vue       # 代码热点分区（热点文件）
│       ├── CandlestickSection.vue   # 提交趋势分区（K 线/趋势图）
│       ├── DebtSummaryBar.vue       # 债务摘要条
│       ├── DebtFileDetail.vue       # 债务文件详情
│       └── FileDetailModal.vue      # 文件详情弹窗
└── styles/
    ├── index.scss                   # 主面板样式（卡片骨架 + Tab 区 + Stash/Tag/Output/Conflict 保留）
    ├── CardHeader.scss              # 卡片顶栏样式（从 index.scss 提取）
    ├── CardRemotes.scss             # 远程状态区样式（从 index.scss 提取）
    ├── CardActionBar.scss           # 操作栏样式（从 index.scss 提取）
    ├── StatsPanel.scss              # 统计视图样式
    ├── CommitAnalysisPanel.scss     # 提交分析面板样式
    ├── CommitRuleCheckPanel.scss    # 提交规则检查面板样式
    ├── CommitFixDialog.scss         # 提交信息修正弹窗样式
    ├── LineStatsPanel.scss          # 行数统计面板样式（含过滤按钮）
    ├── ExtFilterDialog.scss         # 文件格式过滤弹窗样式
    ├── WorkingTreePanel.scss        # 工作区面板样式
    ├── WorkingTreeDiffDialog.scss   # 差异弹窗样式
    ├── AiErrorAnalysisDialog.scss   # AI 错误分析弹窗样式
    ├── BranchCommitList.scss        # 提交历史列表样式
    ├── variables.scss               # 全局 Token 透传（已废弃：引用方已统一为 @/variables.scss，可删除）
    ├── _mixins.scss                 # 共享混入
    ├── _buttons.scss                # .vp-btn 按钮体系
    └── _shared.scss                 # .gp-spin 旋转动画
```

## 架构

`GitPushManager` 为**门面（Facade）**，自身不含业务逻辑，按职责委托给 6 个协作者：

```
GitPushManager (facade)
  ├── GitExecutor      ← 唯一接触 child_process 的类；execGit 双池并发 + abort/destroy
  ├── ProjectStore     ← 依赖 Executor（detectRemotes）+ Storage；项目/分类/标签 CRUD
  ├── RemoteOps        ← 依赖 Executor + Store + Storage；push/pull/fetch/checkPushStatus
  ├── WorktreeOps      ← 依赖 Executor；工作区/stash/分支/提交日志
  ├── RepoOps          ← 依赖 Executor；Tag/冲突/远程配置/Git 配置/扫描
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
| `checkPushStatus(id, opts?)` | 检查 ahead/behind/noUpstream |
| `getWorkingTreeStatus(path, opts?)` | 解析 `git status --porcelain` |
| `getFileDiff(path, file, staged)` | 获取文件 diff |
| `stageFile / stageAll / unstageFile / unstageAll` | 暂存操作 |
| `discardFile(path, file, staged, status)` | 丢弃更改 |
| `commit(path, message)` | 提交暂存内容 |
| `generateCommitMessage(path)` | AI / 启发式生成提交信息 |
| `getAiConfig()` | 读取超级面板 AI 配置（统一入口 `@/utils/aiApi`，供 AI 错误分析弹窗使用） |
| `getCommitLog(path, count?)` | 获取最近 N 条提交记录 |
| `getNumstatLog(path, since?, maxCount?)` | 获取 numstat 提交日志（每文件增删行；供代码统计报告聚合） |
| `getCommitStatsLog(path, maxCount?)` | 行数统计专用单命令抓取：numstat + hash/message/author/date（替代原 getCommitLog + getNumstatLog 双命令） |
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

## 使用

1. 在超级面板中启用「Git 推送」
2. 点击「添加项目」，输入名称和选择项目路径
3. 面板自动检测 GitHub/Gitee/Gitea 远程
4. **列表视图**：展开项目卡片查看工作区变更、分支列表、提交历史
5. **统计视图**：查看远程覆盖率、待处理项目汇总、平台配置状态
6. **行数统计视图**：点击「开始行数分析」统计各项目/作者的代码新增/删除/净增行数排行；可按需点击过滤按钮勾选要排除的文件格式
7. 使用拉取/推送按钮同步远程仓库
8. 暂存文件 → 生成/输入提交信息 → 提交
9. 点击头部「在独立窗口打开」按钮，将面板弹出为独立浮动窗口（关闭浮动窗口页签自动移回主窗口）

## 存储

项目映射和分类通过 `PluginStorage` + `TypedStorage` 持久化，存储 key：
- `git-push-projects`：项目列表
- `git-push-categories`：分类列表
- `git-push-concurrency`：Git 并发数配置

## 性能优化

- **并发信号量**：git 命令最大 3 并发，避免子进程排队拥堵
- **批次加载**：首屏只加载工作区摘要 + 推送状态，提交日志/分支/Stash 按展开懒加载
- **HEAD hash 缓存**：静默刷新时跳过无变动项目的重加载
- **共享 rev-parse**：统计视图通过 `loadStatsData` 单次获取分支名分发给 pushStatus + workingTree
