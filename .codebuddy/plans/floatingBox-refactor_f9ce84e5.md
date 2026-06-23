---
name: floatingBox-refactor
overview: 审查并重构 floatingBox 功能模块，解决跨功能直接导入（违反 CODEBUDDY.md）、831行巨型组件、i18n 键缺失、SCSS 耦合等问题，输出完整的优化方案。
---

现在我已经完整阅读并分析了所有文件。以下是对 `floatingBox` 功能模块的完整审查报告和重构方案。

---

## 审查结论总览

| 序号 | 严重度 | 问题 | 违规条款 |
| --- | --- | --- | --- |
| 1 | **严重** | 3 处跨功能直接导入 | CODEBUDDY.md：功能模块之间禁止直接相互导入 |
| 2 | **严重** | `PromptsModal.vue` 831 行，单一文件承载 4 个子弹窗 + 全部逻辑 | 关注点分离 |
| 3 | 中等 | `PromptsModal.scss` 603 行 | SCSS 过大 |
| 4 | 中等 | SCSS 架构缺陷：共享 mixins 与工具栏样式混在同一文件，`@use` 产生副作用导入 | SCSS 规范 |
| 5 | 中等 | `promptsTool` 是 `createPromptsTool` 的冗余别名 | DRY |
| 6 | 中等 | i18n fallback 手写 48 行字典 + 键缺失 | i18n 规范 |
| 7 | 轻微 | 缺少 `composables/` 目录 | 目录规范 |


---

## 重构方案详述

### 问题 1：跨功能直接导入 → 事件总线 + App.vue 调度

**当前违规代码**：

- `tools/flashcardReading.ts:2` → `import { toggleFlashcardDialog } from "../../flashcardReading/FlashcardReading"`
- `tools/passwordVault.ts:2` → `import { togglePasswordVault } from "../../passwordVault"`
- `tools/textDiff.ts:2` → `import { getTextDiffManager } from "../../textDiff"`

**改造方案**：

1. 这三个 tool 文件不再直接导入其他功能，改为调用 `emitCustomEvent("openFlashcardReading" / "openPasswordVault" / "openTextDiff")`
2. `App.vue` 新增 3 个 `window.addEventListener` 监听器，收到事件后调用目标功能已导出的公开 API（`togglePasswordVault` / `getTextDiffManager().toggle()` / 通过 `emitCustomEvent` 间接触发 flashcardReading），这些 API 已存在于 `src/features/index.ts` 的导出中
3. `floatingBox/index.vue` 中调用 tool action 时，`flashcardReading` 和 `passwordVault` 工具需要传入 plugin 引用，改为由 action 内部通过事件桥接——这两个工具 action 当前直接调用了跨模块函数，改为 `emitCustomEvent` 即可
4. `index.vue` 中 `flashcardReadingTool` 当前调用 `action(plugin)` 传参，事件模式不再需要传 plugin，改为 `action()`

### 问题 2：PromptsModal.vue 拆分

**当前结构**：831 行，含 4 个独立弹窗（主网格/增删改表单/分类管理/删除确认），script 约 365 行。

**拆分方案**：

| 新文件 | 职责 | 预估行数 |
| --- | --- | --- |
| `composables/usePrompts.ts` | 提示词 CRUD + 迁移逻辑 + 过滤计算 | ~150 行 |
| `composables/useCategoryManager.ts` | 分类 CRUD + 分类列表管理 | ~80 行 |
| `components/PromptsGrid.vue` | 网格视图 + 搜索/筛选 + 卡片渲染 + 内容复制 | ~100 行 |
| `components/PromptFormModal.vue` | 添加/编辑提示词表单 + 内容块编辑器 | ~180 行 |
| `components/CategoryManageModal.vue` | 分类管理弹窗 | ~70 行 |
| `components/DeleteConfirmModal.vue` | 删除确认弹窗 | ~50 行 |
| `PromptsModal.vue`（保留） | 容器编排：组合 4 个子组件，管理弹窗显隐状态，提供 i18n prop 透传 | ~80 行 script |


**数据流**：`PromptsModal`（容器）持有 `showAddModal`/`showCategoryManage`/`deleteConfirmTarget` 状态和 `prompts`/`categories` 响应式数据 → 通过 `usePrompts` 和 `useCategoryManager` composable 暴露 CRUD 方法 → 通过 props 传给子组件。

