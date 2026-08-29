---
name: gitPush 提交规则检查 P1 三项扩展
overview: 为 gitPush 提交规则检查功能实现三项 P1 扩展：提交时实时校验（硬阻止）、违规列表批量修复（手动勾选多选）、违规趋势统计（违规率折线 + 提交数柱状双指标）。
todos:
  - id: commit-real-time-validation
    content: 在 WorkingTreePanel 提交表单接入 checkCommitRule 实时校验，违规时禁用提交按钮并显示红色原因提示
    status: completed
  - id: violation-trend-data
    content: 在 commitRuleChecker/types/useCommitAnalysis 新增违规趋势纯函数、类型与 computed 字段
    status: completed
  - id: violation-trend-section
    content: 新增 RuleTrendSection 双指标趋势组件并挂载到 CommitRuleCheck，补 i18n 与 SCSS
    status: completed
    dependencies:
      - violation-trend-data
  - id: batch-commit-fix
    content: 新增 useBatchCommitFix composable 并改造 ViolationListSection 支持勾选批量修复与刷新
    status: completed
---

## 产品概述

为 gitPush 模块的提交规则检查功能（CommitRuleCheck）落地 3 个 P1 级扩展：提交时实时校验（硬阻止）、违规提交批量修复（手动勾选多选）、违规趋势统计（违规率折线 + 提交数柱状双指标）。

## 核心功能

### 1. 提交时实时校验（硬阻止）

在 `WorkingTreePanel` 提交表单中，输入提交信息时实时调用 `checkCommitRule` 校验。命中违规时：文本框下方显示红色违规原因提示，且提交按钮禁用，强制用户修正为符合 Conventional Commits 规则后才可提交。

### 2. 违规批量修复（手动勾选多选）

在 `ViolationListSection` 违规列表每行新增复选框，支持手动勾选 + 全选当前可见项。勾选后执行批量修复：仅对「可确定性修复」的违规（`fixCommitMessageHeuristically` 返回非空的 trim/空 scope/多余空格类）执行 `rewriteCommitMessage` 重写，不可自动修复项（missingType/invalidType/emptySubject/notChinese）跳过并在结果中提示。修复串行执行，完成后刷新分析结果。

### 3. 违规趋势统计（双指标）

新增「违规趋势」区块，展示最近 30 天每日提交数柱状图（复用现有 DailyTrendSection 视觉语言），叠加每日违规率折线（SVG polyline），双指标同图呈现违规率随时间的变化。

## 技术栈

- Vue 3 + TypeScript（组合式 API），沿用 gitPush 现有架构与统一入口
- 规则校验复用 `commitRuleChecker.ts` 纯函数，不引入新依赖
- 数据可视化用原生 SVG polyline（折线）+ CSS 柱状（复用 `withBarPct` 预计算宽度/高度），与现有 DailyTrendSection 模式一致

## 实现方案

### 功能 1：提交时实时校验（硬阻止）

修改 `src/features/gitPush/components/ListView/WorkingTreePanel.vue`：

- 导入 `checkCommitRule`（来自 `../../commitRuleChecker`）与 `COMMIT_RULE_REASON_META`（来自 `../../types`，与现有 `COMMIT_TYPE_VALUES` 导入合并）
- 新增 `const validationReason = computed(() => checkCommitRule(commitMessage.value))`
- 模板 textarea 下方新增红色提示：`v-if="validationReason"` 显示 `i18n[COMMIT_RULE_REASON_META[validationReason].labelKey]`
- 提交按钮 `:disabled` 追加 `|| !!validationReason`
- `handleCommit` 增加防御守卫 `if (validationReason.value) return`
- `styles/WorkingTreePanel.scss` 新增 `.wt-commit-invalid` 红色提示样式（使用 `$color-danger` 与 `$font-size-*` Token）

### 功能 2：违规趋势数据层

- `src/features/gitPush/types/meta.ts`：新增 `RuleViolationTrendDay` 类型（`{ label: string, total: number, violations: number, compliant: number, rate: number }`），`CommitRuleCheckStats` 新增 `dailyTrend: RuleViolationTrendDay[]`
- `src/features/gitPush/commitRuleChecker.ts`：新增纯函数 `buildRuleViolationTrend(entries: CommitAnalysisEntry[], days = 30): RuleViolationTrendDay[]`，参照 `utils.ts` 的 `buildDailyCommitBuckets` 按本地日期聚合每日 total 与 violations，`rate = Math.round(violations / total * 100)`（total=0 时 rate=0）
- `src/features/gitPush/composables/useCommitAnalysis.ts`：`commitRuleStats` computed（489-495 行）填充 `dailyTrend: buildRuleViolationTrend(entries, 30)`

