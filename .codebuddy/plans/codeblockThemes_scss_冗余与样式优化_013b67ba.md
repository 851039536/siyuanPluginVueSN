---
name: codeblockThemes.scss 冗余与样式优化
overview: 对 `codeblockThemes.scss` 做完整审查并实施三类优化：消除 4 路根选择器重复 5 次与 base mixin 三份展开的冗余、清理 8 个死 CSS 变量包装、将硬编码尺寸/字号/行高替换为设计 Token，保持视觉输出不变。
todos:
  - id: add-lineheight-token
    content: "在 `src/_variables.scss` 代码块区新增 `$codeblock-line-height: 1.6;` 行高 Token"
    status: completed
  - id: rewrite-codeblock-themes
    content: 重写 `codeblockThemes.scss`：提取 `$codeblock-roots` 列表变量、合并 base mixin 到通用块、清理死 CSS 变量、替换硬编码为设计 Token
    status: completed
    dependencies:
      - add-lineheight-token
  - id: codex-validate
    content: 使用 [skill:codex-ui-style-guide] 校验重构后 SCSS 的 Codex 规范与 Token 合规性
    status: completed
    dependencies:
      - rewrite-codeblock-themes
  - id: verify-no-residue
    content: 全项目搜索验证无 `--codeblock-*` / `--mac-button-*` 死变量与硬编码残留，并执行 read_lints 检查
    status: completed
    dependencies:
      - rewrite-codeblock-themes
---

## 用户需求

对 `src/features/generalSettings/styles/codeblockThemes.scss` 做一次完整彻底的审查与落地优化，覆盖**冗余**、**性能**、**样式**三类问题。相比此前仅回答「能否删除」的浅层审查，本次要求实际动手重构，使文件更精简、更符合项目 Codex 设计 Token 规范。

## 核心要点

### 冗余消除

- **4 路根选择器重复 5 次**：`.protyle-wysiwyg .code-block`、`.b3-typography .code-block`、`.protyle-wysiwyg [data-node-id][data-type="NodeCodeBlock"]`、`.b3-typography [data-node-id][data-type="NodeCodeBlock"]` 这 4 个选择器在 base mixin 与 github/mac/default/通用块中共出现 5 处，需提取为单一列表变量复用。
- **base mixin 三次完整展开**：`@mixin codeblock-base` 被 github/mac/default 各 `@include` 一次，三份内容 100% 相同，可合并为单一通用块只写一次。

### 死 CSS 变量清理

- `var(--codeblock-padding, ...)` 与 `var(--codeblock-font-size, ...)`：两个变量全项目无注入源，永远走 fallback，属伪可配置点，简化为直接 SCSS 变量。
- Mac 三色按钮 6 个 `--mac-button-*` 变量：全项目无注入源，永远回退到写死 hex，简化为直接色值并保留注释说明。

### 硬编码替换

- 将可映射到现有 Token 的硬编码值替换为 `$spacing-*` / `$radius-*` 等设计 Token；`line-height: 1.6` 因项目无对应 Token，在 `_variables.scss` 代码块区新增 `$codeblock-line-height`。

### 约束

- **保持视觉输出完全不变**的纯等价重构，不联动 `styles.ts` / 组件 / i18n。
- 遵守项目硬规则：AI 不执行 `pnpm build` / `pnpm lint`，由用户自行验证。

## 技术栈

- Sass/SCSS（Dart Sass，经 Vite 构建）
- 复用全局设计 Token：`src/_variables.scss`

## 实现方案

### 1. 选择器合并（列表变量插值）

在文件顶部定义 4 路根选择器列表变量，通过 `#{$codeblock-roots}` 插值复用：

```
$codeblock-roots: '.protyle-wysiwyg .code-block', '.b3-typography .code-block', '.protyle-wysiwyg [data-node-id][data-type="NodeCodeBlock"]', '.b3-typography [data-node-id][data-type="NodeCodeBlock"]';
```

**关键决策：不用 `@extend`**。`@extend` 会产生选择器特异性膨胀与不可控的编译顺序副作用；列表变量插值是纯文本复用，编译产物与手写多路选择器完全一致，零副作用。

### 2. base 合并到通用块

将 `@mixin codeblock-base` 的内容移入 `body[class*="codeblock-style-"]` 通用块，删除 mixin 与三次 `@include`。github/mac/default 三个块只保留各自差异化样式。

**安全性依据**：`applyCodeBlockStyle()`（styles.ts:82-87）保证 `body` 上恒有且仅有一个 `codeblock-style-*` class（default 为兜底），因此「对任意风格生效的公共样式」等价于「对 `body[class*="codeblock-style-"]` 生效」。公共块特异性 (0,1,1) 与 `body.codeblock-style-github` 相同，公共块写在前面、差异化块写在后面，差异化样式靠源码顺序胜出，无冲突。

### 3. Token 替换映射

| 原值 | 替换为 | 位置 |
| --- | --- | --- |
| `line-height: 1.6` | `$codeblock-line-height`（新增） | base .hljs |
| `8px` | `$spacing-2` | base .hljs padding |
| `0.5rem` | `$spacing-2` | Mac 滚动条高度 |
| `0.25rem` | `$radius-sm` | Mac 滚动条 thumb 圆角 |
| `0.75rem`（宽高） | `$spacing-3` | Mac 三色按钮尺寸 |
| `0.125rem` | `$spacing-2px` | action bar 上下 padding |


**保留硬编码并加注释**（无精确 Token 或属视觉精确值）：

- `letter-spacing: 0.5px`（非字体三要素，项目未禁止）
- Mac 三色点间距 `1.125rem` / `2.25rem`（品牌视觉精确值）
- `margin-left: -0.375rem` 居中微调 hack（保留并注释，避免 `translateX` 带来视觉回归）
- `0.875rem`（GitHub action bar 右 padding，无精确 Token）

### 4. 死变量清理

- `var(--codeblock-padding, #{$codeblock-padding}) 8px` → `$codeblock-padding $spacing-2`，并删除冗余的 `padding-top` 覆盖行。
- `var(--codeblock-font-size, #{$codeblock-font-size})` → `$codeblock-font-size`。
- Mac 6 个 `--mac-button-*` var 回退 → 直接 hex 色值，保留注释说明是固定品牌色。

## 目录结构

```
project-root/
├── src/
│   ├── _variables.scss                                    # [MODIFY] 代码块区新增 $codeblock-line-height: 1.6;
│   └── features/generalSettings/styles/codeblockThemes.scss # [MODIFY] 重构：选择器合并 + base 合并 + 死变量清理 + Token 替换
```

## 性能说明

- base 三份展开合并为一份后，编译产物减少约 2/3 的重复规则，CSS 体积下降。
- 属性选择器 `[data-node-id][data-type="NodeCodeBlock"]` 较重但由思源 DOM 结构决定、无法避免；合并选择器后可减少规则总数与样式重计算开销。

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 目的：校验重构后的 `codeblockThemes.scss` 是否符合本项目 Codex UI 规范与设计 Token 规则（无硬编码尺寸/字号/行高/色值、选择器与命名合规）
- 预期结果：确认重构产物无 Codex 违规项，与 `src/_variables.scss` Token 体系一致