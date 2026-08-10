---
name: quickNote-refactor-v2
overview: 将 quickNote 从单一速记功能重构为四大模块（今天待办、灵感速记、项目跟进、每周复盘）的协同工作面板，保持 persistent Modal 弹窗形态，采用白底蓝绿商务风格，集成 Chart.js 数据可视化。
design:
  architecture:
    framework: vue
    component: shadcn
  styleKeywords:
    - 商务极简
    - 蓝绿色系
    - 白底干净
    - Codex边框
    - 克制品味
    - 图表可视化
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 14px
      weight: 600
    subheading:
      size: 12px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#3b82f6"
      - "#22c55e"
      - "#0ea5e9"
    background:
      - "#FFFFFF"
      - "#F8FAFC"
      - "#EFF6FF"
    text:
      - "#1E293B"
      - "#64748B"
      - "#94A3B8"
    functional:
      - "#EF4444"
      - "#F59E0B"
      - "#22C55E"
      - "#3B82F6"
todos:
  - id: update-data-layer
    content: "更新数据层：重写 types/index.ts（TodoItem/InspirationItem/ProjectItem/AppData 类型定义）和 types/storage.ts（统一存储槽 key: \"quick-note-data\"）"
    status: completed
  - id: create-composables
    content: 创建四个 composables：useTodoList（CRUD+自动顺延+逾期检测）、useInspirations（CRUD+标签筛选）、useProjects（CRUD+关联待办进度）、useWeeklyReview（复盘数据计算+图表数据）
    status: completed
    dependencies:
      - update-data-layer
  - id: create-todo-components
    content: 创建待办模块：TodoItem.vue + TodoForm.vue 组件及对应 SCSS，TodayFocus.vue「今天要处理的」逾期任务+卡住项目标红组件及样式
    status: completed
    dependencies:
      - create-composables
  - id: create-inspiration-components
    content: 创建灵感速记模块：InspirationItem.vue + InspirationForm.vue 组件及对应 SCSS，标签筛选 UI 内联于 InspirationForm 中
    status: completed
    dependencies:
      - create-composables
  - id: create-project-components
    content: 创建项目跟进模块：ProjectItem.vue（含进度条+关联待办折叠）+ ProjectForm.vue 组件及对应 SCSS
    status: completed
    dependencies:
      - create-composables
  - id: create-review-components
    content: 创建每周复盘模块：WeeklyReview.vue 组件及 SCSS，集成项目已有 Chart.vue 渲染优先级分布环形图 + 项目精力分布条形图 + 卡点汇总清单
    status: completed
    dependencies:
      - create-composables
  - id: rewrite-shell-and-finalize
    content: 重写 index.vue（Tab 导航壳+页头 CSS 渐变配图）、更新 styles/index.scss、更新 Manager 面板宽度为 480px、更新 i18n 中英文各约 55 键、更新 README.md，使用 [skill:codex-ui-style-guide] 审查样式合规性，使用 [skill:universal-arch-skill] 校验注册完整性
    status: completed
    dependencies:
      - create-todo-components
      - create-inspiration-components
      - create-project-components
      - create-review-components
---

## 产品概述

将现有速记弹窗从简单的「待完成/已完成」双列表重构为四大核心模块的综合管理面板，涵盖日常待办、灵感收集、项目跟进与每周复盘，顶部增设「今天要处理的」聚焦视图自动汇总逾期任务与卡点项目。

## 核心功能

### 今天要处理的（顶部固定）

- 逾期未完成的任务红字标出，显示截止日期与优先级
- 状态为「卡住」的项目列出来标红，提示当前卡点
- 一目了然地呈现今天必须关注的事项

### 今天待办

- 添加任务时填写内容、选择优先级（紧急/高/中/低）、设置截止日期
- 完成任务打勾标记，已完成任务灰显删除线
- 过期未做任务整行标红，提供「一键顺延到明天」按钮
- 未来任务按日期分组展示，今天/明天/本周/更远分区
- 昨天未完成的任务启动时自动顺延到今天，记录顺延次数

### 灵感速记

