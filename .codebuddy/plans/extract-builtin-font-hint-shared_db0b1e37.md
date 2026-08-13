---
name: extract-builtin-font-hint-shared
overview: 审查 CodeBlockSettings.vue 与 DocumentFontSettings.vue，确认两者不应整体合并，但提取三处重复（内置字体命中判断、内置字体提示 UI+样式、内置字体 preset 条目）为共享组件与工具函数，消除重复。
todos:
  - id: add-shared-utils
    content: styles.ts 为 BUILTIN_FONTS 增加 label 并新增 isBuiltinFontFamily 函数
    status: completed
  - id: create-hint-component
    content: 新建 BuiltinFontHint.vue 与 BuiltinFontHint.scss 共享提示组件
    status: completed
    dependencies:
      - add-shared-utils
  - id: refactor-codeblock
    content: 改造 CodeBlockSettings.vue 派生内置条目并清理重复样式
    status: completed
    dependencies:
      - create-hint-component
  - id: refactor-document-font
    content: 改造 DocumentFontSettings.vue 派生内置条目并清理重复样式
    status: completed
    dependencies:
      - create-hint-component
---

## 用户需求

审查 `CodeBlockSettings.vue` 与 `DocumentFontSettings.vue` 两个设置面板组件，判断是否可以合并以减少重复代码。

## 审查结论

两个组件**不应整体合并**：它们分属不同设置域（代码块样式 vs 文档正文字体）、绑定不同存储槽（`storage.codeblock` vs `storage.documentFont`）、在父面板 `index.vue` 中是两个独立 Tab，合并后约 880 行会违反项目 500 行硬阈值。

但确认存在三处明确重复，应提取为共享实现：

1. **内置字体命中判断**：两个组件各有一个 computed，逻辑完全一致（仅字段名 `codeFontFamily` / `fontFamily` 不同）。
2. **内置字体提示 UI 与样式**：两处模板中的提示块完全相同，且 `.builtin-font-hint` / `.builtin-font-hint-icon` 在两个 SCSS 文件中逐字重复。
3. **内置字体 preset 条目**：`NeoXiHei Code`、`LXGW WenKai` 的 value 与 label 在两处 preset 列表中重复出现，应改为从 `BUILTIN_FONTS` 元数据单一来源派生。

## Core Features

- 提取 `isBuiltinFontFamily(fontFamily)` 工具函数，统一内置字体命中判断。
- 新建 `BuiltinFontHint.vue` 共享提示组件，承载提示 UI 与样式。
- 为 `BUILTIN_FONTS` 增加 `label` 字段，两个组件的预设列表从中派生内置字体条目。
- 清理两个组件与两个 SCSS 文件中的重复实现，保持视觉与行为完全不变。

## 技术栈选择

沿用项目现有技术栈：Vue 3 `<script setup lang="ts">` + TypeScript + SCSS（`@use "@/variables.scss" as *;` 设计 Token）。不引入任何新依赖或新架构模式。

## 实施方案

### 策略：提取共享，而非整体合并

两组件保持独立（设置域、存储槽、父 Tab 均不同），仅提取三处重复。共享单元统一放在 `generalSettings` 模块内部，遵循项目「模块内代码分层」规范（共享常量/工具函数放 `utils/styles.ts`，共享 UI 放 `components/`，样式独立 SCSS）。

### 提取一：内置字体命中判断函数

在 `utils/styles.ts` 中 `BUILTIN_FONTS` 旁新增纯函数，供两个组件复用：

```ts
export function isBuiltinFontFamily(fontFamily: string): boolean {
  return BUILTIN_FONTS.some((font) => font.fontFamily === fontFamily)
}
```

### 提取二：内置字体提示子组件

新建 `components/BuiltinFontHint.vue`，props 接收 `fontFamily` 与 `i18n`，内部调用 `isBuiltinFontFamily` 判断是否渲染提示。样式从两个 SCSS 迁移到新建的 `styles/BuiltinFontHint.scss`：

```ts
interface Props {
  fontFamily: string
  i18n?: Record<string, string>
}
```

模板结构沿用现有提示块（`v-if` + `IconWrapper name="checkCircle"` + `i18n.builtinFontHint`）。

### 提取三：内置字体 preset 条目派生

为 `BUILTIN_FONTS` 每个条目增加 `label` 字段（与现两处 label 文案一致），两个组件的 preset 列表改为 `...BUILTIN_FONTS.map((f) => ({ value: f.fontFamily, label: f.label }))` 派生内置条目，并移除原条目及 `CodeBlockSettings` 中未被使用的 `builtin: true` 死字段。`SelectOption` 接口含 `[key: string]: any`，派生条目类型兼容。

## 实施细节

### 性能

纯代码去重，运行时渲染路径与原来等价（子组件内部 computed 与原先 computed 开销一致），无性能回退。`isBuiltinFontFamily` 为常量级遍历（`BUILTIN_FONTS` 仅 2 项）。

### 向后兼容与爆炸半径

- 仅改动 `generalSettings` 模块内部，不触碰注册清单、`src/index.ts`、存储、i18n 键（`builtinFontHint` 已存在），父组件 `index.vue` 无需改动。
- 两组件对外 `props` / `emit` 契约不变，视觉与交互不变。

### 规范合规

- 新建 `BuiltinFontHint.vue` 顶部补文件头注释（如「内置字体提示条：标识随插件分发字体」）。
- 新建 SCSS 顶部 `@use "@/variables.scss" as *;`，不硬编码字号/间距，沿用 `$spacing-1` / `$font-size-2xs` / `$line-height-normal` Token。
- `checkCircle` 图标已在 `icons.ts` 注册，继续使用 `IconWrapper`。
- 不执行 `pnpm lint` / `pnpm vite build`，验证由用户执行：`pnpm lint`、`pnpm i18n:verify`、`pnpm validate:icons`、`npx tsc --noEmit`。

## 架构设计

重构后关系：两个面板组件 → 共享子组件 `BuiltinFontHint`（UI+样式）与共享工具函数 `isBuiltinFontFamily`（逻辑）→ 共享元数据 `BUILTIN_FONTS`（含 fontFamily / fileName / subDir / label 单一数据源）。

## 目录结构

```
src/features/generalSettings/
├── utils/
│   └── styles.ts                      # [MODIFY] BUILTIN_FONTS 增加 label 字段；新增 isBuiltinFontFamily() 工具函数；更新注释说明
├── components/
│   ├── BuiltinFontHint.vue            # [NEW] 内置字体提示条组件。props 接收 fontFamily 与 i18n，内部用 isBuiltinFontFamily 判断渲染；含文件头注释
│   ├── CodeBlockSettings.vue          # [MODIFY] 移除 isBuiltinCodeFontSelected；presetFonts 内置条目改为从 BUILTIN_FONTS 派生；模板提示块替换为 <BuiltinFontHint>
│   └── DocumentFontSettings.vue       # [MODIFY] 移除 isBuiltinFontSelected；PRESET_FONTS 内置条目改为从 BUILTIN_FONTS 派生；模板提示块替换为 <BuiltinFontHint>
└── styles/
    ├── BuiltinFontHint.scss           # [NEW] 迁移 .builtin-font-hint / .builtin-font-hint-icon 样式
    ├── CodeBlockSettings.scss         # [MODIFY] 删除重复的 .builtin-font-hint / .builtin-font-hint-icon
    └── DocumentFontSettings.scss      # [MODIFY] 删除重复的 .builtin-font-hint / .builtin-font-hint-icon
```