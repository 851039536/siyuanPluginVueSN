---
name: generalSettings 冗余审查与精简
overview: 审查 src/features/generalSettings 模块中的冗余代码（函数重复定义、样式双重定义、规范违规、死代码、入口违规），输出结构化精简方案。
todos:
  - id: cleanup-dead-code
    content: 确认并清理 GeneralSettings.ts 死代码（applyGlobalFontStyles/applyToSiyuanElements/废弃分支）
    status: completed
  - id: deduplicate-functions
    content: 消除重复函数（applyDocumentFontStyles/generateLevelDisplayCss/HEADING_LEVEL_MAPPINGS）
    status: completed
    dependencies:
      - cleanup-dead-code
  - id: extract-heading-scss
    content: 提取 HeadingSettings.vue 内联 SCSS 到独立文件并删除 index.scss 重复块
    status: completed
  - id: extract-encryption-highlight-scss
    content: 提取 EncryptionSettings 和 HighlightSettings 内联 SCSS
    status: completed
  - id: deduplicate-documentfont
    content: 消除 DocumentFontSettings 重复接口和常量定义
    status: completed
    dependencies:
      - deduplicate-functions
  - id: cleanup-index-scss
    content: 清理 index.scss 未使用样式和其他模块样式
    status: completed
    dependencies:
      - extract-heading-scss
      - extract-encryption-highlight-scss
  - id: fix-doccountmanager-api
    content: 修复 DocCountManager 入口违规改用 @/api
    status: completed
---

## 需求概述

审查 `src/features/generalSettings` 模块中的冗余代码，执行清理和精简。

## 核心问题

1. **函数重复定义**：`applyDocumentFontStyles()` 在 GeneralSettings.ts 和 DocumentFontSettings.vue 中 100% 重复；`generateLevelDisplayCss()` 在三处重复；`HEADING_LEVEL_MAPPINGS` 在两处重复
2. **样式双重定义**：index.scss 与各组件内联 `<style>` 中存在大量相同 CSS 规则
3. **规范违规**：HeadingSettings.vue 1447 行（严重超标）；3 个组件内联 SCSS 违反分离规范
4. **死代码**：`applyGlobalFontStyles()`、`applyToSiyuanElements()` 无调用者
5. **入口违规**：`DocCountManager.fetchSyncPost()` 绕过 @/api 统一封装

## 预期效果

- 消除所有重复定义，统一引用源
- 所有组件 SCSS 100% 提取到独立文件
- 文件行数符合规范（<500 行硬阈值）
- 死代码和未使用样式全部清除

## 技术方案

### 1. 函数重复消除策略

- `applyDocumentFontStyles()`：保留 GeneralSettings.ts 版本作为启动时应用，DocumentFontSettings.vue 改为直接调用 `injectStyle` 注入（单一职责）
- `generateLevelDisplayCss()`：统一到 `utils/styles.ts` 导出，GeneralSettings.ts 和 HeadingSettings.vue 均引用此函数
- `HEADING_LEVEL_MAPPINGS`：删除 HeadingSettings.vue 中的局部 `levelMappings`，统一引用 `utils/styles.ts` 导出的常量

### 2. SCSS 分离策略

- 各组件 `<style scoped>` 中的 CSS 提取到 `styles/<ComponentName>.scss`
- 组件内改用 `@use "../styles/<ComponentName>.scss";` 导入
- `index.scss` 仅保留面板布局相关样式（侧边栏、内容区、滚动条等）

### 3. 死代码清理策略

- 通过 `search_content` 确认 `applyGlobalFontStyles`、`applyToSiyuanElements` 无外部调用后删除
- `handleSettingsChange` 中移除已废弃的 `"font"` 和 `"list"` 分支

### 4. 入口统一策略

- `DocCountManager.query()` 改为使用 `@/api` 的 `sql()` 封装
- 移除 `fetchSyncPost()` 方法（约 30 行）

## 性能影响

- 无运行时性能变化（仅删除重复代码和死代码）
- CSS 体积减小（消除重复样式规则）
- 构建产物更小

## Agent Extensions

无适用扩展。本任务为代码审查和清理，不需要额外工具支持。