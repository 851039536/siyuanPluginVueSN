---
name: gitPush-fix-save-refresh-optimize
overview: 优化 gitPush 提交规则检查「保存修正」后的刷新流程：保存后仅重抓被修正项目（300→1）而非全量重跑分析；并为历史提交 rebase 保存过程增加耗时提示文案。
todos:
  - id: refactor-runcore-subset
    content: Use [skill:Feature Evolution] 评估影响后，为 useCommitAnalysis 的 runCore 增加 projectIds 子集重抓与 entries/failedCount/缓存合并逻辑，runAnalysis 支持可选 projectId
    status: completed
  - id: wire-fix-project-id
    content: CommitRuleCheck/index.vue 的 handleFixSaved 捕获 projectId 随 runAnalysis emit 传出，更新 emit 类型
    status: completed
    dependencies:
      - refactor-runcore-subset
  - id: rebase-save-hint
    content: CommitFixDialog 历史提交 rebase 保存加「正在重写历史提交」按钮文案与提示条，中英分片新增 ruleFixRewriting 键
    status: completed
---

## 产品概述

对 gitPush「提交规则检查」的「保存修正 → 刷新」链路做性能优化与体验改善：保存一条提交修正后，不再全量重跑所有项目分析（300 个项目），而是仅重抓被修正项目的提交日志，其他项目复用现有缓存；同时对历史提交的 rebase 重写过程增加「正在重写历史提交…」耗时提示。

## 核心功能

- 保存后局部刷新：修正成功后只重抓被修正项目的 git log，违规列表/总览卡片/违规分布基于合并后的数据即时更新，刷新耗时从「全项目」降到「单项目」
- 数据一致性：entries 缓存按项目合并（移除目标项目旧条目 + 追加新数据），failedCount 增量校正，全量模式行为与现状完全一致零回归
- 保存耗时提示：HEAD 提交（amend）保持「保存中…」；历史提交（rebase）显示「正在重写历史提交…」，让用户明确等待原因

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + SCSS，无新增依赖。

## 实现方案

### 1. 数据层：子集重抓（核心改动 `useCommitAnalysis.ts`）

- `runCore(needNumstat, projectIds?)` 新增可选参数：
- 未传 `projectIds` → 全量抓取（现状不变）
- 传入 → `Promise.allSettled(targets.map(...))` 只抓目标项目，`targets = projects.value.filter(p => projectIds.includes(p.id))`
- **entries 合并**（子集模式）：
- 先移除旧 `entries` 中属于目标项目的条目（rebase/amend 后 hash 已变，整个项目数据需整体替换）
- 再追加本次新抓取的 `flat`，其他项目条目保持原顺序
- 统一合并逻辑：全量模式（无 projectIds）时合并结果即 `flat`，行为与现状完全一致
- **failedCount 增量**：旧贡献 = 目标项目是否缺席旧 entries（缺席计 1）；新贡献 = 本次 rejected 数（单项目 0/1）；`failedCount = failedCount - 旧贡献 + 新贡献`
- **缓存合并**：`commitAnalysisCache.save` 的 `entries` 改用合并后数组、`failedCount` 用校正后的值；全量/子集共用同一保存路径
- `runAnalysis(projectId?)` 转发给 `runCore(false, projectId ? [projectId] : undefined)`；`runLineStatsAnalysis()`/`setCommitCount` 保持全量不变
- 子集重抓整个项目 git log，天然拿到 amend/rebase 后的新 hash 链，无需精确定位单条提交
- `analyzing` 防重与 `pendingReanalyze` 排队逻辑保持（分析进行中再保存则排队全量重跑，可接受）

### 2. 编排层：`CommitRuleCheck/index.vue`

- `handleFixSaved()`：在清空 `editingViolation` 前捕获 `editingViolation.value?.projectId`（`performSave` 中 `emit("saved")` 先于 `emit("close")`，此时目标仍可读），`emit("runAnalysis", projectId)`；无 projectId 时退化为不带参全量
- emit 定义更新：`runAnalysis: [projectId?: string]`

