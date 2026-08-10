---
name: quicknote-code-review-fixes
overview: 修复 quickNote 模块审查中发现的 3 个严重问题、3 个高优先级问题，以及中优先级的死代码清理和类型统一。
todos:
  - id: fix-critical-todolist-projects
    content: 修复严重问题：useTodoList groupOf 崩溃 + useProjects remove 数据丢失 + persist 竞争条件；删除 toDateStr 死导出、generateId 重复代码、groupedByStatus 死代码
    status: completed
  - id: fix-use-inspirations
    content: 修复 useInspirations persist 竞争条件（加 _saveLock）+ 删除 generateId 重复代码
    status: completed
    dependencies:
      - fix-critical-todolist-projects
  - id: create-utils-and-fix-weeklyreview
    content: 新建 utils.ts（generateId + polishText）+ 修复 useWeeklyReview（weekStart ref+setInterval、死代码清理、颜色去硬编码、ReviewChartDatum/PrioritySlice 类型去重）
    status: completed
  - id: fix-components-redundancy
    content: 修复子组件冗余：TodoForm projectId 复位、ProjectForm submitLabel 删除、WeeklyReview effortChartData 删除、InspirationForm/InspirationItem 改用 polishText、ProjectItem 隐藏编辑按钮
    status: completed
    dependencies:
      - create-utils-and-fix-weeklyreview
  - id: fix-index-vue
    content: 修复 index.vue：删除代理函数改模板直接绑定 + weekStart 生命周期调用
    status: completed
    dependencies:
      - fix-critical-todolist-projects
      - create-utils-and-fix-weeklyreview
  - id: verify-tsc
    content: 运行 npx tsc --noEmit 验证 quickNote 模块 0 类型错误，更新工作记忆
    status: completed
    dependencies:
      - fix-index-vue
      - fix-components-redundancy
      - fix-use-inspirations
---

## 用户需求

修复 quickNote 模块代码审查发现的全部 12 个问题，包括运行时崩溃、数据丢失、功能缺陷、死代码、类型重复、代码冗余。所有修改仅限 quickNote 模块内部文件，不涉及注册链路改动。

## 修复范围（按严重度分组）

### 严重（3 项）

1. **`groupOf()` Null 引用崩溃**：空字符串 `dueDate` 未被 `!t.dueDate` 拦截，`parseDateStr("")` 返回 null，`due!` 断言后调用 `.getTime()` 崩溃
2. **`useProjects.remove()` 数据丢失**：删除项目时在内存中置空了关联待办的 `projectId`，但 `persist()` 只保存 `projects` 不保存 `todos`，下次 load 后旧值覆盖
3. **`weekStart` computed 永不过期**：computed 内部仅依赖 `new Date()`，无响应式依赖，跨周后不重新计算，导致"本周完成"统计锁死在上一周

### 高优（3 项）

4. **ProjectItem 编辑按钮无父组件监听**：`ProjectItem.vue` emit `edit` 但 `index.vue` 缺少 `@edit` 处理，点击无响应
5. **`generateId()` 三处复制粘贴**：`useTodoList.ts`、`useInspirations.ts`、`useProjects.ts` 各自定义完全相同的函数，违反项目 DRY 原则
6. **`persist()` 竞争条件**：三个 composable 共用 `loadOrDefault → save` 模式，快速双击操作可能读到旧数据丢失更新

### 中优（6 项）

7. **死代码清除**：`groupedByStatus`(useProjects)、`completedThisWeek`/`weekStart`(useWeeklyReview return 暴露)、`toDateStr` export(useTodoList)、`effortChartData` computed(WeeklyReview.vue)、`submitLabel` computed(ProjectForm.vue)
8. **类型去重**：`ReviewChartDatum`（useWeeklyReview）结构与 `ChartData`（Chart.vue）完全一致；`PrioritySlice` 类型冗余
9. **AI 润色逻辑重复**：InspirationForm 和 InspirationItem 中约 15 行"缓存原稿→清空→流式回填→失败恢复"完全相同
10. **代理函数精简**：index.vue 中 `handleTodoAdd`、`toggleTodoDone`、`rolloverTodo`、`handleProjectAdd`、`updateInsp` 为纯透传函数
11. **TodoForm 提交后 projectId 未复位**：content 和 dueDate 复位了，projectId 保留上次选择
12. **projectEffort 颜色硬编码**：`"#ef4444"` / `"#3b82f6"` 应使用 `STATUS_META`

