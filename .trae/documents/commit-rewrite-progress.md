# gitPush 提交历史重写进度显示计划

## Summary

在「修正提交信息」弹窗保存历史提交（isHistoryCommit）时，重写过程目前只显示静态文案「正在重写历史提交…」。本次为重写过程增加实时进度反馈：**计数（x/y）+ 细进度条**。改动范围：commit-tree 重建循环增加进度回调，经 3 层透传到弹窗；UI 复用现有 `saving && isHistoryCommit` 提示块。

可行性已确认：`execGit` 支持回调、commit-tree 循环位置明确、ICO `gp-fix-warning` 提示块已存在、i18n 键可加。

## Current State Analysis

- [rebuildHistoryWithNewMessage](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\managers\WorktreeOps.ts)（L401-486）：commit-tree 逐条重建循环。
  - L461 `await rebuild(target, message)` 重建目标
  - L463-470 for 循环遍历后代：父指针未变化（侧链）`map.set(rec.hash, rec.hash); continue` 不重建；否则 L469 `await rebuild(rec, rec.message)`
  - 无任何进度回调参数
- [GitPushManager.rewriteCommitMessage](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\GitPushManager.ts)（L396-403）：写锁包装，无回调通道
- [CommitFixDialog.vue](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\components\common\CommitFixDialog.vue) ：
  - 模板 L115-124：`saving && isHistoryCommit` 时渲染 `gp-fix-warning` 提示块，内含 Icon + `<span>{{ i18n.ruleFixRewriting }}</span>`（静态）
  - L301-311 `performSave`：`await manager.rewriteCommitMessage(projectPath, hash, message.trim(), preserve)`，`saving` ref 控制全程 loading
- i18n：`ruleFixRewriting`（zh "正在重写历史提交…" / en "Rewriting history commits..."）已存在，无计数/百分比变量键

**关键语义点**（决定进度分母准确性）：循环内侧链提交走 `continue` 不重建，进度「总数」必须是**实际重建数**（目标 + 依赖目标的后代），而非 rest 总长度。

## Proposed Changes

### 1. [WorktreeOps.ts](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\managers\WorktreeOps.ts)

**`rewriteCommitMessage`**（L353）：签名追加尾参
```ts
async rewriteCommitMessage(projectPath, hash, message, preserveDate = false, onProgress?: (current: number, total: number) => void)
```
L389 透传给 `rebuildHistoryWithNewMessage`（HEAD amend 路径不传进度——瞬时操作）。

**`rebuildHistoryWithNewMessage`**（L401）：签名追加同尾参 `onProgress?: (current: number, total: number) => void`。

重构循环为「预计算 total → 重建推进」两个阶段：一次性预扫描出「需要重建的集合」，避免进度分母依赖运行时过程：

```ts
// 预计算必要重建数（纯逻辑）：目标必重建；后代中任一父已被重写的才重建
const replaced = new Set<string>([fullHash])
let total = 1
for (const rec of rest) {
  if (rec.parents.some((p) => replaced.has(p))) {
    replaced.add(rec.hash)
    total++
  }
}

let done = 0
const progress = () => onProgress?.(done, total)
await rebuild(target, message)
done++
progress()
for (const rec of rest) {
  const newParents = rec.parents.map((p) => map.get(p) ?? p)
  if (newParents.join(" ") === rec.parents.join(" ")) {
    map.set(rec.hash, rec.hash)
    continue
  }
  await rebuild(rec, rec.message)
  done++
  progress()
}
```

> 正确性说明：预计算的 `replaced` 判定（父被重写）与原循环的 `map` 判定（父被重映射且≠自身）在本场景语义等价——identity 分支只发生在侧链（其父未被重写），而 rebuild 分支的父必在 replaced 中。总数字段在循环内增量与 total 始终一致。

### 2. [GitPushManager.ts](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\GitPushManager.ts)（L396-403）

