---
name: gitpush-push-all-optimization
overview: 对 gitPush 模块的"推送全部"功能进行全面优化：并行化远程推送、实时逐远程进度反馈、推送 HEAD 替代 --all、取消支持、智能跳过、失败重试、彩色输出、全局推送所有项目、输出折叠截断，共 9 项改进。
todos:
  - id: parallel-push
    content: GitPushManager.remoteOpAll 改为 Promise.allSettled 并行推送，execGit 增加 AbortSignal 支持
    status: completed
  - id: progress-feedback
    content: 升级 pushingRemote 为 pushProgress 状态模型，index.vue 按钮区展示逐远程实时状态
    status: completed
    dependencies:
      - parallel-push
  - id: head-mode-switch
    content: 新增 pushBranchMode 持久化设置（TypedStorage + SettingsDialog 开关），tryRemoteOp 按模式选择 --all 或 HEAD
    status: completed
  - id: cancel-button
    content: 实现取消按钮：Manager 层维护 AbortController 映射，取消时 kill 子进程 + 清空等待队列，UI 层按钮状态切换
    status: completed
    dependencies:
      - parallel-push
      - progress-feedback
  - id: smart-skip
    content: remoteOpAll 推送前利用 pushStatuses 缓存跳过 ahead===0 的远程，标记 skipped
    status: completed
    dependencies:
      - progress-feedback
  - id: retry-on-failure
    content: tryRemoteOp 增加自动重试：失败时延迟 1s 重试 1 次，仅网络类错误触发
    status: completed
    dependencies:
      - parallel-push
  - id: structured-output
    content: pushOutputs 改为 PushOutputEntry[] 结构化数据，index.vue 渲染彩色条目列表 + 耗时 + 折叠展开
    status: completed
    dependencies:
      - progress-feedback
  - id: push-all-projects
    content: 顶栏新增"推送所有项目"按钮，遍历 needsPush 项目批量 pushToAll，显示进度计数
    status: completed
    dependencies:
      - progress-feedback
      - smart-skip
  - id: output-collapse
    content: 输出区域默认折叠仅显示摘要行 + 超长内容 500 字符截断 + 展开按钮
    status: completed
    dependencies:
      - structured-output
  - id: i18n-styles
    content: 使用 [skill:codex-ui-style-guide] 补充 i18n 翻译键（zh_CN/en_US）和新增 SCSS 样式
    status: completed
    dependencies:
      - head-mode-switch
      - cancel-button
      - push-all-projects
      - output-collapse
---

## 产品概述

对 gitPush 模块"推送全部"功能进行全方位优化，提升推送性能、用户体验和操作可靠性。

## 核心功能

### 1. 项目内远程并行推送

将 `remoteOpAll()` 中 4 个远程的串行 `await` 改为 `Promise.allSettled()` 并行执行，4 个远程同时推送，总耗时从 ~20s 降至 ~5s。全局 `gitMaxConcurrent` 信号量自动约束并发数，不破坏现有并发控制。

### 2. 实时逐远程进度反馈

`pushingRemote` 从 `Record<string, string>`（只存 `"all"`）升级为 `Record<string, Set<PlatformKey>>` + `Record<string, Record<PlatformKey, "pending"|"pushing"|"ok"|"fail">>` 状态映射。UI 按钮区展示每个远程独立状态：灰色 pending → 蓝色旋转 pushing → 绿色✓/红色✗。

### 3. `git push HEAD` 模式开关

新增持久化设置 `pushBranchMode: "all" | "head"`（默认 `"all"` 保持兼容），在设置弹窗中提供切换。`"head"` 模式使用 `git push <remote> HEAD` 仅推送当前分支，避免 `--all` 推送无变更分支产生的冗余输出。

### 4. 取消按钮

推送进行中时，"推送全部"按钮变为"取消"按钮。利用 `AbortController` 信号传递 + `execGit` 的 `child_process.kill()` 终止正在执行的 git 子进程，等待队列一并清空。

### 5. 推送前智能跳过已同步远程

在 `remoteOpAll()` 中，推送前检查 `pushStatuses` 缓存的各远程 ahead/behind 状态，对 `ahead === 0` 的远程直接返回 `{ ok: true, skipped: true }`，不发起 git 调用。

