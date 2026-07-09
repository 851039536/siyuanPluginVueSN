---
name: separate-monitor-from-shortcuts-statusbar
overview: 在状态栏中，监控项（笔记数/字数/今日活动/CPU/内存/运行时间）与功能快捷入口/任务/抽屉按钮之间添加视觉分隔，让两类内容在视觉上明确分开。
todos:
  - id: add-separator
    content: 在 index.vue 模板中监控项区块末尾插入分隔 span，并新增 showSeparator computed 控制显隐
    status: completed
  - id: add-separator-style
    content: 在 index.scss 中新增 .status-bar-separator 样式
    status: completed
    dependencies:
      - add-separator
---

## 用户需求

在状态栏 UI 上将监控类项目（文档数、总字数、今日活动、CPU、内存、运行时间）与功能快捷入口类项目（视频管理器、密码箱、Skills 查看器等）在视觉上分开，使两类内容之间有清晰的分隔。

## 核心功能

- 在监控项区块与功能快捷/任务区块之间插入一条细竖线分隔符
- 分隔符仅在两侧均有可见内容时显示（监控项有可见 + 快捷或任务有可见），避免无意义留白
- 分隔符样式与思源主题边框颜色一致，融入现有视觉风格

## 技术方案

### 实现方式

在 `index.vue` 模板中，于最后一个监控项（monitor-uptime）之后、动态任务循环之前，插入一个条件渲染的 `<span>` 作为视觉分隔线。通过 computed 属性 `showSeparator` 控制显隐条件：当 `visibleMonitors` 集合非空 且 存在可见快捷入口或活跃后台任务时才显示。

### 关键决策

- **使用 `<span>` + CSS 而非 `<hr>` 或 border**：`<span>` 作为 inline-block 元素自然融入 flex 行内，无需额外布局调整
- **computed 条件控制**：避免在仅有监控项或仅有快捷入口时出现多余的空白分隔线
- **复用现有 design token**：颜色使用 `--b3-theme-border`，与项目其他边框颜色一致

### 改动范围

仅涉及 2 个文件，改动量极小，不影响现有功能逻辑。

### 目录结构

```
src/features/statusBar/
├── index.vue          # [MODIFY] 模板新增分隔 span + script 新增 showSeparator computed
└── styles/
    └── index.scss     # [MODIFY] 新增 .status-bar-separator 样式
```