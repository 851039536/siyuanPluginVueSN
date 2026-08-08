---
name: fix-backlink-not-displaying
overview: 诊断并修复 docNavigation 模块中反向链接（BacklinkDropdown）在 UI 上完全不显示的问题。问题可能出在 API 数据获取层、渲染条件判断或 CSS 可见性。
todos:
  - id: fix-api-type
    content: 修正 src/api.ts 中 IGetBacklinkResponse 接口定义，匹配思源实际 API 返回结构
    status: completed
  - id: fix-fetch-backlinks
    content: 修正 src/features/docNavigation/types/storage.ts 中 fetchBacklinks 函数的数据解构逻辑
    status: completed
    dependencies:
      - fix-api-type
  - id: cleanup-console-log
    content: 移除 BacklinkDropdown.vue 中的调试 console.log
    status: completed
---

## 用户需求

修复 docNavigation 功能模块中反向链接在 UI 上完全不显示的问题。

## 产品概述

docNavigation 是思源笔记插件的文档导航功能模块，在文档编辑区顶部或底部显示层级导航栏。其反向链接子功能应在导航栏中显示一个"反向链接 (N)"按钮，点击后弹出下拉面板，展示所有引用/提及当前文档的文档列表。

## 核心问题

反向链接按钮完全不渲染。经代码审查确认，根因是 `fetchBacklinks` 函数从思源 API 返回数据中解构反链列表时使用了错误的字段名，导致永远获取到空数组。

## 修复范围

- 修正 `src/api.ts` 中 `IGetBacklinkResponse` 接口，匹配思源实际 API 返回结构
- 修正 `src/features/docNavigation/types/storage.ts` 中 `fetchBacklinks` 函数的数据解构逻辑
- 清理 `BacklinkDropdown.vue` 中的调试 console.log

## 技术方案

### 根因分析

思源内核 API `/api/ref/getBacklink` 的实际返回结构为：

```
{
  "code": 0,
  "data": {
    "backlinks": [
      { "id": "xxx", "name": "xxx.sy", "path": "/xxx.sy", "box": "xxx", ... }
    ]
  }
}
```

而代码中 `IGetBacklinkResponse` 接口错误地定义为 `{ files: IRefFile[], backmention: IRefFile[] }`，导致 `fetchBacklinks` 中 `backlinkRes?.files` 等四个可选链全部返回 `undefined`，反链数组永远为空。

### 修复方案

1. **`src/api.ts`** — 将 `IGetBacklinkResponse` 接口修正为 `{ backlinks: IRefFile[] }`，匹配思源实际返回结构
2. **`src/features/docNavigation/types/storage.ts`** — `fetchBacklinks` 函数改为从 `backlinkRes?.backlinks` 和 `backmentionRes?.backlinks`（或 `backmentions`）解构数据
3. **`BacklinkDropdown.vue`** — 移除调试 console.log

### 实现要点

- `getBacklink` 返回的 `data.backlinks` 包含 `IRefFile[]`（有 `id/name/path/box` 字段），直接遍历即可
- `getBackmention` 的返回结构需要与 `getBacklink` 保持一致处理（思源可能返回 `data.backmentions` 或 `data.backlinks`）
- 保留现有的去重逻辑（`seen Set`）和上限截断（50条）
- 缓存机制无需变更（缓存 key 基于 `box:docId`）