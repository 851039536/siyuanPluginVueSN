# 速记（quickNote）

日常待办、灵感收集、项目跟进与每周复盘的综合工作面板。保持 persistent Modal 弹窗形态，白底蓝绿商务风格，顶部固定「今天要处理的」聚焦视图自动汇总今日到期/逾期任务与卡点项目。

## 功能

### 今天要处理的（顶部固定）

- 今日到期与逾期未完成的任务红字标出，逾期项截止日期加粗强调，逾期项排前
- 状态为「卡住」的项目列出来标红，提示当前卡点
- 无紧急事项时显示绿色柔和提示

### 今天待办

- 添加任务时填写内容、选择优先级（紧急/高/中/低）、设置截止日期、关联项目
- 完成任务打勾标记，已完成任务灰显删除线
- 过期未做任务整行标红，提供「一键顺延到明天」按钮（累计顺延次数）
- 未来任务按日期分组（今天/明天/本周/更远）
- 昨天未完成任务启动时自动顺延到今天（每日一次，`lastRolloverDate` 防重复）

> **注意**：每日自动顺延会把逾期项的截止日期改写为今天，因此**次日打开时该任务通常已不再标红**（仅保留「已顺延 N」计数）。
> 逾期红字与「顺延到明天」按钮只在守卫窗口内可见：即当天已过期、但尚未被自动顺延的任务（同一会话内跨天亦可触发，见下）。

### 灵感速记

- 随手记录想法（保留 AI 润色能力，流式回填）
- 支持为每条灵感添加多个标签（逗号/顿号/空格分隔）
- 标签筛选栏按标签过滤灵感列表

### 项目跟进

- 记录项目名称、当前进度、下一步计划、卡点描述
- 三种状态：进行中 / 已完成 / 卡住（卡住态红色左边框强调）
- 任务可挂载到项目下（TodoItem 关联 projectId）
- 项目卡片显示关联待办的完成进度条（已完成数/总数），可展开查看关联待办

### 每周复盘

- 周切换头：← 更早 / → 更近，可回看本周及最近 7 周历史（纯派生，从待办 doneAt 实时回溯，无快照存储）
- 统计卡片行：本期完成数、环比上周（升绿/降红/持平灰）、日均完成
- 优先级分布环形图（所选周紧急/高/中/低各完成多少）
- 项目精力分布条形图（所选周各项目关联待办完成数）
- 卡点汇总清单（实时状态快照，带「当前」徽章标注，非所选周历史）

> `weekOffset` 语义：**0 = 本周，递增 = 更早**。周界由 `getWeekStart(offset, now)` 按 offset 向前减 7 天求得，
> 结果恒为周一零点；周日归入其所在周的末尾（`day === 0` 归一化为 7）。该函数在 `pureUtils.spec.ts` 有边界用例覆盖。

## 视觉风格

白底简洁商务风格，蓝绿色主色调（`$color-info` 蓝 + `$color-success` 绿），页头使用克制 CSS 渐变配图（蓝→绿 135° 对角，叠加半透明白），不喧宾夺主。数据可视化使用项目通用 `Chart.vue` 组件（Chart.js 内核）。

## 目录职责

```
quickNote/
├── index.ts                    # QuickNoteManager（persistent Modal 生命周期 + 位置/拖拽/最小化应用）+ registerQuickNote
├── index.vue                   # 弹窗主面板壳层（TodayFocus 聚焦区 + 四大 Tab 导航 + 定位/最小化逻辑 + composable 编排）
├── pureUtils.ts                # 无依赖纯函数（日期换算 / 周界计算 / 标签拆分 / 逾期判定 / 每日顺延），可直接单测
├── pureUtils.spec.ts           # 上述纯函数的单元测试（45 例）
├── utils.ts                    # generateId / createPersistLock 串行锁 / polishText 润色回填辅助
├── components/
│   ├── today/TodayFocus.vue    # 「今天要处理的」今日到期/逾期任务 + 卡住项目标红列表
│   ├── todo/TodoTab.vue        # 待办 Tab（表单 + 分组列表 + 已完成列表，持有编辑中状态）
│   ├── todo/TodoItem.vue       # 待办单条目（优先级色条/逾期标红/顺延按钮）
│   ├── todo/TodoForm.vue       # 待办新增/编辑表单（优先级/截止日期/关联项目，编辑态由 editingTodo prop 切换）
│   ├── inspiration/InspirationTab.vue  # 灵感 Tab（表单 + 筛选栏 + 列表，标签筛选状态在此）
│   ├── inspiration/InspirationItem.vue  # 灵感单条目（标签/编辑态 AI 润色）
│   ├── inspiration/InspirationForm.vue  # 灵感新增表单 + 标签筛选栏
│   ├── project/ProjectTab.vue  # 项目 Tab（表单 + 卡片列表，持有编辑中状态）
│   ├── project/ProjectItem.vue # 项目卡片（状态徽章/进度条/关联待办折叠）
│   ├── project/ProjectForm.vue # 项目新增/编辑表单
│   ├── review/ReviewTab.vue    # 复盘 Tab（透传 useWeeklyReview 周切换派生数据）
│   └── review/WeeklyReview.vue # 每周复盘（周切换头 + 统计卡片行 + 环形图 + 条形图 + 卡点清单）
├── composables/
│   ├── useAiPolish.ts          # AI 润色：并发锁 + API Key 校验 + callAISmart 流式 + 错误码（**仅在 index.vue 实例化一次**）
│   ├── useTodoList.ts          # 待办 CRUD + 每日自动顺延 + 逾期检测 + 日期分组 + 日期基准校准
│   ├── useInspirations.ts      # 灵感 CRUD + 标签筛选
│   ├── useProjects.ts          # 项目 CRUD + 关联待办进度计算 + 卡住筛选（todosRef 构造参数注入）
│   └── useWeeklyReview.ts      # 复盘周切换纯派生（weekOffset 回溯任意周统计 + 卡点汇总）
├── types/
│   ├── index.ts                # 类型入口（re-export position + data，外部导入路径不变）
│   ├── position.ts             # 弹窗位置类型 + 位置 → 对齐/最小化方向映射表
│   ├── data.ts                 # 待办/灵感/项目数据模型 + 优先级/状态元数据映射表
│   └── storage.ts              # QuickNoteStorage（data + settings 两个槽位）
└── styles/
    ├── index.scss              # 面板壳 + Tab 导航 + 分组列表 + 共享 %占位类（icon-btn/primary-btn/cancel-btn/helper-text/empty-state）
    ├── TodayFocus.scss         # 「今天要处理的」聚焦区
    ├── TodoItem.scss / TodoForm.scss
    ├── InspirationItem.scss / InspirationForm.scss
    ├── ProjectItem.scss / ProjectForm.scss
    └── WeeklyReview.scss
```