- 随手记录想法（保留原有 AI 润色能力）
- 支持为每条灵感添加多个标签
- 标签筛选栏按标签过滤灵感列表

### 项目跟进

- 记录项目名称、当前进度、下一步计划、卡点描述
- 支持三种状态：进行中 / 已完成 / 卡住
- 任务可挂载到项目下（TodoItem 关联 projectId）
- 项目卡片显示关联待办的完成进度条（已完成数/总数）

### 每周复盘

- 展示本周完成事项数量
- 优先级分布饼图（紧急/高/中/低各完成多少）
- 精力分布条形图（各项目关联的待办完成数）
- 卡点汇总清单（所有项目的 blocker 汇总）

### 视觉风格

- 白底简洁商务风格，蓝绿色主色调（品牌信息色配品牌成功色）
- 页头使用克制免版权渐变配图（CSS 渐变模拟），不喧宾夺主
- 数据可视化使用 Chart.js 渲染环形图与条形图

## 技术栈

- 框架：Vue 3 + TypeScript（沿用项目现有架构）
- 样式：SCSS + 设计 Token（$font-size-xs/$font-size-2xs、$spacing-*、$vp-radius 等）
- 图表：Chart.js v4.5.1 + vue-chartjs v5.3.3（已安装，复用项目已有 Chart.vue 通用组件）
- 存储：TypedStorage 统一槽位持久化
- 弹窗管理：QuickNoteManager（保持 persistent Modal + 位置/拖拽/最小化不变）

## 实现方案

### 总体策略

在保持 QuickNoteManager（弹窗生命周期、位置管理、拖拽、最小化）零改动的前提下，仅增加面板宽度（420px→480px 以容纳图表），完全重写数据模型与 UI 层。数据层从 `QuickNoteItem[]` 单一数组升级为包含 `todos`/`inspirations`/`projects` 三个数组的统一存储对象，每周复盘数据为纯计算派生不额外存储。

### 数据模型设计

**AppData（统一存储对象，key: "quick-note-data"）**：

- `todos: TodoItem[]` — 待办列表
- `inspirations: InspirationItem[]` — 灵感列表
- `projects: ProjectItem[]` — 项目列表
- `lastRolloverDate: string | null` — 上次自动顺延日期，用于防止同一天重复顺延

**TodoItem（待办条目）**：

- 新增 `priority`（urgent/high/medium/low）、`dueDate`（YYYY-MM-DD 字符串或 null）、`projectId`（关联项目）、`rolloverCount`（顺延次数）
- 保留 `id`/`content`/`done`/`createdAt`/`updatedAt` 字段
- 新增 `doneAt`（完成时间戳，用于每周复盘统计）

**InspirationItem（灵感条目）**：

- 新增 `tags: string[]` 字段
- 保留 `id`/`content`/`createdAt`/`updatedAt`

**ProjectItem（项目条目）**：

- `id`/`name`/`currentStep`/`nextStep`/`blockers`/`status`(active/completed/blocked)/`createdAt`/`updatedAt`
- 关联待办进度为计算属性（不存储）：过滤 `todos.filter(t => t.projectId === project.id)`

### 自动顺延机制

`useTodoList` 的 `load()` 方法中实现：

1. 读取 `lastRolloverDate`，与今天日期对比
2. 若非今天，查找所有 `done === false && dueDate < today && dueDate !== null` 的任务
3. 将其 `dueDate` 设为今天，`rolloverCount += 1`
4. 更新 `lastRolloverDate` 为今天，持久化
5. 此逻辑在 `onMounted` 中执行一次，保证每天首次打开弹窗时自动顺延

### 组件架构

```
index.vue（Tab 导航壳）
├── [顶部] 「今天要处理的」TodayFocus.vue
├── [Tab 1] 今天待办 → TodoForm.vue + 多个 TodoItem.vue
├── [Tab 2] 灵感速记 → InspirationForm.vue + 多个 InspirationItem.vue + TagFilter
├── [Tab 3] 项目跟进 → ProjectForm.vue + 多个 ProjectItem.vue
└── [Tab 4] 每周复盘 → WeeklyReview.vue（内嵌 Chart.vue 渲染图表）
```

