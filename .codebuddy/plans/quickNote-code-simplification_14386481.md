---
name: quickNote-code-simplification
overview: 对 quickNote 模块进行代码简化与去冗余，涉及串行锁提取、CSS 占位类统一、表单模式泛型化、类型文件拆分、构造参数优化、Tab 内容组件提取共 6 项改进。
todos:
  - id: split-types
    content: 拆分 types/index.ts 为 position.ts + data.ts，原文件改为 re-export
    status: completed
  - id: extract-persist-lock
    content: 提取 createPersistLock 共享函数到 utils.ts，三个 composable 去重串行锁
    status: completed
    dependencies:
      - split-types
  - id: remove-set-todos
    content: 将 useProjects.setTodos() 改为构造参数注入，移除 index.vue 中的中间调用
    status: completed
    dependencies:
      - extract-persist-lock
  - id: extract-tab-components
    content: 将 index.vue 四个 Tab 内容区拆分为独立组件（TodoTab/InspirationTab/ProjectTab/ReviewTab）
    status: completed
    dependencies:
      - remove-set-todos
  - id: css-dedup
    content: CSS 样式去重：index.scss 新增 %占位类，各子 SCSS 文件使用 @extend 替代重复样式
    status: completed
  - id: final-verify
    content: 全局搜索确认无残留引用，更新 README.md 记录重构变更
    status: completed
    dependencies:
      - extract-tab-components
      - css-dedup
---

## 需求概述

对 quickNote 速记功能模块进行代码简化重构，消除已识别出的冗余模式，减少逻辑复杂度，提升可维护性。

## 核心改动

### 1. 提取共享串行锁函数

3 个 composable（useProjects / useTodoList / useInspirations）中 persist() 函数的串行锁实现完全一致，提取为 utils.ts 中的 `createPersistLock()` 共享函数，每个 composable 从 ~15 行缩减为 1 行调用。

### 2. CSS 样式去重

图标操作按钮、品牌蓝色主按钮、取消按钮、辅助文字、空态提示等样式在多个 SCSS 文件中重复定义。在 index.scss 中使用 SCSS `%` 占位类统一定义，各子文件通过 `@extend` 复用。

### 3. 拆分 types/index.ts

将 213 行的 types/index.ts 拆分为 `types/position.ts`（位置相关类型与映射表）和 `types/data.ts`（数据模型类型与元数据映射表），原 index.ts 改为 re-export。所有外部导入路径不变，零破裂影响。

### 4. 消除 setTodos() 间接注入

useProjects 的 `setTodos(todosRef)` 中间方法改为构造参数 `useProjects(storage, todosRef?)`，移除冗余的中间调用。

### 5. index.vue Tab 内容区拆分

将 4 个 Tab 内容区（待办/灵感/项目/复盘）的模板与事件处理提取为独立组件，index.vue 仅负责面板壳层、composable 编排与定位/最小化逻辑。

## 技术方案

### 实现策略

采用"先基础后上层"的顺序：类型拆分 → 工具函数提取 → composable 去重 → index.vue 简化 → CSS 去重。每步可独立验证，互不阻塞。

### 核心改动详解

#### 1. 串行锁提取（utils.ts）

在 utils.ts 新增 `createPersistLock` 工厂函数：

```typescript
export function createPersistLock<T>(
  save: (data: T) => Promise<void>,
  load: () => Promise<T>,
  buildPayload: (data: T) => T,
): () => Promise<void> {
  let lock: Promise<void> = Promise.resolve()
  return async () => {
    lock = lock.catch(() => undefined).then(async () => {
      const data = await load()
      await save(buildPayload(data))
    })
    await lock
  }
}
```

三个 composable 在内部创建各自的 persist 闭包：

- useTodoList: `persist = createPersistLock(save, load, (d) => ({ ...d, todos: todos.value }))`
- useInspirations: `persist = createPersistLock(save, load, (d) => ({ ...d, inspirations: inspirations.value }))`
- useProjects: 稍复杂（可选传入 todos），但同样可复用

