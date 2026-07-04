---
name: gitPush-composables-代码审查
overview: 审查 src/features/gitPush/composables/ 目录下 12 个 composable 文件的逻辑漏洞、冗余代码和内存泄露风险，按严重程度分级并给出修复方案。
todos:
  - id: fix-gitops-critical
    content: 修复 useGitOps.ts 核心问题：B1 pruneRecordCache 传 .value、B4 duration 统计、B5 空 catch 加日志、M1 setTimeout 跟踪+onUnmounted 清理、M2 新增 clearProjectCache 并在 useGitPush 中包装 removeProject
    status: completed
  - id: fix-batch-progress-picker
    content: 修复 useBatchProgress.ts start() 清理旧定时器(B2) 和 useDirectoryPicker.ts Promise 超时+cancel 事件(M3)
    status: completed
  - id: cleanup-redundancy
    content: 移除 commitOutputs 死代码(R1)、导出 pullToAll(R2)、合并 4 个文件重复注释头(R3)、修复 abortMergeOp 冗余写法(R4)
    status: completed
    dependencies:
      - fix-gitops-critical
  - id: fix-minor-issues
    content: 修复 S1 watch immediate、S2 useIdeManagement 改用 getNodeProcessModules、S3 deleteCategory 本地更新、S4 selectedTags 增删函数、M4 expandedProjects 清理
    status: completed
  - id: fix-cancel-distinction
    content: 修改 GitPushManager.cancelOp 支持 action 参数(B3)，同步更新 withAbortController 和 abortControllers key 结构，useGitOps 中 cancelPush/cancelPull 传入对应 action
    status: completed
    dependencies:
      - fix-gitops-critical
---

## 需求概述

对 `src/features/gitPush/composables/` 目录下 12 个 composable 文件进行代码审查后，发现 5 个严重逻辑漏洞、4 个内存泄露风险、4 处冗余代码和 4 个小问题。本次需求是修复所有已发现的问题，确保代码逻辑正确、无内存泄露、无冗余。

## 核心修复项

- 修复 `pruneRecordCache` 传入 Ref 对象而非 `.value` 导致缓存剪枝完全失效
- 修复 `useBatchProgress` 重复调用 `start()` 时 interval 泄露
- 修复 `useGitOps` 中空 catch 吞掉错误、duration 统计错误、setTimeout 未跟踪
- 修复 `useDirectoryPicker` Promise 可能永挂
- 清理 6 个缓存中删除项目后的陈旧条目
- 移除 `commitOutputs` 死代码、未导出的 `pullToAll`、重复注释头
- 修复 `cancelPush`/`cancelPull` 无法区分操作类型（需 GitPushManager 配合）
- 修复 `useGeneratedMsgSync` watch 缺少 immediate、`useIdeManagement` 绕过统一入口等小问题

## 技术栈

- Vue 3 Composition API（`ref`/`computed`/`watch`/`onUnmounted`/`onScopeDispose`）
- TypeScript
- 项目现有模式：composable 聚合（`useGitPush` 编排子 composable）、`pruneRecordCache` 缓存剪枝、`findProject`/`resolveValidPath` 工具函数

## 实现方案

### 1. useGitOps.ts 修复（B1 + B4 + B5 + M1 + M2）

**B1 — pruneRecordCache 传入 Ref 而非 .value**

- 第 189 行 `pruneRecordCache(outputsRef)` 改为 `pruneRecordCache(outputsRef.value)`
- 同步检查 `remoteOpSingle` 中是否也有此问题（第 237 行 `outputsRef.value[id] = entries` 是直接赋值，无 prune 调用——需补加 `pruneRecordCache(outputsRef.value)`）

**B4 — duration 统计错误**