数据流：`index.vue` 实例化 `useTodoList`/`useInspirations`/`useProjects`/`useWeeklyReview` 四个 composable，将响应式数据通过 props 传递给各子组件。子组件 emit 事件调用 composable 方法执行 CRUD。

### 性能考量

- 每条 CRUD 操作后即时 `persist()` 全量写入（数据量小，无需防抖）
- 每周复盘为纯 computed，不产生额外存储开销
- Chart.js 仅在复盘 Tab 激活时渲染（v-if 控制）
- 标签筛选为 computed 过滤，O(n) 线性，数据量在百级内无性能瓶颈

### 向后兼容

- QuickNoteManager 的公开 API（toggle/open/close/getPosition/setPosition/isMinimized/setMinimized/startDrag）全部保持不变
- 设置存储槽 `quick-note-settings` 保持不变
- 仅 `quick-note-items` 升级为 `quick-note-data`（新 key，旧数据不迁移——重构后数据结构完全不同）
- 配置层（config.ts/settings.ts/icons.ts/features/index.ts/index.ts）无需改动

## 目录结构

```
src/features/quickNote/
├── index.ts                       # [MODIFY] QuickNoteManager：面板宽度 420→480px，storage 入参保留
├── index.vue                      # [MODIFY] 重写为 Tab 导航壳 + 页头，约 200 行
├── README.md                      # [MODIFY] 更新功能描述与目录结构文档
├── types/
│   ├── index.ts                   # [MODIFY] 全新类型定义（TodoItem/InspirationItem/ProjectItem/AppData/Priority 等）
│   └── storage.ts                 # [MODIFY] 新 QuickNoteStorage（key: "quick-note-data"，settings 保留）
├── composables/
│   ├── useAiPolish.ts             # [KEEP] 不变，灵感速记复用
│   ├── useTodoList.ts             # [NEW] 待办 CRUD + 自动顺延 + 逾期检测
│   ├── useInspirations.ts         # [NEW] 灵感 CRUD + 标签提取/筛选
│   ├── useProjects.ts             # [NEW] 项目 CRUD + 关联待办进度计算
│   └── useWeeklyReview.ts         # [NEW] 复盘数据计算（图表数据 + 卡点汇总）
├── components/
│   ├── today/
│   │   └── TodayFocus.vue         # [NEW] 「今天要处理的」逾期任务 + 卡住项目标红列表
│   ├── todo/
│   │   ├── TodoItem.vue           # [NEW] 单条待办展示（含优先级徽章、截止日期、顺延按钮）
│   │   └── TodoForm.vue           # [NEW] 待办新增/编辑表单（优先级选择、日期选择、项目关联下拉）
│   ├── inspiration/
│   │   ├── InspirationItem.vue    # [NEW] 单条灵感展示（含标签、编辑态 AI 润色）
│   │   └── InspirationForm.vue    # [NEW] 灵感新增表单（含标签输入）
│   ├── project/
│   │   ├── ProjectItem.vue        # [NEW] 单项目卡片（进度条、状态徽章、待办列表折叠）
│   │   └── ProjectForm.vue        # [NEW] 项目新增/编辑表单
│   └── review/
│       └── WeeklyReview.vue       # [NEW] 复盘面板（内嵌 Chart.vue 渲染环形图+条形图 + 卡点清单）
├── styles/
│   ├── index.scss                 # [MODIFY] 更新面板壳样式 + Tab 导航 + 页头渐变
│   ├── TodayFocus.scss            # [NEW]
│   ├── TodoItem.scss              # [NEW]
│   ├── TodoForm.scss              # [NEW]
│   ├── InspirationItem.scss       # [NEW]
│   ├── InspirationForm.scss       # [NEW]
│   ├── ProjectItem.scss           # [NEW]
│   ├── ProjectForm.scss           # [NEW]
│   └── WeeklyReview.scss          # [NEW]
├── i18n/
│   ├── zh_CN/quickNote.json       # [MODIFY] 新增约 55 个翻译键
│   └── en_US/quickNote.json       # [MODIFY] 新增约 55 个翻译键
```

## 关键代码结构

