---
name: dataBackup-style-review
overview: 审查 dataBackup 功能模块的样式规则，修复与 Codex 规范的 6 类违规：缺失全局变量导入、font-size/font-weight/间距硬编码、box-shadow 禁用违规、缺少 focus glow、字体栈硬编码、变量重复声明
todos:
  - id: add-global-import
    content: 添加 @use '@/variables.scss' as *; 并删除重复的本地 $radius-* 变量声明，修正 card-section mixin 中 $radius-lg 为 $radius-md
    status: completed
  - id: replace-font-tokens
    content: 替换所有 font-size 和 font-weight 硬编码为全局 Token（$font-size-xs/$font-size-sm、$font-weight-medium/$font-weight-semibold），0.8125rem/0.625rem 保留
    status: completed
    dependencies:
      - add-global-import
  - id: replace-spacing-tokens
    content: 替换所有 padding/gap/margin 中可映射的硬编码值为 $spacing-1~$spacing-6 Token，0.375rem/0.625rem/0.6875rem 等保留
    status: completed
    dependencies:
      - add-global-import
  - id: fix-boxshadow-and-focus
    content: 移除 .input-dialog 的 box-shadow 改为 border，为 %input-base:focus 添加 focus glow box-shadow
    status: completed
    dependencies:
      - add-global-import
  - id: fix-font-and-layout
    content: "替换硬编码 font-family 为 $vp-mono，line-height: 1.3 为 $line-height-tight，letter-spacing: 0.04em 为 0.06em，progress-bar transition 0.3s 为 0.12s"
    status: completed
    dependencies:
      - add-global-import
  - id: verify-build
    content: 执行 pnpm build 和 pnpm lint 验证编译与代码规范通过
    status: completed
    dependencies:
      - replace-font-tokens
      - replace-spacing-tokens
      - fix-boxshadow-and-focus
      - fix-font-and-layout
---

## 用户需求

审查 `src/features/dataBackup/styles/index.scss`（646 行）中所有 Codex 样式规范违规项，并逐一修复。

## 核心功能

修复 6 大类违规，使 dataBackup 模块样式完全对齐项目 Codex UI 标准：

### 类 A — 添加全局 Token 导入

文件顶部添加 `@use '@/variables.scss' as *;`，使所有全局变量可用。

### 类 B — 删除重复的本地变量声明

删除 Lines 4-6 中与全局 `_variables.scss` 重复且可能不一致的 `$radius-sm`/`$radius-md`/`$radius-lg` 声明，同时更新 `.card-section` mixin 中的 `$radius-lg` 引用为全局 `$radius-md`（因为全局 `$radius-lg=0.75rem`，原意应为 8px 圆角 = `$radius-md`）。

### 类 C — font-size / font-weight Token 替换

- `font-size: 0.875rem`（14px）→ `$font-size-sm`
- `font-size: 0.8125rem`（13px，无直接 Token）→ 保留 rem 值（注：不强制映射，避免视觉偏差）
- `font-size: 0.75rem`（12px）→ `$font-size-xs`
- `font-size: 0.6875rem`（11px）→ `$font-size-xs`
- `font-size: 0.625rem`（10px）→ 保留（Codex 大写标签规范允许 10px 硬编码）
- `font-weight: 600` → `$font-weight-semibold`
- `font-weight: 500` → `$font-weight-medium`

### 类 D — spacing Token 替换

- `0.25rem`/`4px` → `$spacing-1`
- `0.5rem`/`8px` → `$spacing-2`
- `0.75rem`/`12px` → `$spacing-3`
- `1rem`/`16px` → `$spacing-4`
- `1.5rem`/`24px` → `$spacing-6`
- `gap: 4px 8px` → `gap: $spacing-1 $spacing-2`
- `0.375rem`（6px）/ `0.0625rem`（1px）等无直接全局 Token → 保留原值

### 类 E — box-shadow 消除 + focus glow

- `.input-dialog` 的 `box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.2)` → 改为 `border: 1px solid var(--b3-border-color)`
- `%input-base:focus` 补加 `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest)`

### 类 F — 字体/行高/间距规范化

- `font-family: 'Consolas', 'Monaco', monospace`（3 处）→ `$vp-mono`
- `font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace` → `$vp-mono`
- `line-height: 1.3` → `$line-height-tight`
- `letter-spacing: 0.04em` → `0.06em`（对齐 Codex 大写标签规范）
- `.progress-bar` transition `0.3s ease` → `0.12s`（Codex 统一过渡）

## 技术方案

### 实施策略

对 `src/features/dataBackup/styles/index.scss` 执行**就地修复**，不改变文件结构。所有 Token 替换在同一文件内完成，确保零架构变更。

### 关键决策

1. **0.8125rem（13px）的 font-size**：全局无 13px Token（`$font-size-xs=12px`、`$font-size-sm=14px`），**保留 `0.8125rem` 不变**，避免视觉跳动。

2. **0.6875rem（11px）的 font-size**：映射为 `$font-size-xs`（12px），微小放大在可接受范围内，消除硬编码。

3. **0.375rem（6px）的 spacing**：全局 Token 链为 `$spacing-1`(4px) → `$spacing-2`(8px)，6px 无直接映射。保留 `0.375rem` 原值，仅对有精确 Token 映射的值替换。

4. **`.vp-btn` 内部精细值**（3px/5px/12px）：属于 Codex 按钮体系的内联标准，**全部保留**。这些值与全局 Token 无直接映射关系，且属于按钮微调范围。

5. **`$radius-lg` 映射变更**：全局 `$radius-lg=0.75rem`，而文件中使用 `$radius-lg` 表示 0.5rem（8px）圆角。修复后改为 `$radius-md`（全局定义=0.5rem），确保语义一致。

### 性能与可靠性

- **零运行时影响**：纯 SCSS 编译时 Token 替换，CSS 输出等价。
- **逐行对应**：每处修改均可追溯到具体的规范条款。
- **构建验证**：修改后执行 `pnpm build` 确保无 Sass 编译错误。

### 文件修改范围

- **仅修改**：`src/features/dataBackup/styles/index.scss`（1 个文件）
- **修改量**：约 80+ 处 Token 替换 + 3 处逻辑修复