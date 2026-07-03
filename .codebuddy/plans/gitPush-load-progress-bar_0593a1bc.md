---
name: gitPush-load-progress-bar
overview: 新增底部加载进度条，在批量刷新/加载时显示"正在加载 3/12"等进度信息，让用户感知加载进度。
todos:
  - id: add-progress-state
    content: 在 index.vue 中新增 LoadProgress 接口、loadProgress ref、startLoadProgress/advanceLoadProgress/endLoadProgress 三个函数、runBatchWithProgress 包装函数
    status: completed
  - id: replace-template-progress
    content: 替换模板中 gp-progress-bar 简易进度条为带标签/项目名的 gp-load-progress 进度条组件
    status: completed
    dependencies:
      - add-progress-state
  - id: wrap-batch-calls
    content: 改造 4 个 batchProcess 调用点为 runBatchWithProgress（onMounted、watch(activeCategory)、watch(currentView)、silentRefreshAll）
    status: completed
    dependencies:
      - add-progress-state
  - id: add-progress-styles
    content: 在 styles/index.scss 新增 .gp-load-progress 样式（标签 + 进度条轨道/填充 + 项目名）
    status: completed
    dependencies:
      - replace-template-progress
  - id: verify-progress
    content: 验证：pnpm lint + npx tsc --noEmit，确保零错误
    status: completed
    dependencies:
      - wrap-batch-calls
      - add-progress-styles
---

## 用户需求

用户反馈批量加载 git 项目数据时看不到具体进度——不知道当前加载到哪个项目、还有多少项目未加载。需要实现一个进度条控件，在批量加载时显示"加载中 3/12"格式的进度信息和当前项目名称。

## 核心功能

- 在面板底部显示进度条，格式为 `加载中 3/12` + 进度条 + 可选当前项目名
- 仅在批量加载项目数超过 3 个时显示进度条（避免单个项目闪烁）
- 进度条宽度按 `current/total` 比例动态变化，过渡动画 0.3s
- 覆盖 4 个批量加载场景：首屏加载、分类切换、统计视图切换、全局刷新
- 加载完成后进度条自动隐藏

## 技术方案

### 实现策略

采用**最小侵入**策略：不修改 `batchProcess` 工具函数本身（保持其通用性），而是在 `index.vue` 中新增 `runBatchWithProgress()` 包装函数，在 `batchProcess` 每次迭代时调用 `advanceLoadProgress()` 推进进度。

### 核心数据结构

```ts
interface LoadProgress {
  visible: boolean      // 进度条是否可见
  current: number       // 当前已完成项目数
  total: number         // 总项目数
  label: string         // 状态标签（如 "加载中"、"刷新中"）
  projectName?: string  // 当前正在加载的项目名
}
```

### 进度管理函数

三个轻量函数管理进度生命周期：

- `startLoadProgress(total, label)` — 初始化进度，visible = true
- `advanceLoadProgress(projectName?)` — current++，更新项目名
- `endLoadProgress()` — visible = false，重置状态

### 包装函数 runBatchWithProgress

```ts
async function runBatchWithProgress<T>(
  items: T[], label: string, fn: (item: T) => Promise<void>, getName?: (item: T) => string
) {
  if (items.length <= 3) { await batchProcess(items, 3, fn); return }  // 少项目跳过进度
  startLoadProgress(items.length, label)
  let i = 0
  await batchProcess(items, 3, async (item) => {
    await fn(item)
    i++
    advanceLoadProgress(getName?.(item))
  })
  endLoadProgress()
}
```

### 4 个调用点改造

| 调用点 | 当前写法 | 改造后 |
| --- | --- | --- |
| onMounted:1269 | `await batchProcess(projList, 3, async (p) => {...})` | `await runBatchWithProgress(projList, "加载中", async (p) => {...}, p=>p.name)` |
| watch(activeCategory):1310 | `await batchProcess(pending, 3, ...)` | `await runBatchWithProgress(pending, "加载中", ..., p=>p.name)` |
| watch(currentView):1327 | `await batchProcess(pending, 3, ...)` | `await runBatchWithProgress(pending, "加载中", ..., p=>p.name)` |
| silentRefreshAll:1224 | `await batchProcess(projList, 3, ...)` | `await runBatchWithProgress(projList, "刷新中", ..., p=>p.name)` |


### 模板改造

将现有的简易进度条（L29-32）替换为带信息展示的进度条：

```html
<div v-if="loadProgress.visible" class="gp-load-progress">
  <span class="gp-load-progress-label">{{ loadProgress.label }} {{ loadProgress.current }}/{{ loadProgress.total }}</span>
  <div class="gp-load-progress-bar">
    <div class="gp-load-progress-fill" :style="{ width: (loadProgress.current / loadProgress.total * 100) + '%' }" />
  </div>
  <span v-if="loadProgress.projectName" class="gp-load-progress-name">{{ loadProgress.projectName }}</span>
</div>
```

### SCSS 样式

复用项目已有的设计 Token 和 Codex 风格：

- 容器：flex 布局，gap: $spacing-2，padding: 4px 8px，border-top: 1px solid var(--b3-border-color)
- 标签：font-size: 10px，opacity: 0.6，font-family: $vp-mono
- 进度条轨道：flex: 1，height: 3px，background: var(--b3-theme-surface)，border-radius: $radius-sm
- 进度条填充：height: 100%，background: var(--b3-theme-primary)，border-radius: inherit，transition: width 0.3s ease
- 项目名：font-size: 10px，opacity: 0.5，@include text-ellipsis，max-width: 120px

### 性能考量

- 进度条使用 CSS transition 而非 requestAnimationFrame，零 JS 开销
- `items.length <= 3` 时跳过进度显示，避免批次数 1 时闪烁
- `advanceLoadProgress` 仅做 `ref.value` 赋值，不触发批量 DOM 更新