# Git 推送 (gitPush)

同时推送到 GitHub、Gitee、Gitea，持久化项目路径映射，查看工作区变更和提交历史。

## 功能

- **项目映射**：添加本地 Git 项目路径，持久化保存（不影响项目本身）
- **远程检测**：自动检测 `github.com`、`gitee.com`、Gitea 远程仓库
- **多平台推送**：一键推送到 GitHub / Gitee / Gitea，或全部推送
- **路径检查**：添加时检查路径是否为合法 Git 仓库
- **工作区变更**：查看暂存/未暂存/未跟踪文件，支持暂存、取消暂存、查看 diff
- **提交功能**：Conventional Commit 快捷类型选择、AI 生成提交信息（降级为启发式）
- **提交历史**：查看当前分支最近 5 条提交记录
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
│   └── BranchCommitList.vue    # 提交历史面板
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
| `checkPushStatus(id)` | 检查 ahead/behind/noUpstream |
| `getWorkingTreeStatus(path)` | 解析 `git status --porcelain` |
| `getFileDiff(path, file, staged)` | 获取文件 diff |
| `stageFile / stageAll / unstageFile / unstageAll` | 暂存操作 |
| `commit(path, message)` | 提交暂存内容 |
| `generateCommitMessage(path)` | AI / 启发式生成提交信息 |
| `getCommitLog(path, count?)` | 获取最近 N 条提交记录 |
| `getCategories / addCategory / updateCategory / deleteCategory` | 分类 CRUD |
| `moveProject(projectId, categoryId)` | 移动项目到指定分类 |

### 共享常量

- `COMMIT_TYPE_VALUES`：Conventional Commit 类型数组（`feat/fix/chore/docs/style/refactor/test`），单一数据源
- `CommitType`：对应的 TypeScript 联合类型

## 使用

1. 在超级面板中启用「Git 推送」
2. 点击「添加项目」，输入名称和选择项目路径
3. 面板自动检测 GitHub/Gitee/Gitea 远程
4. 展开项目卡片查看工作区变更
5. 点击推送按钮或「推送全部」

## 存储

项目映射和分类通过 `PluginStorage` + `TypedStorage` 持久化，存储 key：
- `git-push-projects`：项目列表
- `git-push-categories`：分类列表

## 扩展建议

- **标签管理**：支持 Git tag 的创建、推送、删除操作
- **Pull 操作**：从远程拉取更新，支持 rebase/merge 策略选择
- **diff 对比增强**：并排双栏 diff 视图，语法高亮
- **Stash 支持**：暂存/恢复工作区修改
- **分支切换**：在面板内切换分支
- **冲突解决**：检测 merge conflict 并提供简化解决方案
- **提交搜索**：按关键词/作者/日期搜索提交历史
