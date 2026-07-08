---
name: fix-mdrenderer-issues
overview: 修复 mdRenderer.ts 审查中发现的 5 个问题：全局状态污染、lang 未转义、缓存清理出口、extensions 扩展入口、预设快捷方式。
todos:
  - id: fix-mdrenderer-core
    content: 修复 mdRenderer.ts：移除 marked.setOptions 全局污染、对 lang 做 escapeHtml 转义、导出 clearRendererCache、增加 extensions 字段和 MarkdownPreset 预设支持
    status: completed
  - id: update-onunload
    content: 在 src/index.ts 的 onunload 中导入并调用 clearRendererCache()
    status: completed
    dependencies:
      - fix-mdrenderer-core
  - id: simplify-docanalysis
    content: 简化 src/features/docAnalysis/utils/mdRenderer.ts 的 parseMarkdown 外壳为 "wechat" 预设调用
    status: completed
    dependencies:
      - fix-mdrenderer-core
---

## 修复内容

修复 `src/utils/mdRenderer.ts` 审查中发现的 5 个问题，提升代码健壮性、安全性和可扩展性。

## 修复清单

### 关键修复（2 项）

1. **`marked.setOptions()` 全局状态污染** — 将 `marked.setOptions({ breaks, gfm })` 改为通过 `marked.parse()` 的第二参数按调用传入，消除不同调用方之间的配置互相干扰
2. **`lang` 未转义直接拼入 HTML 属性** — `class="language-${lang}"` 中 `lang` 来自用户 Markdown 输入（如 ```` ```">...```），对 `lang` 调用 `escapeHtml()` 防止属性注入

### 增强补充（3 项）

3. **导出 `clearRendererCache()`** — HMR 热重载或测试时清除缓存的 Renderer 实例，在 `src/index.ts` 的 `onunload()` 中调用
4. **`ParseMarkdownOptions` 增加 `extensions` 字段** — 透传 marked 自定义扩展给 `marked.parse()`，支持自定义 tokenizer/walker 等高级场景
5. **增加命名预设快捷方式** — 支持 `"basic"` / `"highlight"` / `"wechat"` 三个字符串预设，`parseMarkdown` 签名扩展为 `(mdText: string, options?: ParseMarkdownOptions | Preset): string`，保持向后兼容

## 技术方案

### 修改点 1：`marked.setOptions()` → per-call 传参

**当前（有 bug）**：

```typescript
marked.setOptions({ breaks, gfm })
return marked.parse(mdText, renderer ? { renderer } : undefined) as string
```

**修复后**：

```typescript
return marked.parse(mdText, {
  breaks,
  gfm,
  ...(renderer ? { renderer } : {}),
}) as string
```

`marked.parse()` 第二个参数接受与 `marked.setOptions()` 相同的选项对象，语义等价且不污染全局单例。

### 修改点 2：对 `lang` 进行 HTML 属性转义

**当前（有风险）**：

```typescript
const langAttr = lang ? ` class="language-${lang}"` : ""
```

**修复后**：

```typescript
const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ""
```

复用已导入的 `escapeHtml` 工具函数（处理 `& < > " '`）。

### 修改点 3：导出 `clearRendererCache()`

在 `src/utils/mdRenderer.ts` 末尾新增：

```typescript
export function clearRendererCache(): void {
  cachedRenderers = {}
}
```

在 `src/index.ts` 的 `onunload()` 最末尾（`destroy()` 之前）添加：

```typescript
import { clearRendererCache } from "@/utils/mdRenderer"
// ...
clearRendererCache()
destroy()
```

### 修改点 4：增加 `extensions` 字段

`ParseMarkdownOptions` 接口新增：

```typescript
extensions?: marked.TokenizerAndRendererExtension[]
```

`parseMarkdown()` 中透传：

```typescript
return marked.parse(mdText, {
  breaks,
  gfm,
  ...(extensions ? { extensions } : {}),
  ...(renderer ? { renderer } : {}),
}) as string
```

### 修改点 5：命名预设快捷方式

新增类型：

```typescript
export type MarkdownPreset = "basic" | "highlight" | "wechat"
```

预设映射：

```typescript
const PRESETS: Record<MarkdownPreset, ParseMarkdownOptions> = {
  basic: {},
  highlight: { codeHighlight: true },
  wechat: { codeHighlight: true, inlineStyles: true },
}
```

`parseMarkdown` 签名扩展为：

```typescript
export function parseMarkdown(mdText: string, options?: ParseMarkdownOptions | MarkdownPreset): string {
  const resolved: ParseMarkdownOptions = typeof options === "string"
    ? PRESETS[options] ?? {}
    : (options ?? {})
  // ... 后续逻辑不变
}
```

### 调用方影响分析

| 调用方 | 当前用法 | 修复后 | 变动 |
| --- | --- | --- | --- |
| `aiContentGenerator/utils.ts` | `parseMarkdown(md)` | 不变 | 无 |
| `skillsViewer/index.vue` | `parseMarkdown(content)` | 不变 | 无 |
| `gitPush/MarkdownPreviewDialog.vue` | `parseMarkdown(md, { codeHighlight: true })` | 可选改用 `"highlight"` | 无（可选优化） |
| `docAnalysis/utils/mdRenderer.ts` | `parseMarkdown(md, { codeHighlight: true, inlineStyles: true })` | 改为 `"wechat"` | 简化 |


`docAnalysis` 模块的 `parseMarkdown()` 外壳可用预设简化为一行：

```typescript
export function parseMarkdown(mdText: string): string {
  return sharedParseMarkdown(mdText, "wechat")
}
```

### 向后兼容保证

- `parseMarkdown(md)` — 默认行为不变（无 options → `{}` → `"basic"`）
- `parseMarkdown(md, { codeHighlight: true })` — `ParseMarkdownOptions` 对象传入，逻辑不变
- `parseMarkdown(md, { codeHighlight: true, inlineStyles: true })` — 同上
- 字符串 `"basic"` / `"highlight"` / `"wechat"` 为新增能力，不影响现有调用