### 功能 3：趋势区块组件

- 新增 `src/features/gitPush/components/CommitRuleCheck/RuleTrendSection.vue`：props 接收 `i18n` 与 `stats`；SVG viewBox 折线绘制违规率（按每日 rate 计算 y 坐标），下方 CSS 柱状展示每日提交数；复用 `withBarPct` 预计算柱高
- 挂载：`CommitRuleCheck/index.vue` 在 `ReasonDistributionSection` 之后、`ViolationListSection` 之前插入 `<RuleTrendSection :i18n="i18n" :stats="stats" />`
- 新增 `styles/RuleTrendSection.scss`（组件专属样式，含 SVG 折线、柱状、图例；使用设计 Token，禁 box-shadow）
- i18n：`src/i18n/{zh_CN,en_US}/gitPush.json` 新增趋势标题/图例键

### 功能 4：批量修复

- 新增 `src/features/gitPush/composables/useBatchCommitFix.ts`：封装选中集合（`Set<string>`，key 为 `${projectId}-${hash}-${reason}`）、`toggle/selectAllVisible/clearSelection/fixSelected`、`fixing` 状态与结果统计 `{ fixed, skipped, failed }`；修复时对每个选中项先 `fixCommitMessageHeuristically` 取修复文案（空串跳过），再 `manager.getProjectById` + `resolveValidPath` 解析路径，串行 `manager.rewriteCommitMessage(path, hash, fixed, true)`（preserveDate=true 保持时间线稳定）
- 修改 `src/features/gitPush/components/CommitRuleCheck/ViolationListSection.vue`：`inject(CARD_SERVICES_KEY)` 获取 manager；引入 `useBatchCommitFix`；每行首部加复选框，区块标题区加「全选」与「批量修复」按钮（含 fixing 态与结果提示）；修复完成后 emit `batchFixed`
- 修改 `src/features/gitPush/components/CommitRuleCheck/index.vue`：监听 `@batch-fixed` → `emit("runAnalysis")`（涉及多项目，全量刷新）
- i18n 新增全选/批量修复/结果统计键；`styles/CommitRuleCheckPanel.scss` 新增复选框、批量操作按钮、结果提示样式

## 文件清单

```
src/features/gitPush/
├── commitRuleChecker.ts                     # [MODIFY] 新增 buildRuleViolationTrend 纯函数
├── composables/
│   ├── useCommitAnalysis.ts                 # [MODIFY] commitRuleStats 填充 dailyTrend
│   └── useBatchCommitFix.ts                 # [NEW] 批量修复 composable（选中集合 + 串行修复 + 统计）
├── types/
│   └── meta.ts                              # [MODIFY] 新增 RuleViolationTrendDay + CommitRuleCheckStats.dailyTrend
├── components/
│   ├── ListView/
│   │   └── WorkingTreePanel.vue             # [MODIFY] 提交时实时校验（硬阻止 + 红色提示）
│   └── CommitRuleCheck/
│       ├── index.vue                        # [MODIFY] 挂载 RuleTrendSection + 监听 batchFixed
│       ├── ViolationListSection.vue         # [MODIFY] 复选框多选 + 批量修复入口
│       └── RuleTrendSection.vue             # [NEW] 违规趋势双指标区块
├── styles/
│   ├── WorkingTreePanel.scss                # [MODIFY] 新增 .wt-commit-invalid 提示样式
│   ├── CommitRuleCheckPanel.scss            # [MODIFY] 新增复选框/批量操作/结果提示样式
│   └── RuleTrendSection.scss                # [NEW] 趋势区块样式（SVG 折线 + 柱状 + 图例）
└── i18n/
    ├── zh_CN/gitPush.json                   # [MODIFY] 新增批量修复/全选/趋势键
    └── en_US/gitPush.json                   # [MODIFY] 同步新增
```

## 验证方式

纯逻辑 + UI 增补，无新依赖、无新增注册步骤（复用已有 feature 注册链）。由用户执行：

```
pnpm lint
pnpm i18n:verify
npx tsc --noEmit
```