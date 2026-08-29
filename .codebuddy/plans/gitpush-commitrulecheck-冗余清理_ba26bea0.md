---
name: gitpush-commitrulecheck-冗余清理
overview: 仅清理 gitPush/CommitRuleCheck 目录内的冗余（死代码、冗余 prop、重复 import、模板内重复计算、刷新策略不一致），并做 3 处必要配套改动（useBatchCommitFix 返回受影响项目、runAnalysis 支持多项目、父面板去掉冗余传参）。跨面板 SCSS 与 CommitAnalysis 本轮不动。
todos:
  - id: batch-fix-result
    content: 扩展 useBatchCommitFix：BatchFixResult 加 projectIds 并移除 selectedMap 导出
    status: completed
  - id: run-analysis-signature
    content: 放宽 useCommitAnalysis.runAnalysis 签名为 string 或 string[] 并归一化入参
    status: completed
  - id: clean-dead-code
    content: 清理死代码与冗余 prop：RuleCheckOverview 不可达分支、index.vue 的 projectCount、父面板传参
    status: completed
  - id: merge-imports
    content: 合并 ReasonDistributionSection 与 ViolationListSection 的重复 types 导入
    status: completed
  - id: violation-rows
    content: 重构 ViolationListSection：行视图预计算、条数统一、batchFixed 携带 projectIds
    status: completed
    dependencies:
      - batch-fix-result
      - run-analysis-signature
  - id: wire-index-forward
    content: 更新 CommitRuleCheck/index.vue：事件转发载荷与空项目判据
    status: completed
    dependencies:
      - violation-rows
      - clean-dead-code
  - id: user-verify
    content: 由用户执行 lint、tsc、i18n:verify、validate:icons 四项验证
    status: completed
    dependencies:
      - wire-index-forward
      - merge-imports
---

## 产品概述

对 gitPush 功能的「提交规则检查」视图（CommitRuleCheck 目录，5 个组件）做一轮冗余清理，消除死代码、冗余数据通道与重复计算，并统一修正后的刷新策略。本轮为纯逻辑层清理，界面结构、文案、视觉呈现保持完全不变。

## 核心清理项

- 删除不可达分支：合规率计算中「0 提交返回 100%」的分支永远不会命中。
- 删除冗余 prop：面板同时接收「项目列表」与「项目数量」，后者与前者长度恒等。
- 合并重复导入：两个组件对同一模块写了两条 import 语句。
- 消除模板内重复计算：列表每行的唯一 key 每次渲染算两遍，「可自动修复」判定对 50 行逐行反复执行正则校验。
- 统一刷新策略：单条修正走「只重抓该项目」，而批量修正走「全部项目重跑」；改为批量修正也只重抓实际受影响的项目。
- 移除无消费方的导出项。

## 明确不做（用户已确认）

- 不动两份面板样式文件，不抽取跨面板共享样式。
- 不动提交分析（CommitAnalysis）任何组件。
- 不新建通用条形列表组件。
- 不改规则检查统计的数据结构字段。
- 不新增、不删除任何中英文文案键。

## 技术栈

沿用项目现有技术栈，无新增依赖：Vue 3 `<script setup lang="ts">` + Composition API + TypeScript + SCSS。改动全部落在 `src/features/gitPush/` 模块内。

## 实现思路

按「底层契约 → 上层消费」的顺序推进，避免中间态类型断裂：先扩展批量修复 composable 的结果结构与分析门面签名，再让两个视图组件消费新契约，最后做纯局部的死代码与导入清理。

关键决策与取舍：

1. **批量修复结果携带受影响项目**：`BatchFixResult` 增加 `projectIds`，在串行修复成功分支用 `Set` 收集去重。这样调用方无需遍历违规列表二次推断，也不必回退到全量重跑。
2. **分析门面签名放宽为 `string | string[]`**：底层 `runCore` 早已接受 `projectIds?: string[]`，仅门面 `runAnalysis` 只收单个 id。放宽签名是最小改动面（1 个函数 + 1 处归一化），不必新增一个并行 API。归一化时必须把空数组转成 `undefined`——`runCore` 用 `projectIds?.length && !needNumstat` 判断局部刷新，传空数组会误落到全量分支。
3. **行视图预计算而非 `v-memo`**：把 `key` 与 `autoFixable` 合并进一个 `computed` 行视图。相比 `v-memo`，预计算把每条违规的正则判定从「每次渲染 ×2」降为「数据源变化 ×1」，且不引入额外的缓存失效心智负担。
4. **`violationCount` 与 `violations.length` 统一取后者**：两者由 `analyzeCommitRuleCompliance` 保证恒等，但徽章走 `stats.violationCount`、分页总数走 `pagedSource.length` 形成双真相源，统一为分页数据源长度，消除未来可能的漂移。
5. **保留 `isSelected(row)` 传原始违规对象**：行视图对象是增强结构（多出 `key`/`autoFixable`），传给 `isSelected` 时走结构兼容，但 `selectAllVisible` 仍要求 `CommitRuleViolation[]`，故全选继续传 `pagedViolations.value`，不传增强行，保持 composable 入参类型干净。
6. **不抽象 BarListSection / 不抽取 mixin**：按项目 Rule of Three 与用户本轮「改动最小」的约束，跨面板重复记录在案、留待后续专项处理。

## 执行要点（防回归）

