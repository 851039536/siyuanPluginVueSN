---
name: gitPush-scss-dedup
overview: 删除 ProjectCard.scss（与 index.scss 100% 重复），清理 ProjectCard.vue 中的冗余内联样式，修复 `.gp-scan-item` 手动分割线改用 row-divider mixin。
todos:
  - id: delete-projectcard-scss
    content: 删除 styles/ProjectCard.scss（与 index.scss 100% 重复，约 510 行）
    status: completed
  - id: fix-projectcard-vue
    content: 修改 ProjectCard.vue：移除 ProjectCard.scss 导入、移除 .gp-card 内联重复样式
    status: completed
    dependencies:
      - delete-projectcard-scss
  - id: use-row-divider-mixin
    content: 修改 index.scss：.gp-scan-item 手动边框替换为 @include row-divider
    status: completed
  - id: verify
    content: 运行 pnpm lint + npx tsc --noEmit 验证零错误
    status: completed
    dependencies:
      - fix-projectcard-vue
      - use-row-divider-mixin
---

## 用户需求

审查 gitPush 模块的 CSS/SCSS 代码，合并并删除冗余样式。

## 审查发现的冗余问题

1. **ProjectCard.scss 与 index.scss 完全重复**：两个文件定义了完全相同的一套卡片样式（约 510 行），包括 .gp-card、.gp-card-top、.gp-card-info、.gp-card-name、.gp-card-name-input、.gp-card-note、.gp-branch-row、.gp-branch-tag、.gp-card-actions、.gp-ide-wrap、.gp-ide-popover、.gp-ide-item、.gp-remotes、.gp-remote-item、.gp-actions-bar、.gp-card-name-row、.gp-star-btn、.gp-project-status-btn、.gp-card-meta、.gp-card-tags、.gp-card-tag、.gp-activity、.gp-multi-path-badge、.gp-cat-select 等。index.scss 已被 index.vue 全局加载（无 scoped），ProjectCard.vue 无需重复加载。

2. **ProjectCard.vue 模板内联样式与 CSS 重复**：`.gp-card` 元素上的三个内联 style 属性（box-sizing、flex、min-width）与 CSS 类中定义的值完全相同。

3. **.gp-scan-item 手动边框模式可替换为 row-divider mixin**：手写的 border-bottom + :last-child 逻辑与 `@include row-divider` mixin 等价。

## 技术方案

### 改动策略

1. **删除 ProjectCard.scss**：该文件与 index.scss 100% 重复，且 index.scss 已被 index.vue 以非 scoped 方式全局加载，删除后不会有样式丢失。

2. **移除 ProjectCard.vue 的 SCSS 导入和内联样式**：

- 删除 `@use "../styles/ProjectCard.scss"` 导入
- 移除 .gp-card 上的三个内联 style 属性（box-sizing、flex、min-width），这些属性在 CSS 类中已有定义

3. **index.scss 中使用 row-divider mixin 替代 .gp-scan-item 手动边框**

### 涉及文件

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 删除 | styles/ProjectCard.scss | 与 index.scss 完全重复，约 510 行 |
| 修改 | components/ProjectCard.vue | 移除 ProjectCard.scss 导入 + 内联样式 |
| 修改 | styles/index.scss | .gp-scan-item 改用 @include row-divider |