### 3. 弹窗层：`CommitFixDialog.vue` rebase 耗时提示

- 保存按钮文案：`saving` 时按 `isHistoryCommit` 区分——历史提交显示 `i18n.ruleFixRewriting`（正在重写历史提交…），HEAD 显示 `i18n.ruleFixSaving`
- 复用现有 `.gp-fix-warning` 提示条：`saving && isHistoryCommit` 时 body 显示同文案提示条（含图标），明确「正在重写历史提交」的等待原因

### 4. i18n

- `zh_CN`/`en_US` 分片新增 `ruleFixRewriting`（正在重写历史提交… / Rewriting history commits...）

## 实施要点

- 合并逻辑统一化：全量与子集共用一条保存路径，避免双份逻辑漂移
- `gitPush/index.vue` 无需改动：`@run-analysis="runAnalysis"` 中 Vue 自动将 $event（projectId）作为首个参数传入，新签名天然兼容
- 新增/修改文件带文件头注释；emit camelCase；i18n 只改分片
- 验证由用户执行：`pnpm i18n:verify`、`pnpm lint`、`npx tsc --noEmit`

## 架构设计

沿用现有「composables 数据源 + 编排容器 + 子组件」分层，无新增系统级架构。

保存刷新数据流：
修正保存 → `emit("saved")` → `handleFixSaved` 捕获 projectId → `emit("runAnalysis", projectId)` → `runAnalysis(projectId)` → `runCore(false, [projectId])` 单项目重抓 → entries/failedCount/缓存合并 → `commitRuleStats` computed 重算 → 违规列表/总览/分布即时更新

## 目录结构

```
src/features/gitPush/
├── composables/
│   └── useCommitAnalysis.ts              # [MODIFY] runCore 增加 projectIds 子集重抓；entries/failedCount/缓存合并逻辑；runAnalysis 增加可选 projectId 参数
├── components/
│   ├── CommitRuleCheck/
│   │   └── index.vue                     # [MODIFY] handleFixSaved 捕获 projectId 并随 runAnalysis emit 传出；emit 类型更新
│   └── common/
│       └── CommitFixDialog.vue           # [MODIFY] 历史提交 rebase 保存提示（按钮文案 + body 提示条）
src/i18n/
├── zh_CN/gitPush.json                    # [MODIFY] 新增 ruleFixRewriting
└── en_US/gitPush.json                    # [MODIFY] 新增 ruleFixRewriting
```

## 关键代码结构

`runCore` 子集合并逻辑（核心契约，保持全量模式行为不变）：

```ts
async function runCore(needNumstat: boolean, projectIds?: string[]): Promise<boolean> {
  // 目标子集：未传 projectIds 时 = 全部项目（现状）
  const targets = projectIds?.length
    ? projects.value.filter((p) => projectIds.includes(p.id))
    : projects.value
  const settled = await Promise.allSettled(targets.map(async (p) => { /* 原抓取逻辑不动 */ }))
  const idSet = new Set(projectIds ?? [])
  // 子集合并：移除目标项目旧条目 + 追加新数据；全量时直接替换
  const merged = idSet.size > 0
    ? [...entries.value.filter((e) => !idSet.has(e.projectId)), ...flat]
    : flat
  // failedCount 增量校正（子集模式）
  const oldContribution = [...idSet].filter((id) => !entries.value.some((e) => e.projectId === id)).length
  failedCount.value = idSet.size > 0 ? failedCount.value - oldContribution + fail : fail
  entries.value = merged
  // 缓存保存统一用 merged + failedCount.value（全量时与现状等价）
}
```

## Agent Extensions

### Skill

- **Feature Evolution**
- Purpose: 本次为既有功能（提交规则检查）的性能迭代，用于变更范围界定与回归确认（不破坏全量分析、行数统计、缓存结构）
- Expected outcome: 变更完整落地且无回归，子集重抓与全量模式行为一致，保存刷新链路正确集成