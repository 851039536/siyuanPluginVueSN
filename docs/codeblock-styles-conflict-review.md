# 代码块样式冲突审查报告

**审查日期**：2026-06-17
**审查范围**：静态 SCSS 预设样式 vs 动态 JS 注入样式
**相关文件**：
- `src/features/generalSettings/styles/codeblockThemes.scss` — 静态 SCSS 层
- `src/features/generalSettings/utils/styles.ts` → `applyCodeBlockEnhancedStyles()` — 动态 JS 层

---

## 一、分层架构

```
┌─────────────────────────────────────────────────────────┐
│ 静态 SCSS 层 (codeblockThemes.scss)                      │
│ ├─ codeblock-base mixin（布局骨架：action bar、hljs）     │
│ ├─ body.codeblock-style-github（边框、action bar、行号）  │
│ ├─ body.codeblock-style-mac（边框、三色按钮、滚动条）     │
│ ├─ body.codeblock-style-default（透明边框）               │
│ └─ body[class*="codeblock-style-"]（选中效果、复制按钮）  │
│ 特点：无 !important（除 hljs 背景），作为 fallback        │
├─────────────────────────────────────────────────────────┤
│ 动态 JS 层 (styles.ts → <style id="codeblock-enhanced">) │
│ ├─ .code-block（背景/边框/圆角/阴影）                     │
│ ├─ .hljs（字体/字号/行高/颜色）                           │
│ ├─ .hljs .ln（行号颜色/背景）                             │
│ ├─ 语法高亮各节点颜色                                    │
│ ├─ .b3-typography pre/pre code（预览区）                 │
│ └─ 暗色主题覆写                                         │
│ 特点：全部 !important，用户设置优先                       │
└─────────────────────────────────────────────────────────┘
```

## 二、逐域冲突分析

### 2.1 边框（严重冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 选择器 | `body.codeblock-style-* ...` (0,1,3,1) | `.protyle-wysiwyg .code-block` (0,0,2,1) |
| 属性 | `border: 1px solid var(--b3-theme-outline)` | `border: Npx solid COLOR !important` |

**结论**：动态 `!important` 完全覆盖静态预设，包括 `:hover` 时边框变色效果（`border-color: var(--b3-theme-primary)`）也被覆盖。用户启用自定义设置后，hover 态主题色边框反馈将丢失。

### 2.2 圆角（严重冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 属性 | GitHub: `8px` / Mac: `12px` / Default: 无 | `border-radius: Npx !important` |

**结论**：预设风格特征被用户自定义值覆盖。Default 风格静态层无圆角，由动态层补充。功能上正确，但预设风格的视觉特征被削弱。

### 2.3 行号（架构冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 机制 | CSS Counter（`.hljs .li::before`） | 思源原生 `.ln` 元素 |
| 控制 | 无开关 | `showLineNumber` 控制 `display: none` |

**结论**：两套行号机制共存。GitHub 风格通过 CSS counter 在 `.li::before` 中生成行号，动态层通过 `.ln` 控制思源原生行号。若用户在 GitHub 风格下启用增强，**可能出现双份行号**。动态层 `display: none` 只隐藏 `.ln`，不影响 counter 行号。

### 2.4 背景色（中度冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 属性 | `background: var(--b3-theme-surface)` | `background-color: COLOR !important` |

**结论**：**属性名不统一**（`background` 简写 vs `background-color` 长写）。动态 `background-color !important` 会覆盖静态 `background` 隐含的背景色，但静态 `background` 简写会重置 `background-image` 等子属性。存在 CSS 简写/长写覆盖隐患。

### 2.5 字体大小/行高（中度冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 属性 | `font-size: var(--codeblock-font-size, 13px)` | `font-size: Npx !important` |

**结论**：静态层的 CSS 变量 fallback 体系被动态层硬 px 值架空。`var()` 优雅降级设计无法发挥作用。

### 2.6 阴影（轻度冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 属性 | 无 | `box-shadow: VALUE !important` |

