---
name: extract-shared-md-renderer
overview: 提取公共 Markdown 渲染工具到 src/utils/mdRenderer.ts，消除项目中 3 套独立实现的代码重复（HLJS_INLINE_COLORS 映射表、convertHljsToInlineStyles 函数、marked + code 高亮 Renderer），让 5 个消费方统一使用共享模块。
todos:
  - id: create-shared-md-renderer
    content: 创建 src/utils/mdRenderer.ts 统一 Markdown 渲染模块（HLJS_INLINE_COLORS + convertHljsToInlineStyles + 带缓存的 parseMarkdown）
    status: completed
  - id: update-docanalysis-and-format
    content: 更新 docAnalysis/utils/mdRenderer.ts 为重新导出共享模块，更新 formatAssistant/utils/mdToShared.ts 移除私有重复常量/函数并导入共享模块
    status: completed
    dependencies:
      - create-shared-md-renderer
  - id: update-gitpush-markdown
    content: "重构 gitPush/components/MarkdownPreviewDialog.vue，移除内联 marked/Renderer/hljs 实现，改用共享 parseMarkdown({ codeHighlight: true })"
    status: completed
    dependencies:
      - create-shared-md-renderer
  - id: update-aigen-and-skills
    content: 更新 aiContentGenerator/utils.ts 和 skillsViewer/index.vue，移除内联 marked 调用，改用共享 parseMarkdown
    status: completed
    dependencies:
      - create-shared-md-renderer
---

## 需求概述

消除项目中 3 套独立的 `marked` + `highlight.js` Markdown 渲染实现，创建统一的共享模块 `src/utils/mdRenderer.ts`，作为项目唯一 Markdown 渲染入口。

## 核心问题

项目当前有 5 处 Markdown 渲染逻辑，其中 3 处为完整独立实现（docAnalysis、formatAssistant、gitPush），另有 2 处简单调用（aiContentGenerator、skillsViewer）。`HLJS_INLINE_COLORS` 38 条颜色映射和 `convertHljsToInlineStyles()` 函数在 docAnalysis 和 formatAssistant 中完全重复。

## 修复目标

- 新建 `src/utils/mdRenderer.ts` 统一模块，导出共享常量、工具函数和渲染 API
- `parseMarkdown(mdText, options?)` 支持 `codeHighlight`（hljs 高亮）和 `inlineStyles`（内联样式，桌面预览不需）配置项
- docAnalysis 改为重新导出共享模块（保持向后兼容）
- formatAssistant 移除私有重复代码，改为导入共享模块
- gitPush MarkdownPreviewDialog、aiContentGenerator、skillsViewer 移除内联渲染实现，改用共享模块

## 技术选型

- **渲染引擎**：marked（v17，项目已有依赖）
- **语法高亮**：highlight.js（v11，项目已有依赖）
- **复用原则**：基于 docAnalysis/utils/mdRenderer.ts 的成熟实现模式（独立 Renderer 实例 + 缓存 + `marked.parse()` 局部选项，避免全局副作用）

## 实现方案

### 共享模块 API 设计

新建 `src/utils/mdRenderer.ts`，导出：

```ts
// 常量 — hljs class 到内联颜色映射（38条）
export const HLJS_INLINE_COLORS: Record<string, string>

// 工具函数 — 将 hljs class spans 转为 inline style spans
export function convertHljsToInlineStyles(highlighted: string): string

// 核心渲染函数
export function parseMarkdown(mdText: string, options?: ParseMarkdownOptions): string

interface ParseMarkdownOptions {
  codeHighlight?: boolean   // 默认 false，启用后使用 hljs 高亮代码块
  inlineStyles?: boolean    // 默认 false，仅在 codeHighlight=true 时有意义
  breaks?: boolean          // 默认 true，启用 GFM 换行
  gfm?: boolean             // 默认 true，启用 GFM 表格/任务列表等
}
```

**渲染器缓存策略**：内部维护最多 2 个 Renderer 实例（有高亮无内联 / 有高亮有内联），无高亮时不缓存。使用 `marked.parse()` + 局部 Renderer 方式，禁用 `marked.use()` 全局副作用，与 docAnalysis 现有方式一致。

### 消费方适配矩阵

| 消费方 | 原实现方式 | 改用共享 API | 变更说明 |
| --- | --- | --- | --- |
| docAnalysis/mdRenderer.ts | 独立 Renderer + hljs + 内联样式 | 重新导出 `parseMarkdown`、`convertHljsToInlineStyles` | 删除全部内部实现 ~100 行 |
| formatAssistant/mdToShared.ts | 私有 HLJS_INLINE_COLORS + convertHljsToInlineStyles | 从 shared 导入 | 仅删除 38 行常量+函数，其余不变 |
| gitPush/MarkdownPreviewDialog.vue | 内联 getRenderer + renderMarkdown | `parseMarkdown(md, { codeHighlight: true })` | 删除 ~55 行（marked/Renderer/hljs import + 2 个函数） |
| aiContentGenerator/utils.ts | 简单 marked.parse + 标题粗体剥离 | `parseMarkdown(content)` 后自行剥离标题粗体 | 删除 marked import + setOptions 调用 |
| skillsViewer/index.vue | 内联 renderMarkdown | `parseMarkdown(content)` | 删除 marked import + 内联函数 ~10 行 |


### 架构设计

```
┌──────────────────────────────────────────────┐
│            src/utils/mdRenderer.ts            │  ← 新建统一入口
│  HLJS_INLINE_COLORS + convertHljsToInline     │
│  + parseMarkdown(缓存 Renderer, 局部选项)       │
└────┬──────────────────────────────┬──────────┘
     │ import                      │ import / re-export
     ▼                             ▼
┌────────────┐  ┌──────────────────────┐  ┌──────────────┐
│ format     │  │ docAnalysis           │  │ gitPush /    │
│ Assistant  │  │ (re-export, 向后兼容)  │  │ aiContentGen │
│ (复用常量)  │  │                      │  │ / skills     │
└────────────┘  └──────────────────────┘  └──────────────┘
```

## 实施注意事项

### 向后兼容

- `docAnalysis/utils/mdRenderer.ts` 导出签名不变（`parseMarkdown` 参数兼容），唯一消费者 `PublishPanel.vue` 无需改动
- `formatAssistant/utils/mdToShared.ts` 公开导出不变（`BaseThemeColors`、`convertMarkdown` 等），`mdToWechat`/`mdToBilibili` 无需改动

### 全局副作用消除

- 移除 `aiContentGenerator/utils.ts` 中 `marked.setOptions()` 全局配置调用
- 移除 `gitPush/MarkdownPreviewDialog.vue` 中 `marked.setOptions()` 全局配置调用
- 统一改用 `parseMarkdown` 内置的局部选项传递

### 代码量变化

- 新增 1 个文件（~120 行）
- 净减少约 170 行重复代码