---
name: gitpush-style-codex-fix
overview: 修复 gitPush 功能 78 处 Codex 样式违规：删除 box-shadow、替换 transition:all、border-radius→Token、font-size→Token、font-weight→Token、spacing→Token、文件命名规范化，分三阶段执行。
todos:
  - id: phase1-critical
    content: 阶段一：替换 index.scss/Dialog.scss/WorkingTreePanel.scss/buttons.scss 中的 4 处 box-shadow 和 9 处 transition:all
    status: completed
  - id: phase2-tokens
    content: 阶段二：在 10 个 SCSS 文件中批量替换 border-radius/font-size/font-weight/spacing 硬编码为 Codex Token
    status: completed
    dependencies:
      - phase1-critical
  - id: phase3-rename-imports
    content: 阶段三：重命名 buttons.scss→Buttons.scss、shared.scss→Shared.scss，更新 6 个 Vue @use 路径，替换 3 处 !important
    status: completed
    dependencies:
      - phase2-tokens
  - id: phase4-verify
    content: 运行 lint + build 验证，使用 [skill:web-design-guidelines] 审核最终样式
    status: completed
    dependencies:
      - phase3-rename-imports
---

## 需求概述

基于审查报告修复 gitPush 功能样式中的 78 处 Codex 规范违规，分三个优先级阶段执行，所有修改保持在 10 个 SCSS 文件内，不涉及 Vue 模板或 TS 逻辑。

## 核心修复

### 阶段一：高优先级（13 处）

- **4 处 box-shadow**：将 `.gp-add-popover`、`.gp-ide-popover`、`.gp-dialog`、`.wt-diff-dialog` 的 box-shadow 删除，保持 border-only 风格
- **9 处 transition:all**：将 `.vp-btn`、`.gp-tab`、`.gp-branch-tag`、`.gp-vm-btn`、`.gp-ft-btn`、`.gp-tag-chip`、`.gp-card-tag`、`.gp-toggle-chip`、`.wt-type-btn` 的 `transition: all 0.15s` 拆分为具体属性 `transition: opacity 0.15s, border-color 0.15s, background 0.15s`

### 阶段二：中优先级（Token 替换，约 55 处）

- `border-radius: 4px` → `$radius-sm`
- `border-radius: 6px` → `$vp-radius` 或 `$radius-base`
- `border-radius: 8px` → `$radius-md`
- `border-radius: 3px` → `$radius-sm`
- `font-size: 12px` → `$font-size-xs`
- `font-size: 14px` → `$font-size-sm`
- `font-weight: 700` → `$font-weight-bold`
- `font-weight: 600` → `$font-weight-semibold`
- `gap: 4px` / `padding: 4px 0` → `$spacing-1`
- `gap: 8px` / `padding: 8px` → `$spacing-2`
- `gap: 12px` / `padding: 12px` → `$spacing-3`
- `padding: 16px` / `gap: 16px` → `$spacing-4`
- 涉及全部 10 个 SCSS 文件

### 阶段三：低优先级（命名与 import 路径）

- `buttons.scss` 重命名为 `Buttons.scss`
- `shared.scss` 重命名为 `Shared.scss`
- 更新 6 个 Vue 文件中的 `@use` 引用路径
- 替换 3 处 `!important` 为更高选择器特异性

## 技术方案

### 实现策略

基于审查报告的逐文件违规清单，分三阶段在 gitPush 的 10 个 SCSS 文件中执行查找替换。全局 Token 通过 `styles/variables.scss` 的 `@forward '@/variables.scss'` 透传，无需修改项目级 `_variables.scss`。

### 阶段一：box-shadow / transition:all 精确替换

| 文件 | 行号 | 违规 | 修复 |
| --- | --- | --- | --- |
| `index.scss` | 102 | `box-shadow: 0 4px 16px rgba(0,0,0,0.12)` | 删除整行 |
| `index.scss` | 411 | 同上 | 同上 |
| `Dialog.scss` | 23 | `box-shadow: 0 8px 32px rgba(0,0,0,0.3)` | 删除，添加 `border: 1px solid var(--b3-border-color)` |
| `WorkingTreePanel.scss` | 226 | `box-shadow: 0 8px 32px rgba(0,0,0,0.2)` | 删除整行 |
| `buttons.scss` | 11 | `transition: all 0.15s` | → `transition: opacity 0.15s, border-color 0.15s` |
| `index.scss` | 170,377,1031,1060,1091,1180,1240 | `transition: all 0.15s` | → `transition: opacity 0.15s, border-color 0.15s, background 0.15s` |
| `WorkingTreePanel.scss` | 373 | 同上 | 同上 |


### 阶段二：Token 批量替换

替换映射表：

```
border-radius: 4px   → $radius-sm      # 约 12 处
border-radius: 6px   → $vp-radius       # 约 3 处
border-radius: 8px   → $radius-md       # 约 2 处
border-radius: 3px   → $radius-sm       # 约 8 处
font-size: 12px      → $font-size-xs    # 约 5 处
font-size: 14px      → $font-size-sm    # 约 2 处
font-weight: 700     → $font-weight-bold     # 约 6 处
font-weight: 600     → $font-weight-semibold # 约 8 处
gap: 4px; padding: 4px → gap: $spacing-1; padding: $spacing-1  # 约 10 处
gap: 8px; padding: 8px → gap: $spacing-2; padding: $spacing-2  # 约 8 处
gap: 12px; padding: 12px → gap: $spacing-3; padding: $spacing-3 # 约 4 处
padding: 16px        → padding: $spacing-4  # 约 3 处
```

保留例外（不修改）：gitee/gitea/CNB 品牌色、git diff 标准颜色、星标琥珀色 `#f5a623`、大写标签 `font-size: 10px`（Codex 规范允许）。

### 阶段三：文件重命名与 import 路径

1. `styles/buttons.scss` → `styles/Buttons.scss`
2. `styles/shared.scss` → `styles/Shared.scss`
3. 更新所有 `@use` 引用路径：

- `styles/index.scss` 中的 `@use "./buttons"` → `@use "./Buttons"`
- `styles/index.scss` 中的 `@use "./shared"` → `@use "./Shared"`
- 6 个 Vue 文件中的 `@use "../styles/buttons"` → `@use "../styles/Buttons"`
- 检查无遗漏后删除旧文件

4. 替换 3 处 `!important`：

- `.gp-view-btn` 的 `border-radius: 0 !important` → 在父容器 `.gp-view-toggle` 统一设置
- `.gp-ide-item-del:hover` 和 `.gp-output-copy:hover` 的 `opacity: 1 !important` → 提升选择器特异性

### 验证流程

- `pnpm lint` — ESLint 无新增错误
- `pnpm validate:icons` — 图标注册无变更
- `pnpm build` — SCSS 编译成功，无 Undefined variable 错误

## Skill

- **web-design-guidelines**
- Purpose: 修复完成后审核 gitPush 样式是否符合 Web Interface Guidelines（focus 状态、可访问性等）
- Expected outcome: 确认修复后的样式无新增可访问性或视觉反馈违规