**结论**：纯增量，无冲突。但动态层额外注入了 `:root[data-theme-mode="dark"]` 选择器，用硬编码值覆写用户暗色模式下的阴影设置，可能非用户本意。

### 2.7 预览区（中度冲突）

| 项目 | 静态层 | 动态层 |
|------|--------|--------|
| 选择器 | `.b3-typography .code-block` | `.b3-typography pre` / `.b3-typography pre code` |

**结论**：选择器匹配不同 DOM 层级。若思源预览区 HTML 为 `.code-block > pre` 结构，则静态层样式在容器上，动态层样式在 `pre` 上——不直接冲突但视觉效果叠加（如双重 border）。

### 2.8 无冲突域

| 域 | 说明 |
|----|------|
| hljs 背景 | 仅静态层定义（`!important`），动态层缺失 |
| 选中效果 | 仅静态层定义（`::selection`） |
| 复制按钮 | 仅静态层定义（`opacity: 0 → :hover 1`） |
| action bar 布局 | 仅静态层 mixin 定义（flex/align/min-height） |
| Mac 三色按钮 | 仅静态层定义（`::before` 伪元素 + `box-shadow`） |
| Mac 滚动条 | 仅静态层定义（`::-webkit-scrollbar`） |

## 三、设计问题

### 3.1 动态层 `!important` 滥用

动态层 `applyCodeBlockEnhancedStyles()` 中共出现 **20+ 处 `!important`**。这破坏了 CSS 级联机制的正常优先级，使得：
- 任何第三方样式无法通过正常特异性覆盖动态样式
- 静态层与动态层的协作变成单向覆盖关系
- 调试困难，无法直观判断最终生效样式来源

### 3.2 动态层选择器缺失 `body` 前缀

动态层选择器为 `.protyle-wysiwyg .code-block`，未加 `body.codeblock-style-*` 前缀。这导致：
- 无法按风格做差异化注入（所有风格共用同一套动态样式）
- 未启用代码块增强时（body 上无 `codeblock-style-*` class），其他功能若误触发动态注入，样式仍会生效

### 3.3 静态层 CSS 变量被架空

静态层使用 `var(--codeblock-font-size, 13px)` 的优雅降级设计，但动态层始终注入硬编码 px 值，CSS 变量方案无法发挥作用。

## 四、建议

| 优先级 | 建议 | 说明 |
|--------|------|------|
| P0 | 统一行号机制 | GitHub 风格的 CSS counter 行号与动态 `.ln` 控制应协调：启用增强时隐藏 counter 行号，或让 `showLineNumber` 同时控制两种行号 |
| P1 | 动态层减少 `!important` | 改用更高特异性的选择器（如加 `body.codeblock-style-*` 前缀）替代 `!important`，保留 CSS 级联机制 |
| P1 | 修复 hover 边框 | 动态层的 `border !important` 覆盖了静态层的 `:hover border-color`，需在动态层中补充 hover 态样式 |
| P2 | 统一 background 属性 | 静态层用 `background` 简写，动态层用 `background-color` 长写，建议统一 |
| P2 | 预览区选择器对齐 | 确保动态层 `.b3-typography pre` 与静态层 `.b3-typography .code-block` 不产生双重样式叠加 |
| P3 | 暗色模式阴影 | 动态层 `:root[data-theme-mode="dark"]` 硬编码阴影应改为使用用户设置的阴影值 |

## 五、架构校验结论

迁移后的文件结构符合项目 6 大架构原则：

- ✅ **功能模块化**：`codeblockThemes.scss` 位于 `generalSettings/styles/` 模块目录内
- ✅ **统一入口**：`index.scss` 仍作为全局样式入口，通过 `@use` 转发
- ✅ **设计 Token**：新文件通过 `@use '@/variables.scss'` 引用全局变量，无硬编码
- ✅ **样式分离**：样式在独立 `.scss` 文件中，未内联
- ✅ 无 linter 错误
- ✅ `codeblock-base` mixin 无外部引用依赖
