---
name: compact-mode-feature-extraction
overview: 将 index.scss 中的紧凑模式 CSS 抽取为独立功能模块（src/features/compactMode/），在通用设置面板中新增"紧凑模式"分类页，支持 UI 开关切换。
todos:
  - id: create-css-file
    content: 创建 src/features/compactMode/styles/index.scss，从 src/index.scss 提取 compact-responsive mixin 和 html.siyuan-compact-mode 规则块
    status: completed
  - id: update-index-scss
    content: 修改 src/index.scss：删除 L69-L244 紧凑模式内容，替换为 @use 引用新文件
    status: completed
    dependencies:
      - create-css-file
  - id: create-module
    content: 创建 src/features/compactMode/index.ts，导出 applyCompactMode(enabled) 工具函数（管理 HTML class 添加/移除）
    status: completed
  - id: update-main-and-index
    content: 修改 src/main.ts L23-L27 和 src/index.ts L148-L153，将裸 classList 操作替换为调用 applyCompactMode()
    status: completed
    dependencies:
      - create-module
  - id: create-settings-vue
    content: 创建 CompactModeSettings.vue 设置组件（SiSwitch 开关 + 描述文本），通过 props 接收 plugin 实例
    status: completed
  - id: update-general-settings
    content: 修改 generalSettings/index.vue：categories 数组新增 compactMode 分类，template 中新增 v-show 区域嵌入 CompactModeSettings 组件
    status: completed
    dependencies:
      - create-settings-vue
  - id: add-i18n-entries
    content: 在 zh_CN.json 和 en_US.json 中新增 compactModeSettings/compactModeDescription 翻译条目
    status: completed
    dependencies:
      - create-settings-vue
---

## 产品概述

将 `src/index.scss` 中全局紧凑模式 CSS 提取为独立功能模块 `compactMode`，新增通用设置面板中的 UI 开关，用户可以在插件设置界面中直观地开启/关闭紧凑模式。

## 核心功能

- 紧凑模式 CSS 独立为模块文件，从主入口 `src/index.scss` 中通过 `@use` 引用
- 通用设置面板新增"紧凑模式"侧边栏分类，显示开关组件
- 用户切换开关时实时生效：添加/移除 `html` 元素上的 `siyuan-compact-mode` class
- 开关状态持久化到插件配置中，重启后保持上次选择

## 技术栈

- Vue 3 + TypeScript + SCSS（复用项目现有技术栈）
- `@/components/Switch.vue`（已存在的 SiSwitch 组件）

## 实现方案

### 核心策略

采用 **简单功能模块** 模式（参考 CLAUDE.md "简单功能（无面板、无存储）"），不创建 register 函数或 dock 面板。由于 `compactMode` 已在 `PluginSettings` 中定义且 `saveSettings` 封装完整，模块只需：

1. 提取 CSS 到独立文件
2. 提供 `applyCompactMode(boolean)` 工具函数管理 HTML class
3. 创建设置组件嵌入 `generalSettings` 面板

### 架构设计

```mermaid
graph TD
    A[src/index.scss] -->|@use| B[features/compactMode/styles/index.scss]
    B -->|@use| C[src/_variables.scss]
    D[features/compactMode/index.ts] -->|导出| E[applyCompactMode]
    F[index.ts loadAndApplySettings] --> E
    G[main.ts init] --> E
    H[CompactModeSettings.vue] -->|emit| I[compactMode 事件]
    I -->|App.vue 监听| E
    J[generalSettings/index.vue] -->|嵌入| H
```

### 数据流

```
用户切换开关 → CompactModeSettings.vue emit 事件
  → App.vue 监听 → 调用 saveSettings 持久化
  → 调用 applyCompactMode(enabled) 切换 HTML class
  → plugin.settings.compactMode 同步更新
```

## 实现细节

### 核心目录结构

```
src/features/compactMode/
├── index.ts                       # [NEW] 导出 applyCompactMode / getCompactModeState
├── components/
│   └── CompactModeSettings.vue    # [NEW] 设置 UI：开关 + 描述文本
└── styles/
    └── index.scss                 # [NEW] compact-responsive mixin + html.siyuan-compact-mode 块（从 src/index.scss 提取）
```

### 文件变更清单

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| NEW | `src/features/compactMode/index.ts` | 导出 `applyCompactMode(enabled)` 工具函数 |
| NEW | `src/features/compactMode/components/CompactModeSettings.vue` | 开关设置组件 |
| NEW | `src/features/compactMode/styles/index.scss` | 紧凑模式 CSS（从 index.scss 提取） |
| MODIFY | `src/index.scss` | 删除 L69-L244，替换为 `@use './features/compactMode/styles/index.scss'` |
| MODIFY | `src/features/generalSettings/index.vue` | categories 数组 + template 中新增 compactMode 分类和组件 |
| MODIFY | `src/index.ts` | L148-L153 替换为调用 `applyCompactMode()` |
| MODIFY | `src/main.ts` | L23-L27 替换为调用 `applyCompactMode()` |
| MODIFY | `src/i18n/zh_CN.json` | 新增 `compactModeSettings` / `compactModeDescription` |
| MODIFY | `src/i18n/en_US.json` | 同上英文版本 |


### !important 使用说明

紧凑模式 CSS 中有 6 处 `!important`（`line-height: 24px/20px/22px`），这些是覆盖思源 JS 动态设置的 inline style，必须保留。

## Agent Extensions

无需使用任何 agent 扩展。
