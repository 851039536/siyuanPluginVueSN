---
name: gitPush-commit-rule-check-enhance
overview: 对 gitPush 提交规则检查视图进行三项优化：消除与提交分析工具条之间的重复逻辑、增加指定项目单选下拉（仅过滤展示、不改分析范围）、工具条布局与违规列表的 UI 微调。
todos:
  - id: refactor-toolbar-dedup
    content: Use [skill:universal-arch-skill] 审查确认冗余后，抽取 analysisStatusText() 与 CommitCountSelect 公共组件并改造两个工具条复用
    status: completed
  - id: add-project-filter-data
    content: Use [skill:Feature Evolution] 新增 RuleCheckPrefs 类型与 ruleCheckPrefs 存储槽位，useCommitAnalysis 增加项目过滤与偏好持久化
    status: completed
  - id: wire-project-select-ui
    content: 接线项目单选下拉与两行工具条布局，ViolationListSection 单项目模式隐藏项目名，清理死样式
    status: completed
    dependencies:
      - refactor-toolbar-dedup
      - add-project-filter-data
  - id: add-i18n-keys
    content: 中英分片新增 ruleCheckAllProjects/ruleCheckSelectProject 键并保持键对齐
    status: completed
    dependencies:
      - wire-project-select-ui
---

## 产品概述

对 gitPush「提交规则检查」（CommitRuleCheck）面板做一次迭代：审查并消除与「提交分析」工具条之间的重复逻辑，新增「指定项目」单选过滤，并对工具条布局与违规列表做细微 UI 优化。

## 核心功能

- 冗余消除：抽取两个分析工具条共用的状态文案逻辑与条数选择控件，消除复制粘贴
- 项目选择：工具条新增「全部项目 / 单个项目」单选下拉，切换即过滤总览卡片、违规类型分布与违规列表
- 仅过滤展示：分析仍覆盖全部项目，复用全量缓存、切换零延迟，不影响「提交分析」视图
- UI 优化：工具条重构为「控件行 + 状态行」两行布局；单项目模式下违规列表隐藏重复的项目名
- 偏好持久化：项目选择跨会话保留（仿「代码统计报告」的 reportPrefs 模式）

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + SCSS（Codex 设计 Token，禁止硬编码尺寸/色值）。

## 实现方案

### 1. 冗余消除（跨工具条去重）

- `src/features/gitPush/utils.ts` 新增纯函数 `analysisStatusText()`：统一「分析中 / 上次分析 xx / 未分析」三元文案逻辑（`AnalysisToolbar.vue` 与 `RuleCheckToolbar.vue` 各少一个重复表达式）
- 新建公共组件 `src/features/gitPush/components/common/CommitCountSelect.vue` + `src/features/gitPush/styles/CommitCountSelect.scss`：封装条数选择 `<select>`（`COMMIT_COUNT_OPTIONS` + tooltip + change），两个工具条统一 `v-model` 复用；删除 `.grc-count-select` / `.gpa-count-select` 死样式
- `RuleCheckToolbar.vue` 内联三元改为 computed `statusText` / `runLabel`，提升可读性

### 2. 指定项目选择（单选下拉 + 仅过滤展示）

- 仿 `useCodeReport` 的 reportPrefs 模式：
- `types/meta.ts` 新增 `RuleCheckPrefs` 接口（`{ projectId: string }`）
- `types/storage.ts` 新增 `ruleCheckPrefs: TypedStorage<RuleCheckPrefs>` 槽位（key：`git-push-rulecheck-prefs`，默认 `{ projectId: "" }`）
- `composables/useCommitAnalysis.ts` 新增：
- `ruleCheckProjectId` ref（`""` = 全部项目）
- `effectiveRuleCheckProjectId` computed（选中项目已删除时自动回退 `""`，与 `analysisStats` 的失效过滤语义一致）
- `setRuleCheckProject(id)`：切换即持久化偏好，删除项目自动回退
- `commitRuleStats` computed 改为：先按 `effectiveRuleCheckProjectId` 过滤 entries，再调用 `analyzeCommitRuleCompliance`
- **不改** `runCore` / `runAnalysis` / 缓存结构，全量分析与「提交分析」视图零影响

### 3. UI 接线与优化

- 逐层透传：`gitPush/index.vue`（解构 `ruleCheckProjectId` / `setRuleCheckProject`，传入 `projects`）→ `CommitRuleCheck/index.vue`（新增 `projects` / `projectId` props + `updateProject` emit）→ `RuleCheckToolbar.vue`
- 工具条重构为两行：第一行「项目下拉（flex:1 自适应）+ 条数选择 + 分析按钮」，第二行状态文案满宽展示
- `ViolationListSection.vue` 新增 `scoped` prop：单项目模式下隐藏每行重复的项目名 chip（消除视觉噪音）
- 项目下拉复用全局 `@/components/Select.vue`（`size="small"`），change 事件处理仿 CodeReport 的 `onProjectChange`

