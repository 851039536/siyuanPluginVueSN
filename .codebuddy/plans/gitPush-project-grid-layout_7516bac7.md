---
name: gitPush-project-grid-layout
overview: 为 gitPush 模块的项目列表增加响应式双列布局：当面板宽度 ≥ 810px 时，卡片自动切换为一行两列的 CSS Grid 布局。
todos:
  - id: add-container-query
    content: "在 index.scss 中为 .git-push-panel 添加 container-type: inline-size，并为 .gp-list 新增 @container (min-width: 810px) 两列网格规则"
    status: completed
---

## 用户需求

对 gitPush 模块的项目列表进行响应式布局优化：当面板容器宽度超过 810px 时，项目卡片自动从单列布局切换为一行两列显示，提升宽屏下的空间利用率和信息密度。

## 核心功能

- 面板宽度小于 810px 时保持现有单列卡片布局不变
- 面板宽度大于等于 810px 时，卡片自动切换为两列网格布局（`grid-template-columns: 1fr 1fr`）
- 两列布局下卡片间距与单列保持一致（`gap: 10px`）
- 滚动行为不受影响，溢出时仍可正常纵向滚动

## 技术方案

### 实现方式

使用 **CSS Container Queries**（容器查询）实现基于面板宽度而非视口宽度的响应式布局。

**选择 Container Queries 的理由**：

- gitPush 面板作为 Dock 面板嵌入思源笔记，其宽度由用户拖拽调整决定，与浏览器视口宽度无关
- `@media` 查询基于视口宽度，无法精确反映面板实际宽度
- Container Queries 直接监听父容器（`.git-push-panel`）的 `inline-size`，天然适配面板尺寸变化

### 改动范围

仅修改 `src/features/gitPush/styles/index.scss` 一个文件，两处改动：

1. **`.git-push-panel`**：添加 `container-type: inline-size`，启用容器查询上下文
2. **`@container` 规则块**：新增 `@container (min-width: 810px)` 查询，将 `.gp-list` 从 `flex-direction: column` 切换为 `display: grid; grid-template-columns: 1fr 1fr`

### 实现细节

- 保持现有 `gap: 10px` 不变，CSS Grid 的 `gap` 同时作用于行列间距
- 不需要修改 Vue 模板或 JS 逻辑，纯 CSS 即可实现
- 不引入新的 CSS 变量或 mixin，保持最小改动原则
- Container Query 兼容性：Chrome 105+、Edge 105+、Firefox 110+、Electron 28+（思源笔记当前 Electron 版本满足要求）

### 目录结构

```
src/features/gitPush/
└── styles/
    └── index.scss  # [MODIFY] .git-push-panel 添加 container-type；.gp-list 区域新增 @container 双列规则
```