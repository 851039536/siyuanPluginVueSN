---
name: textDiff SCSS 审查与优化
overview: 审查 src/features/textDiff 的 SCSS（当前全部内联在 index.vue），将样式提取到独立 .scss 文件，合并冗余的按钮/布局基础样式，用全局 Token 替换硬编码值，精简冗余的 :deep 选择器；全程保持视觉与交互逻辑不变，符合 CLAUDE.md 规则。
todos:
  - id: extract-scss
    content: 将 index.vue 内联样式提取到 styles/TextDiff.scss，vue 改为 @use 导入并保留 scoped
    status: completed
  - id: merge-btn-flex
    content: 新增 codex-btn-base 与 flex-row mixin，合并按钮与 header 重复样式
    status: completed
    dependencies:
      - extract-scss
  - id: use-tokens
    content: 删除本地 $codex-mono 改用 $vp-mono，圆角硬编码替换为 $radius-sm/$vp-radius
    status: completed
    dependencies:
      - extract-scss
  - id: trim-deep
    content: 删除 .diff-viewer 中冗余的 :deep .d2h-* 选择器，仅保留 :deep(.vue-diff *)
    status: completed
    dependencies:
      - extract-scss
  - id: verify
    content: 运行 lint 与 tsc，并用 [skill:codex-ui-style-guide] 校验规范合规
    status: completed
    dependencies:
      - merge-btn-flex
      - use-tokens
      - trim-deep
---

## 用户需求

审查 `src/features/textDiff` 功能内的 CSS/SCSS 代码，合并冗余部分，评估性能可优化点，在确保不改变现有功能逻辑与视觉表现的前提下完成重构，并严格符合项目 CLAUDE.md / CLAUDE_RULES.md 的样式规范。

## 核心要点

- 将当前内联在 `index.vue` 的 `<style scoped>` 全部样式提取到独立 SCSS 文件（符合「SCSS 必须分离到 styles/ 目录」强制规则）。
- 合并重复样式：按钮基础样式（`.toggle-btn`/`.action-btn`/`.file-btn`）、flex 布局（`.header-left`/`.header-right`）抽取为共享 mixin。
- 用全局设计 Token 替换本地重复声明与硬编码值（本地 `$codex-mono` → 全局 `$vp-mono`；`border-radius:6px` → `$vp-radius`；`border-radius:4px` → `$radius-sm`）。
- 删除 `.diff-viewer` 中冗余的 `:deep` 后代选择器，减少样式规则数。
- 性能评估结论：`transition: all 0.12s` 与聚焦态 `box-shadow` 在规范中明确允许，保持不变；无明显重排/重绘瓶颈。
- 约束：无法精确映射到全局 Token 的 10px/14px 等 padding 保持原值，避免影响视觉。

## 技术栈

- 框架：Vue 3 + TypeScript + Vite（SFC `<style scoped lang="scss">`）
- 样式：SCSS（Dart Sass，`@use` 模块系统），全局设计 Token 来自 `src/_variables.scss`
- 规范：Codex UI 风格（基于边框卡片、统一 0.12s 过渡、大写标签、禁用 box-shadow 作为主样式）

## 实现方案

采用「等价重构 + 零视觉变更」策略：仅做结构提取与重复合并，不引入任何新样式行为。

1. **样式分离（强制合规）**：新建 `src/features/textDiff/styles/TextDiff.scss`，将 `index.vue` 第 469~835 行的 `<style scoped lang="scss">` 内容整体迁移；`index.vue` 改为 `<style scoped lang="scss"> @use './styles/TextDiff.scss'; </style>`。Vue 的 scoped 属性对 `@use` 引入的外部文件仍然生效，DOM 作用域不变，视觉零变化。
2. **冗余合并**：

- 新增 `@mixin codex-btn-base`：封装 `.toggle-btn`/`.action-btn`/`.file-btn` 共有的 `border / border-radius($radius-sm) / background:transparent / color / cursor / transition:all 0.12s / &:hover{background:surface-lighter}`。三者通过 `@include codex-btn-base;` 复用，差异部分（padding、字体、active 态、svg 子元素）各自保留。
- 新增 `@mixin flex-row($gap:8px)`：封装 `.header-left`/`.header-right` 的 `display:flex;align-items:center;gap`；`.toolbar-left`/`.toolbar-right` 差异较大（含 flex-wrap、justify-content 不同），仅做就近复用，不强行统一。

3. **Token 替换**：删除本地 `$codex-mono`，文件顶部 `@use '@/variables.scss' as *;`，原 `font-family: $codex-mono;` 改为 `$vp-mono`；`border-radius` 硬编码 6px/4px 分别替换为 `$vp-radius`/`$radius-sm`（像素值完全等价：`$vp-radius`=6px、`$radius-sm`=4px）。
4. **:deep 精简**：`.diff-viewer` 中 `:deep(.vue-diff *)` 已匹配全部后代，后续 4 个 `.d2h-*` 具体选择器完全冗余，删除后仅保留 `:deep(.vue-diff *)`，减少样式规则数，轻微降低匹配开销。

## 性能与可靠性说明

- `transition: all 0.12s` 在 CLAUDE_RULES 明确列为「统一 0.12s 过渡」允许写法，保留不变，避免误改引发回归。
- 聚焦态 `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest)` 属于规范允许的「focus 发光」，非卡片主样式，保留不变。
- 10px/14px 等 padding 在全局 `$spacing-*` Token 中无精确对应值，为「不影响视觉」严格保持原值，仅等价映射半径/字号相关 Token。
- 提取后 scoped 作用域不变，不会污染其他功能模块样式。

## 架构与目录

本功能为单体组件（仅 `index.vue`），遵循项目「组件专属 SCSS」命名（`styles/<ComponentName>.scss`），无需拆分子模块或建立 `index.scss` 基座。

```
src/features/textDiff/
├── index.vue        # [MODIFY] 删除内联 <style> 内容，改为 @use './styles/TextDiff.scss'
└── styles/
    └── TextDiff.scss # [NEW] 迁移全部样式，新增 codex-btn-base / flex-row mixin，使用全局 Token
```

## 关键代码结构

仅需新增两个 mixin，均为纯样式复用，无逻辑：

```
@mixin codex-btn-base {
  border: 1px solid var(--b3-border-color);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.12s;
  &:hover { background: var(--b3-theme-surface-lighter); }
}

@mixin flex-row($gap: 8px) {
  display: flex;
  align-items: center;
  gap: $gap;
}
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose: 在样式提取与合并完成后，依据项目 Codex UI 规范审查 `TextDiff.scss` 的合规性（Token 使用、BEM/作用域、禁止事项）。
- Expected outcome: 确认提取后的样式完全符合规范，无硬编码圆角/字号残留、无 box-shadow 误用、无重复字体声明，输出合规校验结论。