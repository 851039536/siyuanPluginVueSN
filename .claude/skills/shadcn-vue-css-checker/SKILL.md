---
name: shadcn-vue-css-checker
description: |
  用于检查和验证 Shadcn/Vue 项目的 CSS 变量架构和实现规范。
  确保 CSS 变量层级、深色模式支持、组件样式一致性符合最佳实践。
---

# Shadcn/Vue CSS 风格检查器

这个 Skill 帮助您检查和验证 Shadcn/Vue 项目的 CSS 实现，确保符合官方设计规范和最佳实践。

## 核心检查项

### 1. CSS 变量架构检查
检查基础 CSS 变量层级和命名规范是否符合 Shadcn/Vue 标准。

**工作流程：** [css-variables-structure.yml](workflows/css-variables-structure.yml)

### 2. 深色模式支持检查
验证深色模式变量是否完整且正确实现。

**工作流程：** [dark-mode-variables.yml](workflows/dark-mode-variables.yml)

### 3. 实现规范检查
检查 CSS 变量在实际组件中的使用规范。

**工作流程：** [implementation-guidelines.yml](workflows/implementation-guidelines.yml)

## 使用说明

1. **运行完整检查：**
   ‍```bash
   claude skills run shadcn-vue-css-checker
