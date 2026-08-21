---
name: skillsViewer 模块审查与优化
overview: 全面修复 skillsViewer 功能模块的逻辑漏洞、i18n 失效、内存泄露、死代码、重复类型，并按 Codex 规范优化布局与 CSS。
todos:
  - id: fix-i18n-structure
    content: 嵌套化 skillsViewer i18n 分片并移除全部硬编码兜底，补中文注释
    status: completed
  - id: extract-shared-config
    content: 上移 AI_TOOLS 至 config/aiTools.ts，并提取 formatFileSize 消除重复
    status: completed
  - id: fix-logic-bugs
    content: 用 filePath 稳定标识替代数组索引，重命名事件并修复路径输入防抖
    status: completed
  - id: split-view-and-cleanup
    content: 拆分 index.vue 逻辑到 useSkillsViewer composable，清理 pathChangeTimer 与死代码
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: optimize-scss
    content: 使用 [skill:codex-ui-style-guide] 优化 SCSS 布局与 Token 合规、去重与响应式
    status: completed
---

## 用户需求

对 `src/features/skillsViewer`（Skills 查看器）功能模块进行代码审查与优化，覆盖以下方面：

1. **代码逻辑漏洞**：修复列表索引不稳定导致的编辑/删除/复制错位、事件命名与语义不符、路径输入防抖失效等问题。
2. **冗余与重复类型**：消除 `AI_TOOLS` 与顶层配置的字段重复、`formatFileSize` 双份实现、CSS 样式重复编译。
3. **内存泄露**：清理未在组件卸载时销毁的定时器、未释放的 Manager 实例。
4. **死代码**：移除无人调用的 `toggleSkillsViewer`、`formatFileSize`（Manager 内）、无效 fallback。
5. **优化布局与 CSS**：修复 i18n 完全失效（P0）、硬编码色值/尺寸/字号、缺 `$color-*` fallback、`border-width` 抖动、5 列工具卡无响应式等，使其符合项目 Codex 设计规范。

## 核心目标

- 恢复 i18n 中英文文案正确显示（当前平铺结构导致 `plugin.i18n.skillsViewer` 恒为 undefined，全部命中硬编码中文兜底）。
- 以 `filePath` 作为 Skill 的稳定唯一标识，替代数组 index，杜绝误操作。
- 统一 AI 工具元数据单一数据源，消除配置漂移风险。
- 将超 500 行的 `index.vue` 拆分，降低文件规模。
- SCSS 全面 Token 化、去重、响应式化，视觉上保持 Codex 风格不变。

## 技术栈

- Vue 3 + TypeScript（组合式 API）+ SCSS
- 思源笔记插件架构，遵循项目硬规则：统一入口、零跨 feature 直接导入、SCSS 分离、文件头注释、i18n 单一数据源、Codex 设计 Token。

## 实现方案

### 1. 修复 i18n 失效（P0）

- 将 `src/i18n/{zh_CN,en_US}/skillsViewer.json` 从平铺结构改为嵌套结构 `{ "skillsViewer": { ... } }`，子键去掉 `skillsViewer` 前缀（`skillsViewerTitle`→`title`、`skillsViewerDesc`→`desc`、`skillsViewerUnsupported`→`unsupported`、`skillsUnit`→`unit`、`skillsPathHint`→`pathHint`）。
- 移除 `index.vue` 及所有子组件模板中的 `|| '中文兜底'`，i18n 成为唯一文案源；每处 i18n 键上方补中文 HTML 注释。
- 更新 `index.ts` 中 `addCommand` 的 `langKey` 为嵌套键（如 `skillsViewer.title`），保留 `langText` 作为思源框架兜底。
- 顶层合并 JSON 由 `pnpm i18n:merge` 自动生成，禁止手动改。

### 2. 稳定标识替代数组索引（P1）