## 分层约定

子组件**不得**自行导入 composable 编排业务逻辑（见 `AGENTS_ARCH.md § 禁止将逻辑下放给子组件`）。
AI 润色是本模块唯一的跨组件逻辑，按此约定处理：

```
index.vue  useAiPolish(plugin)  →  { polishing, polish }
   ├─→ TodoTab  → TodoForm                              （props 透传）
   └─→ InspirationTab → InspirationForm / InspirationItem（props 透传）
```

单实例的收益：`polishing` 并发锁跨入口生效。若各子组件各自 `useAiPolish`，会得到多个互不相知的
`polishing` ref，用户可在润色进行中从另一入口再次发起请求，锁形同虚设。

## 日期基准与跨天刷新

`useTodoList` 的「今天/明天」分组、逾期红字均派生自内部 `now` ref（而非在 computed 里直接
`new Date()`），并导出 `refreshNow()` 校准。这是因为弹窗为 persistent Modal 常驻不销毁，
而 `computed` 只在依赖的响应式数据变化时重算——若不加校准，面板跨过午夜后分组与逾期状态会停留在前一天。

当前校准时机：`load()` 与切入「待办」Tab 时。`useWeeklyReview` 用同样的 `refreshNow()` 模式处理周界。

## 数据模型与自动顺延

统一存储槽 `quick-note-data`（`AppData`）包含 `todos` / `inspirations` / `projects` 三个数组与 `lastRolloverDate`。

自动顺延在 `useTodoList.load()` 中执行：读取 `lastRolloverDate` 与今天对比，非今天则将已逾期未完成任务顺延到今天并累计 `rolloverCount`，更新 `lastRolloverDate` 后持久化，保证每天首次打开弹窗时自动顺延一次。

## 位置与拖拽机制

`createModalVueApp` 的遮罩层是全屏 fixed flex 容器（默认居中）。定位分两种模式：

- **五档预设**：Manager 的 `applyPosition()` 按 `POSITION_ALIGN_MAP` 改写遮罩
  `align-items` / `justify-content` 实现贴边/居中，贴边档位附加边缘间距
- **custom 自定义**：拖拽产生，容器绝对定位到 `customX/customY`（视口坐标，应用时 clamp 到视口内）

拖拽由 `startDrag()` 驱动；`consumeDragClick()` 供小条 click 护栏吞掉拖拽后的误触点击。
该实现与 `vueAppHelper` 的遮罩 DOM 结构耦合，helper 重构时需同步调整。

## 恢复兜底

弹窗被拖到异常位置（如顶部）导致无法点击/拖动时，可打开状态栏「功能列表」抽屉，点击「速记恢复」条目，
派发 `resetQuickNote` 事件，经 App.vue 调度调用 `QuickNoteManager.reset()`：
将定位重置为居中、清除自定义坐标与绝对定位残留、退出最小化，持久化后重新应用展开态。

## 最小化机制

最小化方向由当前定位派生（`POSITION_MINIMIZE_META`）。Manager 的 `setMinimized()` 将容器尺寸改为 `auto`，
遮罩设为透明 + `pointer-events: none` 实现点击穿透；展开时还原尺寸与遮罩。最小化状态持久化。
自定义定位下最小化时，会清除拖拽产生的 absolute 定位内联样式，小条以横条形态贴最左边缘垂直居中
（customX/customY 缓存保留，展开时 `applyPosition()` 仍还原原拖拽坐标）。

## 联动链路

```
statusBar FEATURES 条目 → emitCustomEvent("toggleQuickNote")
  → App.vue onMounted 监听 → plugin.__quickNote.toggle()

statusBar「速记恢复」抽屉条目 → emitCustomEvent("resetQuickNote")
  → App.vue onMounted 监听 → plugin.__quickNote.reset()
```

## 存储

| 键 | 内容 |
|------|------|
| `quick-note-data` | 统一数据（`AppData`：待办/灵感/项目/顺延记录） |
| `quick-note-settings` | 功能设置（`{ position, customX, customY, minimized }`，对象浅合并兜底未来字段） |

> 注：重构后数据从 `quick-note-items` 升级为 `quick-note-data`（结构完全不同），旧数据不做迁移。
