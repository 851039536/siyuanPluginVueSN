---
name: remove-prompt-feature-from-aiContentGenerator
overview: 从 aiContentGenerator 模块中全面移除提示词功能，包括已保存提示词配置管理、SettingsPanel 对话框、PromptManager composable、以及 systemPrompt/temperature/maxTokens 的 UI 编辑能力，全部改用硬编码默认值。
todos:
  - id: delete-prompt-files
    content: 删除 3 个提示词相关文件：usePromptManager.ts、SettingsPanel.vue、SettingsPanel.scss
    status: completed
  - id: clean-types-and-utils
    content: 清理类型和工具函数：从 src/types/ai.ts 移除 SavedPrompt 接口，从 utils.ts 移除 getPromptPreview 函数
    status: completed
  - id: simplify-storage
    content: 简化 AIGeneratorStorage：移除 prompts/currentPrompt TypedStorage 字段，AISettings 移除 systemPrompt/temperature/maxTokens
    status: completed
  - id: hardcode-generation-params
    content: 重构 useGeneration.ts：将 systemPrompt/temperature/maxTokens 从外部 Ref 改为内部硬编码常量
    status: completed
  - id: clean-index-vue
    content: 清理 index.vue：移除 SettingsPanel 导入和模板、usePromptManager 调用、所有提示词相关状态和持久化逻辑、BottomInputArea 的提示词 props/events、toggleSettings 方法
    status: completed
    dependencies:
      - delete-prompt-files
      - simplify-storage
      - hardcode-generation-params
  - id: clean-bottom-input-and-panel-header
    content: 清理 BottomInputArea.vue（移除提示词选择器模板/props/emits/computed）和 PanelHeader.vue（移除设置按钮）
    status: completed
    dependencies:
      - delete-prompt-files
      - clean-types-and-utils
  - id: clean-styles-and-i18n
    content: 清理 index.scss 提示词面板样式（~60行）和 i18n 中 8 个提示词专用键（含合并后的 zh_CN.json/en_US.json）
    status: completed
    dependencies:
      - delete-prompt-files
      - clean-bottom-input-and-panel-header
---

## 用户需求

审查 `aiContentGenerator` 功能模块，并移除所有提示词（Prompts）相关功能。

## 移除范围（全部移除）

1. **已保存提示词配置管理**：保存/加载/编辑/删除已命名提示词配置（SavedPrompt CRUD）的完整功能
2. **系统提示词编辑 UI**：`systemPrompt`、`temperature`、`maxTokens` 的设置面板
3. **提示词选择下拉框**：BottomInputArea 中的提示词选择器和其下拉面板
4. **设置对话框**：SettingsPanel 弹窗组件整体删除
5. **存储层**：`prompts` 和 `currentPrompt` 两个 TypedStorage 字段

## 保留内容

- `systemPrompt` 改用硬编码默认值（不提供 UI 编辑入口）
- `temperature` 硬编码 0.7，`maxTokens` 硬编码 10000
- 模型选择（`selectedModel`/`customModel`）、思考模式（`enableThinking`）、联网搜索（`webSearch`）、审核功能（`enableReview`）——这些不是提示词功能，保留
- AI 生成管道、编辑操作、技能加载、文档目标选择等核心功能完全保留

## 核心功能描述

移除后，AI 内容生成器使用固定的默认提示词和参数进行 AI 调用，用户不再能自定义系统提示词或保存提示词配置。面板 UI 将简化：顶部工具栏无设置按钮，底部无提示词选择器，仅保留技能选择、文档选择、快捷操作、模型选项和自定义输入。

## 技术栈

- 框架：Vue 3 + TypeScript + SCSS
- 构建：Vite
- 存储：PluginStorage + TypedStorage
- 项目规范：文件头注释、ESLint、i18n 键对齐

## 实现方案

### 整体策略

