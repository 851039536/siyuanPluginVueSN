---
name: fix-outputpanel-redundancy
overview: 修复 OutputPanel.vue 中 L38 summary 三元冗余和 L42 截断魔法数字。
todos:
  - id: fix-summary-ternary
    content: 简化 L38 summary 冗余三元表达式为静态文本
    status: completed
  - id: fix-magic-number
    content: 提取 L42 500 硬编码为 MAX_STDOUT_PREVIEW 常量
    status: completed
  - id: verify
    content: 验证 ESLint + tsc
    status: completed
    dependencies:
      - fix-summary-ternary
      - fix-magic-number
---

## 修复 OutputPanel.vue 2 项问题

1. L38 `<summary>` 三元冗余：`v-if="entry.fullStdout || entry.fullStderr"` 已保证渲染时必有内容，`{{ entry.fullStdout || entry.fullStderr ? '详情' : '' }}` 永不落空，简化为静态文本
2. L42 `500` 硬编码魔法数字：stdout 截断阈值提取为常量 `MAX_STDOUT_PREVIEW`

## 修改范围

仅修改 `src/features/gitPush/components/OutputPanel.vue` 一个文件，2 处改动。

### 修复 1：L38 三元简化

```html
<!-- 改前 -->
<summary>{{ entry.fullStdout || entry.fullStderr ? '详情' : '' }}</summary>
<!-- 改后 -->
<summary>详情</summary>
```

### 修复 2：L42 提取常量

在 `<script setup>` 顶部新增常量，模板引用：

```typescript
const MAX_STDOUT_PREVIEW = 500
```

```html
<!-- 改前 -->
{{ entry.fullStdout.length > 500 ? `${entry.fullStdout.slice(0, 500)}...` : entry.fullStdout }}
<!-- 改后 -->
{{ entry.fullStdout.length > MAX_STDOUT_PREVIEW ? `${entry.fullStdout.slice(0, MAX_STDOUT_PREVIEW)}...` : entry.fullStdout }}
```

### 验证

- ESLint：`pnpm lint`
- tsc：`npx tsc --noEmit`（确认无新增错误）