---
name: prompts-modal-content-blocks-refactor
overview: 将 PromptsModal 的固定 3 内容字段（content/content2/content3）重构为可无限添加的 contents 数组（自定义标签+文本），支持上移/下移排序，自动迁移旧数据；同时全面优化 UI 排版并拆分 SCSS 到独立文件，完全遵循 CLAUDE_RULES.md 的 Codex 风格规范。
design:
  architecture:
    framework: vue
    component: shadcn
  styleKeywords:
    - Codex
    - 暖色系
    - 边框优先
    - 大写标签
    - 等宽代码块
    - Focus发光
    - 0.12s过渡
  fontSystem:
    fontFamily: Noto Sans
    heading:
      size: 20px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#D97757"
      - "#B85C3D"
    background:
      - "#FFFFFF"
      - "#F5F3F0"
    text:
      - "#1A1A1A"
      - "#666666"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
todos:
  - id: refactor-types-and-migration
    content: 重构 Prompt 类型和存储迁移逻辑：新增 PromptContent 接口，修改 Prompt 接口为 contents 数组，在 storage.ts 添加旧数据自动迁移
    status: completed
  - id: refactor-prompts-modal
    content: 重构 PromptsModal.vue：动态内容块（v-for 渲染 + 添加/删除/上移下移），替换所有硬编码中文为 i18n 引用
    status: completed
    dependencies:
      - refactor-types-and-migration
  - id: split-scss-and-optimize-ui
    content: 拆分 SCSS 到 PromptsModal.scss 并全面优化 UI：提取 vp-* 样式，新增动态内容块样式，遵循 Codex 规范
    status: completed
    dependencies:
      - refactor-prompts-modal
  - id: add-i18n-entries
    content: 补全 i18n 条目：zh_CN/en_US floatingBox.json 新增 PromptsModal 所有翻译，运行 i18n:verify 校验
    status: completed
    dependencies:
      - refactor-prompts-modal
  - id: build-verify
    content: 构建验证：pnpm vite build + pnpm vue-tsc --noEmit 确认无错误无警告
    status: completed
    dependencies:
      - refactor-types-and-migration
      - refactor-prompts-modal
      - split-scss-and-optimize-ui
      - add-i18n-entries
---

## 产品概述

对 floatingBox 功能模块中的 PromptsModal 组件进行全面重构，将固定 3 个内容字段（content/content2/content3）改为可无限添加的动态内容块，每个内容块支持自定义标签命名。同时对 UI 进行全面优化，遵循 CLAUDE.md 和 CLAUDE_RULES.md 的 Codex 设计规范，拆分 SCSS 到独立文件，补全缺失的 i18n 条目，并提供旧数据自动迁移机制。

## 核心功能

- **动态内容块**：移除固定的 content/content2/content3 三字段限制，改为 `contents: PromptContent[]` 数组结构，每个内容块包含 `label`（自定义标签）+ `text`（内容文本），用户可无限添加/删除内容块
- **内容块排序**：通过上移/下移按钮调整内容块顺序，使用 COMMON_ICONS 中已有的 `up`/`down` 图标
- **旧数据自动迁移**：加载时检测旧格式（content/content2/content3），自动转换为新的 contents 数组格式，用户无感知
- **UI 全面优化**：遵循 Codex 设计规范，包括大写标签、等宽字段、focus 发光、0.12s 过渡动画、禁用 box-shadow 改用 border
- **SCSS 拆分**：将 PromptsModal 样式从 index.scss 中拆分为独立 `PromptsModal.scss`，floatingBox 工具栏样式保留在 index.scss
- **i18n 补全**：新增 PromptsModal 相关的所有翻译条目（提示词 CRUD、分类管理、内容块操作等），同步 zh_CN/en_US

## Tech Stack

- **框架**：Vue 3 + TypeScript（Composition API + `<script setup>`）
- **构建**：Vite 6
- **样式**：SCSS，遵循 Codex 设计 Token 体系（`_variables.scss` 全局变量 + `vp-*` 命名空间）
- **存储**：`TypedStorage<T>` 类型安全存储槽（已有 `FloatingBoxStorage`）
- **组件**：复用 `@/components/Button.vue` + `@/components/IconWrapper.vue`
- **工具函数**：`copyToClipboard` from `@/utils/domUtils`

## Implementation Approach

### 数据模型重构

将 `Prompt` 接口从固定 3 字段改为动态数组：

