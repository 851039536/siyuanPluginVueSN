---
name: fix-duplicate-parent-display
overview: 修复 docNavigation 中面包屑与上级文档链接重复显示上级文档的问题——面包屑可见时隐藏独立的上级文档链接块。
todos:
  - id: fix-duplicate-parent
    content: 修改 DocNavContainer.vue 第 51 行：`v-if="parentDoc"` → `v-if="parentDoc && !hasBreadcrumbs"`，消除上级文档重复显示
    status: completed
---

## 问题描述

docNavigation 导航栏中"上级文档"在面包屑路径与独立链接中重复显示。

## 根因

DocNavContainer.vue 模板中面包屑路径（`Root > Parent > Current`）的倒数第二项就是上级文档，同时下方又有独立的 `doc-nav-parent` 块再次渲染同一条上级文档链接。当 `hasBreadcrumbs` 为 `true` 时，上级文档出现在两个位置。

## 修复方案

给 `doc-nav-parent` 块增加 `!hasBreadcrumbs` 条件：面包屑可见时隐藏独立上级链接，避免重复显示。

## 改动范围

仅修改 1 个文件、1 行代码：

`src/features/docNavigation/components/DocNavContainer.vue` 第 51 行：

```
- v-if="parentDoc"
+ v-if="parentDoc && !hasBreadcrumbs"
```

## 逻辑说明

- 面包屑可见（`hasBreadcrumbs === true`）→ 不显示独立上级链接（面包屑中已有）
- 面包屑不可见（`hasBreadcrumbs === false`）→ 显示独立上级链接（作为唯一导航入口）

`hasBreadcrumbs` 已在 `useDocNavigation()` 解构中导出，模板中可直接使用。