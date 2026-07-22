# Git 推送 (gitPush)

完整的 Git 图形界面：推送/拉取/暂存/提交/差异/分支切换/提交搜索/统计视图，持久化项目路径映射。

## 功能

- **项目映射**：添加本地 Git 项目路径，持久化保存（不影响项目本身）
- **远程检测**：自动检测 `github.com`、`gitee.com`、`gitcode.com`、Gitea 远程仓库，支持远程名称辅助识别（不区分大小写）
- **多平台推送/拉取**：一键推送到/拉取自 GitHub / Gitee / Gitea，或全部操作，并发信号量限流
- **路径检查**：添加时检查路径是否为合法 Git 仓库
- **工作区变更**：查看暂存/未暂存/未跟踪文件，支持暂存、取消暂存、查看着色 diff、丢弃更改
- **提交功能**：Conventional Commit 快捷类型选择、AI 生成提交信息（支持思考模式控制）
- **提交历史**：查看当前分支最近 N 条提交记录，支持关键词/作者搜索过滤
- **分支管理**：查看本地分支列表，一键切换分支（自动检测未提交变更）
- **Stash 暂存**：Git stash 存取恢复，支持 AI 生成描述
- **项目分类**：按颜色标签分组管理项目
- **标签/状态/备注**：多标签筛选、状态徽章循环切换（活跃/维护中/暂停）、项目备注
- **统计视图**：远程覆盖率、待处理项目合并视图（推送状态概览 + 待推送/暂存/未暂存表格）、平台配置状态
- **扫描导入**：递归扫描目录批量导入 Git 仓库
- **远程配置**：添加/编辑/删除远程仓库，支持行内编辑 URL

## 目录结构

```
src/features/gitPush/
├── index.ts                         # registerGitPush() 入口
├── index.vue                        # 主面板（Dock，列表+统计双视图）
├── GitPushManager.ts                # 门面：组合 managers/ 协作者，对外暴露统一 API
├── managers/
│   ├── GitExecutor.ts               # git 子进程执行器（双池信号量限流 + abort 生命周期）
│   ├── ProjectStore.ts              # 项目/分类/标签 CRUD 与内存缓存
│   ├── RemoteOps.ts                 # push/pull/fetch 全平台与单平台、推送状态检查
│   ├── WorktreeOps.ts               # 工作区状态/差异/暂存/提交/stash/分支/提交日志
│   ├── RepoOps.ts                   # Tag 管理、冲突检测、远程配置、Git 配置查看、仓库扫描
│   └── CommitMsgGenerator.ts        # AI 提交信息与 stash 描述生成（含启发式降级）
├── types/
│   ├── index.ts                     # 类型桶（重导出 meta/storage + GitPushManager）
│   ├── meta.ts                      # PLATFORM_META/STATUS_META 等共享常量（独立模块切断循环引用）
│   └── storage.ts                   # 类型定义 + TypedStorage 持久化
├── composables/
│   ├── useGitPush.ts                # Vue 3 响应式状态层（聚合入口）
│   ├── useProjectCrud.ts            # 项目 CRUD 响应式封装
│   ├── useGitOps.ts                 # 推送/拉取/工作区/stash 响应式封装
│   ├── useGitTagsConflicts.ts       # Tag/冲突/模板/扫描导入
│   ├── useGitStats.ts               # 统计视图 computed
│   └── useDirectoryPicker.ts        # 目录选择封装（Electron + webkitdirectory 降级）
├── components/
│   ├── StatsPanel.vue               # 统计视图（覆盖率/待处理项目/平台状态）
│   ├── WorkingTreePanel.vue         # 工作区变更面板（暂存/diff/提交）
│   └── BranchCommitList.vue         # 提交历史面板（含搜索）
└── styles/
    ├── index.scss                   # 主面板样式
    ├── StatsPanel.scss              # 统计视图样式
    ├── WorkingTreePanel.scss        # 工作区面板样式
    ├── BranchCommitList.scss        # 提交历史列表样式
    ├── _variables.scss              # 设计 Token
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
| `getCommitLog(path, count?)` | 获取最近 N 条提交记录 |
| `getBranches(path)` | 获取本地分支列表 |
| `switchBranch(path, branch)` | 切换分支（检测未提交变更） |
| `getCategories / addCategory / updateCategory / deleteCategory` | 分类 CRUD |
| `moveProject(projectId, categoryId)` | 移动项目到指定分类 |
| `addRemote / removeRemote / setRemoteUrl / renameRemote` | 远程仓库管理 |
| `getStashList / stashSave / stashPop / stashApply / stashDrop` | Stash 操作 |
| `generateStashDescription(path)` | AI 生成 Stash 描述 |
| `scanForGitRepos(dirPath)` | 递归扫描目录查找 Git 仓库 |

### 共享常量

- `PLATFORM_META`：远程平台元数据（GitHub/Gitee/Gitea 单个数据源），供 index.vue / StatsPanel / useGitPush 共用
- `COMMIT_TYPE_VALUES`：Conventional Commit 类型数组，单一数据源
- `PROJECT_STATUS_VALUES`：项目状态循环顺序（`active → maintenance → paused`）

## 使用

1. 在超级面板中启用「Git 推送」
2. 点击「添加项目」，输入名称和选择项目路径
3. 面板自动检测 GitHub/Gitee/Gitea 远程
4. **列表视图**：展开项目卡片查看工作区变更、分支列表、提交历史
5. **统计视图**：查看远程覆盖率、待处理项目汇总、平台配置状态
6. 使用拉取/推送按钮同步远程仓库
7. 暂存文件 → 生成/输入提交信息 → 提交

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