### 4. i18n

- 中英分片新增 `ruleCheckAllProjects`（全部项目 / All projects）、`ruleCheckSelectProject`（选择项目 / Select project）

## 实施要点

- 纯函数去重进 `utils.ts`；gitPush 模块内部共享，不涉及跨 feature 导入
- 删除旧 `.grc-count-select` / `.gpa-count-select` 样式时，确认 `CommitRuleCheckPanel.scss` / `CommitAnalysisPanel.scss` 中无其他引用
- 新增/修改文件必须带文件头注释（10~30 字）；emit 事件 camelCase；SCSS 分离到独立文件
- 验证由用户执行：`pnpm lint`、`pnpm i18n:verify`、`npx tsc --noEmit`（AI 不运行 lint/build）

## 架构设计

沿用现有「composables 数据源 + 纯编排容器 + 子区块组件」分层，无新增系统级架构。

新增链路数据流：
选择项目 → `setRuleCheckProject(id)` → 持久化偏好 → `commitRuleStats` computed 按 `effectiveRuleCheckProjectId` 过滤 entries → `analyzeCommitRuleCompliance` 聚合 → 总览卡片 / 违规分布 / 违规列表渲染

## 目录结构

```
src/features/gitPush/
├── utils.ts                                  # [MODIFY] 新增 analysisStatusText() 纯函数（状态文案三元统一）
├── types/
│   ├── meta.ts                               # [MODIFY] 新增 RuleCheckPrefs 接口（{ projectId: string }）
│   └── storage.ts                            # [MODIFY] 新增 ruleCheckPrefs TypedStorage 槽位 + 默认值常量
├── composables/
│   └── useCommitAnalysis.ts                  # [MODIFY] 新增 ruleCheckProjectId / effectiveRuleCheckProjectId / setRuleCheckProject / 偏好载入保存；commitRuleStats 按项目过滤
├── components/
│   ├── common/
│   │   └── CommitCountSelect.vue             # [NEW] 公共条数选择组件（COMMIT_COUNT_OPTIONS + tooltip + v-model，两个工具条复用）
│   ├── CommitRuleCheck/
│   │   ├── index.vue                         # [MODIFY] 新增 projects/projectId props + updateProject emit，透传工具栏；计算 scoped 传给违规列表
│   │   ├── RuleCheckToolbar.vue              # [MODIFY] 改用 CommitCountSelect + analysisStatusText；新增项目下拉；两行布局
│   │   └── ViolationListSection.vue          # [MODIFY] 新增 scoped prop，单项目模式隐藏 grc-item-project
│   └── CommitAnalysis/
│       └── AnalysisToolbar.vue               # [MODIFY] 改用 CommitCountSelect + analysisStatusText（消除重复）
├── styles/
│   ├── CommitCountSelect.scss                # [NEW] 公共条数选择样式（原 .grc-count-select 样式迁移，统一 .gp-count-select）
│   ├── CommitRuleCheckPanel.scss             # [MODIFY] 工具条两行布局、.grc-project-select、删除 .grc-count-select
│   └── CommitAnalysisPanel.scss              # [MODIFY] 删除 .gpa-count-select 死样式
src/i18n/
├── zh_CN/gitPush.json                        # [MODIFY] 新增 ruleCheckAllProjects / ruleCheckSelectProject
└── en_US/gitPush.json                        # [MODIFY] 新增 ruleCheckAllProjects / ruleCheckSelectProject
```

## 关键代码结构

`analysisStatusText` 为跨组件共享契约（两个工具条统一调用）：

```ts
/** 分析状态文案："分析中… / 上次分析 xx / 未分析"（notRunKey 区分 analysisNotRun / ruleCheckNotRun） */
export function analysisStatusText(opts: {
  analyzing: boolean
  analyzed: boolean
  analyzedAt: string
  i18n: Record<string, any>
  notRunKey: string
}): string
```

## Agent Extensions

### Skill

- **universal-arch-skill**
- Purpose: 对 CommitRuleCheck 与 CommitAnalysis 工具条执行代码架构审查，确认冗余范围（状态文案三元 + 条数选择控件）与去重方案符合项目规范
- Expected outcome: 输出冗余清单确认，保证去重后的代码符合模块化、统一入口、样式分离等 6 大原则
- **Feature Evolution**
- Purpose: 管理本次「提交规则检查新增项目选择」的功能迭代流程，覆盖变更范围界定与回归确认（不影响提交分析视图与共享缓存）
- Expected outcome: 变更完整落地且无回归，项目选择、偏好持久化与现有数据流正确集成