### 问题 3 + 4：SCSS 重构

**当前问题**：`styles/index.scss` 包含工具栏样式（68-270 行）和共享 mixins/variables（1-48 行）。`PromptsModal.scss` 通过 `@use "./index" as floatingBox` 导入整个文件，产生工具栏样式副作用。

**改造方案**：

1. **新建 `styles/_mixins.scss`** — 提取 `modal-overlay`、`modal-base`、`card-hover`、`form-input` 四个共享 mixin + 相关变量（`$modal-z-index`、`$modal-small-max-width`、`$modal-form-max-width`、`$modal-large-max-width`、`$card-border-radius`）→ ~55 行
2. **`styles/index.scss` 改为 `@use "./mixins"`**（仅引用 mixins，不重复定义）→ 保留工具栏样式 → ~230 行
3. **拆分 `PromptsModal.scss` 为 5 个 partial**，均 `@use "./mixins"`：

- `styles/_modal.scss` — overlay/modal base/header/body/loading/empty → ~80 行
- `styles/_grid.scss` — category filter/chips、controls/search、grid/card/content blocks → ~150 行
- `styles/_form.scss` — form elements/content editor/form actions → ~120 行
- `styles/_category.scss` — category form/color input/category list → ~80 行
- `styles/_responsive.scss` — 768px 响应式覆盖 → ~70 行

4. **PromptsModal.vue 的 `<style>` 块改为 `@use` 这 5 个 partial**（或新建 `styles/PromptsModal.scss` 作为聚合入口 `@use`）

### 问题 5：冗余别名

删除 `tools/prompts.ts` 中的 `promptsTool` 导出函数，同步更新 `tools/index.ts` 移除其导出。

### 问题 6：i18n 键补充

在 `floatingBox.json`（zh_CN / en_US）中新增以下键：

```
{
  "passwordVault": "密码箱",
  "passwordVaultTitle": "打开密码箱",
  "flashcardReading": "单词阅读",
  "flashcardReadingTitle": "打开单词阅读",
  "refreshFiletree": "文件树",
  "refreshFiletreeTitle": "重载文件树",
  "refreshTag": "标签树",
  "refreshTagTitle": "重载标签树",
  "refreshUI": "完整刷新",
  "refreshUITitle": "重载整个界面",
  "skills": "提示词库",
  "skillsTitle": "打开提示词库"
}
```

同时删除 `tools/prompts.ts` 中 48 行的 `getI18nMap()` 函数，改用标准 i18n prop 传递模式。

---

## 涉及文件清单

```
[MODIFY]  src/features/floatingBox/index.vue                         # 工具 action 调用改为无参事件模式
[MODIFY]  src/features/floatingBox/components/PromptsModal.vue       # 缩减为容器（~80 行 script），编排 4 个子组件
[MODIFY]  src/features/floatingBox/components/ToolItem.vue            # 适配新 tool 接口（如有需要）
[MODIFY]  src/features/floatingBox/tools/flashcardReading.ts          # 改为 emitCustomEvent("openFlashcardReading")
[MODIFY]  src/features/floatingBox/tools/passwordVault.ts             # 改为 emitCustomEvent("openPasswordVault")
[MODIFY]  src/features/floatingBox/tools/textDiff.ts                  # 改为 emitCustomEvent("openTextDiff")
[MODIFY]  src/features/floatingBox/tools/prompts.ts                   # 删除 getI18nMap() 函数，简化 createPromptsTool
[MODIFY]  src/features/floatingBox/tools/index.ts                     # 移除 promptsTool 导出
[MODIFY]  src/features/floatingBox/styles/index.scss                  # 提取 mixins 到 _mixins.scss，仅保留工具栏样式
[MODIFY]  src/features/floatingBox/styles/PromptsModal.scss           # 改为聚合入口 @use 5 个 partial
[MODIFY]  src/i18n/zh_CN/floatingBox.json                             # 补充 12 个缺失键
[MODIFY]  src/i18n/en_US/floatingBox.json                             # 补充 12 个缺失键
[MODIFY]  src/App.vue                                                 # 新增 3 个事件监听器
[NEW]     src/features/floatingBox/composables/usePrompts.ts          # 提示词 CRUD + 迁移 + 过滤
[NEW]     src/features/floatingBox/composables/useCategoryManager.ts  # 分类 CRUD
[NEW]     src/features/floatingBox/components/PromptsGrid.vue         # 网格视图组件
[NEW]     src/features/floatingBox/components/PromptFormModal.vue     # 增删改表单组件
[NEW]     src/features/floatingBox/components/CategoryManageModal.vue # 分类管理弹窗
[NEW]     src/features/floatingBox/components/DeleteConfirmModal.vue  # 删除确认弹窗
[NEW]     src/features/floatingBox/styles/_mixins.scss                # 共享 SCSS mixins + variables
[NEW]     src/features/floatingBox/styles/_modal.scss                 # modal 基础样式
[NEW]     src/features/floatingBox/styles/_grid.scss                  # 网格/卡片/搜索样式
[NEW]     src/features/floatingBox/styles/_form.scss                  # 表单/编辑器样式
[NEW]     src/features/floatingBox/styles/_category.scss              # 分类管理样式
[NEW]     src/features/floatingBox/styles/_responsive.scss            # 响应式样式
```

