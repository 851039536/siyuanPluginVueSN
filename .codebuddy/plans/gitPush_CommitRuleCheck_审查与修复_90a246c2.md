---
name: gitPush CommitRuleCheck 审查与修复
overview: 审查并修复 gitPush 提交规则检查功能（CommitRuleCheck）的代码问题：分页状态不重置、事件顺序隐式依赖、冗余分支等，并输出功能扩展建议。
todos:
  - id: write-review-report
    content: 编写五维度审查报告并保存至 docs/gitpush-commit-rule-check-review.md，用 [skill:doc-formatting-ex] 排版，含扩展建议
    status: completed
  - id: fix-pagination-reset
    content: 修复 ViolationListSection 分页状态不重置：解构 reset 并 watch 数据源，对齐 LogPanel 模式
    status: completed
    dependencies:
      - write-review-report
  - id: fix-fixdialog-event
    content: 修复 saved 事件顺序依赖：CommitFixDialog 携带 projectId，index.vue handleFixSaved 改用参数
    status: completed
    dependencies:
      - write-review-report
  - id: fix-rule-checker
    content: 修复 commitRuleChecker 空白 scope 放行与无效日期 NaN 排序，启发式同步 trim scope
    status: completed
    dependencies:
      - write-review-report
---

## 产品概述

对 gitPush 模块的提交规则检查功能（`src/features/gitPush/components/CommitRuleCheck/`）进行代码质量审查，覆盖逻辑漏洞、冗余、内存泄漏、死代码、重复类型五个维度，并给出功能扩展建议。

## 审查范围

- CommitRuleCheck 目录 5 个组件（index.vue / RuleCheckToolbar.vue / RuleCheckOverview.vue / ReasonDistributionSection.vue / ViolationListSection.vue）
- 依赖链路：`commitRuleChecker.ts`、`composables/useCommitAnalysis.ts`、`composables/usePagedList.ts`、`components/common/CommitFixDialog.vue`、`types/meta.ts`

## 核心发现摘要

- **逻辑漏洞 4 处**（已确认可修复）：

1. ViolationListSection 分页状态在数据源变化（重新分析/切换过滤项目）后不重置，残留旧页码——对比 LogPanel 正确写法缺少 `watch + reset`
2. `handleFixSaved` 依赖「saved 事件先于 close 派发」的隐式顺序契约读取 `editingViolation`，顺序调整即退化为全量重分析
3. `checkCommitRule` 中 `feat( ):` 空格 scope 被放行（仅拦截空串）
4. 违规列表排序对无效日期返回 NaN，sort 可能乱序

- **冗余**：`RuleCheckOverview` complianceRate 的 `totalCommits === 0` 分支不可达（外层已拦截，防御性保留无害）；`openFix`/`scoped` 可内联（保留以保可读性）
- **内存泄漏**：无。CommitFixDialog keydown 监听正确配对，面板组件无定时器/全局监听
- **死代码**：无。`fixCommitMessageHeuristically` 被 CommitMsgGenerator 使用，`usePagedList.reset` 被 LogPanel 使用
- **重复类型**：`CommitRuleViolation` 与 `CommitFixTarget` 结构重叠但语义不同（分析结果 vs 修正目标），不构成真正重复

## 交付物

1. 审查报告文档（五维度发现 + 修复摘要 + 扩展建议）
2. 低风险 bug 修复（分页重置 / 事件 payload / 空白 scope / NaN 排序）

## 技术栈

沿用现有 Vue 3 + TypeScript 组合式 API 模式，纯逻辑修复，不引入新依赖。

## 修复方案

### 1. ViolationListSection 分页状态重置（`components/CommitRuleCheck/ViolationListSection.vue`）

- 解构 `usePagedList` 的 `reset`，新增 `watch(pagedSource, () => reset())`，与 `LogPanel/index.vue:129-138` 的既有正确模式保持一致
- 效果：重新分析或切换过滤项目后分页回到首页，避免新结果集停留在旧页码

### 2. 消除 saved 事件顺序依赖（`components/common/CommitFixDialog.vue` + `CommitRuleCheck/index.vue`）

- CommitFixDialog：`defineEmits` 中 `saved` 改为携带 payload `[projectId: string]`，`performSave` 成功时 `emit("saved", props.target.projectId)`
- index.vue：`handleFixSaved(projectId: string)` 直接使用事件参数，删除对 `editingViolation.value` 读取的注释契约
- 兼容性：Vue 事件参数可选，不影响其他潜在调用方

### 3. 空白 scope 与 NaN 排序修复（`commitRuleChecker.ts`）

- `checkCommitRule`：`scope !== undefined && scope.trim() === ""` 判为 `invalidScope`
- `fixCommitMessageHeuristically`：同步 `scope.trim()` 保持与校验一致（避免启发式生成结果再次校验失败）
- `analyzeCommitRuleCompliance`：排序比较改用 `(Date.parse(x) || 0)`，无效日期按 0 兜底排到末尾

### 4. RuleCheckOverview 不可达分支

- 保留防御分支不改代码，在审查报告中说明其不可达原因与保留理由（外层 `v-if stats.totalCommits === 0` 已拦截）

## 文件清单

```
docs/
└── gitpush-commit-rule-check-review.md   # [NEW] 审查报告（五维度发现 + 扩展建议，按 doc-formatting-ex 排版）
src/features/gitPush/
├── commitRuleChecker.ts                  # [MODIFY] 空白 scope 拦截 + NaN 排序兜底 + 启发式 scope.trim
├── components/
│   ├── CommitRuleCheck/
│   │   ├── index.vue                     # [MODIFY] handleFixSaved 改用事件参数
│   │   └── ViolationListSection.vue      # [MODIFY] 解构 reset + watch 数据源重置分页
│   └── common/
│       └── CommitFixDialog.vue           # [MODIFY] saved 事件携带 projectId
```

## 验证方式

修改为纯逻辑变更、无新增 i18n 键，由用户自行验证：

```
pnpm lint
pnpm i18n:verify
npx tsc --noEmit
```

## Agent Extensions

### Skill

- **doc-formatting-ex**
- Purpose: 按项目文档排版规范排版审查报告（结构分层、发现列表表格化、扩展建议分优先级），确保报告可读性与项目既有 docs/ 文档风格一致
- Expected outcome: 生成结构规范、五维度发现清晰对照、扩展建议可执行的 `docs/gitpush-commit-rule-check-review.md`