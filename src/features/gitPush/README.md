# Git 推送 (gitPush)

完整的 Git 图形界面：推送/拉取/暂存/提交/差异/分支切换/提交搜索，持久化项目路径映射。

## 功能

- **项目映射**：添加本地 Git 项目路径，持久化保存（不影响项目本身）
- **远程检测**：自动检测 `github.com`、`gitee.com`、Gitea 远程仓库
- **多平台推送/拉取**：一键推送到/拉取自 GitHub / Gitee / Gitea，或全部操作
- **路径检查**：添加时检查路径是否为合法 Git 仓库
- **工作区变更**：查看暂存/未暂存/未跟踪文件，支持暂存、取消暂存、查看着色 diff
- **提交功能**：Conventional Commit 快捷类型选择、AI 生成提交信息（降级为启发式）
- **提交历史**：查看当前分支最近 5 条提交记录，支持关键词/作者搜索过滤
- **分支管理**：查看本地分支列表，一键切换分支（自动检测未提交变更）
- **项目分类**：按颜色标签分组管理项目

## 目录结构

```
src/features/gitPush/
├── index.ts                    # registerGitPush() 入口
├── index.vue                   # 主面板（Dock）
├── types/
│   ├── index.ts                # GitPushManager 业务逻辑
│   └── storage.ts              # 类型定义 + TypedStorage 持久化
├── composables/
│   └── useGitPush.ts           # Vue 3 响应式状态层
├── components/
│   ├── WorkingTreePanel.vue    # 工作区变更面板（暂存/diff/提交）
│   └── BranchCommitList.vue    # 提交历史面板（含搜索）
└── styles/
    ├── _variables.scss          # $vp-mono 等宽字体变量
    ├── _mixins.scss             # focus-ring / output-base 混入
    ├── _buttons.scss            # .vp-btn 按钮体系
    └── _shared.scss             # .gp-spin 旋转动画
```

## API

### GitPushManager 核心方法

| 方法 | 说明 |
|------|------|
| `addProject(name, path, categoryId)` | 添加项目并自动检测远程 |
| `removeProject(id)` | 删除项目映射 |
| `pushToAll(id)` | 推送到全部已配置远程 |
| `pushSingle(id, target)` | 推送到指定远程 |
| `pullToAll(id)` | 从全部已配置远程拉取（--ff-only） |
| `pullSingle(id, target)` | 从指定远程拉取 |
| `checkPushStatus(id)` | 检查 ahead/behind/noUpstream |
| `getWorkingTreeStatus(path)` | 解析 `git status --porcelain` |
| `getFileDiff(path, file, staged)` | 获取文件 diff |
| `stageFile / stageAll / unstageFile / unstageAll` | 暂存操作 |
| `commit(path, message)` | 提交暂存内容 |
| `generateCommitMessage(path)` | AI / 启发式生成提交信息 |
| `getCommitLog(path, count?)` | 获取最近 N 条提交记录 |
| `getBranches(path)` | 获取本地分支列表 |
| `switchBranch(path, branch)` | 切换分支（检测未提交变更） |
| `getCategories / addCategory / updateCategory / deleteCategory` | 分类 CRUD |
| `moveProject(projectId, categoryId)` | 移动项目到指定分类 |

### 共享常量

- `COMMIT_TYPE_VALUES`：Conventional Commit 类型数组（`feat/fix/chore/docs/style/refactor/test`），单一数据源
- `CommitType`：对应的 TypeScript 联合类型
- `BranchInfo`：分支信息接口（`name` + `current`）

## 使用

1. 在超级面板中启用「Git 推送」
2. 点击「添加项目」，输入名称和选择项目路径
3. 面板自动检测 GitHub/Gitee/Gitea 远程
4. 展开项目卡片查看工作区变更、分支列表、提交历史
5. 使用拉取/推送按钮同步远程仓库
6. 暂存文件 → 生成/输入提交信息 → 提交

## 存储

项目映射和分类通过 `PluginStorage` + `TypedStorage` 持久化，存储 key：
- `git-push-projects`：项目列表
- `git-push-categories`：分类列表

## 扩展建议

- **标签管理**：支持 Git tag 的创建、推送、删除操作
- **Stash 支持**：暂存/恢复工作区修改
- **冲突解决**：检测 merge conflict 并提供简化解决方案
- **远程管理**：添加/删除/重命名 git remote
- **日志筛选**：按日期范围、文件路径过滤提交记录