---

## 验证清单

完成所有修改后，依次执行：

```
pnpm lint            # ESLint 代码规范
pnpm i18n:verify     # 中英文键对齐
pnpm validate:icons  # 图标注册有效性（无变更，但需确认）
npx tsc --noEmit     # TypeScript 编译类型检查
```

---

## 架构约束（必须遵守）

- **跨功能通信**：仅使用 `emitCustomEvent` + `App.vue` 中枢调度，禁止功能间直接导入
- **SCSS 分离**：所有样式在 `.scss` 文件中，Vue SFC 仅含 `@use` 导入
- **统一入口 API**：存储用 `TypedStorage`，剪贴板用 `copyToClipboard`，弹窗用 `createModalVueApp`
- **行为不变**：外部 observable behavior 完全保持不变（悬浮工具栏交互、提示词库功能均不受影响）
- **i18n**：仅编辑分片文件，禁止编辑合并后的 `zh_CN.json`/`en_US.json`

```xml
<plan_result>
<req>
## 用户需求
对 `src/features/floatingBox/` 功能模块进行全面审查，区分功能模块化边界，给出符合 CLAUDE.md 规则的优化重构方案。当前为 Plan Mode，仅出方案不执行。

## 产品概述
floatingBox 是思源笔记插件中的一个功能模块，在页面右侧显示悬浮工具箱，包含超级面板、刷新、文本对比、密码箱、单词阅读、提示词库 6 个快捷工具。其中提示词库工具拥有完整的增删改查弹窗系统。

## 核心功能
- 悬浮工具栏：页面右侧居中显示可展开的工具按钮，桌面端 hover 展开，移动端 click 展开
- 6 个快捷工具入口：超级面板、刷新（含文件树/标签树/完整刷新子菜单）、文本对比、密码箱、单词阅读、提示词库
- 提示词库弹窗系统：网格视图、搜索筛选、分类标签、内容块复制、添加/编辑表单（含动态内容块编辑器）、分类管理、删除确认
</req>

<tech>
## 技术栈
- 前端框架：Vue 3 + TypeScript
- 样式方案：SCSS（强制分离到 styles/ 目录）
- 构建工具：Vite
- 平台：思源笔记（Electron 桌面应用）
- 跨功能通信：emitCustomEvent + App.vue 中枢调度

## 重构方案

### 方案概述
本次重构是纯架构优化，不改变任何用户可见行为。核心策略：**拆分巨型组件 + 修复跨模块导入违规 + 规范化 SCSS 架构 + 补全 i18n**。

### 问题 1：跨功能直接导入 → 事件总线 + App.vue 调度

**现状**：3 个 tool 文件直接导入其他 feature 模块的 API，违反 CODEBUDDY.md"功能模块之间禁止直接相互导入"规则。

**改造**：
1. `flashcardReading.ts` / `passwordVault.ts` / `textDiff.ts` 不再 import 其他模块，改为调用 `emitCustomEvent("openFlashcardReading" / "openPasswordVault" / "openTextDiff")`
2. `App.vue` `onMounted` 中新增 3 个 `window.addEventListener`，分别调用 `passwordVaultVisible` toggle、`getTextDiffManager()?.toggle()`、通过事件库桥接打开 flashcardReading
3. `floatingBox/index.vue` 中调用 tool action 的代码从 `action(plugin)` 改为 `action()`（事件模式不再需要传递 plugin 引用）

**关键决策**：选择 `emitCustomEvent` 而非直接调用 window.dispatchEvent，因为项目统一使用 `@/utils/eventBus` 封装，且 `App.vue` 通过 `window.addEventListener` 监听原生 CustomEvent 是项目中已有的成熟模式（参见 `toggleToolCollection` 等实现）。

### 问题 2：PromptsModal.vue 831 行拆分

**现状**：单个 Vue SFC 包含 4 个独立弹窗（主网格、增删改表单、分类管理、删除确认）+ 完整 CRUD 逻辑 + 内容块编辑器。

**改造**：
- **提取 `composables/usePrompts.ts`**：提示词列表管理（load/save/filter）、旧格式迁移、增删改方法、内容块操作辅助，约 150 行
- **提取 `composables/useCategoryManager.ts`**：分类列表管理（load/save/add/delete）、默认分类逻辑，约 80 行
- **新建 `components/PromptsGrid.vue`**：网格视图 + 搜索输入 + 分类筛选 Chips + 卡片渲染 + 内容块展示/复制，接收 `prompts`/`categories`/`i18n` props，emit `add`/`edit`/`delete`/`categoryChange` 事件，约 100 行
- **新建 `components/PromptFormModal.vue`**：添加/编辑表单（标题/描述/分类选择/动态内容块编辑器），接收 `editingPrompt`/`categories`/`i18n` props，emit `save`/`close` 事件，约 180 行
- **新建 `components/CategoryManageModal.vue`**：分类管理弹窗（新增/删除/颜色选择），接收 `categories`/`i18n` props，emit `add`/`delete`/`close` 事件，约 70 行
- **新建 `components/DeleteConfirmModal.vue`**：删除确认弹窗，接收 `targetId`/`i18n` props，emit `confirm`/`cancel` 事件，约 50 行
- **保留 `PromptsModal.vue`**：作为容器编排者，组合 4 个子组件，管理弹窗显隐状态和过渡动画，script 缩减至约 80 行

**数据流**：PromptsModal（容器）→ usePrompts/useCategoryManager composables → 内部响应式数据 → props 传入子组件 → 子组件通过 emit 回传用户操作 → 容器调用 composable 方法更新数据。

### 问题 3+4：SCSS 架构重构

**现状**：`styles/index.scss` 混放工具栏样式和共享 mixins。`PromptsModal.scss` 通过 `@use "./index"` 产生工具栏样式副作用导入。

**改造**：
- **新建 `styles/_mixins.scss`**：提取 4 个共享 mixin（`modal-overlay`/`modal-base`/`card-hover`/`form-input`）+ 5 个共享变量（`$modal-z-index`/$modal-small-max-width/$modal-form-max-width/$modal-large-max-width/$card-border-radius`），约 55 行
- **`styles/index.scss`**：改为 `@use "./mixins"`，仅保留悬浮工具栏样式（.floating-box-wrapper/.floating-box-trigger/.floating-toolbar/.tool-item/.tool-submenu 等），约 230 行
- **拆分 `PromptsModal.scss` 为 5 个 partial**：`_modal.scss`（基座+header+body）/_grid.scss（网格+卡片+搜索）/_form.scss（表单+编辑器）/_category.scss（分类管理）/_responsive.scss（响应式），均 `@use "./mixins"`
- **新建聚合入口** `PromptsModal.scss`：`@use "./mixins"; @use "./modal"; @use "./grid"; @use "./form"; @use "./category"; @use "./responsive";`

