---
name: toolCollection-侧边栏布局重构
overview: 将 toolCollection 从「顶部 Tab 一行平铺」重构为「左侧文字列表 + 右侧内容区」布局，保留全部现有能力（拖拽排序、键盘导航、尺寸调整、独立浮动窗口双形态）。
design:
  styleKeywords:
    - Codex 克制边框风
    - 双栏导航
    - 竖排工具列表
    - 等宽字体细节
    - hover/active 过渡
  fontSystem:
    fontFamily: system-ui
    heading:
      size: 13px
      weight: 600
    subheading:
      size: 12px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - var(--b3-theme-primary)
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface)
    text:
      - var(--b3-theme-on-background)
      - var(--b3-theme-on-surface)
    functional:
      - var(--b3-border-color)
      - var(--b3-scrollbar-color)
todos:
  - id: restructure-layout
    content: 重构 index.vue 为左侧工具列表 + 右侧内容双栏布局，绑定拖拽与导航
    status: completed
  - id: rewrite-styles
    content: 重写 styles/index.scss：删除横向 Tab 样式，新增侧栏与双栏布局及 tool-item 样式
    status: completed
    dependencies:
      - restructure-layout
  - id: extend-keyboard-nav
    content: useToolNavigation 新增 ↑/↓ 导航，同步更新中英文 i18n 提示文案
    status: completed
    dependencies:
      - restructure-layout
  - id: update-docs
    content: 更新 README.md 布局描述、快捷键表与拖拽排序说明
    status: completed
    dependencies:
      - extend-keyboard-nav
---

## 产品概述

重构思源笔记插件「工具合集」功能面板的 UI 布局。当前 8 个工具以横向 Tab 一行平铺，工具增多后需要左右滚动、切换效率低。目标改为「左侧文字列表 + 右侧内容」双栏布局：竖排列表同时显示图标与工具名，一览所有工具、快速点击切换。

## 核心功能

- 左侧固定宽度工具导航栏：图标 + 名称竖排列表，可滚动，活动项高亮
- 右侧内容区：flex 自适应填充，动态渲染当前工具组件
- 完整保留现有能力：
- Tab 拖拽排序（纵向列表适配）+ 顺序持久化（`toolCollection-tabOrder` 兼容旧数据）
- 键盘导航：←/→ 循环切换、Ctrl+1~9 跳转、Home/End、Esc 关闭，并新增 ↑/↓ 纵向导航
- 面板尺寸调整（宽/高按钮 + 顶部拖拽手柄），持久化不变
- 独立浮动窗口承载（addTab + openWindow 双形态，overlay/tab 两种模式均生效，浮动窗口内隐藏头部标题）
- 新布局自动适配底部面板与独立页签两种承载模式，视觉遵循 Codex 风格（设计 Token + 思源主题变量）

## 技术栈

- Vue 3 + TypeScript + SCSS（Vite 库模式），沿用项目现有架构与设计 Token 体系，不引入新依赖

## 实现方案

### 目标布局

```
tool-collection-panel
├── resize-handle（顶部拖拽调高手柄，保留）
├── header（保留：标题 + 尺寸调整组 + 浮动窗口 + 关闭；isFloating 时仍隐藏）
└── tool-collection-body（新增横向 flex 容器）
    ├── sidebar（新增：固定宽度 ~176px 竖排工具列表，可滚动）
    │   ├── tool-item × N（Iconify 图标 + 名称，click 切换 / drag 排序 / active 高亮 + 左侧指示条）
    │   └── keyhint（键盘提示精简保留）
    └── content（保留：动态组件，flex:1 自适应滚动）
```

### 关键技术决策

1. **不拆子组件**：模板改动量小（横向 Tab 栏 → 侧栏列表约 ±40 行），且拖拽/导航逻辑与父组件状态（tools/currentTool/activeTabRef）紧耦合，直接在 `index.vue` 内重写，避免 props/emit 绕行。重构后约 280 行，仍在 300 行警戒线内；若超限再提取 `components/ToolSidebar.vue` 兜底。
2. **useTabReorder 零改动复用**：其排序基于索引 splice，与 DOM 方向无关；仅将 dragstart/dragover/drop/dragend 绑定从横向 Tab 按钮迁移到纵向 tool-item，持久化 key 与旧数据格式不变，自动兼容。
3. **useToolNavigation 增量增强**：保留全部现有按键，新增 ArrowUp/ArrowDown 循环切换（与 ←/→ 等价行为），Ctrl+1~9/Home/End/Esc 不变，纯增量零破坏。
4. **样式重构**：删除横向 Tab 栏全部样式（约 110 行），新增双栏布局与侧栏工具项样式。Codex 风格强制：全部使用设计 Token（`$color-*`/`$spacing-*`/`$font-size-*`/`$font-weight-*`/`$line-height-*`/`$vp-mono`/`$radius-*`）与思源 CSS 变量（`--b3-*`），禁止 box-shadow（用边框）、禁止硬编码色值/字号。
5. **双形态自动适配**：新布局为面板内部 flex 布局，overlay（底部面板）与 tab（独立页签/浮动窗口）两种承载模式自动生效，现有 `.tool-collection-panel.tab-mode` 静态定位覆盖保留。