"外科手术式"精准移除：删除 3 个文件，修改 8 个源文件，清理 i18n 键和样式。不重构剩余代码结构，保持现有 `index.vue` 的 composable 分层架构不变。

### 关键架构调整

**1. useGeneration.ts 接口降级**

当前接口要求 `systemPrompt: Ref<string>, temperature: Ref<number>, maxTokens: Ref<number>` 三个响应式引用。移除后改为直接内联硬编码常量，不再从外部传入：

```
// useGeneration.ts 内部直接定义
const DEFAULT_SYSTEM_PROMPT = "你是一个专业的内容创作助手..."
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 10000
```

`buildGenerateOptions` 中 `opts.systemPrompt.value` → 直接使用传入的 `systemPrompt` 字符串参数（调用方传入），`opts.temperature.value` → `DEFAULT_TEMPERATURE`，`opts.maxTokens.value` → `DEFAULT_MAX_TOKENS`。

**2. index.vue 状态精简**

移除的 ref/状态：

- `systemPrompt`, `temperature`, `maxTokens`（改用硬编码）
- `currentPromptName`, `showSettings`（SettingsPanel 删除）
- `promptMgr` 所有解构（savedPrompts, showPromptSelector, newPromptName, paginatedPrompts 等）
- `saveSettings`/`loadSettings`/`watch` 整个持久化逻辑块（~50 行）
- `toggleSettings` 方法

**3. BottomInputArea 接口精简**

移除 4 个 props：`showPromptSelector`, `currentPromptName`, `savedPrompts`, `paginatedPrompts`
移除 5 个 emits：`toggle-prompt-selector`, `clear-current-prompt`, `load-prompt`, `edit-prompt`, `delete-prompt`
移除 `getOriginalIndex` 函数和 `SavedPrompt`/`getPromptPreview` 导入
简化 `canExecute` 和 `executeButtonTitle` computed（去掉 `currentPromptName` 条件）

**4. AIGeneratorStorage 瘦身**

移除 `prompts: TypedStorage<SavedPrompt[]>` 和 `currentPrompt: TypedStorage<string>` 两个字段，`init()` 中移除 prompts 初始化。`AISettings` 接口移除 `systemPrompt`/`temperature`/`maxTokens` 三个字段。

### 变更路径依赖图

```
删除 usePromptManager.ts ──→ 无外部引用（仅 index.vue）
删除 SettingsPanel.vue ──→ 删除 SettingsPanel.scss（仅被此组件引用）
删除 SavedPrompt ──→ 影响 6 个文件需同步清理
修改 useGeneration.ts ──→ index.vue 传参需对应调整
修改 storage.ts ──→ index.vue 的 saveSettings 需同步移除
修改 PanelHeader.vue ──→ index.vue 移除 toggle-settings 绑定
```

### 性能影响

- 移除约 400 行代码（3 个文件删除 + 8 个文件修改）
- 移除 `watch([systemPrompt, temperature, ...], debounceSave)` —— 减少 5 个 watch 源
- 移除 SettingsPanel Teleport 渲染 —— 减少一个固定定位 DOM 层
- 存储写入减少：不再保存 prompts 数组（可能几十条）和 currentPrompt 字符串
- 离线存储键减少 2 个：`ai-content-generator-prompts` 和 `ai-content-generator-current-prompt`

### 代码审查注意事项

- `confirmDelete` 键在 30+ 个功能中共用，不能从全局 i18n 中移除
- `src/types/ai.ts` 是全局类型文件，移除 `SavedPrompt` 前需确认无其他模块引用（已验证仅 aiContentGenerator 使用）
- `src/features/index.ts` 中 `prompts` 功能项（`registerPrompts` 等）是独立模块，不是 aiContentGenerator 的提示词功能，不应移除
- PanelHeader 移除设置按钮后，`header-actions` 变为空 div，需同时移除
- 文件头注释规则：所有修改的 `.ts`/`.vue` 文件确保顶部有功能说明注释