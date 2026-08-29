# gitPush CommitRuleCheck 代码审查报告

> 审查日期：2026-08-29 | 审查范围：`src/features/gitPush/components/CommitRuleCheck/` 5 组件 + 依赖链路
> 修复日期：2026-08-29 | 已修复 4 处逻辑漏洞

---

## 一、总览

> 审查对象是提交规则检查视图（CommitRuleCheck），它由 5 个组件组合而成，数据来源为 `useCommitAnalysis` 的 `commitRuleStats` computed，规则校验逻辑在 `commitRuleChecker.ts` 纯函数中。整体代码质量良好：模块分层清晰、工具函数复用到位（`withBarPct` / `analysisStatusText` / `usePagedList` / `relativeTime` 均走统一入口）、无内存泄漏、无死代码。主要问题集中在**分页状态管理**与**事件契约**两处中等风险逻辑漏洞。

| 维度 | 结论 | 数量 |
|------|------|------|
| 逻辑漏洞 | 🔴 有，2 处中等 + 2 处低等 | 4 |
| 冗余 | 🟢 轻微，防御分支 + 可内联单行函数 | 2 |
| 内存泄漏 | 🟢 无 | 0 |
| 死代码 | 🟢 无 | 0 |
| 重复类型 | 🟢 可接受（语义不同） | 0 |

---

## 二、审查范围

| 层级 | 文件 | 角色 |
|------|------|------|
| 容器 | `components/CommitRuleCheck/index.vue` | 状态编排 + 区块组合 + 修正弹窗 |
| 区块 | `RuleCheckToolbar.vue` | 项目过滤 + 分析状态 + 条数选择 |
| 区块 | `RuleCheckOverview.vue` | 总览卡片 + 规则提示 |
| 区块 | `ReasonDistributionSection.vue` | 违规类型分布条形图 |
| 区块 | `ViolationListSection.vue` | 违规列表 + 本地分页 |
| 依赖 | `components/common/CommitFixDialog.vue` | 修正弹窗（自包含校验 + amend） |
| 依赖 | `commitRuleChecker.ts` | 规则校验 + 聚合纯函数 |
| 依赖 | `composables/useCommitAnalysis.ts` | `commitRuleStats` / `runAnalysis` |
| 依赖 | `composables/usePagedList.ts` | 本地分页 composable |
| 依赖 | `types/meta.ts` | `CommitRuleReasonKey` / `CommitRuleViolation` 等类型 |

---

## 三、逻辑漏洞

### 3.1 [🟡 中] ViolationListSection 分页状态不重置

- **文件**：`ViolationListSection.vue:82-87`
- **类型**：状态残留

```typescript
// ViolationListSection.vue:82-87 — 只解构了 visibleCount/paged/hasMore/loadMore，漏了 reset
const {
  visibleCount: pagedVisibleCount,
  paged: pagedViolations,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
} = usePagedList(pagedSource, 50)
```

对比同模块 `LogPanel` 的正确写法：

```typescript
// LogPanel/index.vue:129-138 — 解构 reset + watch 数据源重置
const {
  visibleCount: pagedVisibleCount,
  paged: pagedLogs,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
  reset: pagedReset,
} = usePagedList(filteredLogs, 50)

watch([activeFilter, failOnly, searchQuery], () => pagedReset())
```

**影响**：`pagedSource` 是 `computed(() => props.stats.violations)`，会随「重新分析」「切换过滤项目」变化。`visibleCount` 残留上次的值，新结果集停留在旧页码。典型场景：

1. 全量分析有 300 条违规，用户滚到底（`visibleCount` 累加到 300）
2. 切换到某单个项目过滤，该项目仅 20 条违规
3. 列表一次性渲染 20 条（无功能错误，但分页语义失真）

> 反向场景（少 → 多）下 `hasMore` 仍能正确显示"加载更多"按钮，所以功能不会崩，但状态未重置属于交互语义缺陷。

**修复**：解构 `reset` 并 `watch(pagedSource, () => reset())`，与 LogPanel 模式对齐。