### 性能与可靠性

- 侧栏列表渲染开销可忽略；内容区 `:key="currentTool"` 切换重建机制不变
- 无新增定时器/全局监听（键盘监听仍复用现有 handleKeydown，onBeforeUnmount 清理不变）
- 持久化 key 全部不变（`toolCollection-tabOrder`/`toolCollection-width`/`toolCollection-height`），零数据迁移
- 改动面收敛在 toolCollection 模块内部，不触碰注册链与跨功能通信（统一入口原则不受影响）

## 架构设计

单组件模板级重构，不改变模块分层与数据流：

- 类型层 `types/index.ts`（ToolMeta）、注册表 `tools/registry.ts`、注册链 `index.ts`：零改动
- 视图层 `index.vue`：模板重写，script 逻辑（usePanelResize/useDragResize/useTabReorder/useToolNavigation）绑定迁移
- 样式层 `styles/index.scss`：删除横向 Tab 样式，新增双栏/侧栏/工具项样式
- composables 层：仅 `useToolNavigation.ts` 增加 ↑/↓ 分支

## 目录结构

```
src/features/toolCollection/
├── index.vue                     # [MODIFY] 模板重构：删除横向 Tab 栏，新增 .tool-collection-body（侧栏工具列表 + 内容区）；tool-item 绑定 icon/label/click/拖拽事件/activeTabRef；文件头注释更新；Header 与 script 逻辑保留
├── styles/index.scss             # [MODIFY] 删除横向 Tab 栏全部样式；新增 .tool-collection-body（flex 横向）/ .tool-collection-sidebar（固定宽 + border-right + 滚动）/ .tool-item（hover/active 高亮 + 左侧指示条 + dragging 反馈）；内容区改 flex:1；响应式与 tab-mode 覆盖同步调整
├── composables/
│   └── useToolNavigation.ts      # [MODIFY] 新增 ArrowUp/ArrowDown 循环切换分支（与 ←/→ 等价），保留全部现有按键；注释更新
├── README.md                     # [MODIFY] 布局描述更新（Tab → 左侧工具列表双栏）；快捷键表增加 ↑/↓；拖拽排序描述适配纵向
└── types/index.ts                # 零改动（ToolMeta 不变）
```

```
src/i18n/
├── zh_CN/toolCollection.json     # [MODIFY] toolCollectionPanel.prevTool/nextTool 文案补充 ↑/← 双提示
└── en_US/toolCollection.json     # [MODIFY] 同上英文对应更新
```

## 关键代码结构

useToolNavigation 键盘处理新增分支（保留原有全部分支）：

```ts
} else if (e.key === "ArrowUp") {
  e.preventDefault()
  prevTool()
} else if (e.key === "ArrowDown") {
  e.preventDefault()
  nextTool()
}
```

（与原 ArrowLeft/ArrowRight 分支行为等价，当前工具列表纵向排列时 ↑/↓ 为自然导航方向）

## 设计风格

遵循项目强制 Codex 风格：克制边框化设计、等宽字体细节、无阴影、focus 发光。面板由纵向三段（Header / 双栏 body / 无底部）改为「Header + 横向双栏」结构——左侧固定宽度工具导航栏以边框与内容区隔离，工具项采用「图标 + 名称」竖排列表，hover 背景过渡、active 项主色文字 + 左侧 2px 指示条 + 浅色底衬托，拖拽时半透明反馈。内容区保持原有工具视图，视觉层级清晰：导航栏克制收敛、内容区占据主空间，契合工具持续增多的扩展性。窄屏（<860px）下侧栏宽度收缩，双形态（底部面板/浮动窗口）统一呈现。

## 页面规划

单一面板重构，无新增页面；双栏布局在 overlay 与 tab 两种承载模式统一生效。

## 布局与交互

1. Header（保留）：标题 + 尺寸调整组 + 浮动窗口 + 关闭，isFloating 时隐藏标题
2. 左侧工具导航栏：固定宽度列表，图标 + 名称竖排，可滚动、可拖拽排序、可键盘 ↑/↓ 与 ←/→ 切换，底部保留 ←→/↑↓ 键盘提示
3. 右侧内容区：flex:1 自适应，动态组件渲染当前工具，保持滚动与 padding 规范
4. 顶部拖拽手柄保留，调整面板高度；宽高按钮组保留