```typescript
export interface PromptContent {
  id: string
  label: string
  text: string
}

export interface Prompt {
  id: string
  title: string
  description: string
  contents: PromptContent[]
  category: string
}
```

### 旧数据迁移策略

在 `loadPrompts()` 中添加迁移逻辑：检测旧格式（有 `content` 字段但无 `contents` 字段），自动构建 `PromptContent[]` 数组。迁移后立即 `savePrompts()` 持久化，避免每次加载都迁移。保留 `content/content2/content3` 可选字段于接口中仅用于迁移检测，迁移后不再使用。

### 动态内容块 UI 设计

表单区域用 `v-for` 渲染 `promptForm.contents` 数组，每个块包含：标签输入框（inline）+ 文本域 + 操作区（上移/下移/删除）+ "添加内容块"按钮。至少保留 1 个内容块，删除时若仅剩 1 个则禁用删除按钮。

### SCSS 拆分方案

将 `styles/index.scss`（745 行）拆分为：

- `styles/index.scss` — 保留 floatingBox 工具栏样式（行 1-273）+ 共享变量/mixins
- `styles/PromptsModal.scss` — 提取所有 `vp-*` 样式（行 275-745）+ 新增动态内容块样式

PromptsModal.vue 中改为 `@use '../styles/PromptsModal.scss';`

### 性能考量

- `filteredPrompts` computed 简化：不再需硬编码 3 字段检查，直接遍历 `prompt.contents` 数组
- 搜索逻辑改为 `prompt.contents.some(c => c.text.toLowerCase().includes(query))`，复杂度 O(n*m) 但实际数据量极小
- 内容块操作（添加/删除/排序）直接操作 `promptForm.contents` 数组，使用 splice/swap O(1) 或 O(n)

## Implementation Notes

- **向后兼容**：迁移逻辑必须在 `loadPrompts()` 中、`loading.value = false` 之前完成，避免 UI 渲染未迁移数据
- **表单验证**：`savePrompt` 中验证改为检查 `contents` 数组至少有 1 个非空 text 的块
- **i18n 新增**：所有硬编码中文字符串替换为 i18n 引用，运行 `npm run i18n:verify` 确保键对齐
- **图标复用**：使用已注册的 `up`/`down`/`add`/`delete` 图标，无需新增图标
- **禁止 box-shadow**：动态内容块的 hover/focus 状态使用 border-color 变化 + focus 发光（`box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest)` 例外允许）
- **Blast radius**：仅修改 floatingBox 模块内部文件，不影响其他 feature

## Architecture Design

```mermaid
graph TD
    A[PromptsModal.vue] --> B[types/index.ts<br/>PromptContent + Prompt]
    A --> C[types/storage.ts<br/>FloatingBoxStorage + 迁移]
    A --> D[styles/PromptsModal.scss<br/>vp-* 样式]
    A --> E[styles/index.scss<br/>工具栏样式]
    A --> F[i18n/floatingBox.json<br/>zh_CN + en_US]
    B --> C
    C -->|loadPrompts| G[迁移检测<br/>旧3字段 → contents数组]
    A -->|copyToClipboard| H[@/utils/domUtils]
    A -->|Button/IconWrapper| I[@/components/*]
```

## Directory Structure

```
src/features/floatingBox/
├── components/
│   └── PromptsModal.vue              # [MODIFY] 核心重构：动态内容块 + UI 优化 + i18n 补全
├── styles/
│   ├── index.scss                    # [MODIFY] 移除 PromptsModal 相关样式，仅保留工具栏样式 + 共享变量/mixins
│   └── PromptsModal.scss             # [NEW] 提取的 PromptsModal 全部 vp-* 样式 + 新增动态内容块样式
├── types/
│   ├── index.ts                      # [MODIFY] 新增 PromptContent 接口，修改 Prompt 接口为 contents 数组
│   └── storage.ts                    # [MODIFY] 添加旧数据迁移逻辑（loadPrompts 时检测并转换）
└── ...（其他文件不变）

src/i18n/
├── zh_CN/
│   └── floatingBox.json              # [MODIFY] 新增 PromptsModal 所有翻译条目
└── en_US/
    └── floatingBox.json              # [MODIFY] 对应英文翻译
```

### 文件修改详情

**`types/index.ts`** — 新增 `PromptContent` 接口（`id`/`label`/`text`），修改 `Prompt` 接口：移除 `content`/`content2?`/`content3?`，新增 `contents: PromptContent[]`。为兼容迁移保留可选的旧字段（`content?`/`content2?`/`content3?`）。

