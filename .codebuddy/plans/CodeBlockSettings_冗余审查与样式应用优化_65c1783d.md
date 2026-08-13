---
name: CodeBlockSettings 冗余审查与样式应用优化
overview: 审查 generalSettings 的 CodeBlockSettings.vue 及其样式应用链路，消除冗余代码，优化 applyCodeBlockEnhancedStyles 的健壮性与可读性。
todos:
  - id: optimize-styles-ts
    content: 优化 styles.ts：增强 hexToRgba 容错、移除 ?? 1 冗余、合并行号样式逻辑
    status: completed
  - id: clean-scss-redundancy
    content: 清理 CodeBlockSettings.scss 中 3 处冗余 position/z-index 声明
    status: completed
  - id: unify-component-formatting
    content: 统一 CodeBlockSettings.vue 值格式化：简化 opacityPercent 并复用 formatPx
    status: completed
---

## 产品概述

对 `src/features/generalSettings/components/CodeBlockSettings.vue` 及其关联的样式文件与样式应用工具进行冗余审查与优化，在不改变现有功能行为的前提下，消除重复代码、提升样式应用健壮性与可读性。

## 核心功能

- **消除 SCSS 冗余**：删除 `.style-card-icon`、`.style-card-name`、`.style-card-desc` 中多余的 `position: relative; z-index: 1` 声明。
- **强化样式应用健壮性**：修复 `hexToRgba` 对 3 位 hex 与非法输入（如 `rgb(...)`）处理不安全的问题，避免产出 NaN 的 `rgba(...)`。
- **合并行号样式逻辑**：将 `showLineNumber` 的三元模板字符串与上方「行号样式」块合并，提升 CSS 生成可读性。
- **移除防御性冗余**：删除 `backgroundColorOpacity ?? 1` 中无效的 `?? 1`（类型已保证为必填 number）。
- **统一组件内值格式化**：简化 `opacityPercent` computed，并将折叠高度 `SettingLabel` 的值显示复用 `formatPx`，保持风格一致。

## 技术栈

- Vue 3 + TypeScript（`<script setup>`）
- SCSS（全局设计 Token，Codex 风格）
- 纯函数式样式注入（`document.createElement("style")`）

## 实现方案

### 1. 样式应用工具优化（`utils/styles.ts`）

**`hexToRgba` 健壮性增强**：该函数为模块私有（未导出），仅被 `applyCodeBlockEnhancedStyles` 单点调用。增强逻辑：

- 保留 `opacity >= 1` 时直接返回原 `hex` 的快速路径。
- 对非 `#` 开头的输入（如 `rgb(...)`、`transparent`）直接原样返回，避免解析崩溃。
- 支持 3 位 hex（`#abc` → `#aabbcc`）与 6 位 hex 两种格式。
- 解析失败（非合法 hex）时安全回退为原值，不产出 NaN。
- `opacity` 钳制到 `[0, 1]` 区间。

**移除 `?? 1`**：将 `codeSettings.backgroundColorOpacity ?? 1` 改为 `codeSettings.backgroundColorOpacity`，因 `CodeBlockSettings.backgroundColorOpacity` 为必填 `number`，默认值恒为 `1`。

**合并行号样式**：将第 137-140 行「行号样式」与第 142-151 行的 `showLineNumber` 三元模板合并为单一逻辑块。当 `showLineNumber` 为 false 时，在行号样式后追加 `display: none !important`，消除模板字符串内嵌三元表达式的割裂。

### 2. SCSS 冗余清理（`styles/CodeBlockSettings.scss`）

删除以下三个选择器中冗余的 `position: relative; z-index: 1`：

- `.style-card-icon`（第 65-68 行）
- `.style-card-name`（第 70-77 行）
- `.style-card-desc`（第 79-86 行）

依据：`.style-card` 已声明 `overflow: hidden`，且 `:hover`/`.active` 仅改变 `background` 颜色（非伪元素覆盖层），故子元素的 `position`/`z-index` 无实际作用。

### 3. 组件内值格式化统一（`CodeBlockSettings.vue`）

- 简化 `opacityPercent`：将 `const opacityPercent = computed(() => formatPercent(...))` 移除，模板 `:value="opacityPercent"` 改为 `:value="formatPercent(settings.backgroundColorOpacity)"`（`formatPercent` 已是纯函数，无需额外 computed 包裹）。
- 折叠高度值显示复用 `formatPx`：模板第 283 行 `:value="`${settings.collapseHeight}px`"` 改为 `:value="formatPx(settings.collapseHeight)"`，与背景透明度、滑块格式统一。

## 实现注意事项

- **改动边界**：仅修改 `utils/styles.ts`、`styles/CodeBlockSettings.scss`、`components/CodeBlockSettings.vue` 三个文件，不触碰类型定义、默认值、父链路（`index.vue` / `GeneralSettings.ts`）及数据流。
- **行为保持**：所有改动均为等价重构，`hexToRgba` 增强仅增加容错，不改变合法 6 位 hex + opacity 的既有输出。
- **性能**：`hexToRgba` 增强无额外热路径开销（仅单点调用，复杂度 O(1)）；移除 `opacityPercent` computed 不产生新开销。
- **日志**：保持现有 `console.error` 风格，不新增日志。
- **禁止执行构建/检查**：不执行 `pnpm vite build` / `pnpm lint`，由用户自行验证。

## 目录结构

```
src/features/generalSettings/
├── utils/
│   └── styles.ts                       # [MODIFY] 增强 hexToRgba 容错、移除 ?? 1、合并行号样式逻辑
├── styles/
│   └── CodeBlockSettings.scss          # [MODIFY] 删除 3 处冗余 position/z-index
└── components/
    └── CodeBlockSettings.vue           # [MODIFY] 简化 opacityPercent、折叠高度值复用 formatPx
```

## 推荐扩展

### Skill

- **codex-ui-style-guide**
- 用途：校验 SCSS 冗余清理后是否符合 Codex UI 规范，确保未破坏设计 Token 使用约定。
- 预期结果：确认删除 `position: relative; z-index: 1` 后样式仍符合 Codex 规范，无遗留硬编码或违规声明。