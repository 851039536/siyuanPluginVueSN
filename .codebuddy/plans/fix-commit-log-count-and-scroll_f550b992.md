---
name: fix-commit-log-count-and-scroll
overview: 修复 commit log 最多只显示 5 条的问题（增加默认数量至 30），使 SCSS 已内置的 max-height + overflow-y:auto 滚动生效。
todos:
  - id: fix-default-count
    content: 修改 GitPushManager.ts 第 710 行 getCommitLog 默认 count 从 5 改为 30
    status: completed
---

## 问题描述

`BranchCommitList.vue` 的提交历史列表最多只显示 5 条记录，实际仓库可能有数十条提交，需要能看到更多。

## 根因分析

- `GitPushManager.ts` 第 710 行 `getCommitLog(projectPath, count = 5)` 默认只拉取 5 条提交
- 调用方 `useGitOps.loadCommitLog` 第 434 行未传入 count 参数，全程使用默认值 5
- SCSS 层面 `.bcl-list` 已设置 `max-height: 160px; overflow-y: auto`，但因条目从未超过 5 条从未触发滚动

## 核心改动

将 `GitPushManager.ts` 中 `getCommitLog` 的默认 count 从 5 提升至 30，无需修改 Vue 组件或 SCSS。160px 高度约可见 8-9 条，30 条总数据自然超出触发滚动。

## 代码简化建议（本次不实施，供后续参考）

1. **GitPushManager.ts**：`split("\n")` + 固定步长 5 的循环（第 716-726 行）可提取为辅助函数，增强可读性和复用性
2. **BranchCommitList.vue**：`searchKeyword` + `searchAuthor` 两个独立 `ref` 可合并为 `reactive({ keyword: "", author: "" })`，减少响应式变量数量

## 技术方案

### 修改范围

仅修改 1 个文件、1 个参数：

| 文件 | 行号 | 变更 |
| --- | --- | --- |
| `src/features/gitPush/GitPushManager.ts` | 710 | `count = 5` → `count = 30` |


### 为什么不需要其他改动

1. **Vue 组件**：`BranchCommitList.vue` 从 props 接收 `entries`，无条目数量限制，无需修改
2. **SCSS**：`.bcl-list` 已有 `max-height: 160px` + `overflow-y: auto`，30 条数据会自动触发滚动
3. **调用方**：`useGitOps.loadCommitLog` 无需改，默认值提升后自动生效
4. **搜索栏**：`.bcl-search` 位于 `.bcl-body` 内、`.bcl-list` 外，滚动时搜索栏保持固定在上方，UX 良好

### 性能影响

- 30 条提交记录的 git log 命令开销极小（通常在 100ms 以内）
- 30 条文本数据 `CommitLogEntry[]` 数组内存占用可忽略
- 懒加载机制不变：仅在用户展开工作区面板时才触发 `loadCommitLog`