### 问题 5：冗余别名消除
删除 `tools/prompts.ts` 中 `promptsTool` 导出函数，同步更新 `tools/index.ts` 移除其导出行。

### 问题 6：i18n 键补充
在 `floatingBox.json`（zh_CN/en_US）中补充 12 个缺失翻译键，同时删除 `tools/prompts.ts` 中 48 行的 `getI18nMap()` 手动 fallback 函数，改用标准 i18n prop 传递模式。

### 实现注意事项
- **行为不变性**：所有外部 observable 行为（悬浮工具栏 hover/click 展开、提示词库所有 CRUD 操作、刷新子菜单、内容复制）完全保持不变
- **性能**：composable 拆分不引入额外响应式开销；SCSS partial 拆分不增加构建产物体积（Vite/Dart Sass 统一处理 @use 去重）
- **日志**：保持现有的 `console.error` 错误日志不变，不增加新日志
- **兼容性**：`emitCustomEvent` 与现有 `window.addEventListener` 模式完全兼容，不需要修改 `eventBus` 基础设施

### 目录结构变更

```

src/features/floatingBox/
├── index.ts                          # [MODIFY] 不变
├── index.vue                         # [MODIFY] action 调用改为无参事件模式
├── types/
│   ├── index.ts                      # [不修改]
│   └── storage.ts                    # [不修改]
├── composables/                      # [NEW] 新建目录
│   ├── usePrompts.ts                 # [NEW] 提示词 CRUD + 迁移 + 过滤
│   └── useCategoryManager.ts         # [NEW] 分类 CRUD
├── components/
│   ├── PromptsModal.vue              # [MODIFY] 缩减为容器（~80 行 script）
│   ├── PromptsGrid.vue               # [NEW] 网格视图组件
│   ├── PromptFormModal.vue           # [NEW] 增删改表单组件
│   ├── CategoryManageModal.vue       # [NEW] 分类管理弹窗
│   ├── DeleteConfirmModal.vue        # [NEW] 删除确认弹窗
│   └── ToolItem.vue                  # [MODIFY] 适配新 tool 接口
├── tools/
│   ├── index.ts                      # [MODIFY] 移除 promptsTool 导出
│   ├── flashcardReading.ts           # [MODIFY] 改为 emitCustomEvent
│   ├── passwordVault.ts              # [MODIFY] 改为 emitCustomEvent
│   ├── textDiff.ts                   # [MODIFY] 改为 emitCustomEvent
│   ├── prompts.ts                    # [MODIFY] 删除 getI18nMap，简化
│   ├── refresh.ts                    # [不修改]
│   └── superPanel.ts                 # [不修改]
└── styles/
├── index.scss                    # [MODIFY] 提取 mixins，仅保留工具栏样式
├── PromptsModal.scss             # [MODIFY] 改为聚合入口 @use 5 个 partial
├── _mixins.scss                  # [NEW] 共享 mixins + variables
├── _modal.scss                   # [NEW] modal 基座样式
├── _grid.scss                    # [NEW] 网格/卡片/搜索样式
├── _form.scss                    # [NEW] 表单/编辑器样式
├── _category.scss                # [NEW] 分类管理样式
└── _responsive.scss              # [NEW] 响应式样式

```
</tech>