- 所有 `v-for` 的 `:key` 与 `expandedSkills`/`editingSkill`/`deleteTargetIndex`/`copySourceIndex` 从数组 `index` 改为 `skill.filePath`。
- `deleteTargetSkill`/`copySourceSkill` 由 `skills.value`（全量）按 filePath 查找，而非 `filteredSkills` 索引，避免过滤切换后误操作。
- 删除/保存后按 filePath 定位原始项更新。

### 3. 事件与输入逻辑修正（P1）

- statusBar 发出的 `toggleSkillsViewer` 实为"打开"语义，重命名为 `openSkillsViewer`，同步修改 `statusBar/index.vue` 与 `App.vue` 监听器。
- 删除 `state.ts` 与 `skillsViewer/index.ts` 中无人调用的 `toggleSkillsViewer` 导出。
- `handlePathChange` 由 `@change` 改为 `@input` + 500ms 防抖，实现实时扫描语义。

### 4. 消除重复与配置上移（P2）

- 将完整 `AIToolType`/`AIToolConfig`/`AI_TOOLS`（含 icon/paths）上移至 `src/config/aiTools.ts`，并由其派生 `AI_TOOL_META`；`SkillsViewerManager.ts` 改为从 config 导入，删除本地重复定义。
- 提取 `formatFileSize` 纯函数到 `src/features/skillsViewer/utils.ts`，`SkillCard.vue` 导入使用，删除 `SkillsViewerManager.formatFileSize` 死代码。
- `aiContentGenerator` 的 `SkillScanEntry` 本地投影保留（遵守零跨 feature 导入，已文档化）。

### 5. 资源清理与拆分（P2）

- `onBeforeUnmount` 中 `clearTimeout(pathChangeTimer)`，防止卸载后定时器触发。
- 将 `index.vue` 中约 330 行脚本逻辑抽取到 `composables/useSkillsViewer.ts`，`index.vue` 仅保留模板与极简接线，降至 500 行内。
- 澄清 `scanSkills()` 每次 `new SkillsViewerManager()` 无持久资源（无定时器/监听器，仅持有 fs/path 模块引用），由 GC 回收，非真实泄露；`index.vue` 生命周期内唯一实例在 `onBeforeUnmount` 已调用 `destroy()`。

### 6. SCSS 规范化与去重（P3）

- 移除 `SkillCard.vue`/`DeleteConfirmModal.vue`/`CopySkillModal.vue` 对 `index.scss` 的重复 `@use`（避免每子组件重复编译全量主样式）。
- 新建 `styles/_modal.scss`（共享 `.sv-modal-overlay`/`.sv-modal` 基类 + `.sv-modal-skill-name`/`.sv-modal-skill-path`），新建 `styles/_mixins.scss`（共享 `sv-custom-scrollbar`）。
- 合并后删除 `DeleteConfirmModal.scss`（其内容并入 `_modal.scss`），`CopySkillModal.scss` 仅保留工具选项样式并 `@use "./modal"`。
- 硬编码色值 → Token：`rgba(0,0,0,0.55)` 用 `color-mix` 基于 `$color-fg` 生成；`#22c55e`→`$color-success`；`#ef4444`→`$color-danger`；`#999` 兜底改为非空断言（AI_TOOLS 全量含 color）。
- 所有 `var(--b3-theme-*)` 补 `$color-*` fallback（映射：on-surface→`$color-fg`、on-surface-variant→`$color-muted`、surface→`$color-surface`、background→`$color-bg`、border→`$color-border`、primary→`$color-primary`）。
- 移除 `active` 态 `border-width: 2px` 布局抖动，改仅用 `--tool-color` 边框色 + 背景 + `::after` 左条标识。
- `grid-template-columns: repeat(5, 1fr)` 改为 `repeat(auto-fill, minmax(120px, 1fr))` 实现窄屏换行。
- 裸 px 尺寸/间距/字号/行高统一替换为 `$spacing-*`/`$font-size-*`/`$line-height-*`/`$radius-*` Token。

## 实现要点

