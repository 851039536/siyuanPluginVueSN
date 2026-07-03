---
name: gitpush-progress-elapsed-timer
overview: 在 GitPush 批量加载进度条右侧增加已用秒数实时计时器，显示如 "12.3s"
todos:
  - id: extend-interface-add-timer
    content: 扩展 LoadProgress 接口新增 elapsedSeconds 字段，新增 progressTimer 变量，改造 startLoadProgress/endLoadProgress 函数，移除 runBatchWithProgress 中 400ms setTimeout 和 Date.now
    status: completed
  - id: add-template-time
    content: 模板新增 gp-load-progress-time span 显示 elapsedSeconds.toFixed(1) + "s"
    status: completed
  - id: add-scss-time
    content: styles/index.scss 新增 .gp-load-progress-time 样式
    status: completed
  - id: verify
    content: 验证：pnpm lint + npx tsc --noEmit
    status: completed
    dependencies:
      - extend-interface-add-timer
      - add-template-time
      - add-scss-time
---

## 用户需求

在 gitPush 批量加载进度条上增加实时秒数计时器，显示如 "3.2s" 格式的已过时间。

## 核心功能

- 进度条启动时自动开始计时，精确到 0.1 秒
- 模板显示 "X.Xs" 格式的计时文本
- 使用 setInterval 替代原有的 400ms 硬编码最小展示延迟，计时器自然覆盖进度条存活时间

## 技术栈

- Vue 3 响应式系统 (ref)
- TypeScript 接口扩展
- SCSS (Codex 风格)

## 实现方案

### 核心思路

在 `LoadProgress` 接口新增 `elapsedSeconds` 字段，用模块级 `setInterval` 每 100ms 自增 0.1。模板中新增 `<span>` 渲染 `elapsedSeconds.toFixed(1) + "s"`。由于 setInterval 持续推动进度条可见时长，`runBatchWithProgress` 中 400ms 硬编码 setTimeout 可安全移除。

### 变更文件（2 个）

1. **index.vue** — 接口扩展 + timer 变量 + 函数改造 + 模板新增时间 span + 移除 runBatchWithProgress 中的 setTimeout/Date.now
2. **styles/index.scss** — 新增 `.gp-load-progress-time` 等宽字体样式

### 关键决策

- **精度 0.1s**：100ms 间隔足够视觉流畅，不产生明显 CPU 开销
- **移除 400ms setTimeout**：计时器本身让进度条可见满 400ms 后才 `endLoadProgress`，不再需要额外延迟
- **keep startTime**：`startLoadProgress` 中记录 `Date.now()` 起始值，`endLoadProgress` 中计算 elapsed 用于决定是否需要额外停留（保持进度条至少可见一瞬间）