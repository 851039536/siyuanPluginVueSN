---
name: gitpush-code-review-refactor
overview: 对 gitPush 模块进行全面代码审查：提取共享 SCSS、消除 7 类重复代码、性能优化（减少不必要的 git 命令调用）、新增分支提交历史列表功能，并给出扩展建议。
todos:
  - id: explore-duplicates
    content: 使用 [subagent:code-explorer] 精确锚定 7 类冗余的代码行号和上下文，确认所有重复片段
    status: completed
  - id: create-scss-partials
    content: 创建 src/features/gitPush/styles/_variables.scss、_buttons.scss、_shared.scss 三个 partial 文件，迁移 $vp-mono、gp-spin 动画、vp-btn 体系、focus mixin、输出区基类
    status: completed
    dependencies:
      - explore-duplicates
  - id: update-scss-imports
    content: 修改 index.vue 和 WorkingTreePanel.vue 的 SCSS：删除本地重复定义，改为 @use 引用共享 partial，验证构建无警告
    status: completed
    dependencies:
      - create-scss-partials
  - id: dedup-commit-types
    content: 在 types/storage.ts 新增 COMMIT_TYPE_VALUES 常量和 CommitType 类型，统一 WorkingTreePanel.vue、AI prompt、heuristicCommitMessage 三处引用
    status: completed
    dependencies:
      - explore-duplicates
  - id: dedup-push-output
    content: 在 composables/useGitPush.ts 提取 formatPushOutput 私有函数，消除 pushToAll 和 pushSingle 中的重复输出格式化代码
    status: completed
    dependencies:
      - explore-duplicates
  - id: dedup-platform-check
    content: 在 types/index.ts 提取 isKnownRemote 辅助方法，统一 detectRemotes 和 checkCanPushToCloud 中的平台判断逻辑
    status: completed
    dependencies:
      - explore-duplicates
  - id: add-commit-log
    content: 新增分支提交列表：types/storage.ts 加 CommitLogEntry 接口、types/index.ts 加 getCommitLog 方法、新建 components/BranchCommitList.vue、集成到 WorkingTreePanel
    status: completed
    dependencies:
      - dedup-commit-types
  - id: update-readme
    content: 使用 [skill:readme-generator] 更新 src/features/gitPush/README.md，补充新增组件说明、扩展建议章节（标签管理、Pull 操作、diff 对比增强、stash 支持）
    status: completed
    dependencies:
      - add-commit-log
  - id: build-verify
    content: 执行 pnpm vite build 构建验证，确认零错误零警告，所有冗余已消除
    status: completed
    dependencies:
      - update-scss-imports
      - dedup-commit-types
      - dedup-push-output
      - dedup-platform-check
      - add-commit-log
---

## 用户需求

对 `src/features/gitPush` 模块执行全面的代码审查与重构，涵盖 TypeScript/Vue/SCSS 三个层面：

1. **识别并合并 7 类冗余代码**：SCSS 变量/动画/按钮/输出区/focus 样式重复、COMMIT_TYPES 多处定义、推送输出格式化重复、平台判断逻辑重复
2. **评估性能优化可能性**：大数组渲染、重复计算缓存
3. **确保符合 CLAUDE.md 编码规范**：Vue 事件 camelCase、统一入口原则、Codex UI 风格
4. **新增分支提交信息列表**：显示当前分支最近 5 条提交记录

## 产品概述

重构后的 gitPush 模块代码更整洁、可维护，SCSS 共享变量统一管理，类型常量单一数据源，新增的分支提交列表让用户无需切换终端即可查看提交历史。

## 核心功能

- SCSS 变量/动画/按钮/共享样式提取到独立 partial 文件
- COMMIT_TYPES 提取为 types/storage.ts 中共享常量
- 推送输出格式化提取为私有辅助函数
- 新增 BranchCommitList.vue 组件展示最近 5 条提交（hash、message、author、time）
- 提供模块扩展建议（标签管理、Pull 操作、文件对比增强等）

## 技术栈

- 前端框架：Vue 3 + TypeScript
- 样式：SCSS（非 scoped，全局样式模式）
- 构建：Vite 6
- Git 操作：Node child_process.exec 调用 git CLI
- 存储：TypedStorage（项目标配）