## 技术方案

### 修复策略

**P1 — useTodoList 关键修复**

- `groupOf()`：第 173 行 `!t.dueDate` 改为 `!t.dueDate?.trim()`，阻止空字符串通过
- `isOverdue()`：第 158 行同理加 `.trim()` 防御
- `toDateStr`：去掉 `export`，仅模块内部使用
- 删除本地 `generateId()`，改为 import from `../utils`

**P2 — useProjects 关键修复**

- `remove()`：不再调用通用 `persist()`，改为直接 `loadOrDefault → save({ ...data, projects, todos: todosRef?.value })` 全量持久化，确保待办 projectId 置空同时写入存储
- `persist()`：添加 `_saveLock: Promise<void>` 链式队列，所有写操作串行化
- 删除本地 `generateId()`，改为 import from `../utils`
- 从 return 移除 `groupedByStatus`（无外部引用）

**P3 — useInspirations 关键修复**

- `persist()`：添加 `_saveLock` 链式队列
- 删除本地 `generateId()`，改为 import from `../utils`

**P4 — useWeeklyReview 关键修复**

- `weekStart`：从 `computed` 改为 `ref(Date.now())`，新增 `startWatch()` 用 `setInterval` 每 60s 刷新，`stopWatch()` 清理定时器
- 返回值新增 `startWatch` / `stopWatch`，移除 `weekStart` / `completedThisWeek`（不再暴露）
- `projectEffort`：颜色改为 `STATUS_META[proj.status]?.color ?? STATUS_META.active.color`
- 删除 `ReviewChartDatum` 类型，改用 `ChartData` from `@/components/Chart.vue`
- 删除 `PrioritySlice` 类型，`priorityDistribution` 直接标注 `ChartData[]`

**P5 — utils.ts 新建**

- export `generateId()`：`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
- export `polishText()`：接收 `polish(txt, onChunk)` 函数 + 原始文本 + 目标 ref + i18n，封装缓存原稿→清空→流式回填→失败恢复模式

**P6 — index.vue 修复**

- `onMounted` 中调 `review.startWatch()`，`onUnmounted` 中调 `review.stopWatch()`
- 删除代理函数 `handleTodoAdd`、`toggleTodoDone`、`rolloverTodo`、`handleProjectAdd`，模板直接绑定 composable 方法
- `updateInsp` 删除，模板改为 `@update="(c, t) => inspirations.update(item.id, c, t)"`
- 保留带 confirm 的 remove 函数

**P7 — 子组件修复**

- `ProjectItem.vue`：删除编辑按钮（`<!-- 编辑按钮 -->` 区块），降低困惑
- `ProjectForm.vue`：删除 `submitLabel` computed，模板直接 `{{ i18n.addProject }}`
- `TodoForm.vue`：`handleAdd()` 末尾加 `projectId.value = ""`
- `WeeklyReview.vue`：删除 `effortChartData` computed，模板 `:data` 直接传 `projectEffort`；import `ChartData` 无需 `ReviewChartDatum`
- `InspirationForm.vue`：`handlePolish()` 改为调用 `polishText(polish, content, i18n)` 辅助函数
- `InspirationItem.vue`：`handlePolishEdit()` 改为调用 `polishText(polish, editDraft, i18n)` 辅助函数

### persist 竞争条件修复模式

每个 composable 的 `persist()` 添加 `_saveLock` 变量：

```ts
// 写法示例（useTodoList）
let _saveLock: Promise<void> = Promise.resolve()

const persist = async () => {
  _saveLock = _saveLock.then(async () => {
    const data = await storage.data.loadOrDefault()
    await storage.data.save({ ...data, todos: todos.value })
  })
  await _saveLock
}
```

useProjects 因为 `remove()` 需要同时保存两个槽位，不做通用 persist 加锁，改为直接在 remove 内部 `read-modify-write`。

### 验证要点

- `npx tsc --noEmit` 过滤 quickNote，确保 0 类型错误
- 中英文 i18n 键对齐（无新增 key，仅删除死引用）
- 图标无新增，不需要运行 validate:icons