---

### 3.2 [🟡 中] `handleFixSaved` 依赖事件派发顺序的隐式契约

- **文件**：`CommitRuleCheck/index.vue:141-146` + `CommitFixDialog.vue:293-295`
- **类型**：隐式契约，脆弱

```typescript
// CommitFixDialog.vue:293-295 — saved 先派发，close 后派发
await manager.rewriteCommitMessage(...)
emit("saved")
emit("close")
```

```typescript
// CommitRuleCheck/index.vue:141-146 — 依赖"此时 editingViolation 仍非空"读取 projectId
function handleFixSaved() {
  // 先捕获 projectId 再清空（saved 事件派发早于 close，此处仍可读到目标）
  const projectId = editingViolation.value?.projectId
  editingViolation.value = null
  emit("runAnalysis", projectId)
}
```

**影响**：代码正确依赖了「Vue 事件同步派发、监听器按注册顺序执行」这一行为，但这是一个**注释约定的隐式契约**。一旦有人调整 `performSave` 中的事件顺序，`editingViolation.value` 已被 `close` 置空，`projectId` 变 `undefined`，`runAnalysis(undefined)` 退化为**全量重分析**——数据量大时代价高。

**修复**：`saved` 事件直接携带 `projectId` payload，消除对组件内部状态的读取依赖。

---

### 3.3 [🟢 低] 空白 scope 被放行

- **文件**：`commitRuleChecker.ts:27`
- **类型**：校验不严

```typescript
if (scope !== undefined && scope === "") return "invalidScope"
```

仅拦截空串 `feat():`，但 `feat( ):`（scope 为空格）会放行。conventional commits 规范中 scope 不应为空白。

**修复**：`scope.trim() === ""` 判定；`fixCommitMessageHeuristically` 同步 trim，避免启发式修复后再次校验失败。

---

### 3.4 [🟢 低] 违规列表排序遇无效日期产生 NaN

- **文件**：`commitRuleChecker.ts:49`
- **类型**：防御性缺失

```typescript
violations.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
```

数据源为 `git %aI`（UTC ISO），正常有效。但一旦某条日期异常（损坏的缓存、异常格式），`Date.parse` 返回 `NaN`，sort 比较器返回 `NaN` 会被引擎视为 0，破坏排序稳定性。

**修复**：`(Date.parse(x.date) || 0)` 兜底，无效日期按 0 排到末尾。

---

## 四、冗余

| # | 位置 | 说明 | 处置 |
|---|------|------|------|
| 1 | `RuleCheckOverview.vue:44` | `complianceRate` 的 `totalCommits === 0` 分支**不可达**——`index.vue:46` 外层 `v-if stats.totalCommits === 0` 已显示 EmptyState，Overview 永不渲染 0 提交场景 | 保留（防御分支无害，且独立组件被复用时有意义） |
| 2 | `index.vue:136-138` / `index.vue:131` | `openFix` 单行函数与 `scoped` computed 可内联 | 保留（可读性优先，符合项目风格） |

---

## 五、内存泄漏

**无。** 逐组件核查结论：

| 检查点 | 结论 |
|--------|------|
| `CommitFixDialog` keydown 监听 | ✅ `onMounted` 添加 / `onUnmounted` 移除，正确配对 |
| `CommitFixDialog` 异步 `init()` | 组件卸载后 ref 赋值无泄漏（Vue 不持引用），仅理论上的竞态警告，无实际危害 |
| 面板 5 组件 | 无定时器、无全局监听器、无 `addEventListener`，纯展示组件 |
| `usePagedList` | 纯 computed + ref，无副作用 |

---

## 六、死代码

**无。** 验证反例：

| 疑似死代码 | 实际使用方 |
|-----------|-----------|
| `fixCommitMessageHeuristically` | `managers/CommitMsgGenerator.ts:98`（AI 生成失败降级路径） |
| `usePagedList` 返回的 `reset` | `LogPanel/index.vue:134` |
| `COMMIT_RULE_REASON_META` | 4 个组件 + `CommitFixDialog` 共 5 处消费 |