- 颜色/字号/间距零硬编码，`var(--b3-theme-*, $color-*)` 双保险，参考 `gitPush/styles/CommitFixDialog.scss`。
- i18n 嵌套结构参考 `src/i18n/zh_CN/video.json`；组件目录组织参考 `statistics/components/`。
- 不执行 `pnpm build`/`pnpm lint`，由用户自行验证 `pnpm lint`、`pnpm i18n:verify`、`pnpm validate:icons`、`npx tsc --noEmit`。

## 目录结构

```
src/
├── config/
│   └── aiTools.ts                          # [MODIFY] 上移完整 AIToolType/AIToolConfig/AI_TOOLS，派生 AI_TOOL_META
├── i18n/
│   ├── zh_CN/skillsViewer.json             # [MODIFY] 嵌套化 + 子键去前缀
│   ├── en_US/skillsViewer.json             # [MODIFY] 嵌套化 + 子键去前缀
│   └── {zh_CN,en_US}.json                  # 自动生成，禁止手改
├── App.vue                                 # [MODIFY] 事件监听 toggleSkillsViewer → openSkillsViewer
└── features/
    ├── skillsViewer/
    │   ├── index.ts                        # [MODIFY] 移除 toggleSkillsViewer；更新 langKey
    │   ├── index.vue                       # [MODIFY] 模板化薄壳，逻辑迁移至 composable
    │   ├── state.ts                        # [MODIFY] 删除死代码 toggleSkillsViewer
    │   ├── utils.ts                        # [NEW] formatFileSize 纯函数
    │   ├── composables/
    │   │   └── useSkillsViewer.ts          # [NEW] 抽取全部状态与 CRUD 逻辑（filePath 稳定标识 + 定时器清理）
    │   ├── types/
    │   │   ├── index.ts                    # [MODIFY] 更新 re-export（类型来自 config）
    │   │   └── SkillsViewerManager.ts      # [MODIFY] 导入 config AI_TOOLS，删除重复定义与 formatFileSize
    │   ├── components/
    │   │   ├── SkillCard.vue               # [MODIFY] 用 utils.formatFileSize；移除 index.scss 导入；去 i18n 兜底
    │   │   ├── DeleteConfirmModal.vue      # [MODIFY] 改 @use _modal；去 i18n 兜底
    │   │   └── CopySkillModal.vue          # [MODIFY] 改 @use _modal + 自身样式；去 i18n 兜底
    │   ├── styles/
    │   │   ├── index.scss                  # [MODIFY] 主弹窗样式 Token 化、响应式、去抖动
    │   │   ├── SkillCard.scss              # [MODIFY] Token 化、滚动条用 mixin
    │   │   ├── CopySkillModal.scss         # [MODIFY] 保留工具选项，@use modal
    │   │   ├── DeleteConfirmModal.scss     # [DELETE] 内容并入 _modal.scss
    │   │   ├── _modal.scss                 # [NEW] 共享 modal 基类 + skill-name/path
    │   │   └── _mixins.scss                # [NEW] sv-custom-scrollbar mixin
    │   └── README.md                       # [MODIFY] 补充目录结构与维护说明
    └── statusBar/index.vue                 # [MODIFY] emit openSkillsViewer
```

## 关键代码结构

跨模块共享契约（`src/config/aiTools.ts`）：

```ts
import type { IconKey } from "@/config/icons"

export type AIToolType = "claude" | "codebuddy" | "qoder" | "trae" | "opencode"

export interface AIToolConfig {
  id: AIToolType
  name: string
  icon: IconKey
  color: string
  skillPaths: string[]
  projectPaths: string[]
}

export const AI_TOOLS: AIToolConfig[] = [/* 完整配置 */]

export const AI_TOOL_META = AI_TOOLS.map(({ id, name, color }) => ({ id, name, color }))
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：审查并修正 skillsViewer 全部 `styles/*.scss`，确保符合项目 Codex 设计规范（Token 化、禁止硬编码色值/尺寸/字号/行高、`$color-*` fallback、响应式布局、SCSS 去重、无 box-shadow）。
- 预期结果：所有 SCSS 通过 Codex 规范，硬编码与冗余消除，5 列工具卡在窄屏可换行，active 态无布局抖动。