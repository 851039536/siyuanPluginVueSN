# 速记（quickNote）

日常待办、灵感收集、项目跟进与每周复盘的综合工作面板。保持 persistent Modal 弹窗形态，白底蓝绿商务风格，顶部固定「今天要处理的」聚焦视图自动汇总逾期任务与卡点项目。

## 功能

### 今天要处理的（顶部固定）

- 逾期未完成的任务红字标出，显示截止日期与优先级
- 状态为「卡住」的项目列出来标红，提示当前卡点
- 无紧急事项时显示绿色柔和提示

### 今天待办

- 添加任务时填写内容、选择优先级（紧急/高/中/低）、设置截止日期、关联项目
- 完成任务打勾标记，已完成任务灰显删除线
- 过期未做任务整行标红，提供「一键顺延到明天」按钮（累计顺延次数）
- 未来任务按日期分组（今天/明天/本周/更远）
- 昨天未完成任务启动时自动顺延到今天（每日一次，`lastRolloverDate` 防重复）

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

- 展示本周完成事项数量（数字卡片）
- 优先级分布环形图（紧急/高/中/低各完成多少）
- 项目精力分布条形图（各项目关联待办完成数）
- 卡点汇总清单（所有项目的 blocker 汇总）

## 视觉风格

白底简洁商务风格，蓝绿色主色调（`$brand-info` 蓝 + `$brand-success` 绿），页头使用克制 CSS 渐变配图（蓝→绿 135° 对角，叠加半透明白），不喧宾夺主。数据可视化使用项目通用 `Chart.vue` 组件（Chart.js 内核）。

## 目录职责

```
quickNote/
├── index.ts                    # QuickNoteManager（persistent Modal 生命周期 + 位置/拖拽/最小化应用）+ registerQuickNote
├── index.vue                   # 弹窗主面板壳层（TodayFocus 聚焦区 + 四大 Tab 导航 + 定位/最小化逻辑）
├── utils.ts                    # generateId / createPersistLock 串行锁 / polishText 润色回填辅助
├── components/
│   ├── today/TodayFocus.vue    # 「今天要处理的」逾期任务 + 卡住项目标红列表
│   ├── todo/TodoTab.vue        # 待办 Tab（表单 + 分组列表 + 已完成列表，持有编辑中状态）
│   ├── todo/TodoItem.vue       # 待办单条目（优先级色条/逾期标红/顺延按钮）
│   ├── todo/TodoForm.vue       # 待办新增表单（优先级/截止日期/关联项目）
│   ├── inspiration/InspirationTab.vue  # 灵感 Tab（表单 + 筛选栏 + 列表，标签筛选状态在此）
│   ├── inspiration/InspirationItem.vue  # 灵感单条目（标签/编辑态 AI 润色）
│   ├── inspiration/InspirationForm.vue  # 灵感新增表单 + 标签筛选栏
│   ├── project/ProjectTab.vue  # 项目 Tab（表单 + 卡片列表，持有编辑中状态）
│   ├── project/ProjectItem.vue # 项目卡片（状态徽章/进度条/关联待办折叠）
│   ├── project/ProjectForm.vue # 项目新增表单
│   ├── review/ReviewTab.vue    # 复盘 Tab（透传 useWeeklyReview 派生数据）
│   └── review/WeeklyReview.vue # 每周复盘（数字卡片 + 环形图 + 条形图 + 卡点清单）
├── composables/
│   ├── useAiPolish.ts          # AI 润色：并发锁 + API Key 校验 + callAISmart 流式 + 错误码
│   ├── useTodoList.ts          # 待办 CRUD + 每日自动顺延 + 逾期检测 + 日期分组
│   ├── useInspirations.ts      # 灵感 CRUD + 标签提取/筛选
│   ├── useProjects.ts          # 项目 CRUD + 关联待办进度计算 + 卡住筛选（todosRef 构造参数注入）
│   └── useWeeklyReview.ts      # 复盘纯计算派生（图表数据 + 卡点汇总）
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

弹窗被拖到异常位置（如顶部）导致无法点击/拖动时，状态栏提供独立的「恢复默认位置」按钮（仅在速记功能启用时显示），
点击派发 `resetQuickNote` 事件，经 App.vue 调度调用 `QuickNoteManager.reset()`：
将定位重置为居中、清除自定义坐标与绝对定位残留、退出最小化，持久化后重新应用展开态。

## 最小化机制

最小化方向由当前定位派生（`POSITION_MINIMIZE_META`）。Manager 的 `setMinimized()` 将容器尺寸改为 `auto`，
遮罩设为透明 + `pointer-events: none` 实现点击穿透；展开时还原尺寸与遮罩。最小化状态持久化。

## 联动链路

```
statusBar FEATURES 条目 → emitCustomEvent("toggleQuickNote")
  → App.vue onMounted 监听 → plugin.__quickNote.toggle()

statusBar 恢复按钮 → emitCustomEvent("resetQuickNote")
  → App.vue onMounted 监听 → plugin.__quickNote.reset()
```

## 存储

| 键 | 内容 |
|------|------|
| `quick-note-data` | 统一数据（`AppData`：待办/灵感/项目/顺延记录） |
| `quick-note-settings` | 功能设置（`{ position, customX, customY, minimized }`，对象浅合并兜底未来字段） |

> 注：重构后数据从 `quick-note-items` 升级为 `quick-note-data`（结构完全不同），旧数据不做迁移。