### 6. 失败自动重试

单个远程推送失败时，自动重试 1 次（间隔 1 秒）。仅对网络类错误（非认证/权限错误）重试，避免无意义重试。

### 7. 彩色结构化输出

`pushOutputs` 从纯文本拼接改为结构化数据 `PushOutputEntry[]`。UI 渲染为带颜色标记的条目列表：绿色✓成功 + 耗时、红色✗失败 + 错误摘要。每条可折叠展开查看完整 stdout/stderr。

### 8. 全局推送所有项目

顶栏新增"推送所有项目"按钮，遍历当前分类下所有 `needsPush === true` 的项目，逐个调用 `pushToAll()`。批量操作受全局 `gitMaxConcurrent` 信号量约束。按钮显示进度 "推送中 (2/5)"。

### 9. 输出区域折叠 + 自动截断

输出区域默认折叠（仅显示摘要行），点击展开查看详情。超长 stdout/stderr 自动截断至 500 字符 + "[展开全部]" 按钮。保留现有 `max-height: 150px` 滚动。

## 技术栈

- 框架：Vue 3 + TypeScript（项目现有）
- 样式：SCSS（Codex UI 风格，遵循项目 SCSS 分离规范）
- 状态管理：Vue `ref` / `reactive` + composable 模式
- 持久化：`TypedStorage<number>`（现有 GitPushStorage 模式）
- Git 操作：Node.js `child_process.execFile`
- 并发控制：现有 `execGit()` 信号量 + `AbortController`

## 实现方案

### 整体策略

保持现有架构分层（Manager → Composable → Vue UI）不变，在每层内部扩展而非重构。9 项优化按依赖关系分批实施，确保每批独立可测、向后兼容。

### 关键技术决策

**1. 并行化策略**
在 `remoteOpAll()` 中用 `Promise.allSettled()` 替代串行 `await`。每个 `tryRemoteOp` 调用仍经过 `execGit()` 信号量，因此并行不会突破 `gitMaxConcurrent` 限制。天然安全。

**2. 取消机制**
`execGit()` 增加可选 `AbortSignal` 参数。取消时调用 `child_process.kill("SIGTERM")`（Windows 下 `taskkill`）。Manager 层维护 `Map<projectId, AbortController>`，取消时连环终止所有进行中的子进程。

**3. 状态模型升级**

```typescript
// 旧：pushingRemote: Record<string, string>  // id → "all" | "github"
// 新：
pushProgress: Record<string, {
  targets: Set<PlatformKey>           // 正在处理的远程集合
  statuses: Record<PlatformKey, "pending" | "pushing" | "ok" | "fail">
  startedAt: number                   // 开始时间戳
  aborted: boolean
}>
```

**4. 结构化输出**

```typescript
// 旧：pushOutputs: Record<string, string>
// 新：
pushOutputs: Record<string, PushOutputEntry[]>

interface PushOutputEntry {
  platform: PlatformKey
  label: string
  ok: boolean
  skipped: boolean
  duration: number        // 毫秒
  summary: string         // 摘要行："Everything up-to-date" / 错误首行
  fullStdout: string
  fullStderr: string
}
```

### 性能考虑

- 并行推送：4 远程从串行 20s → 并行 ~5s（受信号量约束，安全不超载）
- 智能跳过：减少无意义的 git push 调用，网络和 CPU 开销降为零
- 输出截断：默认 500 字符防止 DOM 过大；`pruneRecordCache` 已有 30 条目限制
- 重试仅 1 次 + 1s 延迟，不影响整体完成时间

### 向后兼容

- `pushBranchMode` 默认 `"all"`，现有用户行为不变
- `pushToAll()` 返回值 `AllPlatformResult` 保持不变
- `pushOutputs` 类型变更但模板层通过 computed 适配
- `useGitOps` 导出函数签名不变

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose：确保新增 SCSS 样式和 Vue 组件遵循项目 Codex UI 规范（BEM 命名、设计 Token、SCSS 分离）
- Expected outcome：新增样式文件通过规范审查，与现有 UI 风格一致

### SubAgent

- **code-explorer**
- Purpose：在实现过程中快速定位相关文件、验证调用链和类型依赖
- Expected outcome：确保修改不遗漏调用点，类型变更传播完整