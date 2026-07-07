---
name: wordQuery-scss-review
overview: 对 wordQuery 模块的 styles/index.scss 和 styles/codeUtils.scss 进行代码去重合并、CLAUDE.md 合规修复与性能优化。范围：索引冗余、硬编码设计 Token 替换、重复块合并、样式模式提取。
todos:
  - id: refactor-codeutils-scss
    content: 重构 codeUtils.scss：定义局部变量替换13px/1.6/6px硬编码，提取label-row mixin消除5处重复，合并suggestions-list重复声明
    status: completed
  - id: refactor-index-scss
    content: 重构 index.scss：替换2处line-height为$line-height-normal，移除br冗余样式，替换480px响应式gap为$spacing-1
    status: completed
---

## 需求概述

审查 `src/features/toolCollection/tools/wordQuery/styles/` 下的 SCSS 文件，完成以下目标：

1. **冗余代码合并**：识别并合并重复的样式声明（如 `.suggestions-list` 重复、label 模式重复）
2. **性能优化**：移除多余样式、提取可复用 mixin/placeholder
3. **CLAUDE.md 合规**：替换所有硬编码尺寸（`font-size: 13px`、`line-height: 1.5/1.6`、`gap: 6px` 等）为全局设计 Token 或局部变量集中管理
4. **确保零视觉回归**：改动必须在语义等价前提下进行，局部变量保留原始像素值

## 核心文件

- `src/features/toolCollection/tools/wordQuery/styles/index.scss`（501 行）— 主面板样式
- `src/features/toolCollection/tools/wordQuery/styles/codeUtils.scss`（516 行）— 子组件通用样式

## 技术方案

### 审查发现的全部问题分类

#### A. 硬编码值（违反 CLAUDE.md "禁止硬编码尺寸"规则）

| 位置 | 硬编码值 | 替换方式 | 视觉影响 |
| --- | --- | --- | --- |
| index.scss L13 `.word-query-panel` | `line-height: 1.5` | `$line-height-normal` | 零变化（值相同） |
| index.scss L146 `.result-section` | `line-height: 1.5` | `$line-height-normal` | 零变化（值相同） |
| codeUtils.scss L56 `.code-textarea` | `line-height: 1.6` | 局部变量 `$code-line-height: 1.6` | 零变化 |
| codeUtils.scss L173 `.code-result` | `line-height: 1.6` | 局部变量 `$code-line-height: 1.6` | 零变化 |
| codeUtils.scss L313 `.explanation-text` | `line-height: 1.6` | 局部变量 `$code-line-height: 1.6` | 零变化 |
| codeUtils.scss 8 处 | `font-size: 13px` | 局部变量 `$code-font-size: 13px` | 零变化 |
| codeUtils.scss 10 处 | `gap: 6px` | 局部变量 `$compact-gap: 6px` | 零变化 |
| index.scss L476 `.result-actions` | `gap: 6px` | `$spacing-1`（4px） | 极微调（窄屏按钮间隙收紧 2px） |


#### B. 重复声明合并

1. **`.suggestions-list` 重复**：codeUtils.scss L265-269 与 L322-326 完全重复

- 合并方案：保留第一个声明，删除第二个重复块中的 `.suggestions-list` 规则

2. **Label 行模式重复**：`.input-label`(L42-49)、`.style-label`(L67-74)、`.section-title`(L298-306)、`.examples-label`(L356-363) 共享同一模式

- 合并方案：提取统一 `@mixin label-row` 并应用到各选择器

#### C. 冗余代码移除

- index.scss L129-133: `br { display: block; margin-bottom: $spacing-2; content: ""; }` — 老旧 hack，modern CSS 无实际作用，直接移除

### Mixin 设计方案

在 `codeUtils.scss` 顶部添加：

```
// 局部变量：替代无法精确映射到全局 Token 的硬编码值
$code-font-size: 13px;
$code-line-height: 1.6;
$compact-gap: 6px;

@mixin label-row {
  display: flex;
  align-items: center;
  gap: $compact-gap;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--b3-theme-on-surface);
}
```

### 约束与保证

- **不改 `.vue` 模板** — 仅修改 SCSS 文件
- **不改文件名/目录结构** — 所有修改在原文件内完成
- **两个 SCSS 文件保持独立** — 不互相导入，不产生新的依赖关系
- **用户自行验证**：`pnpm lint` + `pnpm build`