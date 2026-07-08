---
name: wordQuery-scss-optimization
overview: 审查并优化 wordQuery 模块的 2 个 SCSS 文件 + 2 个 Vue 内联样式（共约 860 行 SCSS），合并冗余选择器、修复 SCSS 分离违规、提取共享 Mixin、优化渲染性能。零视觉回归。
todos:
  - id: extract-wordquery-scss
    content: 从 WordQueryPanel.vue 提取内联样式到新建 styles/WordQueryPanel.scss，修改 Vue style 块为 @use 导入
    status: completed
  - id: extract-translate-scss
    content: 从 TranslatePanel.vue 提取内联样式到新建 styles/TranslatePanel.scss，修改 Vue style 块为 @use 导入
    status: completed
  - id: extract-result-table-mixin
    content: 在 codeUtils.scss 中提取 result-table mixin，消除 .result-rows/.result-row/.row-label/.row-value 重复定义
    status: completed
    dependencies:
      - extract-wordquery-scss
  - id: extract-empty-center-mixin
    content: 在 codeUtils.scss 中提取 empty-center mixin，消除 .query-empty 和 .translate-empty 空状态重复
    status: completed
    dependencies:
      - extract-wordquery-scss
      - extract-translate-scss
  - id: fix-hardcoded-and-performance
    content: 修复性能问题：word-break:break-all 改为 overflow-wrap:break-word；替换 $code-font-size 硬编码；移除 480px 死代码；统一使用 $codeblock-font-size 全局 Token
    status: completed
    dependencies:
      - extract-result-table-mixin
      - extract-empty-center-mixin
  - id: codex-review
    content: 使用 [skill:codex-ui-style-guide] 审查全部 4 个 SCSS 文件，确保符合 Codex 风格和全局 Token 规范
    status: completed
    dependencies:
      - fix-hardcoded-and-performance
---

## 用户需求

对 wordQuery 模块的全部 SCSS/CSS 代码进行安全重构审查，要求：

1. 识别并合并冗余选择器与重复样式属性
2. 分析渲染性能，优化复杂选择器嵌套、频繁重绘属性等影响性能的代码
3. 修改时严格保证不改变现有视觉表现与业务逻辑
4. 最终输出严格遵循 CLAUDE_RULES.md 中的 SCSS 分离规范与 Codex UI 风格要求

## 审查范围

- `styles/codeUtils.scss`（530行）— 4个代码工具组件的共享样式
- `styles/index.scss`（49行）— 主面板外壳样式
- `components/WordQueryPanel.vue` 的 `<style scoped>`（~215行内联样式）
- `components/TranslatePanel.vue` 的 `<style scoped>`（~105行内联样式）

## 核心问题

1. **SCSS 分离违规**：WordQueryPanel.vue 和 TranslatePanel.vue 存在 ~320 行内联样式
2. **选择器重复**：`.result-rows/.result-row/.row-label/.row-value` 在 codeUtils.scss 和 WordQueryPanel.vue 中各定义一次
3. **空状态模式重复**：`.query-empty` 和 `.translate-empty` 几乎完全一致
4. **硬编码与性能**：`$code-font-size: 13px` 未使用全局 Token；`word-break: break-all` 触发频繁重排；480px 媒体查询存在死代码

## 技术方案

### 整体策略

将所有内联样式提取为独立 SCSS 文件，消除 SCSS 分离违规；通过提取 mixin 消除重复选择器、统一共享模式；将硬编码替换为全局设计 Token；优化渲染性能敏感属性。每一步保证视觉零回归。

### 文件变更概览

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| **新建** | `styles/WordQueryPanel.scss` | 从 WordQueryPanel.vue 提取 ~140 行（去除 codeUtils 已有样式后） |
| **新建** | `styles/TranslatePanel.scss` | 从 TranslatePanel.vue 提取 ~75 行（去除空状态重复后） |
| **修改** | `styles/codeUtils.scss` | 新增 `result-table` mixin + `empty-center` mixin，消除 3 处重复；替换硬编码；修复 word-break |
| **修改** | `components/WordQueryPanel.vue` | `<style>` 块改为 `@use "../styles/WordQueryPanel.scss";` |
| **修改** | `components/TranslatePanel.vue` | `<style>` 块改为 `@use "../styles/TranslatePanel.scss";` |


### 关键设计决策

**1. 复用策略：mixin > 直接引用**

- 提取 `@mixin result-table` 到 codeUtils.scss，供 WordQueryPanel.scss 和 codeUtils.scss 内两个上下文使用
- 提取 `@mixin empty-center` 到 codeUtils.scss，供 WordQueryPanel.scss 和 TranslatePanel.scss 使用
- 理由：保持各文件独立可读，避免选择器上下文耦合

**2. word-break 替换**

- `.row-value` 和 `.code-result` 中的 `word-break: break-all` → `overflow-wrap: break-word`
- `break-all` 在任意字符处断行（破坏单词完整性，导致频繁重排）；`break-word` 仅在必要时断行，减少 Layout Shift
- 视觉表现：两种属性对超长连续字符（如 URL）效果一致，对正常英文单词无影响

**3. 硬编码替换**

- `$code-font-size: 13px` → 保留为局部变量但注释引用全局 `$codeblock-font-size`
- `$code-line-height: 1.6` → 保留为局部变量（全局无精确对应）

**4. 全局 Token 使用**

- 所有 padding/gap/border-radius/font-size 必须使用 `$spacing-*`、`$radius-*`、`$font-size-*` 等全局 Token
- 所有等宽字体使用 `$vp-mono`
- 禁用 `box-shadow`（Codex 风格：基于边框的卡片）

### 设计原则

1. **零视觉回归**：每条样式规则的视觉输出与重构前完全一致
2. **安全重构**：仅做提取/合并/替换，不重新设计 UI
3. **规范合规**：严格遵循 CLAUDE_RULES.md § SCSS 分离 + Codex UI 风格
4. **渐进优化**：按「提取内联 → 合并重复 → 优化性能」顺序执行，每步可独立验证

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：审查重构后的 SCSS 代码是否符合 Codex UI 风格规范（禁用 box-shadow、使用全局 Token、BEM 命名等）
- 预期结果：验证所有新 SCSS 文件通过 Codex 风格检查，无违规项