- 当前 `startedAt[key]` 在同步循环中为所有 key 设置几乎相同的时间戳，`await managerFn(id)` 后统一计算，导致所有平台 duration ≈ 总耗时
- 方案：移除外层 per-key duration 跟踪，改为在 `buildOutputEntries` 中统一设为 0 或从 manager 返回值提取（manager 内部 `remoteOpAll` 已有 per-platform 的 `tryRemoteOp` 调用，但返回值不含 duration）
- 最简修复：注释标明 "duration 为全平台总耗时"，将所有 key 的 duration 统一设为 `Date.now() - totalStart`，消除虚假精度

**B5 — 空 catch 吞掉错误**

- 第 192 行 `} catch {` 改为 `} catch (e) { console.error(\`[gitPush] \${action === "push" ? "推送" : "拉取"}失败:\`, e) }`

**M1 — setTimeout 未跟踪**

- 在 `useGitOps` 函数顶部声明 `const pendingTimers = new Set<ReturnType<typeof setTimeout>>()`
- `remoteOpAll` 和 `remoteOpSingle` 中的 `setTimeout(...)` 返回值存入 `pendingTimers`，回调内 `delete` 后 `clearTimeout` 不需要（自然执行完）
- 添加 `onUnmounted(() => { pendingTimers.forEach(clearTimeout); pendingTimers.clear() })`

**M2 — 6 个缓存不剪枝**

- 新增 `clearProjectCache(id: string)` 函数，删除 `pushStatuses`/`workingTrees`/`fileDiffs`/`commitLogs`/`branches`/`stashEntries`/`pushOutputs`/`pullOutputs`/`commitOutputs` 中该 id 的条目
- 对 `fileDiffs`（键格式 `id::staged::file`）需按前缀过滤删除
- 在 `useGitPush.ts` 中包装 `removeProject`：调用 `projectCrud.removeProject(id)` 后调用 `gitOps.clearProjectCache(id)`
- 对 `fileDiffs` 额外调用 `pruneRecordCache(fileDiffs.value, 50)` 限制上限

### 2. useBatchProgress.ts + useDirectoryPicker.ts 修复（B2 + M3）

**B2 — start() 不清理旧定时器**

- `start()` 函数开头加 `if (progressTimer) { clearInterval(progressTimer); progressTimer = null }`

**M3 — Promise 永挂**

- webkitdirectory 降级方案中，在 `input.click()` 前设置 60 秒超时 `setTimeout(() => resolve(null), 60000)`
- `onchange` 回调中 `clearTimeout(timeoutId)` 防止误触发
- 增加 `input.addEventListener("cancel", () => resolve(null))` 作为额外保障

### 3. 冗余清理（R1 + R2 + R3 + R4 + M4）

**R1 — commitOutputs 死代码**

- 从 `useGitOps.ts` 移除 `commitOutputs` 声明（第 57 行）和导出（第 491 行）
- 从 `useGitPush.ts` 移除 `commitOutputs: gitOps.commitOutputs`（第 61 行）
- 注意：`index.vue:644` 有自己的 `commitOutputs`，不受影响

**R2 — pullToAll 未导出**

- `useGitOps.ts:256-258` 的 `pullToAll` 函数已定义但 `useGitPush.ts` 未暴露
- 方案：在 `useGitPush.ts` 中添加 `pullToAll: gitOps.pullToAll` 导出（与 `pushToAll` 对称）

**R3 — 重复注释头**

- `useDirectoryPicker.ts:1-7` 三段注释合并为单行
- `useIdeManagement.ts:1-2` 合并
- `useProjectFilters.ts:1-2` 合并
- `useGitTagsConflicts.ts:1-2` 合并

**R4 — abortMergeOp 冗余**

- `useGitTagsConflicts.ts:71-72` 改为 `const { [id]: _, ...rest } = conflicts.value; conflicts.value = rest`

**M4 — expandedProjects 不清理**

- 在 `useCommitLog` 中导出 `clearExpanded(id: string)` 函数
- 在 `useGitPush.ts` 的 `removeProject` 包装中也调用 `commitLog.clearExpanded(id)`

### 4. 小问题修复（S1 + S2 + S3 + S4）