### AppData（统一存储对象）

```typescript
export interface AppData {
  todos: TodoItem[]
  inspirations: InspirationItem[]
  projects: ProjectItem[]
  lastRolloverDate: string | null
}

export interface TodoItem {
  id: string
  content: string
  priority: TodoPriority  // "urgent" | "high" | "medium" | "low"
  dueDate: string | null   // YYYY-MM-DD
  done: boolean
  doneAt: number | null
  projectId: string | null
  rolloverCount: number
  createdAt: number
  updatedAt: number
}

export interface InspirationItem {
  id: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface ProjectItem {
  id: string
  name: string
  currentStep: string
  nextStep: string
  blockers: string
  status: ProjectStatus  // "active" | "completed" | "blocked"
  createdAt: number
  updatedAt: number
}
```

## 设计风格

采用**蓝绿色商务极简**风格，融合 Codex 设计语言（边框代替阴影、等宽字体、大写标签、全设计 Token 化）。整体白底干净利落，以品牌蓝色 `#3b82f6`（$brand-info）和品牌绿色 `#22c55e`（$brand-success）为主色调传递专业感与活力，琥珀色 `#f59e0b` 用于优先级强调，红色 `#ef4444` 用于逾期/卡住警示。

页头使用克制 CSS 渐变（蓝→绿 135° 对角渐变，叠加半透明白）作为免版权配图，不喧宾夺主，仅提供品牌氛围。

## 页面布局

弹窗宽度 480px，高度 70vh。整体分为三层：

**页头区**（固定，约 80px）：CSS 渐变背景（蓝绿对角），左侧速记图标+标题，整体干净克制。

**「今天要处理的」聚焦区**（固定，最大 120px）：白色背景，列出逾期任务与卡住项目，红色文字警示。无逾期时显示「今日无紧急事项」绿色柔和提示。与下方 Tab 区间隔 1px 边框线分隔。

**Tab 内容区**（flex:1 可滚动，padding-right: $spacing-2 为滚动条留呼吸空间）：四个 Tab——待办/灵感/项目/复盘。Tab 切换栏使用下划线式设计（非卡片式），激活态蓝色下划线与文字。

## 组件设计要点

### 待办 TodoItem

- 左侧优先级色条（红/橙/蓝/灰）+ 勾选框
- 内容区：标题（$font-size-xs）+ 截止日期（$font-size-2xs 辅助文字）
- 过期未完成整行淡红背景 + 红色边框 +「顺延到明天」按钮
- 完成态灰显删除线，优先级色条变灰

### 灵感 InspirationItem

- 标签以蓝色小徽章展示在内容上方
- 编辑态保留 AI 润色按钮（复用 useAiPolish）
- 标签筛选栏在列表顶部，选中标签高亮蓝色

### 项目 ProjectItem

- 卡片式布局（边框+圆角）
- 头部：项目名 + 状态徽章（进行中=蓝/已完成=绿/卡住=红）
- 内容：当前进度 → 下一步（箭头式流程感）
- 底部：关联待办进度条（CSS 实现，蓝绿渐变填充）+ 完成数/总数
- 卡住态整卡红色左边框强调

### 本周复盘 WeeklyReview

- 顶部数字卡片：「本周完成 X 件事」（大字 $font-size-sm）
- 左侧环形图（Doughnut）：优先级分布（红/橙/蓝/灰四色）
- 右侧水平条形图（Bar）：各项目精力分布
- 底部「卡点汇总」清单：红色图标 + 项目名 + 卡点描述

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose：审查并确保所有新增 SCSS 文件严格遵循 Codex 风格规范（边框代替阴影、全设计 Token 化、BEM 命名、字号两级制）
- Expected outcome：所有 SCSS 文件通过规范审查，无硬编码尺寸/颜色/阴影，所有字体三要素使用 $font-size-*/$font-weight-*/$line-height-* Token

- **universal-arch-skill**
- Purpose：在重构过程中校验功能模块的注册完整性（8 步注册规则）、文件结构与命名是否符合项目架构规范
- Expected outcome：确认所有新增/修改文件位置正确，模块注册链路完整，无遗漏的配置项