---

## 七、重复类型

**可接受，不构成真正重复。** 说明：

| 类型 | 定义 | 语义 |
|------|------|------|
| `CommitRuleViolation` | `extends CommitAnalysisEntry` + `reason: CommitRuleReasonKey` | 分析结果（含 author/date） |
| `CommitFixTarget` | `Pick<CommitAnalysisEntry, "projectId"|"projectName"|"hash"|"message">` + `reason?` | 修正目标（提交日志场景复用） |

两者结构重叠但语义边界清晰，且 `CommitFixDialog` 在提交日志场景独立复用 `CommitFixTarget`。若强行合并会引入可空字段噪音，**不建议改动**。

---

## 八、修复摘要

| # | 文件 | 修复内容 |
|---|------|----------|
| 1 | `ViolationListSection.vue` | 解构 `reset` + `watch(pagedSource, () => reset())` |
| 2 | `CommitFixDialog.vue` | `saved` 事件携带 `projectId` payload |
| 3 | `CommitRuleCheck/index.vue` | `handleFixSaved(projectId)` 改用事件参数 |
| 4 | `commitRuleChecker.ts` | 空白 scope 拦截 + 启发式 trim + NaN 排序兜底 |

**划重点：** 以上均为纯逻辑变更，无新增 i18n 键、无新增依赖、不触碰 Vue 模板结构。

---

## 九、功能扩展建议

按投入产出比分级：

### P0 低成本高收益

| # | 建议 | 说明 |
|---|------|------|
| 1 | **一键启发式修复** | `fixCommitMessageHeuristically` 已实现（trim/空 scope/多余空格可确定性修复），目前只在 AI 生成链路走。在违规列表每行加"一键修复"按钮，直接填充弹窗输入框，减少对 AI 的依赖（AI 不可用时仍能修常见格式问题） |
| 2 | **规则可配置化** | 将「必须中文」（`notChinese`）与 type 白名单（`ALLOWED_TYPES`）改为设置项持久化。英文项目团队可关掉中文强制；扩展自定义 type（如 `perf`/`build`）无需改代码 |
| 3 | **违规列表作者过滤** | 复用 `analysisStats.authorRanking` 的维度，按作者筛选违规，便于定位到个人 |

### P1 中成本

| # | 建议 | 说明 |
|---|------|------|
| 4 | **批量修复** | 同类型违规（如全为 `whitespace`）多选后批量执行启发式修复 + amend，复用 `RewriteCommitMessage` 的逐个流程 |
| 5 | **提交时实时校验** | 在 CommitDialog 输入提交信息时实时调用 `checkCommitRule`，输入即提示违规，从源头拦截 |
| 6 | **违规趋势统计** | 按 `date` 聚合违规率走势，与 `buildDailyCommitBuckets` 模式复用，展示规则执行效果随时间变化 |

### P2 可选

| # | 建议 | 说明 |
|---|------|------|
| 7 | **导出报告** | 违规列表导出 CSV/Markdown，复用 `triggerBlobDownload` 统一入口 |
| 8 | **规则版本化** | 规则配置变更后对历史提交重新评估，展示「按当前规则」与「按当时规则」的合规率对比 |

---

## 十、总结

本次审查在 gitPush 模块当前质量基线（高）之上，定位到 4 处低风险逻辑漏洞，无内存泄漏、无死代码、无重复类型。

从工程角度看，真正值得关注的不是"修什么"，而是两个**模式**：

1. **分页状态生命周期**——`usePagedList` 提供了 `reset` 但 3 个使用方中只有 1 个调用。同类 composable 的「状态重置」应由使用方负责，建议后续在 `usePagedList` 内部增加「数据源变化自动重置」选项，从根上消除这类遗漏。
2. **组件间事件契约**——用「事件派发顺序」传递隐式状态是 Vue 最常见的隐性耦合来源。显式携带 payload 一次，省掉下游所有心智负担。
