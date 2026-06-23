---
name: review-doccount-settings
overview: 对照 CLAUDE.md 规则审查 DocCountSettings.vue 并修复发现的违规项：emoji 图标替换为 Iconify、内联 SCSS 提取到外部文件、硬编码尺寸替换为设计 Token。
todos:
  - id: create-scss-file
    content: 创建 styles/DocCountSettings.scss，将现有内联样式提取到独立文件，替换所有硬编码值为设计 Token，修正分隔线颜色，声明等宽字体变量
    status: completed
  - id: fix-vue-template-icons
    content: 修改 DocCountSettings.vue 模板：将 3 个 emoji (📊💡🎨) 替换为 IconWrapper 组件，添加 IconWrapper import
    status: completed
  - id: fix-vue-style-import
    content: 修改 DocCountSettings.vue 的 style 块：将内联 SCSS 替换为 @use "../styles/DocCountSettings.scss";
    status: completed
    dependencies:
      - create-scss-file
  - id: verify-build
    content: 运行 pnpm vite build 验证构建无警告/错误
    status: completed
    dependencies:
      - fix-vue-template-icons
      - fix-vue-style-import
---

## 用户需求

对照 CLAUDE.md 和 CLAUDE_RULES.md 中的项目规范，审查 `src/features/generalSettings/components/DocCountSettings.vue`，发现并修复所有违规项。

## 审查发现的 6 项违规

### 1. Emoji 图标（CLAUDE.md 行108）

模板中使用了 3 个 emoji 作为图标：`📊`（统计）、`💡`（说明）、`🎨`（样式），违反了"禁止使用 emoji 表情作为图标"规则。需替换为 `<IconWrapper>` 组件引用已注册的 Iconify 图标。

### 2. 内联 SCSS（CLAUDE_RULES.md 行420-471）

全部 SCSS 样式（第 323-558 行，共 236 行）写在 `<style scoped>` 块中，违反了"所有 Vue 文件的 SCSS 样式必须提取到独立的 `.scss` 文件"规则。需提取到 `styles/DocCountSettings.scss`，Vue 文件仅保留一行 `@use` 导入。

### 3. 硬编码尺寸/圆角（CLAUDE_RULES.md 行328-418）

大量使用硬编码 px 值，未使用全局设计 Token：

- `border-radius: 6px` 应使用 `$radius-base`
- `border-radius: 8px` 应使用 `$radius-md`
- `border-radius: 4px` 应使用 `$radius-sm`
- `padding: 16px` 应使用 `$spacing-4`
- `margin-top: 8px` 应使用 `$spacing-2`
- 等等共 20+ 处

### 4. font-family: monospace（行509）

`.color-text` 使用 `font-family: monospace`，应替换为标准等宽字体栈。

### 5. 缺少 `@use` 导入

当前 SCSS 块未通过 `@use` 导入全局变量文件，无法使用设计 Token。

### 6. 分隔线颜色（行529）

`.style-preview { border-top: 1px solid var(--b3-theme-surface-lighter); }` 颜色变量不标准，应使用 `var(--b3-border-color)`。

## 技术方案

### 实现策略

采用**最小改动、最大合规**策略：只修改 DocCountSettings.vue 和新建 DocCountSettings.scss，不触碰其他文件。严格遵循项目中 `CodeBlockSettings.vue` 已有的成熟模式。

### 图标替换方案

| Emoji | 替换为 | 图标键 | 图标 | 来源 |
| --- | --- | --- | --- | --- |
| 📊 | `<IconWrapper name="statistics" :size="14" />` | `statistics` | `mdi:chart-bar` | FEATURE_ICONS（已注册） |
| 💡 | `<IconWrapper name="lightbulb" :size="14" />` | `lightbulb` | `mdi:lightbulb` | COMMON_ICONS（已注册） |
| 🎨 | `<IconWrapper name="codeBlockColor" :size="14" />` | `codeBlockColor` | `mdi:palette` | FEATURE_ICONS（已注册） |


三个图标键均已存在于 `src/config/icons.ts`，无需新增注册。

### 样式分离方案

遵循 `CodeBlockSettings.vue` 的现有模式：

```
<!-- DocCountSettings.vue -->
<style scoped lang="scss">
@use "../styles/DocCountSettings.scss";
</style>
```

SCSS 文件头部导入全局变量：

```
// styles/DocCountSettings.scss
@use '@/variables.scss' as *;

// 本地声明等宽字体栈（$vp-mono 等价物，因 generalSettings 未导入 superPanel）
$vp-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;
```

### 设计 Token 映射表

| 原始硬编码值 | 替换为 | 说明 |
| --- | --- | --- |
| `padding: 16px` | `$spacing-4` | 1rem = 16px |
| `margin-top: 20px` | `$spacing-5` | 1.25rem = 20px |
| `margin-top: 16px` | `$spacing-4` |  |
| `margin-top: 12px` | `$spacing-3` | 12px |
| `margin-top: 8px` | `$spacing-2` | 8px |
| `padding: 12px 14px` | `$spacing-3 $spacing-3` | 近似值 |
| `padding: 8px 12px` | `$spacing-2 $spacing-3` |  |
| `padding: 10px 12px` | `$spacing-2 $spacing-3` | 近似值 |
| `gap: 8px` | `$spacing-2` |  |
| `border-radius: 8px` | `$radius-md` | 0.5rem |
| `border-radius: 6px` | `$radius-base` | 0.375rem |
| `border-radius: 4px` | `$radius-sm` | 0.25rem |
| `font-family: monospace` | `$vp-mono` | 本地声明 |


### 分隔线颜色修正

```
// 修正前
.style-preview { border-top: 1px solid var(--b3-theme-surface-lighter); }

// 修正后
.style-preview { border-top: 1px solid var(--b3-border-color); }
```

### 风险控制

- 不修改任何 TypeScript 逻辑，只改模板图标和样式
- 所有替换的图标键已确认存在于 `icons.ts` 中
- 使用与 CodeBlockSettings.scss 完全相同的 `@use` 模式
- Token 映射值全部来自 `_variables.scss`，与已有 SCSS 文件一致
