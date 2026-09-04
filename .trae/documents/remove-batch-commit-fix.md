# 移除提交规则检查的批量修复功能

## Summary

审查结论：批量修复（勾选多行一键重写）与单条修正弹窗功能重复，且会连环触发多次历史重写（耗时、风险面大）。用户确认**全量移除**——含每行的「可自动修复」标记。移除后违规列表仅保留单条修正入口 + 分页。

## Current State Analysis（引用已逐一核实）

**批量修复生态 = 6 处**：

| 位置 | 内容 |
|------|------|
| `composables/useBatchCommitFix.ts`（整文件 152 行） | `useBatchCommitFix` composable + 工具函数 `violationKey` / `isAutoFixable` + 类型 `BatchFixResult` |
| `components/CommitRuleCheck/ViolationListSection.vue` | 模板：全选按钮(L9-17)、批量修复按钮(L18-31)、结果提示块(L35-48)、每行 checkbox(L56-63)、可自动修复图标(L72-79)；脚本：composable 接线 + `runBatchFix` + `skippedReasonText` + watch 清理 + `batchFixed` emit + manager inject |
| `components/CommitRuleCheck/index.vue` | `@batch-fixed="emit('runAnalysis', $event)"`(L79) |
| `i18n/zh_CN/gitPush.json` + `en_US/gitPush.json` | 7 个键：`ruleCheckSelectAll` / `ruleCheckBatchFix` / `ruleCheckBatchFixTip` / `ruleCheckBatchResult` / `ruleCheckBlockedProjects` / `ruleCheckSelectHint` / `ruleCheckAutoFixable`（均在 L680-686） |
| `styles/CommitRuleCheckPanel.scss` | `.grc-item-check`(L257) / `.grc-batch-result`(L264) / `.grc-batch-result--hint`(L271) |

**必须保留的引用**（移除时勿误删）：
- `commitRuleChecker.ts` 的 `fixCommitMessageHeuristically`：被 **CommitMsgGenerator.ts:98**（AI 生成修正的启发式兜底）使用，保留
- `violationKey` 的用途：ViolationListSection 行 key（`v-for :key="row.key"` + `pagedRows.key`），删除 composable 后需**内联为本地函数**（`\`${v.projectId}-${v.hash}-${v.reason}\``）
- 「修正按钮」`grc-item-fix` / `grc-section-title` / 分页 `LoadMoreButton`：保留（单条修正与分页与此无关）

## Proposed Changes

### 1. 删除 `src/features/gitPush/composables/useBatchCommitFix.ts`（整个文件）

### 2. 精简 `components/CommitRuleCheck/ViolationListSection.vue`

**模板**：
- 删区块标题内 `.grc-section-actions` span（全选 + 批量修复两个按钮，删后无其他成员）
- 删批量结果提示块（batchNotice / lastResult / blockedProjects 三个 div）+ 相关注释
- 每行 head 内：删 checkbox(L56-63)、删可自动修复图标(L72-79)
- 保留：项目名/哈希/原因/修正按钮/日期与消息展示、分页

**脚本**：
- 删 import：`isAutoFixable, useBatchCommitFix, violationKey`（自 useBatchCommitFix）
- 删 manager 注入（`CARD_SERVICES_KEY`/`inject`——仅批量用）及相关 import
- `ViolationRow` 去掉 `autoFixable` 字段；行 key 内联为组件本地函数 `rowKey(v) => \`${v.projectId}-${v.hash}-${v.reason}\``（替代 violationKey，语义注释保留）
- 删 `useBatchCommitFix` 解构、`batchNotice`、`skippedReasonText`、`runBatchFix`
- `watch(pagedSource)` 简化：仅 `pagedReset()`
- emit 定义删除 `batchFixed`
- 更新文件头注释：去掉「批量修复」字样

### 3. `index.vue`：删除 `@batch-fixed="emit('runAnalysis', $event)"`（L79）

### 4. i18n 中英各删 7 键（L680-686）：`ruleCheckSelectAll`、`ruleCheckBatchFix`、`ruleCheckBatchFixTip`、`ruleCheckBatchResult`、`ruleCheckBlockedProjects`、`ruleCheckSelectHint`、`ruleCheckAutoFixable`

### 5. `styles/CommitRuleCheckPanel.scss`：删 `.grc-item-check`、`.grc-batch-result`、`.grc-batch-result--hint` 三段；同时核对 `.grc-section-actions` 无其他引用则删（执行时确认）

## Assumptions & Decisions

- 「全量移除含标记」：`isAutoFixable`/`autoFixable`/`mdi:auto-fix` 图标/`ruleCheckAutoFixable` 一并删除（无其他消费方）
- `fixCommitMessageHeuristically` 保留（CommitMsgGenerator 引用），不随批量移除
- 行 key 内联为本地 `rowKey` 函数，维持 v-for 渲染稳定性（与现 violationKey 同值）
- 移除后 ViolationListSection 不再需要 manager 注入（无其他领域调用）

## Verification

1. `npx vue-tsc --noEmit`：改动文件无新增类型错误（`fixCommitMessageHeuristically` 仍有 CommitMsgGenerator 引用，不应报未使用）
2. `pnpm i18n:verify`：中英键仍对齐（两侧同步删 7 键）
3. `pnpm lint`：用户自行执行
4. 手动验证：提交规则检查面板 → 违规列表无勾选框、无全选/批量修复按钮、无「可自动修复」图标与结果提示；单击行内铅笔图标仍正常打开修正弹窗；分页/加载更多正常