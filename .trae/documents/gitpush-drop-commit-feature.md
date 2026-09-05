# gitPush 新增「删除历史提交（保留内容）」功能 + git filter-repo 路线评估

## Summary

在 gitPush 提交日志列表中新增「删除该提交」操作：**仅删除提交记录，最终文件内容 100% 不变**（被删提交的变更自动并入下一个提交）。基于现有 `rebuildHistoryWithNewMessage` 的 commit-tree DAG 重建机制改造，零新依赖。

**用户问题先行回答：配合 git filter-repo 不会更简单**，评估见下。

## git filter-repo 评估（回答"实现会不会简单点"）

| 维度 | git filter-repo | commit-tree 重建（现有机制） |
|---|---|---|
| tree 保持型 drop | ❌ 不支持——管道是 fast-export→fast-import **增量 delta 重放**，原生操作对象是路径/文本/元数据；`--commit-callback` 无官方 skip-commit API，强行丢弃提交会连带丢弃变更（变成"删记录+变更"语义，与选定语义相反） | ✅ 原生——后代提交以**原 tree** 重建、仅父指针重映射 |
| 新依赖 | Python 环境 + 脚本分发（Windows 无预装，工程量 ≥ BFG 的 Java 探测） | 无 |
| 仓库侵入 | 默认要求 fresh clone/`--force`，执行后**删除 origin remote**（防误推设计），插件托管仓库的 remote 配置被破坏需恢复 | 零（全程不碰工作区/暂存区） |
| 范围 | 全引用扫描（重，适合批量清理） | 当前分支精准处理（侧链 identity 保留） |
| 实现量 | 下载/探测/编排全套新基建 | **核心差异仅 ~15 行**（跳过目标重建 + 父指针重映射） |

**结论**：filter-repo 的甜区是"按路径/敏感文本批量清理全历史"（BFG 同类），不是"跳过指定提交且保留后代 tree"。本功能走 commit-tree 重建。

## 语义与安全模型（删记录、内容不变）

删除 A→**B**→C→D 中的 B：C 以**原 tree** 重建、父指针指向 A（`map.set(B, A)`），D 同理。结果：

- B 从历史消失；**B 的变更被 C"吸收"**（C 的隐式 diff 从 A..C 变为含 B 的改动）
- **最终 HEAD 的 tree 与删除前完全相同** → 无需 `reset --hard`、无需工作区干净前置、index/worktree 零触碰（与改消息场景同性质）
- B 的所有后代 **hash 必然重写**（Git 机制，无法避免）；已推送需 `--force-with-lease` 强推
- 可恢复性：不 expire reflog → 旧链仍在 reflog（`git reset --hard HEAD@{n}` 可恢复）；按项目惯例执行前再做 **bundle 备份**（复用 BFG 备份目录 + 每项目保留 3 份轮换）

## 前置条件（弹窗内校验，全部通过才可执行）

1. **目标非 HEAD**——删 HEAD 是 `reset --hard` 语义（记录+变更全失），阻止并提示
2. **目标非 merge 提交**——多父拓扑重映射有歧义（子提交该指向哪个父？），阻止（与 `rewriteCommitMessage` 现有限制一致）
3. **目标是当前分支祖先**——`git merge-base --is-ancestor <hash> HEAD` 退出码判定；非祖先时操作无效（该提交不在 HEAD 历史上），阻止并提示
4. **非 rebase 中断残留**——复用 `isInRebaseState`（上次重写失败残留时任何重写都必须阻止）
5. 强推权限：属操作后事项——若分支已推送，完成后提示用户需 `--force-with-lease` 强推（插件已有 `forcePushToAll` 可手动触发，不自动强推）

## Proposed Changes

### 1. `managers/HistoryRewriter.ts`（新建 ~200 行）

