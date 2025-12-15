---
name: siyuan-skill-ui
description: 用于审查和优化思源笔记插件 UI 的 SCSS 代码风格，确保主题兼容性、响应式设计及样式模块化。
---

本 Skill 专注于提升思源笔记（SiYuan）插件的前端样式质量，通过自动化检查与重构建议，帮助开发者：

- 将内联 `<style>` 中的 CSS 迁移至独立的 `index.scss` 文件
- 确保 SCSS 使用 `@use` 模块化引入
- 兼容深色（dark）与浅色（light）主题
- 实现响应式布局，适配移动端
- 清理冗余、重复或未使用的 CSS 规则

详细检查项请参见：[SCSS 样式审查工作流](workflows/scss-style-review.yaml)
