---
name: docAnalysis-review-fix
overview: 修复 docAnalysis/index.vue 及其相关 composable/组件中审查发现的逻辑漏洞、冗余、内存泄露、死代码和类型契约不一致问题。
todos:
  - id: composable-refactor
    content: 在 useDocAnalysis.ts 新增 resetQueryState() 统一查询视图重置，并删除 analyzeDocStats 中 _t/_d/_bm/_wc 死代码解构
    status: completed
  - id: index-vue-fixes
    content: 修复 index.vue：平台过滤清除后重置结果、loadAttrs 竞态 token、IntersectionObserver 断开、v-memo 依赖补全、三处重置逻辑统一
    status: completed
    dependencies:
      - composable-refactor
  - id: filtersettings-cleanup
    content: 清理 FilterSettings.vue 冗余双写：移除 optionsUpdate 事件与 handleChange，删除 index.vue 中 handleOptionsUpdate 及监听
    status: completed
  - id: sortfield-typed-options
    content: 在 types/index.ts 新增 SORT_FIELD_OPTIONS 常量，并将 index.vue 排序下拉改为 v-for 类型化渲染
    status: completed
---

## 用户需求

审查 `src/features/docAnalysis/index.vue` 及其关联模块，定位并修复以下五类问题：代码逻辑漏洞、冗余、内存泄露、死代码、重复类型/契约不一致。

## 审查结论（待修复项）

1. 逻辑漏洞：平台过滤清除后结果未重置；`loadAttrs` 异步加载属性无竞态保护。
2. 冗余：`optionsUpdate` 事件「自己复制自己」的冗余双写；`handleReset` 与 `clearStatsFilter` 重置范围不一致且重复；`clearStatsFilter` 越界直写 `queryState`。
3. 内存泄露：`IntersectionObserver` 在哨兵元素被移除时未 `disconnect`。
4. 死代码：`useDocAnalysis.ts` 中 `_t/_d/_bm/_wc` 四个永远为 `undefined` 的解构变量。
5. 重复类型/契约：`optionsUpdate` 两端参数类型不一致；`v-memo` 依赖数组不完整；排序字段 option 硬编码与 `SortField` 类型脱节。

## 修复边界

仅修改 docAnalysis 模块内相关文件，不引入新依赖、不改变对外行为，遵守项目硬规则（emit camelCase、if 花括号、不执行 build/lint）。

## 技术栈

- Vue 3 + TypeScript（`<script setup lang="ts">`）
- 现有 composable 架构：`useDocAnalysis` 集中持有响应式状态与业务方法
- 现有类型分层：`types/index.ts` 存放类型 + 共享常量

## 实施方案

### 1. Composable 层收敛状态封装

在 `useDocAnalysis.ts` 中新增 `resetQueryState()` 方法，统一「清空结果 + 回到 idle」的逻辑，替代组件内多处越界直写 `queryState`：

```
resetQueryState(): setResults([]) + hasQueried=false + status="idle"
```

同时删除 `analyzeDocStats` 中四个无意义解构变量（保留 Promise.all 全部 9 个 Promise 的并发执行，仅忽略副作用型函数的返回值），保持 `queryToken`/`analyzeToken` 竞态保护不变。

### 2. 组件层逻辑修复（index.vue）

- **平台过滤清除一致性**：`handlePlatformFilter` 清除分支在 `activePlatformFilter=""` 后追加 `resetQueryState()`，使列表、chip 高亮、hint 三态一致。
- **属性加载竞态保护**：新增模块级 `attrsToken`，`loadAttrs` 在 `await` 后校验 token，过期请求直接丢弃（与 `queryToken` 模式对齐）。
- **Observer 清理**：`watch(sentinelRef)` 在 `el` 为 `null` 时执行 `disconnect()` 并置空，避免面板存活期内累积失效 observer。
- **统一重置**：`clearStatsFilter`/`handleReset`/平台清除三处复用 `resetQueryState()`；`handleReset` 补齐 `duplicateNameFilter` 与 `activePlatformFilter` 清理，消除范围不一致。
- **v-memo 依赖补全**：追加 `notebookName`、`hpath`、`unpublishedPlatforms`，与 `DocListItem` 实际渲染字段对齐。

### 3. 消除 optionsUpdate 冗余双写

`FilterSettings.vue` 通过 `v-model` 直接修改 `props.options`（即父组件传入的同一个 `filterOptions` 响应式引用），再 `emit` 完整对象回父组件 `Object.assign` 自身属于无效往返。移除 `optionsUpdate` 事件与 `handleChange`、父组件 `handleOptionsUpdate` 及 `@optionsUpdate` 监听，同时解决两端参数类型不一致问题。

### 4. SortField 类型化

在 `types/index.ts` 新增 `SORT_FIELD_OPTIONS: { value: SortField; label: string }[]`，模板 `<select>` 改为 `v-for` 渲染，使 option value 与 `SortField` 联合类型编译期绑定，消除硬编码脱节。

## 实现要点

- 保持 `Promise.all` 的 9 个分析查询并发不变，仅调整解构写法，不影响统计行为。
- `resetQueryState()` 只负责「结果 + 查询视图」重置，`statsFilter`/`duplicateNameFilter` 由各自调用方按语义清理，避免职责过载。
- 修复均不改变现有对外事件契约与 UI 外观，不涉及 SCSS 与 i18n 分片。