<extensions>
## 智能体扩展
### SubAgent
- **code-explorer**
  - 用途：在重构执行阶段辅助跨文件搜索，验证拆分后的组件间导入关系是否正确，确认没有残留的跨功能直接导入
  - 预期结果：确认所有 import 语句符合 CLAUDE.md 规则，功能模块间零直接依赖
</extensions>

<todolist>
<item id="refactor-cross-imports" deps="">修复 3 处跨功能直接导入违规：将 flashcardReading.ts/passwordVault.ts/textDiff.ts 改为 emitCustomEvent 事件模式，App.vue 新增 3 个事件监听器，index.vue 调整 action 调用</item>
<item id="extract-scss-mixins" deps="">SCSS 架构重构：新建 _mixins.scss 提取共享 mixins/variables，重构 index.scss（仅保留工具栏样式），拆分 PromptsModal.scss 为 5 个 partial（_modal/_grid/_form/_category/_responsive）并新建聚合入口</item>
<item id="split-prompts-modal" deps="extract-scss-mixins">拆分 831 行 PromptsModal.vue：提取 usePrompts 和 useCategoryManager 两个 composable，新建 PromptsGrid/PromptFormModal/CategoryManageModal/DeleteConfirmModal 四个子组件，PromptsModal.vue 缩减为 ~80 行容器</item>
<item id="cleanup-redundancy-and-i18n" deps="">消除冗余别名（删除 promptsTool 函数和 tools/index.ts 对应导出），补全 floatingBox.json 缺失的 12 个 i18n 键，删除 tools/prompts.ts 中 48 行 getI18nMap() 手动 fallback 函数</item>
<item id="verify-build" deps="refactor-cross-imports,split-prompts-modal,cleanup-redundancy-and-i18n">使用 [subagent:code-explorer] 辅助验证：运行 pnpm lint + pnpm i18n:verify + npx tsc --noEmit，确认无跨模块直接导入残留，所有构建检查通过</item>
</todolist>
</plan_result>
```