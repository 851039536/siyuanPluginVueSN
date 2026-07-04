---
name: batch-progress-step-timing
overview: 扩展 BatchProgressBar 日志为分步骤计时，让用户能看到每个项目内各个 git 命令（推送状态/工作区/HEAD/日志/分支/Stash）的具体耗时。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex UI
    - Monospace
    - Compact
  fontSystem:
    fontFamily: system-ui
    heading:
      size: 11px
      weight: 700
    subheading:
      size: 10px
      weight: 400
    body:
      size: 9px
      weight: 400
  colorSystem:
    primary:
      - var(--b3-theme-primary)
    background:
      - var(--b3-theme-surface)
    text:
      - var(--b3-theme-on-surface)
      - var(--b3-theme-error)
    functional:
      - var(--b3-theme-primary)
todos:
  - id: extend-types-composable
    content: 扩展 types/batchProgress.ts（LogStep + LogEntry.steps + pending 状态）和 useBatchProgress.ts（beginLog/addStep/completeLog + 保留 addLog 兼容）
    status: completed
  - id: update-batch-progress-ui
    content: 更新 BatchProgressBar.vue 渲染步骤标签行 + BatchProgressBar.scss 新增步骤样式
    status: completed
    dependencies:
      - extend-types-composable
  - id: refactor-batch-runner
    content: 改造 index.vue 的 runBatchWithProgress 支持 ctx.step() 并更新全部 5 处调用点用 ctx.step 包装各 git 操作步骤
    status: completed
    dependencies:
      - extend-types-composable
---

## 产品概述

增强 gitPush 批量操作日志的明细程度，从当前"项目名+总耗时+ok/fail"升级为"项目名+总耗时+各 git 步骤分项耗时"，让用户清楚知道每个项目的每个 git 命令（pushStatus/workingTree/commitLog/branches/stash 等）分别花了多少时间。

## 核心功能

- 批量进度条日志区每行日志下方显示分步骤耗时标签行
- 步骤按完成顺序显示，支持并行操作（Promise.all 场景）
- 保留 ok/fail 状态图标 + 项目名 + 总耗时 + 错误信息
- 新增 pending 加载中状态图标

## 技术栈

- Vue 3 + TypeScript（已有项目）
- SCSS 样式分离（遵循项目 Codex UI 规范）

## 实现方案

### 数据模型扩展

在 `types/batchProgress.ts` 新增 `LogStep` 接口，扩展 `LogEntry` 添加 `steps?` 字段和 `"pending"` 状态：

```ts
export interface LogStep {
  name: string
  ms: number
}
export interface LogEntry {
  projectName: string
  status: "pending" | "ok" | "fail"  // 新增 pending
  elapsedSeconds: number
  error?: string
  steps?: LogStep[]  // 新增
}
```

### useBatchProgress API 扩展

新增 3 个方法，保留 `addLog` 向后兼容：

- `beginLog(name): number` — 创建 pending entry，返回索引
- `addStep(idx, step)` — 向指定 entry 追加步骤
- `completeLog(idx, status, elapsed, error?)` — 完成 entry

### runBatchWithProgress 改造

fn 签名从 `(item) => Promise<void>` 改为 `(item, ctx) => Promise<void>`，ctx 提供 `step(name, fn)` 方法自动测量耗时：

```ts
interface StepCtx {
  step<T>(name: string, fn: () => Promise<T>): Promise<T>
}
```

执行流程：`beginLog(name)` → fn 执行中 `ctx.step()` 逐步记录 → `completeLog(idx, ok/fail, elapsed)`

### 调用方改造（5 处）

每个 `runBatchWithProgress` 调用点用 `ctx.step()` 包装各操作步骤。

## 实现细节

- `ctx.step` 内部用 `Date.now()` 测量，支持 `Promise.all` 并行场景（步骤按完成顺序追加）
- `logEntries.value` 用 `[...logEntries.value]` 触发响应式更新（Vue 3 对数组 push 响应式可靠，但步骤追加需替换整个 entry 对象）
- `addLog` 保留为兼容方法（内部委托 beginLog + completeLog）
- 样式遵循 Codex UI：等宽字体 `$vp-mono`、`$font-size-*` Token、9px 步骤标签

## 目录结构

```
src/features/gitPush/
├── types/batchProgress.ts          # [MODIFY] 新增 LogStep 接口，扩展 LogEntry
├── composables/useBatchProgress.ts # [MODIFY] 新增 beginLog/addStep/completeLog
├── components/BatchProgressBar.vue # [MODIFY] 渲染步骤标签行
├── styles/BatchProgressBar.scss    # [MODIFY] 新增步骤样式
└── index.vue                       # [MODIFY] 更新 runBatchWithProgress + 5 处调用点
```

## 设计风格

沿用现有 Codex UI 风格，日志区在现有行布局下方新增步骤标签行。步骤行缩进显示，使用更浅的透明度和更小字号（9px），与主日志行形成视觉层级区分。

## 布局

```
┌──────────────────────────────────────────────────────┐
│ ✓ 项目A                              1.2s            │
│   状态 200ms · HEAD 50ms · 日志 300ms · 分支 200ms   │
│ ✗ 项目B                              0.8s            │
│   状态 200ms · HEAD 50ms [失败: 网络超时]            │
└──────────────────────────────────────────────────────┘
```

## 步骤标签行

- 容器缩进 12px，与主行区分
- 步骤名 opacity 0.6，耗时 opacity 0.4，分隔符 `·` opacity 0.3
- 等宽字体 `$vp-mono`，字号 9px
- 步骤间用 `·` 分隔，自动换行