- 模板改动必须保留中文区块注释与 i18n 渲染处的中文行注释；新增/调整的行若含 i18n 表达式需补注释。
- `emit` 事件名全部 camelCase（`batchFixed` / `runAnalysis` / `viewProject` / `openFix`），载荷从空元组改为 `string[]` 时，父组件的 `$event` 转发需同步。
- 文件头注释（10~30 字功能说明）在改动后须与实际职责一致，`ViolationListSection.vue` 头部描述若不再准确要同步更新。
- 分支语句一律带花括号。
- 单文件行数：改动后 `ViolationListSection.vue` 仍应控制在 200 行内（当前 197 行），新增 computed 若导致逼近 300 行警戒线，应把行视图构建逻辑下沉为 `utils.ts` 纯函数。
- 不触碰 SCSS：本轮任何组件都不改 `<style>` 区块。
- 无新增 i18n 键，理论上无需跑 `i18n:verify`，但改动涉及模板表达式，仍建议完整跑一遍四条验证。

## 架构与数据流

改动后的批量修复刷新链路：

```mermaid
flowchart TD
    A[ViolationListSection 批量修复] --> B[useBatchCommitFix.fixSelected]
    B --> C[串行 rewriteCommitMessage]
    C --> D[收集成功项 projectIds 去重]
    D --> E[emit batchFixed projectIds]
    E --> F[CommitRuleCheck index.vue 转发 runAnalysis]
    F --> G[useCommitAnalysis.runAnalysis string 或 string[]]
    G --> H[runCore 局部刷新指定项目]
    I[单条修正 CommitFixDialog saved] --> F
```

- `useBatchCommitFix`：负责选中态、串行修复、结果统计、受影响项目收集（纯逻辑，无视图状态）。
- `useCommitAnalysis`：负责分析执行与缓存，门面归一化入参后下沉 `runCore`。
- `CommitRuleCheck/index.vue`：纯编排，只做事件转发与弹窗开关，不持有领域状态。
- `ViolationListSection`：视图层，持有分页与行视图预计算，通过注入获取 manager。

## 目录结构

本轮共修改 6 个文件，无新增文件。

```
src/features/gitPush/
├── composables/
│   ├── useBatchCommitFix.ts                    # [MODIFY] 批量修复结果结构扩展：BatchFixResult 新增 projectIds 字段（成功修复的项目 id 去重列表）；fixSelected 内串行修复成功分支用 Set 收集项目 id；从返回对象中移除无消费方的 selectedMap 导出。保持 violationKey / isAutoFixable 两个纯函数导出不变。
│   └── useCommitAnalysis.ts                    # [MODIFY] runAnalysis 门面签名放宽为 projectId?: string | string[]；内部归一化为数组后传给 runCore（空数组必须转成 undefined 以命中全量分支）；局部刷新被拒时的 pendingReanalyze 与 warn 分支判据同步改为「是否为局部请求」。其余调用点（CommitAnalysis / LineStats）行为不变。
├── index.vue                                   # [MODIFY] 删除 CommitRuleCheckPanel 上的 :project-count="projects.length" 传参（与已传的 :projects 重复）。
└── components/CommitRuleCheck/
    ├── index.vue                               # [MODIFY] 删除 projectCount prop，空项目判断改用 projects.length === 0；runAnalysis emit 载荷类型放宽为 string | string[]；@batch-fixed 改为转发 $event 载荷；handleFixSaved 保持单项目 id 转发。文件头注释同步。
    ├── RuleCheckOverview.vue                   # [MODIFY] 删除 complianceRate 中不可达的 totalCommits === 0 分支，仅保留合规率计算。
    ├── ReasonDistributionSection.vue           # [MODIFY] 合并两条来自 ../../types 的 import 为一条（类型导入与值导入合并书写）。
    └── ViolationListSection.vue                # [MODIFY] 合并两条来自 ../../types 的 import；新增行视图 computed 预计算 key 与 autoFixable；模板 :key / @change 改用 row.key，v-if 改用 row.autoFixable；条数徽章与分页总数统一取 pagedSource.length；batchFixed 事件载荷改为 projectIds: string[]；runBatchFix 在 fixed > 0 时携带 result.projectIds 触发。文件头注释同步。
```

## 关键代码结构

```ts
// composables/useBatchCommitFix.ts
export interface BatchFixResult {
  fixed: number
  skipped: number
  failed: number
  /** 被跳过的违规原因（去重，供结果提示解释为什么无法自动修复） */
  skippedReasons: CommitRuleReasonKey[]
  /** 成功修复涉及的项目 id（去重，供调用方按项目局部刷新，避免全量重跑） */
  projectIds: string[]
}
```

```ts
// composables/useCommitAnalysis.ts
/** projectId 传单项目 id 或 id 数组 = 局部重抓指定项目；不传 = 全量重跑 */
async function runAnalysis(projectId?: string | string[]): Promise<void>
```

```ts
// components/CommitRuleCheck/ViolationListSection.vue
/** 违规行视图：预计算唯一 key 与可自动修复标记，避免模板内重复执行正则判定 */
interface ViolationRow extends CommitRuleViolation {
  key: string
  autoFixable: boolean
}
```

```ts
// components/CommitRuleCheck/ViolationListSection.vue
const emit = defineEmits<{
  viewProject: [projectId: string]
  openFix: [violation: CommitRuleViolation]
  /** 批量修复完成且存在成功项，父级按这些项目局部刷新分析 */
  batchFixed: [projectIds: string[]]
}>()
```