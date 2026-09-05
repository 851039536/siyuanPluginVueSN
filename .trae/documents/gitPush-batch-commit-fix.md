# gitPush 提交规则检查：违规提交批量修正（Batch Fix）

## 一、结论确认（回答用户提问）

**单个修正与批量修正的流程本质相同**，可确认：

| 步骤 | 单条 | 批量 |
|------|------|------|
| 前置状态 | 加载 HEAD hash / 工作区状态 / rebase 状态 / merge 检测 | 每条各自的（按项目分组加载，每条一次 git 调用） |
| AI/启发式生成 | `manager.generateCommitFix(path, hash, message)` 一次 | 同 API 循环 N 次，进度 "生成中 (i/N)" |
| 保存重写 | `manager.rewriteCommitMessage(path, hash, msg, preserveDate, onProgress)`（HEAD→amend，历史→commit-tree 重建） | 同 API 循环 N 次，进度 "保存中 (i/N)" |
| 提交时间策略 | commitFixPrefs 单条选择 | 全批共享同一个选择（同样持久化） |

批量复用现有 manager API 即可（`runAnalysis` 已支持 `string | string[]`，批量刷新多项目零改动），**无需改动任何 Manager/WorktreeOps 代码**。效率提升点：一次弹窗完成 N 条、AI 生成循环填充、统一进度。

**唯一的流程差异 / 正确性风险点**：同一项目内多条违规存在祖先-后代关系时，必须按「新→旧」顺序处理（违规列表本身按日期降序）。若祖先先被重写，后代的旧 hash 会变成孤儿对象，此时 `rev-parse` 仍能解析到该对象，导致后代修正**静默失效**（重建时因父链断裂而 identity 跳过，分支引用不变）。按日期降序处理则无此问题：后代先重写后，祖先的重写会重新哈希后代链并保留其已修正的信息。批量弹窗内做一次防御性日期降序排序即可。

## 二、现状分析