`rewriteCommitMessage` 签名追加同尾参，透传进写锁：
```ts
async rewriteCommitMessage(projectPath, hash, message, preserveDate = false, onProgress?: (current: number, total: number) => void) {
  const result = await this.writeLock.runExclusive(projectPath, () =>
    this.worktreeOps.rewriteCommitMessage(projectPath, hash, message, preserveDate, onProgress),
  )
  ...
}
```
调用方 `useBatchCommitFix.fixSelected` 不传（undefined 默认），无影响。

### 3. [CommitFixDialog.vue](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\components\common\CommitFixDialog.vue)

- 新增响应式状态：`const rewriteProgress = ref<{ current: number, total: number } | null>(null)`
- `performSave`（L301）：追加第 5 参回调更新状态；`finally` 中置 `rewriteProgress.value = null`
  ```ts
  await manager.rewriteCommitMessage(projectPath, props.target.hash, newMessage.value.trim(), preserve, (current, total) => {
    rewriteProgress.value = { current, total }
  })
  ```
- 模板 L114-124 提示块内：span 文案改为「有进度显计数、无进度显静态」双态：
  ```html
  <span>{{ rewriteProgress ? i18n.ruleFixRewritingProgress.replace("{0}", String(rewriteProgress.current)).replace("{1}", String(rewriteProgress.total)) : i18n.ruleFixRewriting }}</span>
  ```
  下方新增进度条（仅保存历史提交时显示，与提示块同显隐）：
  ```html
  <div class="gp-fix-progress"><div class="gp-fix-progress-bar" :style="{ width: (rewriteProgress ? Math.round(rewriteProgress.current / rewriteProgress.total * 100) : 0) + '%' }" /></div>
  ```
  宽度用内联 style 绑定动态百分比（非静态样式，符合不塞样式到模板的例外——仅数值绑定）。

### 4. [CommitFixDialog.scss](file:///e:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\styles\CommitFixDialog.scss)

新增两段（沿用 Codex token，禁 box-shadow）：
```scss
.gp-fix-progress { height: 4px; border-radius: $radius-s; background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent); overflow: hidden; margin-top: $spacing-1; }
.gp-fix-progress-bar { height: 100%; background: var(--b3-theme-primary); border-radius: inherit; transition: width 0.12s ease; }
```
> 具体 token 名（`$radius-s`/`$spacing-1` 或文件内既有变量）执行时对照该文件现有使用确认，颜色沿用 `--b3-theme-primary`（项目主色，与 gp-fix-warning 图标同系）。

### 5. i18n（zh_CN / en_US 镜像）

新增键（紧邻 `ruleFixRewriting`，L663）：
- zh：`"ruleFixRewritingProgress": "正在重写历史提交 ({0}/{1})…"`
- en：`"ruleFixRewritingProgress": "Rewriting history commits ({0}/{1})..."`

## Assumptions & Decisions

- 进度回调签名 `(current, total)`，不做阶段细分（阶段字/百分比由 UI 层由计数推导）
- total 为实际重建数（排除侧链 identity），保证进度条不跳变、不卡 90%
- 回调执行频率 = 每条 commit-tree 一次（不逐字节流式），UI 实时性足够（每条 ~200ms）
- HEAD amend 路径不触发进度（瞬时，维持现有「保存中…」）
- 超时/Abort 维持现状不扩展：本需求只加进度显示，不加取消按钮（避免扩大改动面）

## Verification

1. `npx vue-tsc --noEmit`：改动文件无新增类型错误
2. `pnpm i18n:verify`：中英键对齐
3. `pnpm lint`：用户自行执行
4. 手动验证：对目标在历史深处的提交保存修正 → 提示块显示「正在重写历史提交 (3/47)…」且进度条随过程递增；对 HEAD 提交保存 → 仍显示「保存中…」无进度条；`ruleCheckBatchFix`（批量修正）不受影响（无进度传参，代码路径不变）