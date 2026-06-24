---
name: gitpush-refactoring
overview: 审查 gitPush 功能模块（约 5800 行代码），进行深度重构：拆分巨型文件、消除冗余代码、优化性能，确保完全符合 CLAUDE.md 编码规范。
todos:
  - id: fix-scss-naming
    content: 修复 SCSS 文件命名违规：重命名 `_buttons.scss`→`buttons.scss`、`_shared.scss`→`shared.scss`、`_variables.scss`→`variables.scss`，同步更新 `index.vue` 及所有子组件 SCSS 文件中的 @use 路径
    status: completed
  - id: extract-manager
    content: 从 `types/index.ts` 提取 GitPushManager 类至新建 `src/features/gitPush/GitPushManager.ts`，types/index.ts 仅保留类型导出和 PLATFORM_META 常量；合并 pushToAll/pullToAll 中的冗余 tryPush/tryPull 为 tryRemoteOp 通用函数
    status: completed
  - id: split-use-gitpush
    content: 拆分 useGitPush.ts（1025行）为 4 个职责单一的 composable：useProjectCrud、useGitOps、useGitTagsConflicts、useGitStats；提取公共 findProject 辅助函数消除散落的 projects.value.find 重复
    status: completed
    dependencies:
      - extract-manager
  - id: extract-project-card
    content: 从 index.vue 提取项目卡片为独立组件 ProjectCard.vue（含远程状态、推送/拉取按钮组），提取 Stash 操作区为 StashSection.vue，提取冲突栏为 ConflictSection.vue
    status: completed
    dependencies:
      - split-use-gitpush
  - id: split-styles
    content: 拆分 styles/index.scss（1521行）：提取弹窗通用样式至 Dialog.scss、表单样式至 Form.scss、远程配置/扫描导入/Tag 面板样式至对应组件 SCSS，修复硬编码 line-height 值
    status: completed
    dependencies:
      - fix-scss-naming
  - id: fix-filters-storage
    content: 修复 useProjectFilters.ts 中直接调用 plugin.loadData/saveData 的违规，改用 TypedStorage 持久化 gitOpsPaused 和 showArchived 状态
    status: completed
  - id: perf-and-verify
    content: 性能优化：Record ref 更新策略改为深层属性赋值、输出缓存添加 30条上限、silentRefreshAll 添加 activeCategory 过滤；运行 `pnpm lint` + `npx tsc --noEmit` 最终验证
    status: completed
    dependencies:
      - extract-project-card
      - split-styles
      - fix-filters-storage
---

## 用户需求

对 `src/features/gitPush` 模块进行全面代码审查与重构：识别并合并冗余代码，评估性能优化机会，在不影响现有功能逻辑的前提下进行代码重构，确保修改完全符合项目 CODEBUDDY.md/CLAUDE_RULES.md 编码规范。

## 核心功能

本次重构不改变 gitPush 功能的任何业务逻辑。所有操作（项目 CRUD、推送/拉取、工作区暂存/提交、stash/tag 管理、冲突检测、统计视图、扫描导入、IDE 打开）保持完全一致。

## 重构范围

涉及 `src/features/gitPush/` 下全部 33 个文件，重点解决以下 7 类问题：

1. **types/index.ts 违规**：`GitPushManager` 类（1360+行运行时逻辑）放在 types 目录，需迁移至独立 service 文件
2. **index.vue 巨型组件**：2203行需提取项目卡片等可复用子组件
3. **useGitPush.ts 过度膨胀**：1025行混淆 10+ 种职责，需按领域拆分
4. **styles/index.scss 过大**：1521行含弹窗、表单、远程配置等混合样式
5. **SCSS 文件命名违规**：`_buttons.scss`/`_shared.scss`/`_variables.scss` 使用 `_` 前缀
6. **冗余代码**：push/pull 操作中有 `~50行重复逻辑`；30+处散落的 `find` 模式；useProjectFilters 直接调用 plugin 存储 API
7. **性能问题**：Record ref 频繁全量替换、输出缓存无界增长、refreshAll 无 Tab 过滤

## 技术栈

- 语言：TypeScript 5.x + Vue 3 Composition API（`<script setup lang="ts">`）
- 样式：SCSS（复用项目全局 `src/_variables.scss` 设计 Token）
- 存储：`PluginStorage` + `TypedStorage<T>` 统一入口
- 构建：Vite library mode（CJS 输出）

## 实施策略

### 拆分顺序原则

按依赖关系自底向上重构：先修复 SCSS 命名（底层样式依赖），再拆分 Manager（composable 依赖），然后拆分 composable，最后拆分 Vue 模板。每步完成后运行 `pnpm lint` + `npx tsc --noEmit` 验证。

### 关键设计决策

1. **GitPushManager 提取为独立文件**：新建 `src/features/gitPush/GitPushManager.ts`，将所有运行时逻辑从 `types/index.ts` 移出。`types/index.ts` 仅保留纯类型导出 + `PLATFORM_META` 常量（供多文件共享）。这是最安全的拆分方式——只改 import 路径，不改任何函数签名。

2. **useGitPush 按职责拆分**：分为 4 个 domain composable，每个只管理一个领域的 ref + 方法：

- `useProjectCrud.ts`：项目 CRUD、标签、状态、分类
- `useGitOps.ts`：推送/拉取、工作区暂存、提交、stash
- `useGitTagsConflicts.ts`：Tag 管理、冲突检测、提交模板
- `useGitStats.ts`：统计视图 computed（projectCount/remoteCoverage/pushStatusStats 等）

抽取公共 `findProject` 辅助函数到 `utils.ts`，消除 30+ 处散落的 `projects.value.find((p) => p.id === id)` 模式。

3. **index.vue 提取子组件**：采取渐进拆分策略——先提取纯展示组件（如 ProjectCard、StashSection、ConflictSection），不改变数据流。卡片内已有的子组件引用（WorkingTreePanel、TagPanel、BranchCommitList）保持不变。

4. **SCSS 规范修复**：重命名 3 个文件（去掉 `_` 前缀），同时更新所有 `@use` 路径。将 styles/index.scss 中的弹窗/表单/远程配置样式提取为独立的 `Dialog.scss`、`Form.scss`、`RemoteConfig.scss` 等 partial 文件。

### 冗余合并策略

- **pushToAll/pullToAll**：将 tryPush/tryPull 内联函数提取为 `tryRemoteOp(action, remoteName)` 通用辅助函数，消除约 50 行重复。
- **pushSingle/pullSingle**：提取 `getRemoteName(project, target)` 辅助函数，消除 remoteName 选择逻辑重复。
- **useProjectFilters.ts**：用 TypedStorage 替代 `plugin.loadData/saveData` 直接调用。

### 性能优化

- **Record ref 更新**：将 `Record<string, boolean>` 的 `delete + 新赋值` 改为直接属性赋值（Vue 3 ref 支持深层响应式），避免每次创建新对象。
- **输出缓存上限**：`pushOutputs`/`pullOutputs`/`commitOutputs` 添加 LRU 策略，超过 30 条旧条目自动删除。
- **silentRefreshAll**：添加 `activeCategory` 检查，仅刷新当前 Tab 下项目，跳过不可见项目。

### 验证要求

- 每步完成后必须通过 `pnpm lint` + `npx tsc --noEmit` 验证
- 所有导入路径更新必须完整覆盖
- i18n 键保持不变，无需重新 merge