从 [WorktreeOps.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/WorktreeOps.ts#L412-L517) 的 `rebuildHistoryWithNewMessage` 提取 DAG 重建核心（`FMT` 格式串 / `parseLog` / `rebuild` 闭包 / 拓扑序遍历 / 侧链 identity 映射 / CAS `update-ref` / mkdtemp+rmSync），对外两个方法：

- `rewriteMessage(projectPath, fullHash, headHash, message, preserveDate, onProgress)` —— 现行为原样迁移（目标以新消息重建）
- `drop(projectPath, fullHash, headHash, onProgress)` —— 差异仅在目标处理一步：
  - 目标**不重建**，`map.set(target.hash, target.parents[0])`（调用方已保证非 merge → 单父）
  - `replaced` 预计算集合同样从 target 起传播，但 total 不含 target 自身（进度分母 = 需重建的后代数）
  - `preserveDate` 恒为 true（删除操作无理由改动后代日期）

提取动机：WorktreeOps.ts 现 471 行，直接复制一份 drop 会超 500 行硬阈值；且两操作共享 95% 骨架，提取后 WorktreeOps 净减至 ~380 行。

### 2. `WorktreeOps.ts` 修改

- `rewriteCommitMessage` 保留全部前置检查（rebase 残留/merge 拒绝/rev-parse 解析/HEAD→amend 分支），历史提交分支改调 `HistoryRewriter.rewriteMessage`（行为不变，纯迁移）
- 新增 `dropCommit(projectPath, hash, onProgress)`：rev-parse 解析完整 hash → 四项前置校验（HEAD/merge/ancestor/rebase，顺序同上）→ 调 `HistoryRewriter.drop`。校验失败抛带中文指引的错误（弹窗直接展示）

### 3. `RepoCleanOps.ts` 修改

cleanRepo 步骤 1 的 bundle 备份逻辑（backupDirFor + 时间戳命名 + pruneBackups 轮换）提取为 public `createBackup(projectPath): Promise<string>`（返回备份文件路径），cleanRepo 内部改为调用它（消除即将出现的双份备份逻辑——drop 也要用）。

### 4. `GitPushManager.ts` 接线

```ts
async dropCommit(projectPath, hash, onProgress?) {
  // writeLock.runExclusive 包裹 + 完成后 invalidatePushStatusCacheByPath（复制 rewriteCommitMessage L613-623 模式）
}
async createProjectBackup(projectPath): Promise<string>  // 薄透传 RepoCleanOps.createBackup
```

### 5. `components/common/DropCommitDialog.vue`（新建，自包含 ~200 行）

仿 [CommitFixDialog.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/common/CommitFixDialog.vue) 模式（放 common/，与 CommitFixDialog 同为"提交级历史操作弹窗"家族）：

- props 仅 `{ i18n, target: CommitFixTarget }`（复用现有类型）+ `inject(CARD_SERVICES_KEY)` 拿 manager
- `onMounted → init()` 并行拉四态：HEAD hash（判定目标是否 HEAD）、`rev-parse hash^2`（merge 判定）、`merge-base --is-ancestor`（祖先判定）、`isInRebaseState`
- **可执行判定** `canDrop` + 不可执行原因文案（对应前置 1~4，i18n 键见下）
- 危险警告区：hash 重写说明 + 强推提示（文案风格复用 `ruleFixForcePushHint` 语义，新增独立键）；确认按钮用 `vp-btn--danger`（Buttons.scss 已有）
- 执行流程：`createProjectBackup`（备份，失败即中止）→ `manager.dropCommit`（重写进度条：current/total 计数 + 细条，复制 CommitFixDialog 的 `ruleFixRewritingProgress` 模式）→ 成功 `emit('saved', projectId)` → 父级刷新该卡片提交日志
- Escape/遮罩点击关闭（执行中禁用，同 CommitFixDialog）

### 6. `BranchCommitList.vue` 修改

每条提交行加删除按钮（`mdi:delete-outline` **已验证存在于本地 MDI 集**；hover 显示、`@click.stop`，样式与现有 `bcl-tag-btn` 同模式）→ `emit('dropCommit', entry)`；`defineEmits` 追加 `dropCommit: [entry: CommitLogEntry]`。

### 7. `ProjectCard.vue` 修改

同 CommitFixDialog 挂载模式（L122 旁）：本地 `dropTarget` ref + `<DropCommitDialog v-if="dropTarget" :target="dropTarget" @close=... @saved=刷新日志 />`（刷新复用现有 fixCommit 保存后的同一刷新链路）。

### 8. 样式

- `styles/DropCommitDialog.scss`（新建）：复用 gp-dialog 基座；警告/进度条样式从 CommitFixDialog.scss 的同类选择器模式派生（不复制整文件，仅弹窗布局 + danger 按钮 + 备份路径提示）
- `BranchCommitList.scss`：追加 `.bcl-drop-btn`（与 `.bcl-tag-btn` 合并选择器——两者同为 hover 显示的行内 ghost 按钮）

### 9. i18n（`src/i18n/{zh_CN,en_US}/gitPush.json` 中英同步，~12 键）

`dropCommitOpen`（按钮 tooltip："删除该提交"）、`dropCommitTitle`（"删除历史提交"）、`dropCommitBody`（确认正文：说明记录删除/内容不变/hash 重写）、`dropCommitConfirm`（"确认删除"）、`dropCommitBackupRunning`、`dropCommitRunning`（"正在重写历史提交…"）、`dropCommitRunningProgress`（"正在重写历史提交 ({0}/{1})…"）、`dropCommitBlockedHead`、`dropCommitBlockedMerge`、`dropCommitBlockedAncestor`、`dropCommitSuccess`、`dropCommitForcePushHint`。模板中每个 i18n 键上方加中文注释。

### 10. `README.md`（gitPush）

功能清单"提交历史"条目追加：删除任意历史提交（记录级删除、内容不变语义、bundle 备份 + reflog 双重可恢复、需手动强推）；目录结构补 HistoryRewriter.ts / DropCommitDialog.vue。

## Assumptions & Decisions

| 决策 | 选择 | 理由 |
|---|---|---|
| 技术路线 | commit-tree 重建（非 filter-repo） | filter-repo 语义不匹配 + Python 依赖 + 删 origin 侵入（见评估表） |
| 删除语义 | tree 保持型（变更并入下一提交） | 用户已确认"删记录、内容不变" |
| merge / HEAD 提交 | V1 阻止 | merge 多父重映射歧义；删 HEAD 是 reset 语义（不同操作） |
| 日期保留 | 恒保留后代原始日期 | 删除操作无理由扰动日期 |
| 备份 | 执行前 bundle 全量备份 | 双保险（reflog 本就可恢复）；复用 BFG 备份目录/轮换，成本一条命令 |
| 自动强推 | 不做 | 与 rewriteCommitMessage 行为一致，强推留给用户决定 |
| 入口范围 | 仅卡片日志 Tab（BranchCommitList） | 最小范围；规则检查视图不加（保持视图职责单一） |
| WorktreeOps 行数 | 提取 HistoryRewriter.ts | 471 行 + drop 会超 500 硬阈值；且 95% 骨架共享 |
| 工作区干净检查 | 不要求 | tree 保持 → 工作区/index 与新 HEAD 差异同旧状，无需检查（与改消息场景一致） |

## Verification

1. `npx vue-tsc --noEmit` —— 本次新文件 0 错误（全库既有 TS6133 与本次无关）
2. `pnpm i18n:verify` —— 中英键对齐；`pnpm validate:icons` —— mdi:delete-outline 已验证存在，预期通过
3. 用户执行 `pnpm lint`
4. 真机验证（**测试仓库**，先造 A→B→C→D 线性链并推送）：
   - 日志列表 hover B 行 → 删除按钮可见 → 点击 → 弹窗四项检查全绿 → 确认
   - `git log --oneline`：B 消失，A→C'→D' 结构完整
   - `git diff <删除前HEAD> <删除后HEAD>`：**空输出**（内容不变核心验证）
   - `git status`：干净（工作区未被触碰）
   - `git reflog`：旧链仍在（恢复演练：`git reset --hard HEAD@{1}` 后仓库回到删除前）
   - 备份产物存在于插件数据目录 bfg-backups/，`git clone <bundle>` 可用
   - 强推后远端 log 与本地一致
   - 边界：对 HEAD 行/merge 行点击删除 → 弹窗明确阻止文案