- [CommitFixDialog.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/common/CommitFixDialog.vue)（341 行，已超 300 警戒线）：单条修正弹窗，自包含（注入 `CARD_SERVICES_KEY` → manager，onMounted 加载偏好 + HEAD/工作区/rebase 状态，AI 生成，保存 + 进度回调）。**行数已高，批量逻辑不应再塞入该组件** → 新建 `BatchFixDialog.vue`。
- [ViolationListSection.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/CommitRuleCheck/ViolationListSection.vue)：违规列表（本地分页 `usePagedList`），每行「修正」按钮 `emit('openFix', row)`；行 key 为 `${projectId}-${hash}-${reason}`。**无选择 / 批量入口**。
- [CommitRuleCheck/index.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/CommitRuleCheck/index.vue)：`editingViolation` ref + `openFix` + `handleFixSaved`（关闭弹窗 + `emit('runAnalysis', projectId)`）。
- Manager API 已齐备：[GitPushManager.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/GitPushManager.ts) 的 `generateCommitFix`（L526）、`rewriteCommitMessage`（L406，writeLock 项目级串行）、`getHeadHash`（L399）、`getWorkingTreeStatus`（L337）、`isInRebaseState`（L404）；[useCommitAnalysis.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/composables/useCommitAnalysis.ts) `runAnalysis(projectId?: string | string[])`（L329）。
- i18n：`src/i18n/{zh_CN,en_US}/gitPush.json` 已有完整 `ruleFix*` / `ruleCheckReason*` 系列键可复用。
- 注意：`CommitFixDialog` 还被 [ProjectCard.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/ListView/ProjectCard.vue#L122-L128)（LOG Tab）使用，批量入口**仅限规则检查视图**，单条流程保持不变。

## 三、方案设计

### 3.1 选择入口（ViolationListSection.vue + CommitRuleCheckPanel.scss）

- 每行左侧加原生 checkbox（`:checked="selectedKeys.has(row.key)"`，`@change` 增删 `selectedKeys: Set<string>`）。
- 区块标题（`grc-section-title`，改为 flex + space-between）右侧新增：全选 checkbox + 「批量修正(N)」按钮（`vp-btn vp-btn--ghost vp-btn--sm`，N=0 禁用，图标 `mdi:auto-fix`）。
- 数据源变化（重新分析/切换项目过滤）时清空选择：复用现有 `watch(pagedSource)`（L105）。
- 新增 emit `openBatchFix: [violations: CommitRuleViolation[]]`；批量按钮触发时按 `stats.violations` 顺序（日期降序）过滤出选中项传出。
- checkbox 样式参照现有 `.checkbox-label` 模式（accent-color），追加到 `CommitRuleCheckPanel.scss`；选中计数用 `$vp-mono` + tabular-nums（对齐现有 `grc-section-count`）。

### 3.2 批量弹窗（新建 components/common/BatchFixDialog.vue + styles/BatchFixDialog.scss）

遵循「子组件自包含」强制规则：父只传 `targets` 数组 + `i18n`；弹窗内部注入 `CARD_SERVICES_KEY` 用 manager 完成全部加载/生成/保存，仅 emit `close` / `saved(projectIds: string[])`。

**Props**：`i18n`、`targets: CommitRuleViolation[]`（最小标识符：projectId/projectName/hash/message/reason/date）。

**初始化**（onMounted，loading 态复用 Loader）：
1. 加载 `manager.storage.commitFixPrefs.loadOrDefault()` → 全批共享 `preserveDate`（切换 radio 即 `save` 持久化，同单条）。
2. 按项目分组，每组一次 `Promise.all` 取 `headHash` / `workingTreeStatus` / `isInRebaseState`；每条一次 `rev-parse --verify ${hash}^2`（`.catch(() => "")`）检测 merge。
3. 防御性按 `date` 降序排序 items（保证同项目祖先-后代违规「新→旧」处理正确）。
4. 每条计算 blocked 状态，复用单条文案：merge→`ruleFixMergeBlocked`、rebase 残留→`ruleFixRebaseStuck`、无 HEAD→`ruleFixNoHead`、工作区脏→`ruleFixDirtyWorkingTree`。

**每条 UI**（卡片式行）：meta（项目名 + hash mono + reason 徽章，复用 `gp-fix-reason` 样式）+ 原提交信息（`gp-fix-original` 样式，小字）+ 新提交信息 textarea（`gp-fix-input`，初始=原信息）+ `checkCommitRule` 不合规提示（`gp-fix-invalid`）+ 历史提交 force-push 提示（仅非 HEAD，复用 `ruleFixForcePushHint`）+ blocked 提示（复用 `gp-fix-warning`）。状态标记：pending / saved / error（error 显示 `getErrorMessage`）。

**AI 批量生成**：仅对可保存（未 blocked）项顺序循环 `manager.generateCommitFix(path, hash, originalMessage)` 填入该项 `newMessage`；进度「生成中 (i/N)」；单条失败沿用现有降级语义（generateCommitFix 内部 AI 失败自动降级启发式，无需额外处理）。

**批量保存**：对 pending/error（未 saved、未 blocked）项顺序循环 `manager.rewriteCommitMessage(path, hash, newMessage.trim(), preserveDate, onProgress)`；进度「保存中 (i/N)」+ 当前项重写进度条（复用 `gp-fix-progress` / `gp-fix-progress-bar` 样式，进度条 flex-basis 100% + flex-wrap 对齐现有布局）。每条独立 try/catch：成功→`saved` 状态；失败→记录错误文案到该项。

**保存完成**：成功项的项目 id 去重后 `emit('saved', projectIds)`（父刷新这些项目）；弹窗**保持打开**显示每项成功/失败状态 + 汇总条（`ruleFixBatchSummary`：成功 X / 失败 Y / 跳过 Z）。用户点「完成」按钮 → `emit('close')`。失败项留在弹窗内可编辑，再次点「批量保存」只处理未成功项（幂等），失败错误可见，无需单独「重试失败项」按钮。

**页脚**：AI 批量生成按钮 + 批量保存按钮 + 完成按钮（保存完成后出现），均复用 `vp-btn` 变体与 loading spin 图标。

### 3.3 入口容器接线（CommitRuleCheck/index.vue）

- 新增 `editingBatch = ref<CommitRuleViolation[] | null>(null)`。
- ViolationListSection 新增 `@open-batch-fix="(v) => editingBatch = v"`。
- 渲染 `<BatchFixDialog v-if="editingBatch" :i18n="i18n" :targets="editingBatch" @close="editingBatch = null" @saved="handleBatchSaved" />`。
- `handleBatchSaved(projectIds: string[])` → `emit('runAnalysis', projectIds)`（数组，`runAnalysis` 已支持）；**不关闭弹窗**（批量弹窗由「完成」按钮自管关闭，区别于单条的 saved 即关闭）。

### 3.4 i18n（zh_CN / en_US gitPush.json 同步新增）

| key | zh_CN | en_US |
|-----|-------|-------|
| ruleCheckSelectAll | 全选 | Select All |
| ruleCheckBatchFix | 批量修正 | Batch Fix |
| ruleFixBatchTitle | 批量修正提交信息 | Fix Commit Messages |
| ruleFixBatchGenerate | AI 批量生成 | Generate All with AI |
| ruleFixBatchGenerating | 正在生成 ({0}/{1})… | Generating ({0}/{1})… |
| ruleFixBatchSave | 批量保存 | Save All |
| ruleFixBatchSaving | 正在保存 ({0}/{1})… | Saving ({0}/{1})… |
| ruleFixBatchSummary | 成功 {0} 项，失败 {1} 项，跳过 {2} 项 | {0} succeeded, {1} failed, {2} skipped |
| ruleFixBatchDone | 完成 | Done |

模板中每处 i18n 渲染位置上加中文注释（强制规则）。

### 3.5 README（gitPush/README.md）

「提交信息修正」章节补充批量修正能力说明（选择多条违规 → 批量弹窗 → AI 批量生成 → 批量保存）。

## 四、假设与决策

1. **复用现有 manager API，不新增批量重写方法**：顺序逐条调用 `rewriteCommitMessage`。同项目多条违规的最坏情况是多次子图重建（与后代数相关），但违规通常少量，正确性由「日期降序处理」保证；暂不做单趟图重建（避免触碰高风险的 commit-tree 核心重写代码）。
2. **批量保存串行执行**：writeLock 已按项目串行；跨项目并行留作后续优化，本期保证确定性进度与错误归属。
3. **不修改 CommitFixDialog.vue**（341 行已超 300 警戒线）；单条流程与 LOG Tab 入口保持原样，最小改动面。
4. **merge / 脏工作区 / rebase 残留 / 无 HEAD 项标记 blocked**：不参与 AI 生成与保存，显示对应文案，计入汇总「跳过」。
5. **批量弹窗保存完成不自动关闭**：父仅刷新受影响项目（`runAnalysis` 数组），失败项错误可见、可编辑重存；弹窗由「完成」按钮关闭。
6. 同项目内仅一个违规为 HEAD（amend）；处理顺序新→旧保证后续历史重写时 HEAD 已稳定，stale headHash 仅影响「是否历史提交」的显示，不影响实际重写（WorktreeOps 内部实时解析 HEAD）。

## 五、验证步骤

1. `pnpm i18n:verify` — 中英键对齐。
2. `npx tsc --noEmit` — 类型检查。
3. 用户自行：`pnpm lint` + 构建 + 手工验证：
   - 多项目批量修正（saved 数组刷新多个项目）；
   - 同一项目内多条链式违规（验证新→旧顺序处理不丢修正）；
   - merge 提交 / 脏工作区 / rebase 残留项被跳过且文案正确；
   - AI 生成失败降级启发式、保存部分失败时失败项可编辑重存；
   - 提交时间策略 radio 跨会话持久化。