## 实现方案

### SCSS 冗余消除策略

创建 `src/features/gitPush/styles/` 目录，按功能拆分为 3 个 partial 文件，`index.vue` 和 `WorkingTreePanel.vue` 通过 `@use` 引用共享样式：

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `_variables.scss` | `$vp-mono` 变量 + `@keyframes gp-spin` | 从 index.vue 和 WorkingTreePanel.vue 各提取一次 |
| `_buttons.scss` | `.vp-btn` 体系（基础 + `--sm`/`--primary`/`--ghost` 变体） | 从 index.vue 迁移 |
| `_shared.scss` | focus mixin (`.gp-focus-ring`)、输出区通用样式 (`.gp-output-base`)、等宽字体 body 通用类 | 新建，替代 3 处重复的 focus + 2 处输出区 + STATUS_MAP 样式 |


两个 Vue 文件从 `lang="scss"` 改为 `lang="scss"` + `@use "@/features/gitPush/styles/variables" as *;`（保持现有变量可直接使用）。

### TypeScript 冗余消除策略

**COMMIT_TYPES 统一**：在 `types/storage.ts` 新增 `COMMIT_TYPE_VALUES` 常量数组和 `CommitType` 类型，3 处引用统一为单一数据源：

```
types/storage.ts:
  export const COMMIT_TYPE_VALUES = ["feat","fix","chore","docs","style","refactor","test"] as const
  export type CommitType = typeof COMMIT_TYPE_VALUES[number]

WorkingTreePanel.vue: import { COMMIT_TYPE_VALUES } → 替代本地 COMMIT_TYPES
types/index.ts: AI prompt 用 COMMIT_TYPE_VALUES.join("/") 动态生成类型列表
types/index.ts: heuristicCommitMessage() 按 COMMIT_TYPE_VALUES 优先级推断
```

**推送输出格式化提取**：在 `composables/useGitPush.ts` 新增私有函数 `formatPushOutput(id, label, result, ok)`，`pushToAll` 和 `pushSingle` 共用。

**平台判断统一**：在 `types/index.ts` 提取 `isKnownRemote(remote: GitRemoteInfo, key: string): boolean` 辅助方法，`detectRemotes` 和 `checkCanPushToCloud` 共用。

### 新增分支提交列表

新增 3 个部分：

1. **类型** `types/storage.ts`：`CommitLogEntry` 接口（hash、message、author、date、branch）
2. **Manager 方法** `types/index.ts`：`getCommitLog(projectPath: string, count?: number)` 执行 `git log --oneline --format="..." -n N`
3. **子组件** `components/BranchCommitList.vue`：显示分支名 + 提交列表（短 hash 等宽 + 提交信息 + 作者 + 相对时间），集成到 WorkingTreePanel 折叠面板底部（提交表单之后），或作为独立可折叠 section

### 性能优化

- `fileDiffs` 使用 `Record<string, string>` 已经 O(1) 查找，无需改动
- `sortedFiles` computed 已使用 `[...props.tree.files]` 浅拷贝，避免修改原数组
- 新增 `commitLogs` 按需加载（展开提交列表时才请求），避免不必要 git 调用

### CLAUDE.md 合规检查

本次重构不引入新功能注册（不涉及 addDock/addCommand），仅模块内部优化：

- Vue 事件：全部已 camelCase，无需修改
- 统一入口：storage 用 TypedStorage、AI 用 callAI、Node 模块用 getNodeProcessModules——全部合规
- 图标：优先 @iconify/vue（`mdi:source-commit` 等）——合规
- Codex 风格：等宽字体 + 大写标签 + 边框卡片 + 主/次按钮——无需修改

## Agent Extensions

### SubAgent

- **code-explorer**
- 用途：探索 gitPush 模块完整文件结构，读取各文件的 SCSS 重复片段、COMMIT_TYPES 定义处、推送格式化逻辑，精确锚定修改位置
- 预期结果：获得 7 类冗余的精确行号和具体代码片段，确保重构方案无遗漏

### Skill

- **readme-generator**
- 用途：更新 `src/features/gitPush/README.md`，补充新增 BranchCommitList 组件说明和扩展建议章节
- 预期结果：生成包含组件树、API 列表、提交日志功能说明、扩展建议的结构化 README