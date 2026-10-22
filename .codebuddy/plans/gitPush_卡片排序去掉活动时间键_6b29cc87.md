---
name: gitPush 卡片排序去掉活动时间键
overview: 修复「卡片操作后跳到最前面」：将 sortProjects 的排序键从「收藏置顶 → lastActivity 降序 → 名称」改为「收藏置顶 → 名称升序」，活动时间不再参与排序（仅保留活跃度徽章展示用途），操作触发的 lastActivity 回写不再改变卡片位置。
todos:
  - id: rework-sort-comparator
    content: 修改 sortProjects 比较器：删除 lastActivity 降序键，改为收藏置顶 + 名称升序，同步注释
    status: completed
  - id: verify-sort-gates
    content: 跑 read_lints + pnpm typecheck + pnpm test 自查闸，确认无残留引用与回归
    status: completed
---

## 产品概述

修复 gitPush 列表视图「卡片操作后跳到最前面」的问题：卡片排序不再消费活动时间，操作（提交 / 修正 / 删除提交 / 刷新日志 / stash 写操作等）触发的 lastActivity 回写不再改变卡片在列表中的位置。

## 核心功能

- `sortProjects` 排序键从「收藏置顶 → lastActivity 降序 → 名称」改为「**收藏置顶 → 名称升序**」，排序结果完全确定、与会话内操作解耦，卡片不再跳动
- `lastActivity` 保留既有职责不变：仍由 `recordCommitActivity` 链路持久化写入，仅用于 CardHeader 活跃度徽章（相对时间 + 活跃等级 + 归档建议）展示
- 智能视图（需推送 / 需拉取 / 有变更 / 收藏 / 归档）与分类分组列表统一套用新排序，行为一致
- 不改动任何功能入口、交互与数据流；用户明确选择「去掉活动时间排序」方案（放弃「会话内冻结排序」备选）

## 技术栈

- 既有项目：Vite + Vue 3 + TypeScript 思源插件，gitPush 为单体插件内功能模块，无新增依赖

## 实现方案

- **唯一改动点**：`src/features/gitPush/utils/project.ts:35-44` 的纯函数 `sortProjects`——删除 lastActivity 降序比较分支，保留 starred 置顶与 `name.localeCompare` 兜底；同步更新其上方的排序说明注释（新增一句说明 lastActivity 不参与排序的原因：操作回写会导致卡片跳动）
- **影响面核实（已完成）**：`sortProjects` 的全部消费方仅 `composables/useProjectFilters.ts`（pickByIds / smartViewProjects / filteredGroups，经 `utils/index.ts` 桶导入）；31 个 spec 文件无一引用 sortProjects / useProjectFilters，无需改测试
- **刻意保留的既有行为**：① `recordCommitActivity`（`index.vue:446-453`）中 `projects.value = [...]` 数组替换保留——它负责驱动活跃度徽章刷新；排序键移除后重排结果与原顺序一致，不再有位置移动；② 收藏置顶排序保留（点收藏跳到收藏区是既定交互）；③ lastActivity 持久化写入链路（ProjectStore.recordLastActivity）零改动

## 架构设计

纯函数比较器删减，数据流不变：`projects`（useGitPush）→ `useProjectFilters.filteredGroups`（sortProjects）→ ListView 卡片列表。改动后重排结果稳定，Vue `:key="project.id"` 下无 DOM 重挂载，零额外渲染开销（比较次数不变）。

## 验证

- 自查闸：read_lints + `pnpm typecheck`（vue-tsc）+ `pnpm test`（纯函数层改动，按 AGENTS 规则主动跑一次）
- `pnpm lint` / `pnpm vite build` 由用户执行；README / changelog 待用户确认效果后补