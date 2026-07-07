---
name: wordquery-code-review-fixes
overview: 对 wordQuery 功能模块进行全面代码审查，修复冗余代码、逻辑漏洞、SCSS 硬编码违规，确保符合 CLAUDE.md 编码规范。涉及 12 个文件。
todos:
  - id: extract-shared-types
    content: 提取共享 Props 接口到 types/index.ts，移除 4 个子组件中的重复 Props 定义，并迁移 generateAbbreviation 到 utils/codeTranslation.ts
    status: completed
  - id: remove-redundant-code
    content: 移除 4 个子组件模板中冗余的 @input="clearError" 绑定和多余额中间变量 namingStyles/commentStyles
    status: completed
    dependencies:
      - extract-shared-types
  - id: fix-speech-cleanup
    content: 修复 index.vue 中 speechSynthesis 未在 onUnmounted 时取消的漏洞
    status: completed
  - id: fix-scss-tokens-index
    content: 将 styles/index.scss 中的硬编码 font-size/padding/gap/border-radius 替换为全局设计 Token
    status: completed
  - id: fix-scss-tokens-codeutils
    content: 将 styles/codeUtils.scss 中的硬编码值替换为全局设计 Token，等宽字体栈改用 $vp-mono
    status: completed
---

## 需求概述

对 `src/features/wordQuery/` 模块进行代码审查，识别并合并冗余、修复逻辑漏洞、确保符合项目 CLAUDE.md 编码规范。审查范围包括 12 个文件（TypeScript、Vue SFC、SCSS），不改变现有功能行为。

## 审查发现的问题清单

### 代码冗余

1. **重复 Props 接口**：4 个子组件（CodeTranslationPanel / CodeCommentGenerator / CodeExplainer / RegexGenerator）各自定义完全相同的 `Props { i18n: Record<string, any>; plugin?: Plugin }` 接口，应提取为共享类型
2. **`@input="clearError"` 与 `clearErrorOnInput()` 双重触发**：4 个子组件中，模板已绑定 `@input="clearError"`，setup 中又调用 `clearErrorOnInput(ref)` 创建 watch 监听同一 ref，watch 已覆盖输入清除逻辑，模板绑定冗余
3. **`namingStyles` / `commentStyles` 多余中间变量**：`CodeTranslationPanel.vue` 中 `const namingStyles = NAMING_STYLES` 和 `CodeCommentGenerator.vue` 中 `const commentStyles = COMMENT_STYLES` 仅为模板暴露而设，但 Vue `<script setup>` 顶层 import 已自动暴露给模板，无需再赋值
4. **`generateAbbreviation` 纯函数放在组件内**：CodeTranslationPanel.vue 中的 `generateAbbreviation` 是纯工具函数，应提取到 `utils/codeTranslation.ts`

### 代码逻辑漏洞

5. **`speechSynthesis` 未在组件卸载时取消**：`index.vue` 的 `playPronunciation` 调用 `speechSynthesis.speak()`，但 `onUnmounted` 中未调用 `speechSynthesis.cancel()`，组件销毁后语音可能继续播放

### SCSS 编码规范违规

6. **styles/index.scss（437行）大量硬编码**：font-size（14px/16px/12px/13px）、padding（16px/12px/8px）、gap（8px/16px）、border-radius（6px）等未使用全局设计 Token（$font-size- */ $spacing-* / $radius-base）
7. **styles/codeUtils.scss（516行）同等问题**：等宽字体栈硬编码 `"JetBrains Mono", "Fira Code", "Consolas", monospace` 应使用 `$vp-mono`；大量 font-size/padding/gap/border-radius 硬编码

## 技术方案

### 实现策略

采用**逐文件聚焦修改**策略，将关联变更分组到同一任务中，减少上下文切换：

1. **类型与工具提取**：创建共享 Props 类型，迁移 `generateAbbreviation`
2. **冗余代码清理**：移除模板中冗余的 `@input` 绑定和多余中间变量
3. **逻辑漏洞修复**：为 `speechSynthesis` 添加卸载清理
4. **SCSS Token 规范化**：两个 SCSS 文件分批替换硬编码为设计 Token

### 关键设计决策

- **共享 Props 类型**：在 `types/index.ts` 新增 `WordQueryComponentProps` 接口，4 个子组件统一引用，避免未来新增组件时重复定义
- **保留 `clearError` 函数调用**：仅移除模板中的 `@input="clearError"` 绑定，保留 JS 中显式调用的 `clearError()`（如 handleTranslate 分支中的错误设置前清空），因为 `clearErrorOnInput` 的 watch 已覆盖输入变化场景
- **`namingStyles` / `commentStyles` 移除**：Vue 3 `<script setup>` 顶层 `import` 的绑定自动暴露给模板，直接在模板中使用 `NAMING_STYLES` / `COMMENT_STYLES` 即可
- **`generateAbbreviation` 提取**：从组件移到 `utils/codeTranslation.ts`，作为 `export function generateAbbreviation(text: string): string`，保持签名和逻辑不变
- **SCSS Token 映射**：`14px → $font-size-sm`、`16px → $font-size-base`、`12px → $font-size-xs`、`16px padding → $spacing-4`、`12px padding → $spacing-3`、`8px padding/gap → $spacing-2`、`6px border-radius → $radius-base`、`8px border-radius → $radius-md`、monospace 字体栈 → `$vp-mono`

### 目录结构变更

```
src/features/wordQuery/
├── types/index.ts           # [MODIFY] 新增 WordQueryComponentProps 接口
├── utils/codeTranslation.ts  # [MODIFY] 新增 generateAbbreviation 导出
├── composables/useCodeFeature.ts  # [MODIFY] 可能需适配 Props 类型变更
├── index.vue                # [MODIFY] 修复 speechSynthesis 清理
├── components/
│   ├── CodeTranslationPanel.vue  # [MODIFY] 移除 Props 定义+冗余绑定+generateAbbreviation
│   ├── CodeCommentGenerator.vue  # [MODIFY] 移除 Props 定义+冗余绑定+commentStyles
│   ├── CodeExplainer.vue         # [MODIFY] 移除 Props 定义+冗余 @input 绑定
│   └── RegexGenerator.vue        # [MODIFY] 移除 Props 定义+冗余 @input 绑定
└── styles/
    ├── index.scss            # [MODIFY] 替换硬编码为设计 Token
    └── codeUtils.scss        # [MODIFY] 替换硬编码为设计 Token
```

### 需注意的边界约束

- **不改动功能逻辑**：所有修改仅限于合并冗余和规范修复，不修改任何业务行为
- **不引入新依赖**：共享类型放 `types/index.ts`（符合 CODEBUDDY.md 的分层规则）
- **SCSS 仅替换 Token**：不重构样式结构，不合并选择器，保持原覆盖率