---
name: review-panel-code-audit-and-optimize
overview: 对 ReviewPanel.vue + ReviewPanel.scss 进行全面审查，移除冗余代码、消除重复样式定义、清理无效 CSS 类引用，在保持功能完全不变的前提下优化代码质量。
todos:
  - id: remove-dead-css-classes
    content: ReviewPanel.vue 模板：移除 subsection-toggle/subsection-chevron/subsection-body 三个死类名
    status: completed
  - id: remove-duplicate-dot-flashing
    content: ReviewPanel.scss：删除与 index.scss 重复的 .dot-flashing 定义（374-379行）
    status: completed
  - id: replace-loading-dot-with-mixin
    content: ReviewPanel.scss：.review-loading-dot 改用 @include collapsible-status-dot mixin，删除独立定义和 review-dot-blink 关键帧
    status: completed
  - id: remove-redundant-font-size
    content: "ReviewPanel.scss：.review-model 删除冗余 font-size: $font-size-2xs（mixin 已提供）"
    status: completed
  - id: add-subsection-chevron-style
    content: ReviewPanel.scss：新增 .subsection-chevron 样式规则引用 collapsible-chevron mixin，保持旋转动画
    status: completed
    dependencies:
      - remove-dead-css-classes
  - id: inline-severity-label-map
    content: ReviewPanel.vue script：删除 SEVERITY_LABEL_MAP 常量，filterOptions 内使用内联映射表
    status: completed
---

## 用户需求

完整审查 ReviewPanel.vue 和 ReviewPanel.scss，移除代码冗余，优化代码质量。

## 核心问题清单

### 1. SCSS：`.dot-flashing` 与 index.scss 重复定义

ReviewPanel.scss 第374-379行定义了 `.dot-flashing`，与 index.scss 第275-280行完全相同。ReviewPanel.vue 的 `<style>` 已 `@use "../styles/index.scss"`，可直接复用共享定义。

### 2. SCSS：`.review-loading-dot` + `@keyframes review-dot-blink` 与 index.scss mixin 重复

`review-dot-blink` 动画（1s ease-in-out infinite, opacity 1/0.3）与 index.scss 的 `collapsible-blink` 完全一致。`.review-loading-dot` 可改用 `@include collapsible-status-dot(var(--b3-theme-success))` 复用 mixin，无需独立定义。

### 3. 模板：3 个无 CSS 定义的死类名

`subsection-toggle`、`subsection-chevron`、`subsection-body` 在模板中使用但无任何 SCSS 定义，是从 CollapsibleSection 迁移时遗留的无效引用。

### 4. SCSS：`.review-model` 中 mixin 已设 font-size 后又重复覆盖

`codex-meta-label` mixin 已设 `font-size: 10px`，外部又覆盖 `font-size: $font-size-2xs`（也是10px），属无效重复。

### 5. Script：`SEVERITY_LABEL_MAP` 常量仅一处使用

该常量（第290-294行）仅在 `filterOptions` computed 中使用，可内联消除中间变量。

## 技术方案

### 改动策略

共 5 项独立优化，互不依赖，可在一次提交中完成。所有改动仅涉及 2 个文件，影响范围极小。

### 改动文件

#### `src/features/aiContentGenerator/components/ReviewPanel.vue`

**模板层（3 处死类名移除）**：

- `subsection-toggle`：该类无任何 CSS 定义。由于 `showScores` 折叠切换通过 `v-if` 控制，类名移除后不影响交互行为。若该 button 需要样式，由父级 `.score-section` 和后续新增的独立样式处理。
- `subsection-chevron`：chevron 旋转动画由 `:class="{ expanded: showScores }"` 驱动，移除类名后保留 expanded 状态绑定，但需确认父级是否有通用 chevron 样式继承。经审查，index.scss 中的 `collapsible-chevron` mixin 未被此元素引用，移除后 chevron 不会旋转——需要补充内联 style 或用已有 mixin。安全方案：移除死类名但保留 expanded 绑定，在 ReviewPanel.scss 中新增 `.subsection-chevron` 样式规则（复用 `collapsible-chevron` mixin）。
- `subsection-body`：该类无任何 CSS 定义，移除不影响渲染。

**Script 层（1 处冗余常量消除）**：

- 删除 `SEVERITY_LABEL_MAP` 常量（290-294行）
- `filterOptions` computed 中改为直接访问 i18n：`label: props.i18n[`reviewSeverity${sev === '高' ? 'High' : sev === '中' ? 'Mid' : 'Low'}`]` ——但这需要中文到英文键名的映射。更简洁的方案：使用 props.i18n 中已有的键名约定。经审查，i18n 键为 `reviewSeverityHigh`、`reviewSeverityMid`、`reviewSeverityLow`，而 `SEVERITY_LEVELS` 值为 `["高", "中", "低"]`，需要映射。保留一个轻量的映射表在 filterOptions 内部即可：

```ts
const sevKeyMap: Record<IssueSeverity, string> = { 高: 'reviewSeverityHigh', 中: 'reviewSeverityMid', 低: 'reviewSeverityLow' }
```

然后将 SEVERITY_LABEL_MAP 删除，filterOptions 内改为 `label: props.i18n[sevKeyMap[sev]]`。

#### `src/features/aiContentGenerator/styles/ReviewPanel.scss`

**3 处 CSS 冗余消除**：

1. **删除 `.dot-flashing` 重复定义**（374-379行）：index.scss 已有完全相同定义，删除即可。

2. **`.review-loading-dot` + `@keyframes review-dot-blink` 替换为 mixin**：

- 删除 `@keyframes review-dot-blink`（57-60行）
- `.review-loading-dot` 改为 `@include collapsible-status-dot(var(--b3-theme-success))`（index.scss 提供此 mixin）

3. **`.review-model` 冗余 font-size 覆盖**：

- 删除 `font-size: $font-size-2xs;`（319行），mixin `codex-meta-label` 已设 `font-size: 10px`

**1 处样式补充**：

- 新增 `.subsection-chevron` 样式规则，引用 `collapsible-chevron` mixin 以保持 chevron 旋转动画功能正常。

### 不改动

- index.scss 中的 `collapsible-blink`、`collapsible-status-dot`、`dot-flashing`、`collapsible-chevron` 保持不变（被其他组件使用）
- ReviewPanel.vue 的 Props/Emit 接口不变
- 所有业务逻辑不变