---
name: docNavigation-参考下拉框-修正
overview: 修正「参考」下拉框实现：改为过滤子文档列表（仅显示标题含"参考"的子文档），移除先前错误的当前文档标题检测逻辑。
todos:
  - id: fix-composable-and-types
    content: 修正 useDocNavigation.ts：移除 docTitle/hasReference/fetchDocTitle 导入与调用，新增 filteredChildDocs/filteredChildCount computed，更新接口和 return；同步清理 storage.ts（移除 titleCache/getCachedTitle/setCachedTitle/fetchDocTitle/TitleCacheItem 导入）和 types/index.ts（移除 TitleCacheItem 接口）
    status: completed
  - id: fix-container
    content: 修正 DocNavContainer.vue：解构 hasReference 替换为 filteredChildDocs/filteredChildCount，参考实例改用过滤数据（child-docs="filteredChildDocs"，child-count="filteredChildCount"，v-if="filteredChildCount > 0"），更新模板注释
    status: completed
    dependencies:
      - fix-composable-and-types
  - id: verify-lint
    content: read_lints 检查 docNavigation 目录，确认零 ERROR，更新今日记忆文件记录本次修复
    status: completed
    dependencies:
      - fix-container
---

## 产品概述

修正 docNavigation 导航条中「参考」下拉框的实现逻辑，使其正确显示过滤后的子文档。

## 核心功能

- 「参考」下拉框显示标题（文档名）包含"参考"二字的子文档子集，而非全部子文档
- 仅当存在匹配子文档时才显示（filteredChildCount > 0）
- 「下级文档」下拉框行为不变，继续显示全部子文档
- 过滤为纯本地操作（`stripHtml(content).includes("参考")`），无需 API 调用

## 技术方案

### 实现策略

将当前错误的"获取当前文档标题 + 判断含参考"方案替换为"就地过滤子文档列表"。子文档的 `content` 字段已由 `fetchDocHierarchy` 返回时包含标题，无需额外 API 调用，直接对 `childDocs` 做 `filter(stripHtml(doc.content).includes("参考"))` 即可。

### 需要移除的代码（错误实现残留）

- `storage.ts`：`titleCache` 字段、`getCachedTitle`/`setCachedTitle` 方法、`fetchDocTitle` 导出函数、`TitleCacheItem` 导入
- `types/index.ts`：`TitleCacheItem` 接口定义
- `useDocNavigation.ts`：`docTitle` ref、`hasReference` computed、`fetchDocTitle` 导入与调用、接口中对应字段、`resetState` 中对 `docTitle` 的清理

### 需要新增的代码

- `useDocNavigation.ts`：`filteredChildDocs` computed（`childDocs.filter(doc => stripHtml(doc.content).includes("参考"))`）、`filteredChildCount` computed，加入 `UseDocNavigationReturn` 接口和 return

### 不修改的文件

- `ChildDocDropdown.vue`：通用化 props（triggerText/panelTitle/triggerIcon）保留
- `icons.ts`、i18n 分片、`README.md`：无需改动

### 目录结构

```
src/features/docNavigation/
├── composables/
│   └── useDocNavigation.ts        # [MODIFY] 移除 docTitle/hasReference/fetchDocTitle，新增 filteredChildDocs/filteredChildCount
├── types/
│   ├── index.ts                   # [MODIFY] 移除 TitleCacheItem 接口
│   └── storage.ts                 # [MODIFY] 移除 titleCache/getCachedTitle/setCachedTitle/fetchDocTitle/TitleCacheItem 导入
└── components/
    └── DocNavContainer.vue        # [MODIFY] hasReference→filteredChildDocs/filteredChildCount，参考实例改用过滤数据
```