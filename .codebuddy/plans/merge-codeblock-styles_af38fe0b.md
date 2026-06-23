---
name: merge-codeblock-styles
overview: 将 src/index.scss 中的代码块美化样式合并到 generalSettings/CodeBlockSettings 模块，并审查静态 SCSS 与动态 JS 注入样式之间的冲突。
todos:
  - id: create-theme-file
    content: 新建 src/features/generalSettings/styles/codeblockThemes.scss，将 src/index.scss 第13-222行样式迁移至此（codeblock-base mixin + 三种风格 + 通用增强）
    status: completed
  - id: update-index-scss
    content: 修改 src/index.scss：删除第13-222行代码块样式，替换为 @use './features/generalSettings/styles/codeblockThemes.scss' 引入
    status: completed
    dependencies:
      - create-theme-file
  - id: audit-conflicts
    content: 使用 [subagent:code-explorer] 审查 styles.ts 动态样式与 codeblockThemes.scss 静态样式的选择器冲突，输出冲突分析结论
    status: completed
    dependencies:
      - create-theme-file
  - id: verify-architecture
    content: 使用 [skill:universal-arch-skill] 验证迁移后的文件结构、index.scss 引用链、模块内聚性是否符合项目规范
    status: completed
    dependencies:
      - update-index-scss
  - id: generate-conflict-doc
    content: 在 docs/ 目录生成 codeblock-styles-conflict-review.md，记录静态/动态样式分层体系、冲突审查结论和注意事项
    status: completed
    dependencies:
      - audit-conflicts
---

## 用户需求

将 `src/index.scss` 中第 13-222 行的代码块美化样式迁移至 `generalSettings` 功能模块目录下，与 `CodeBlockSettings.vue` 设置面板共同组成内聚的代码块样式功能模块，并审查静态 SCSS 预设样式与动态 JS 注入样式之间的冲突。

## 核心功能

- 将 `codeblock-base` mixin、GitHub/Mac/Default 三种预设风格样式、通用增强样式从全局入口文件中提取到独立 SCSS 文件
- 在 `src/index.scss` 中通过 `@use` 引入新文件，保持全局加载时机和编译输出不变
- 审查静态样式与动态样式之间的属性覆盖关系，确认用户设置优先的预期行为是否正确生效
- 审查选择器差异（行号、预览区等），确认 DOM 覆盖完整性
- 生成简洁的冲突分析文档

## 技术栈

- SCSS (Sass `@use` / `@mixin` / `@include`)
- TypeScript（样式工具函数）
- Vue 3 + `<style scoped>`（组件级样式）

## 实现方案

### 整体策略

采用 **文件提取 + @use 引用** 方案，不改变样式加载时序：

1. 新建 `src/features/generalSettings/styles/codeblockThemes.scss`，存放所有迁移样式
2. 在 `src/index.scss` 中删除第 13-222 行，替换为 `@use` 引入
3. 新文件通过 `@use` 引入 `_variables.scss` 获取变量
4. 审查冲突后生成分析文档

### 关键设计决策

**为什么提取到独立文件而非直接写入 CodeBlockSettings.vue？**

- 代码块样式是**全局**样式（通过 `body.codeblock-style-*` 匹配），需要保持在全局 CSS 输出流中
- `CodeBlockSettings.vue` 中的 `<style scoped>` 无法产生全局样式
- 保持 `src/index.scss` → `@use` → 新文件 的加载链，不影响其他模块对 `index.scss` 的 `@use` 引用（如 gitPush、passwordVault 等）

**为什么保留 codeblock-base mixin 结构？**

- 三种预设风格共享大量基础布局代码，mixin 避免重复
- 迁移后 mixin 在新文件中定义，不影响外部引用（目前只有本文件内使用）

**动态/静态分层设计**：

```
┌──────────────────────────────────────────────────────┐
│ 静态 SCSS 层 (codeblockThemes.scss)                   │
│ - 预设风格骨架（边框、action bar 布局、Mac 按钮等）     │
│ - 通用增强（选中效果、复制按钮显隐）                    │
│ - 不带 !important，作为 fallback                       │
├──────────────────────────────────────────────────────┤
│ 动态 JS 层 (styles.ts → codeblock-enhanced-style)     │
│ - 用户自定义色值、尺寸、字体                           │
│ - 全部 !important，优先级高于静态层                    │
│ - 禁用时动态移除                                       │
└──────────────────────────────────────────────────────┘
```

## 实现细节

### 文件变更清单

```
src/
├── index.scss                                        # [MODIFY] 删除第13-222行，新增 @use 引入
└── features/generalSettings/
    └── styles/
        └── codeblockThemes.scss                      # [NEW] 代码块美化主题样式
```

### 冲突审查要点

| 冲突域 | 静态样式 | 动态样式 | 结论 |
| --- | --- | --- | --- |
| 边框 | `border: 1px solid var(--b3-theme-outline)` | `border: Npx solid COLOR !important` | 动态覆盖，正确 |
| 圆角 | `border-radius: 8px / 0.75rem` | `border-radius: Npx !important` | 动态覆盖，正确 |
| 背景 | `background: var(--b3-theme-surface)` | `background-color: COLOR !important` | 动态覆盖，正确 |
| hljs 背景 | `background: rgba(..., 0.015) !important` | 无覆盖 | 静态保留，注意 !important 防止被其他规则覆盖 |
| hljs 字体大小 | `font-size: 13px` | `font-size: Npx !important` | 动态覆盖，正确 |
| hljs 行高 | `line-height: 1.6` | `line-height: N !important` | 动态覆盖，正确 |
| 行号 | `.li::before { counter }` (GitHub) | `.hljs .ln { color, bg }` | 不同选择器，思源可能用 .li 包裹行 |
| 选择区域 | `.hljs ::selection` | 无 | 静态独有，无冲突 |
| 复制按钮 | `.protyle-action__copy:hover` | 无 | 静态独有，无冲突 |


### 性能考虑

- 迁移不改变样式选择器数量，无额外性能开销
- `body[class*="codeblock-style-"]` 属性选择器在未启用时不匹配，零开销
- `@use` 引入的 SCSS 在 Vite 编译后与内联写法产生相同的 CSS 输出

### 向后兼容

- `src/index.ts` 第 74 行 `import "@/index.scss"` 保持不变
- 其他模块 `@use "@/index.scss" as *;` 通过 index.scss 再转发到新文件，保持变量/mixin 可访问性
- body class 切换逻辑（`applyCodeBlockStyle`）不变

## 子代理

### code-explorer

- **用途**：审查 `src/features/generalSettings/utils/styles.ts` 中的动态样式生成逻辑，确认所有动态注入的选择器与静态 SCSS 选择器的精确覆盖关系
- **预期结果**：生成完整的静态/动态样式选择器对照表，标注每条属性的覆盖状态（覆盖/保留/需修复）

## 技能

### universal-arch-skill

- **用途**：验证迁移后的文件结构是否符合项目架构规范（功能模块内聚、样式分离、入口统一）
- **预期结果**：确认 codeblockThemes.scss 位置正确，index.scss 引用链完整
