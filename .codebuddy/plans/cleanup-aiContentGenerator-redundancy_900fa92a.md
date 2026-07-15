---
name: cleanup-aiContentGenerator-redundancy
overview: 清理 aiContentGenerator 审查中发现的 7 处冗余：useGeneration 未使用导出、index.vue 未使用变量和错误编号、BottomInputArea/PanelHeader 死代码、SCSS 死样式。
todos:
  - id: clean-useGeneration-exports
    content: 从 useGeneration.ts 的 return 对象中移除 4 个未使用导出：abortController、currentProvider、startGeneration、resetAllGenerationStates
    status: completed
  - id: clean-index-vue-redundancy
    content: 清理 index.vue：移除未使用的 loadTargetDocument 解构，修正 7 处章节编号注释
    status: completed
  - id: clean-bottominput-comment
    content: 清理 BottomInputArea.vue：注释"提示词"→"RAG"，移除多余空行
    status: completed
  - id: clean-panelheader-deadcode
    content: 清理 PanelHeader.vue 空 script 块和 PanelHeader.scss 死样式
    status: completed
---

## 产品概述

清理 aiContentGenerator 模块在上次移除提示词功能后遗留的 7 类冗余代码，提升代码整洁度。

## 变更内容

1. **useGeneration.ts** — 移除 4 个未使用的导出：`abortController`、`currentProvider`、`startGeneration`、`resetAllGenerationStates`（仅在 composable 内部使用，外部从未 destructure）
2. **index.vue** — 移除未使用的 `loadTargetDocument` 解构（line 193）
3. **index.vue** — 移除章节编号注释中的错乱数字（`// 1. 技能加载` 等 7 处，编号无用且错乱）
4. **BottomInputArea.vue** — 注释"提示词"→"RAG"（line 4 残留"提示词"文字）
5. **BottomInputArea.vue** — 移除 `</script>` 前多余空行（line 263）
6. **PanelHeader.vue** — 移除空的 `<script setup lang="ts"></script>` 块
7. **PanelHeader.scss** — 移除 `.header-actions` 死样式 + `.panel-header` 上对单子元素无效的 `justify-content: space-between`

## 技术栈

- 框架：Vue 3 + TypeScript + SCSS
- 项目：思源笔记插件（siyuanPluginVueSN）

## 实现方案

### 变更清单（5 个文件，零新文件）

**1. `composables/useGeneration.ts`** — 从 return 对象中移除 4 个未使用导出

当前 return 对象中导出但 index.vue 从未解构的 4 项：

- `abortController` — 仅在 `startGeneration`/`resetAllGenerationStates`/`handleStop` 内部使用
- `currentProvider` — 仅被 `availableModels` 和 `supportsThinking` computed 引用
- `startGeneration` — 仅被 `executeGeneration` 内部调用
- `resetAllGenerationStates` — 仅被 `executeGeneration` 和 `handleStop` 内部调用

从 return 对象中删除这 4 行即可，不影响任何外部调用。

**2. `index.vue`** — 两处修改

- Line 193：`const { selectTargetDocument, selectTargetBlock, loadTargetDocument } = docTarget` → 移除 `loadTargetDocument`
- 7 处章节编号注释去除数字（如 `// ============ 1. 技能加载 ============` → `// ============ 技能加载 ============`）

**3. `components/BottomInputArea.vue`** — 两处修改

- Line 4 注释：`<!-- 第一行：文档选择 + 技能 + 提示词 -->` → `<!-- 第一行：文档选择 + 技能 + RAG -->`
- Line 263 移除 `</script>` 前多余空行

**4. `components/PanelHeader.vue`** — 移除空 script 块

当前：

```html
<script setup lang="ts">
</script>
```

移除整个块，仅保留 template 和 style。

**5. `styles/PanelHeader.scss`** — 移除死样式

- `.header-actions { ... }` (lines 17-20) — 对应模板元素已删除
- `.panel-header` 中 `justify-content: space-between` — 单子元素时无效，保留 `display: flex; align-items: center;` 即可