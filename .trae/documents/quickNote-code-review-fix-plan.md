# quickNote 功能代码审查与修复计划

## 一、审查结论总览

对 `src/features/quickNote/` 全量 30+ 文件（入口 Manager、5 个 composable、12 个组件、样式、类型、i18n、注册链）逐一审查，结论如下：

| 类别 | 数量 | 明细 |
|------|------|------|
| 逻辑漏洞 | 4 | A1 聚焦区逾期恒空（产品决策：改为今日+逾期）、A2 autoOpen 开关滞后一次重启、A3 编辑保存不 trim、A4 裸定时器违规 |
| 内存泄露 | 0 | window 监听/interval/拖拽监听/injectStyle 均配对清理；仅 60s 周刷新在非复盘 Tab 空转（纳入 B1 优化） |
| 死代码/冗余 | 3 | C1 `groupOf` 无外部消费者、C2 i18n 死键 `polishing`、C3 `registerQuickNote` 返回值无消费者 |
| 重复类型 | 3 | D1/D2 Todo/Project submit payload 内联类型双处重复、D3 ChartDatum 与 Chart.vue ChartData 结构重复 |
| UI 布局 | 3 | E1 TodoForm 按钮居中悬空、E2 TodayFocus 无高度上限、E3 `padding: $spacing-1 $spacing-1` 冗余写法 |

内存泄露专项确认（无问题，仅记录）：
- `index.vue` onUnmounted 清理 window click / quickNoteMaskMinimize 监听 ✅
- `useWeeklyReview.stopWatch` 清理 interval，Manager.destroy 兜底 ✅
- `QuickNoteManager.destroy` 清理 dragCleanup + removeStyle + modal.destroy ✅

---

## 二、修复方案（逐项，决策已完成）

### A. 逻辑漏洞

#### A1. 聚焦区改为「今日到期 + 逾期」合并展示（用户已确认方案）

**问题**：`useTodoList.load()` 中 `rolloverOverdue` 在加载时把所有逾期未完成任务的 `dueDate` 改为今天，导致 `overdueTodos`（判定 `dueDate < today`）恒为空，「今天要处理的」聚焦区的逾期区块成为死 UI，仅卡住项目生效。

**修改**：
1. `composables/useTodoList.ts`
   - 新增导出类型 `TodoFocusItem = TodoItem & { overdue: boolean }`
   - 将 `overdueTodos` computed 改名/重写为 `todayFocus`：
     ```ts
     const todayFocus = computed<TodoFocusItem[]>(() =>
       todos.value
         .filter((t) => !t.done && t.dueDate?.trim() && (isOverdue(t) || t.dueDate === toDateStr(new Date())))
         .map((t) => ({ ...t, overdue: isOverdue(t) }))
         .sort((a, b) => {
           if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
           return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
         }),
     )
     ```
   - return 中 `overdueTodos` → `todayFocus`（`isOverdue` 导出保留，TodoTab 条目样式仍用）
2. `index.vue`（主面板）：`overdueTodos` → `todayFocus`，TodayFocus 传参同步改名
3. `components/today/TodayFocus.vue`
   - props：`overdueTodos: TodoItem[]` → `focusTodos: TodoFocusItem[]`（从 `../../types` 或 composable 导入类型）
   - `totalCount` 改用 `props.focusTodos.length`
   - 模板循环 `v-for="todo in focusTodos"`；逾期项 due 日期加红色变体 `:class="{ 'qn-today-focus__due--overdue': todo.overdue }"`
4. `styles/TodayFocus.scss`：新增 `.qn-today-focus__due--overdue { color: var(--b3-card-error-color); }`
5. i18n：`todayFocus` 文案「今天要处理的」保持不变（语义兼容今日+逾期）
6. `README.md`（quickNote/）：若描述提及「逾期任务」，同步更新为「今日到期 + 逾期」

#### A2. 「启动时自动打开」开关滞后一次重启

**问题**：`registerQuickNote` 在 `onload` 同步阶段读取 `(plugin as any).settings?.enableQuickNoteAutoOpen`，此时 `settings` = 默认值 + feature-flags.json；而 `updateSettings()`（src/index.ts:265）保存新配置后**不调用** `saveFeatureFlagsSync`，flags 文件要到下次启动 `loadAndApplySettings`（src/index.ts:167）才刷新 → 用户切换 autoOpen 后需重启两次才生效。

**修改**：`src/index.ts` `updateSettings()` 中 `saveSettings` 成功分支追加一行 `saveFeatureFlagsSync(this.settings)`（全局受益，所有依赖 flags 的子开关一致修复）。

#### A3. 编辑保存不 trim（与新增不一致）

**问题**：`useTodoList.add` trim content，但 `update` 的 patch.content 直接 `Object.assign`；`useProjects` 同样（add trim、update 不 trim）。`useInspirations.update` 已 trim。

**修改**：
- `useTodoList.update`：`if (patch.content !== undefined) patch = { ...patch, content: patch.content.trim() }`（注意不 mutate 入参）
- `useProjects.update`：对 `name`/`currentStep`/`nextStep`/`blockers` 存在时逐一 trim

#### A4. 裸定时器违反 TimerRegistry 强制规则

**问题**：AGENTS_API 硬规则「定时任务统一入口 `@/utils/timerRegistry`，禁止裸 setInterval/setTimeout」：
- `useWeeklyReview.ts:54` 裸 `setInterval`
- `index.ts:235`（Manager.startDrag onUp）裸 `setTimeout(0)`

**修改**：
- `useWeeklyReview.ts`：`TimerRegistry.setInterval(...)` / `TimerRegistry.clear(watchTimer)`（句柄类型 `TimerHandle`）
- `index.ts`：`TimerRegistry.setTimeout(() => { this.dragMoved = false }, 0)`

