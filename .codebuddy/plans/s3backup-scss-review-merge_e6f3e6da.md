---
name: s3backup-scss-review-merge
overview: 审查 S3Backup 模块 SCSS 代码，将 S3ConfigForm.vue 中约 160 行内联 SCSS 提取到独立文件，消除与 index.scss 之间的 4 处样式重复，符合 CLAUDE_RULES.md 的 SCSS 分离规范。
todos:
  - id: extract-s3config-scss
    content: 从 S3ConfigForm.vue 提取内联样式到新建的 styles/S3ConfigForm.scss，移除 4 处与 index.scss 重复的样式，保留组件专属样式
    status: completed
  - id: update-s3config-vue
    content: 修改 S3ConfigForm.vue style 块为双行 @use 导入：第一行自身 S3ConfigForm.scss，第二行共享 index.scss
    status: completed
    dependencies:
      - extract-s3config-scss
  - id: verify-lint
    content: 运行 ESLint 验证修改无错误
    status: completed
    dependencies:
      - update-s3config-vue
---

## 审查范围

审查 s3Backup 模块的 SCSS 代码，消除冗余、合并重复样式，并确保符合 CLAUDE_RULES.md 规范。

## 核心任务

1. **提取 S3ConfigForm.vue 内联 SCSS**：将 S3ConfigForm.vue 第 289-449 行内联样式迁移到独立的 `styles/S3ConfigForm.scss`
2. **合并 4 处重复样式**：.form-hint、::deep(.si-button--small)、::deep(.si-input--small .si-input__field) 三处完全相同，保留在 index.scss 共享基座中，S3ConfigForm.scss 不再重复定义；.section-header 两处定义各有不同 margin-bottom，S3ConfigForm 专有样式保留在自身 SCSS 中
3. **修正导入模式**：S3ConfigForm.vue 改为双行导入（自身 SCSS + 共享 index.scss）

## 技术方案

### 总体策略

遵循 CODEBUDDY.md 中 SCSS 分离规范：子组件双行导入（第一行自身 SCSS，第二行共享 index.scss），仅 `_` 前缀文件可用于纯 mixins/变量，PascalCase 命名组件 SCSS。

### 文件变更清单

```
src/features/s3Backup/
├── styles/
│   ├── S3ConfigForm.scss    # [NEW] S3ConfigForm 组件专属样式（约 120 行）
│   └── index.scss           # [MODIFY] 移除 .section-header 的 margin-bottom 硬编码为变量（不改功能），其余不变
├── components/
│   └── S3ConfigForm.vue     # [MODIFY] 内联 SCSS 替换为 @use 双行导入
```

### 迁移规则

| S3ConfigForm.vue 内联样式 | 归属 | 原因 |
| --- | --- | --- |
| `.s3-config-form` 及其所有嵌套子规则（.section-header/.config-guide-panel/.form-grid/.form-group/.form-actions/.connection-result/.guide-fade-*） | → `S3ConfigForm.scss` | 组件专属样式 |
| `.form-hint` | → 已在 `index.scss`，删除重复 | 完全相同 |
| `::deep(.si-button--small)` | → 已在 `index.scss`，删除重复 | 完全相同 |
| `::deep(.si-input--small .si-input__field)` | → 已在 `index.scss`，删除重复 | 完全相同 |


### 注意事项

- Vue scoped 机制确保不同组件中的 `.section-header` 虽同名但互不干扰
- S3ConfigForm.scss 自身也需 `@use '@/variables.scss' as *` 获取设计 Token
- 提取后 S3ConfigForm.vue `<style>` 块仅保留 2 行 `@use` 导入