**S1 — useGeneratedMsgSync watch 无 immediate**

- `useGeneratedMsgSync.ts:7` 的 `watch` 第三参数加 `{ immediate: true }`

**S2 — useIdeManagement 绕过统一入口**

- `useIdeManagement.ts:182` 的 `(globalThis as any).process` 改为通过 `getNodeProcessModules()` 获取

**S3 — deleteCategory 全量重载**

- `useProjectCrud.ts:142` 的 `projects.value = await manager.getProjects()` 改为本地更新：`projects.value = projects.value.map((p) => p.categoryId === id ? { ...p, categoryId: UNGROUPED_ID } : p)`

**S4 — selectedTags 无增删函数**

- 在 `useProjectFilters` 中添加 `toggleTag(tag: string)` 和 `clearTags()` 函数
- `toggleTag`：创建新 Set，toggle 后赋值给 `selectedTags.value`（确保响应式）

### 5. cancelPush/cancelPull 区分（B3 — 需 GitPushManager 配合）

**问题**：`manager.cancelOp(id)` 取消该项目的所有 AbortController，无法区分 push/pull

**修复方案**：

- `GitPushManager.ts`：`abortControllers` 的 Map key 从 `id` 改为 `${id}:${action}`
- `withAbortController` 方法增加 `action: "push" | "pull"` 参数
- `cancelOp` 增加 `action?: "push" | "pull"` 参数，不传则取消全部
- `useGitOps.ts`：`cancelPush(id)` 调用 `manager.cancelOp(id, "push")`，`cancelPull(id)` 调用 `manager.cancelOp(id, "pull")`
- 需同步修改 `remoteOpAll`/`remoteOpSingle` 的 `withAbortController` 调用

## 目录结构

```
src/features/gitPush/
├── composables/
│   ├── useGitOps.ts           # [MODIFY] B1/B4/B5/M1/M2/R1/R2/B3 — 核心修复
│   ├── useBatchProgress.ts    # [MODIFY] B2 — start() 清理旧定时器
│   ├── useDirectoryPicker.ts  # [MODIFY] M3 — Promise 超时 + cancel 事件
│   ├── useGeneratedMsgSync.ts # [MODIFY] S1 — watch immediate
│   ├── useCommitLog.ts        # [MODIFY] M4 — 导出 clearExpanded
│   ├── useGitTagsConflicts.ts # [MODIFY] R3/R4 — 注释合并 + abortMergeOp
│   ├── useIdeManagement.ts    # [MODIFY] R3/S2 — 注释合并 + nodeModules
│   ├── useProjectCrud.ts      # [MODIFY] R3/S3 — 注释合并 + deleteCategory
│   ├── useProjectFilters.ts   # [MODIFY] R3/S4 — 注释合并 + toggleTag/clearTags
│   ├── useGitPush.ts          # [MODIFY] R1/R2/M2/M4 — 移除死代码 + 包装 removeProject + 导出 pullToAll
│   ├── useGitStats.ts         # [无改动]
│   └── useTimeUtils.ts        # [无改动]
├── GitPushManager.ts          # [MODIFY] B3 — cancelOp 支持 action 参数
└── utils.ts                   # [无改动]
```

## 实现注意事项

- **性能**：M2 修复中 `fileDiffs` 的前缀删除需遍历 `Object.keys(fileDiffs.value)` 过滤，项目规模有限（通常 <100），O(n) 可接受
- **Blast radius**：B3 修改 GitPushManager 的 `abortControllers` key 结构，需确保 `withAbortController` 所有调用点同步更新，`cancelAll`（第 1345 行）也需适配
- **响应式**：S4 的 `toggleTag` 必须创建新 Set 赋值，不能直接 `selectedTags.value.add/delete`（Vue 3 对 Set 有响应式追踪，但替换整个 Set 更安全且符合项目其他 composable 的模式）
- **验证**：修改完成后运行 `pnpm lint` + `npx tsc --noEmit` 验证类型和规范