#### 2. types/index.ts 拆分策略

新建 `types/position.ts`，包含：QuickNotePosition、QuickNotePlacement、QuickNoteSettings、QUICK_NOTE_POSITIONS、POSITION_ALIGN_MAP、QuickNoteMinimizeAxis、POSITION_MINIMIZE_META。

新建 `types/data.ts`，包含：TodoPriority、ProjectStatus、TodoItem、InspirationItem、ProjectItem、AppData、TODO_PRIORITIES、PROJECT_STATUSES、PRIORITY_META、STATUS_META。

原 `types/index.ts` 缩为 re-export：

```typescript
export * from "./position"
export * from "./data"
```

外部 13 个文件的导入路径 `from "../types"` / `from "./types"` 无需任何改动。

#### 3. setTodos → 构造参数

useProjects 签名从 `useProjects(storage)` 改为 `useProjects(storage, todosRef?)`，todosRef 为可选参数（useWeeklyReview 调用时不传）。index.vue 中 `projectsApi.setTodos(todoList.todos)` 这行移除，改为初始化时传入。

#### 4. index.vue Tab 组件拆分

创建 4 个 Tab 组件，每个接收 props 注入所需数据与操作：

- **TodoTab.vue**：接收 `plugin, i18n, projects, todoGroups, doneTodos, isOverdue, projectNameOf, editingTodo, ...` 等 props，事件 emit 提交/取消/删除/编辑
- **InspirationTab.vue**：接收 `plugin, i18n, allTags, activeTag, filteredInspirations, ...` 等 props
- **ProjectTab.vue**：接收 `i18n, projects, visibleProjects, blockedProjects, editingProject, linkedTodosOf, projectProgressOf, ...` 等 props
- **ReviewTab.vue**：接收 `i18n, weekTotal, priorityDistribution, projectEffort, blockSummary` 等 props

index.vue 模板变为：

```html
<TodoTab v-if="activeTab === 'todo'" ... />
<InspirationTab v-else-if="activeTab === 'inspiration'" ... />
<ProjectTab v-else-if="activeTab === 'project'" ... />
<ReviewTab v-else ... />
```

#### 5. CSS @extend 去重

在 index.scss 中新增以下占位类：

| 占位类 | 用途 | 替换目标 |
| --- | --- | --- |
| `%qn-icon-btn-28` | 28×28 图标操作按钮 | `.qn-todo-form__icon-btn`、`.qn-insp-form__icon-btn` |
| `%qn-primary-btn` | 品牌蓝色主按钮 | 5 处 add-btn/save-btn |
| `%qn-cancel-btn` | 取消按钮（边框透明底） | TodoForm.scss、ProjectForm.scss 各 1 处 |
| `%qn-helper-text` | 辅助文字（2xs + variant） | 散落多处的重复声明 |
| `%qn-empty-state` | 空态提示（2xs/italic/opacity 0.6/center） | index.scss 两处 + WeeklyReview.scss 两处 |


各子 SCSS 文件将重复样式替换为 `@extend %xxx;` 仅保留差异属性。

### 性能考量

- 串行锁提取为闭包工厂函数，每次调用仅多一层函数包装，无运行时开销增加
- CSS @extend 在编译时展开，不增加运行时 CSS 体积
- Tab 组件拆分增加 4 个 SFC 文件，但每个文件职责单一，Vue 编译后无额外性能影响

### 风险控制

- types 拆分通过 re-export 保持导入路径不变，13 个引用文件零改动
- 串行锁函数签名需精确匹配现有行为（catch → undefined → then），确保并发安全不变
- Tab 组件拆分仅移动模板与事件处理代码，不变更数据流和业务逻辑
- 所有改动限于 quickNote 模块内部，不影响其他 feature