---
name: DiffPreview 样式合规修复
overview: 审查 aiContentGenerator/DiffPreview 页面样式,修复字体大小与规则不符的问题。根因是共享样式文件 styles/index.scss 未导入设计 Token 且根容器缺基准字号,DiffPreview 区域全部硬编码 px。本次修复聚焦 DiffPreview 相关样式(含必要的地基修复),使其符合 Codex 两级字号制与 Token 规范。
todos:
  - id: foundation-fix
    content: "在 styles/index.scss 顶部添加 @use 变量导入,并为 .ai-content-panel 根容器补充基准 font-size: $font-size-xs"
    status: completed
  - id: diffpreview-tokenize
    content: 将 DiffPreview 区块(L414-560)所有硬编码 font-size/font-weight/border-radius 替换为设计 Token,参照 [skill:codex-ui-style-guide] 规范
    status: completed
    dependencies:
      - foundation-fix
---

## 用户需求

用户打开了 `DiffPreview.vue` 组件,指出该页面样式中的字体大小与项目规则不符,要求审查并给出修改方案。

## 产品概述

DiffPreview 是 AI 内容生成器模块的子组件,用于对比原始内容与 AI 生成内容的差异(支持合并/分栏视图)。组件本身无样式,样式定义在共享的 `styles/index.scss` 第 414-560 行。

## 核心问题

经审查,DiffPreview 相关样式存在两类违规:

**地基问题(根本原因)**

1. `styles/index.scss` 顶部缺少 `@use "@/variables.scss" as *;`,导致全部 SCSS Token 不可用 — 这是所有硬编码值的根因
2. 根容器 `.ai-content-panel` 缺少 `font-size: $font-size-xs;` — 违反"Dock 面板根容器必须显式设置基准字号"硬规则

**DiffPreview 区块硬编码(第 414-560 行)**

3. `.diff-toolbar-title` font-size `11px`(非标准值,规则仅允许 10/12/14px)+ font-weight `500`
4. `.diff-stats` font-size `10px` + font-weight `500`
5. `.mode-btn` font-size `10px`
6. `.diff-viewer-wrapper` font-size `12px` + `:deep(.vue-diff)` font-size `12px !important`
7. 圆角硬编码:4px / 3px / 2px(应统一用 `$radius-sm`)

**修复范围**:仅聚焦 DiffPreview 相关样式 + 必要地基修复,不触碰文件中其他子组件的样式区块。

## Tech Stack

- 项目:思源笔记 Vue 3 + TypeScript 插件(Vite 构建)
- 样式:SCSS + 全局设计 Token(`src/_variables.scss`)
- 规范:Codex UI 风格 + 两级字号制(12px 内容 / 10px 辅助)

## Implementation Approach

### 策略

在单一文件 `styles/index.scss` 内完成全部修复,分两步:

1. **地基修复**:在文件最顶部插入 `@use "@/variables.scss" as *;`(SCSS 要求 `@use` 必须在所有其他语句之前),使 `$font-size-*`、`$font-weight-*`、`$radius-*` 等 Token 可用于整个文件。同时为 `.ai-content-panel` 根容器补充 `font-size: $font-size-xs;`。

2. **DiffPreview 区块 Token 化**:将第 414-560 行的硬编码 font-size / font-weight / border-radius 逐一替换为 Token,字号语义对齐两级字号制。

### 关键技术决策

| 硬编码值 | 替换 Token | 理由 |
| --- | --- | --- |
| `font-size: 11px`(L442 toolbar-title) | `$font-size-xs`(12px) | "Diff 对比"是内容级小标题,11px 非标准值,统一为 12px |
| `font-size: 10px`(L450/477 stats/mode-btn) | `$font-size-2xs`(10px) | 辅助文字(统计数字/按钮标签),值匹配仅换 Token |
| `font-size: 12px`(L499/506 viewer) | `$font-size-xs`(12px) | Diff 正文内容基准,值匹配仅换 Token |
| `font-weight: 500`(L443/451) | `$font-weight-medium` | 直接映射 |
| `border-radius: 4px`(L420) | `$radius-sm`(4px) | 值匹配 |
| `border-radius: 3px`(L471) | `$radius-sm`(4px) | 无 3px Token,统一为 4px(视觉差异极小) |
| `border-radius: 2px`(L481) | `$radius-sm`(4px) | 无 2px Token,统一为 4px |
| `font-size: 12px !important`(L506) | `$font-size-xs !important` | SCSS 变量可直接与 `!important` 连用,无需插值 |


### 性能与可靠性

- 纯样式 Token 替换,零逻辑变更,零性能影响
- `!important` 保持不变(覆盖第三方 vue-diff 默认样式所需)
- 圆角从 2px/3px 统一到 4px,视觉差异极小但消除非标准值

## Implementation Notes

- **SCSS `@use` 位置**:`@use` 必须在文件最顶部,在第一行注释之前。插入后原有注释 `// AI内容生成器面板样式` 移至其后
- **`!important` 与变量**:SCSS 中 `font-size: $font-size-xs !important;` 可直接使用,编译后输出 `font-size: 0.75rem !important;`,无需 `#{}` 插值
- **不影响其他组件**:文件顶部 mixin(collapsible-toggle L19 `font-size: 11px`、codex-meta-label L71 `font-size: 10px` 等)及其他区块(quick-actions-bar、markdown-preview 等)的硬编码不在本次范围,因用户明确聚焦 DiffPreview。添加变量导入后这些值仍为硬编码但不受影响,可在后续按需处理
- **DiffPreview.vue 无需改动**:组件的 `<style>` 块仅 `@use "../styles/index.scss"`,样式修正全在 SCSS 文件内完成

## Architecture Design

无架构变更。修改仅涉及单个 SCSS 文件的 Token 合规化,不改变组件结构、数据流或功能逻辑。

## Directory Structure

```
src/features/aiContentGenerator/
└── styles/
    └── index.scss  # [MODIFY] 唯一修改文件
```

### 文件修改详情

**`src/features/aiContentGenerator/styles/index.scss`** [MODIFY]

**地基修复(文件顶部 + 根容器)**:

- L1 前:插入 `@use "@/variables.scss" as *;`
- L79-87 `.ai-content-panel`:补充 `font-size: $font-size-xs;`(根容器基准字号)

**DiffPreview 区块(L414-560)Token 化**:

- L420 `.diff-preview`: `border-radius: 4px` → `$radius-sm`
- L442 `.diff-toolbar-title`: `font-size: 11px` → `$font-size-xs`; `font-weight: 500` → `$font-weight-medium`
- L450 `.diff-stats`: `font-size: 10px` → `$font-size-2xs`; `font-weight: 500` → `$font-weight-medium`
- L471 `.diff-mode-toggle`: `border-radius: 3px` → `$radius-sm`
- L477 `.mode-btn`: `font-size: 10px` → `$font-size-2xs`
- L481 `.mode-btn`: `border-radius: 2px` → `$radius-sm`
- L499 `.diff-viewer-wrapper`: `font-size: 12px` → `$font-size-xs`
- L506 `:deep(.vue-diff)`: `font-size: 12px !important` → `$font-size-xs !important`

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose: 提供完整的 Codex UI 样式规范作为审查依据,确认每处硬编码对应的正确 Token 映射
- Expected outcome: 确保 DiffPreview 区块的 font-size / font-weight / border-radius 全部符合 Token 规范,无遗漏