**`types/storage.ts`** — 在 `FloatingBoxStorage` 中添加 `migratePrompt()` 私有方法，检测旧格式并转换。`loadPrompts` 流程改为：加载 → 检测迁移 → 如需迁移则保存 → 返回。

**`PromptsModal.vue`** — 核心重构：

- `promptForm` 改为 `{ title, description, contents: PromptContent[], category }`
- 表单区域用 `v-for` 渲染动态内容块，每块含标签输入 + 文本域 + 上移/下移/删除按钮
- `filteredPrompts` computed 简化：直接使用 `prompt.contents`，搜索改为 `contents.some()`
- `savePrompt`/`editPrompt`/`openAddModal` 改为操作 `contents` 数组
- 新增 `addContentBlock()`/`removeContentBlock()`/`moveContentBlock()` 方法
- 所有硬编码中文替换为 i18n 引用

**`styles/PromptsModal.scss`** — 从 `index.scss` 提取行 275-745 的所有 `vp-*` 样式，新增 `.vp-content-editor`（动态内容块编辑器容器）、`.vp-content-editor-item`（单个内容块编辑项）、`.vp-content-editor-actions`（操作按钮区）等样式类。遵循 Codex 规范：大写标签、禁 box-shadow、使用 `$radius-*`/`$spacing-*` 变量、0.12s 过渡。

**`styles/index.scss`** — 移除 PromptsModal 相关样式，仅保留行 1-273（工具栏样式 + 共享变量/mixins）。

**`i18n/zh_CN/floatingBox.json`** — 新增约 25 个条目：`promptsTitle`/`addPrompt`/`editPrompt`/`manageCategories`/`contentLabel`/`contentPlaceholder`/`addContentBlock`/`moveUp`/`moveDown`/`removeContent`/`titlePlaceholder`/`descriptionPlaceholder`/`categoryName`/`noPrompts`/`noPromptsFound`/`clickToCopy`/`save`/`cancel`/`close`/`add`/`delete`/`search`/`title`/`description`/`category`/`content`/`loading` 等。

**`i18n/en_US/floatingBox.json`** — 对应英文翻译。

## 设计风格

遵循项目既有的 Codex 风格（基于 shadcn-vue 暖色系），对 PromptsModal 进行全面 UI 优化。

### 整体布局

- 主弹窗：居中遮罩 + 毛玻璃 backdrop-filter，模态框 max-width 1100px，max-height 90vh，12px 圆角，border 替代 shadow
- 添加/编辑弹窗：max-width 500px，表单垂直排列
- 分类管理弹窗：max-width 500px，列表 + 内联表单

### 动态内容块编辑器（新增核心 UI）

- 每个内容块为一个带 border 的卡片区域，内含：标签输入框（inline，大写标签风格）+ 多行文本域 + 右侧操作按钮组（上移/下移/删除）
- 内容块之间用 8px 间距分隔，hover 时 border-color 变为 primary 色
- 底部"添加内容块"按钮为 dashed border + primary 文字，全宽虚线占位风格
- 第一个块禁用上移按钮，最后一个块禁用下移按钮，仅剩 1 个块时禁用删除按钮

### 卡片列表展示

- 3 列网格（移动端 2 列），每张卡片含标题行（图标 + 标题 + 分类标签 + 编辑/删除按钮）+ 描述 + 多个内容块（标签 + 可点击复制代码块）
- 内容块代码块使用等宽字体 `$vp-mono`，点击复制，hover 显示复制提示

### 分类筛选与搜索栏

- 分类标签为圆角 chip + 颜色圆点，选中态为 primary 实底
- 搜索框含左侧搜索图标，focus 时 2px primary 发光

### 交互细节

- 所有过渡动画统一 0.12s
- 按钮主色实底 / ghost 描边 / danger 红色
- 表单 label 使用大写标签风格（10px / 700 / letter-spacing 0.06em / opacity 0.45）
- 空状态居中斜体灰字

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在实现阶段探索现有代码模式（如其他 feature 的 SCSS 拆分方式、i18n 结构对齐验证），确保修改遵循项目约定
- Expected outcome: 确认 SCSS 拆分模式和 i18n 键结构，避免遗漏注册步骤

### MCP

- **Context7**
- Purpose: 查询 Vue 3 Composition API 最新文档，确认动态列表渲染和数组操作的最佳实践
- Expected outcome: 确保动态内容块的 v-for + key 使用方式符合 Vue 3 规范