### B. 内存泄露优化（非泄露，减少空转）

#### B1. 周刷新 interval 仅在复盘 Tab 激活时运行

**现状**：`review.startWatch()` 在面板 onMounted 启动，persistent Modal 存活期间每 60s 空转（即使停留在待办 Tab）。

**修改**：`index.vue`
- 移除 onMounted 中的 `review.startWatch()`
- 新增 `watch(activeTab, (tab) => tab === "review" ? review.startWatch() : review.stopWatch())`
- onUnmounted 保留 `review.stopWatch()` 兜底
- `weekStart` 初始值 `getWeekStart()` 已正确，未启动 interval 时统计同样准确

### C. 死代码 / 冗余

| # | 问题 | 修改 |
|---|------|------|
| C1 | `useTodoList` 导出 `groupOf` 无任何外部消费者（grep 全仓确认） | 从 return 对象移除（内部继续使用） |
| C2 | i18n 死键 `polishing`（"正在润色…"），三个表单模板均未引用，仅按钮 disabled | 从 `src/i18n/{zh_CN,en_US}/quickNote.json` 删除，跑 `pnpm i18n:merge` |
| C3 | `registerQuickNote(plugin): QuickNoteManager` 返回值无消费者（src/index.ts:258 未接收） | 签名改为 `: void`，函数体去掉 `return manager` |

### D. 重复类型

#### D1/D2. Submit payload 内联类型双处重复

**问题**：`TodoForm.vue` emits 与 `TodoTab.vue handleTodoSubmit` 各自内联定义完全相同的 payload 类型；ProjectForm/ProjectTab 同样。

**修改**：`types/data.ts` 新增：
```ts
/** 待办表单提交载荷（新增无 id，编辑携带 id） */
export interface TodoSubmitPayload {
  id?: string
  content: string
  priority: TodoPriority
  dueDate: string | null
  projectId: string | null
}
/** 项目表单提交载荷 */
export interface ProjectSubmitPayload {
  id?: string
  name: string
  status: ProjectStatus
  currentStep: string
  nextStep: string
  blockers: string
}
```
四个组件的 emits/参数类型改为引用上述类型。

#### D3. ChartDatum 与 Chart.vue ChartData 结构重复

**问题**：`useWeeklyReview.ts` 因「.ts 不能导入 .vue 类型」手工复制 `ChartDatum` 结构（文件头注释已自述）。

**修改**：
1. 新建 `src/components/chart.types.ts`：迁入 `ChartData` / `ChartOptions` 接口定义
2. `Chart.vue`：从 `./chart.types` import 并保留 `export type { ChartData, ChartOptions }` re-export（既有 `import type { ChartData } from "@/components/Chart.vue"` 的其他功能不受影响）
3. `useWeeklyReview.ts`：删除本地 `ChartDatum`，`import type { ChartData } from "@/components/chart.types"`

### E. UI 布局优化

| # | 问题 | 修改 |
|---|------|------|
| E1 | TodoForm 首行 textarea(2 行) + 按钮组垂直居中，按钮悬空于两行高度中间 | `styles/TodoForm.scss`：第一行加 modifier `qn-todo-form__row--top`（`align-items: flex-end`，按钮贴 textarea 底沿），TodoForm.vue 模板第一行挂该类 |
| E2 | TodayFocus 列表无高度上限，大量条目挤压下方 Tab 区 | `styles/TodayFocus.scss`：`.qn-today-focus__list { max-height: 108px; overflow-y: auto; }`（约 4 条视口） |
| E3 | `.panel-tab { padding: $spacing-1 $spacing-1 }` 冗余写法 | 简写为 `padding: $spacing-1;` |

---

## 三、实施顺序

1. 类型层：`types/data.ts` 新增 D1/D2 payload 类型 → `src/components/chart.types.ts` 抽取 D3（含 Chart.vue 改造）
2. composable 层：`useTodoList.ts`（A1 todayFocus、A3 trim、C1 移除 groupOf）→ `useProjects.ts`（A3 trim）→ `useWeeklyReview.ts`（A4 TimerRegistry、D3 类型替换）
3. 组件层：`TodoForm.vue`/`TodoTab.vue`/`ProjectForm.vue`/`ProjectTab.vue`（D1/D2 类型引用 + E1 modifier）→ `TodayFocus.vue`（A1 props）→ `index.vue`（A1 传参、B1 watch activeTab）
4. Manager 层：`index.ts`（A4 TimerRegistry.setTimeout、C3 返回值 void）
5. 全局：`src/index.ts` `updateSettings` 补 `saveFeatureFlagsSync`（A2）
6. 样式：`TodoForm.scss`/`TodayFocus.scss`/`index.scss`（E1/E2/E3）
7. i18n：删除 `polishing` 死键（zh/en 分片）→ `pnpm i18n:merge`
8. 文档：`quickNote/README.md` 聚焦区描述同步

## 四、验证

用户自行执行（AI 不运行 lint/build）：
```bash
pnpm i18n:verify
npx tsc --noEmit
pnpm lint
```

手动验证点：
- 新增待办：Enter 换行、Ctrl+Enter 添加；编辑待办内容首尾空格被 trim
- 聚焦区：手动把某待办日期改为过去 → 顶部红色显示且排前；今天到期任务正常显示；完成后从聚焦区消失
- 复盘 Tab：进入/离开 Tab 时 60s 定时器启停（console 断点或行为观察）；跨周数字正确
- 设置面板切换「启动时自动打开」→ 重启一次即生效（A2）
- 灵感/项目表单行为不变；Chart 图表渲染不变（re-export 兼容）
