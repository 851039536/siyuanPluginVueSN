---
name: everythingSearch-refactor
overview: 对 everythingSearch 功能模块进行全面代码审查与重构，解决 SCSS 分离违规、本地变量重复声明、冗余代码、性能问题等 20 项 issue，确保符合 CLAUDE.md 规范。
todos:
  - id: scss-separation
    content: SCSS 分离：创建 8 个 styles/*.scss 文件，将组件内联样式提取到对应文件，.vue 中仅保留 @use 导入
    status: completed
  - id: scss-dedup
    content: 消除 SCSS 重复声明：删除 6 个文件中本地 $vp-mono 声明，修正硬编码值为全局 Token
    status: completed
    dependencies:
      - scss-separation
  - id: fix-style-leak
    content: 修复 SearchResults.vue 非 scoped 样式泄漏，将 .vp-empty 移入 scoped 的 .scss 文件
    status: completed
    dependencies:
      - scss-separation
  - id: remove-redundant-code
    content: 消除 8 项冗余代码：删除多余包装函数/双重 v-if/空桩/冗余别名/无用 async，统一 SearchOptions 命名
    status: completed
  - id: performance-optimize
    content: 性能优化：提升 3 个不变 computed 为常量、优化 v-for key 和 deep watch、简化事件转发链
    status: completed
  - id: code-quality
    content: 代码质量提升：提取公共 requireElectronShell 函数、简化 searchFiles、修正硬编码 locale、整理 import 分组
    status: completed
---

## 用户需求

对 `src/features/everythingSearch/` 模块进行全面的 TypeScript/SCSS 代码审查与重构：

- 识别并合并冗余代码（重复声明、多余包装函数、无意义转发等）
- 评估并实施性能优化（消除不必要的响应式追踪、优化 watch/v-for 等）
- 修正不符合 CLAUDE_RULES.md 编程规范的违规项（SCSS 内联、全局变量重复声明、硬编码等）
- 提升代码质量（消除桩代码、命名一致性、提取公共逻辑等）
- **核心约束**：不改变现有功能逻辑和行为，仅做结构性改进

## 技术方案

### 1. SCSS 分离（P1 最高优先级）

将 8 个组件 `.vue` 文件中的内联 `<style>` 块提取到 `styles/` 目录下对应的 `.scss` 文件：

| .vue 文件 | 目标 .scss 文件 |
| --- | --- |
| `AdvancedHelpPanel.vue` | `styles/AdvancedHelpPanel.scss` |
| `DialogFooter.vue` | `styles/DialogFooter.scss` |
| `DialogHeader.vue` | `styles/DialogHeader.scss` |
| `ResultItem.vue` | `styles/ResultItem.scss` |
| `SearchBar.vue` | `styles/SearchBar.scss` |
| `SearchOptions.vue` | `styles/SearchOptions.scss` |
| `SearchResults.vue` | `styles/SearchResults.scss` |
| `ServiceWarning.vue` | `styles/ServiceWarning.scss` |


每个 `.vue` 文件中仅保留 `<style scoped lang="scss">@use "../styles/ComponentName.scss";</style>`。

### 2. 消除 SCSS 全局变量重复声明（P1）

所有本地 `$vp-mono` 声明均删除，统一从 `@/variables.scss` 继承。涉及 6 个文件（5 个组件 + SearchResults.vue）。同时检查并修正硬编码的 spacing/font-size 值，替换为全局 Token。

### 3. 修复 SearchResults.vue 样式泄漏（P1）

将 `<style lang="scss">` 改为 `<style scoped lang="scss">`，同时将 `.vp-empty` 样式块一并移入 scoped 的 `.scss` 文件。

### 4. 冗余代码消除（P2）

- `index.vue`：删除多余的 `loadConfig()` 包装函数，删除模板中多余的 `v-if="visible"`，合并且删除空桩 `handleItemClick`
- `SearchBar.vue`：`searchButtonText` computed 改为常量字符串
- `types/index.ts`：移除无用的 `_EverythingSearchResult` 别名
- 统一 `SearchOptions` 组件命名

### 5. 性能优化（P3）

- `SearchOptions.vue` 中 3 个不变 computed 提升为模块级常量
- `SearchResults.vue` v-for key 去掉冗余的 index
- `index.vue` 中 `watch([config, options], { deep: true })` 优化为直接调 debounced save
- 简化 3 层事件转发链中无意义的中间转发

### 6. 代码质量提升（P4）

- `api.ts` 中提取公共 `requireElectronShell()` 函数
- `searchFiles` 解构和 URL 构建简化
- `formatDate` 中 `"zh-CN"` 改为从浏览器 locale 获取
- 整理 `index.vue` 中 import 注释位置