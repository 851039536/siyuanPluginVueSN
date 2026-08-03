---
name: textDiff-规则审查优化
overview: 对 textDiff 功能模块进行项目规则合规审查后的优化：拆分双输入面板子组件、图标 Iconify 化、i18n 中文注释补齐、补文件头注释与实例销毁、空状态提示、字号 Token 修正；并输出扩展路线图建议。
todos:
  - id: split-input-panel
    content: 遵循[skill:Feature-Evolution]影响分析结论，提取 components/InputPanel.vue（v-model 多绑定）并用[skill:codex-ui-style-guide]重构 styles（_mixins.scss/InputPanel.scss/TextDiff.scss 重命名 index.scss）
    status: completed
  - id: comply-template
    content: 重构 index.vue 模板：全量补 i18n 中文注释、内联 SVG 换 Iconify 图标、隐藏输入改 class、增加 emptyState 空状态提示
    status: completed
    dependencies:
      - split-input-panel
  - id: fix-types-entry
    content: 修复 types 层与入口：storage.ts 补文件头注释、destroy() 调 modal.destroy()、toggle() 改用 visible，新建 utils.ts 提取共享 $t 函数
    status: completed
  - id: polish-readme
    content: 完善 README.md：功能说明、目录结构、扩展建议路线图（统计栏/忽略选项/语法高亮/导入思源块/导出差异/历史记录）
    status: completed
    dependencies:
      - comply-template
      - fix-types-entry
  - id: verify-structure
    content: 用[skill:universal-arch-skill]校验模块结构与注册链完整性，read_lints 复查全部修改文件，输出用户验证清单（lint/i18n:verify/validate:icons/tsc）
    status: completed
    dependencies:
      - split-input-panel
      - comply-template
      - fix-types-entry
---

## 用户需求

对 `src/features/textDiff` 文本对比功能模块按项目规则（AGENTS_RULES.md / CODEBUDDY.md）进行全面审查，修复所有违规项，并给出后续扩展建议（仅建议，本期不实施）。

## 产品概述

文本对比工具以全屏弹窗形式提供左右两栏文本输入与差异对比，支持分栏/统一两种展示模式、浅色/深色主题、12-24px 字号调节，以及文件拖拽/选择导入。当前通过悬浮框工具（mdi:file-compare）与超级面板派发 `openTextDiff` 事件打开，注册链（8 步）完整。

## 审查发现与修复目标

1. **图标规则违规**：`index.vue` 内定义 5 个内联 SVG path（close/swap/file/cloudUpload/chevronDown），应替换为已离线预加载的 mdi Iconify 图标
2. **i18n 中文注释缺失**：模板约 20 处 `$t()` 及结构区块均无中文注释（硬规则）
3. **文件头注释缺失**：`types/storage.ts` 第一行即 import
4. **内联样式**：隐藏文件输入 `<input style="display: none">` 应提取为 class
5. **字号 Token 违规**：`.drag-overlay span` 使用 `$font-size-sm`(14px) 且无用途注释（辅助提示文字应为 `$font-size-xs`）
6. **实例销毁不彻底**：`TextDiffManager.destroy()` 未调用 `modal.destroy()`
7. **死 i18n 键**：`emptyState` 键未使用，且双文本为空时 diff 区无提示
8. **单文件行数风险**：`index.vue` 484 行，补齐注释后将超 500 行硬阈值，必须先拆分对称的双输入面板（两处复用，符合拆分标准）
9. **README 过简**：仅一句话

## 扩展建议（路线图，本期不实施）

- 差异统计栏（增/删/改行数与字数徽章）
- 忽略选项（大小写/空白/行尾换行）
- 语法高亮语言自动检测（当前 language 硬编码 plaintext，vue-diff 内置 hljs）
- 导入思源当前选中块文本（与笔记深度集成）
- 复制/导出差异结果（patch 格式、triggerDownload）
- 对比历史记录（TypedStorage 持久化 + 一键恢复）
- 大文本自动开启虚拟滚动（virtual-scroll）
- 全局快捷键打开（plugin.addCommand）

## 技术栈

- 沿用项目现有：Vue 3 + TypeScript + SCSS（Vite 构建，思源笔记插件）
- 图标：`@iconify/vue` 直接引用 mdi 系列（`setupIconifyOffline()` 已离线预加载完整 mdi/ph 集合，无需 FEATURE_ICONS 注册，参考 flashcardReading 模式）
- 差异渲染：`vue-diff` 第三方组件（已验证类名：根 `.vue-diff-wrapper`、查看器 `.vue-diff-viewer`）

## 实施方案

1. **组件拆分（先决任务）**：两个输入面板结构完全对称、两处复用，提取 `components/InputPanel.vue`。采用 Vue 3 多绑定 v-model 模式（`v-model` + `v-model:fileName`），文件选择、拖拽、FileReader 读取全部内聚到子组件（自含隐藏 file input），父组件仅保留文本状态用于 diff 计算。同时改进 DOM 结构：header 与 `.input-body`（position:relative）分离，拖拽遮罩层在 body 内 `inset:0`，消除硬编码 `top: 29px`。index.vue 模板预计瘦身约 110 行。
2. **SCSS 结构重构**：按 SCSS 命名规范重组——共享 mixin 提取到 `styles/_mixins.scss`（codex-meta-label/codex-border-card/codex-btn-base/flex-row），子组件专属样式入 `styles/InputPanel.scss`，原 `TextDiff.scss` 重命名为 `styles/index.scss`（主面板 + 共享基座）。子组件双行导入：组件专属 + `../styles/index.scss`。所有 SCSS 文件 `@use '@/variables.scss' as *;` 置于文件最顶部。
3. **模板合规**：所有 `$t()` 与结构区块补中文 HTML 注释；5 个内联 SVG 替换为 `<Icon icon="mdi:...">`（close/swap-horizontal/file-outline/cloud-upload-outline/chevron-down）；隐藏输入改 class；双文本为空时展示 `emptyState` 提示（消除死键）。
4. **入口与类型修复**：`destroy()` 显式调用 `this.modal.destroy()`；`toggle()` 改用 `modal.visible` 判断（替代 `app && container` 探测）；`storage.ts` 补文件头注释。
5. **字号修正**：`.drag-overlay span` 由 `$font-size-sm` 降为 `$font-size-xs`（辅助提示文字）。
6. **文档**：完善 README（功能说明 + 扩展建议路线图）。

## 实施要点

- 分层规则：`$t` 辅助函数被 index.vue 与 InputPanel.vue 两文件共用，须提取到 `utils.ts`，禁止复制粘贴
- 不改动 diff 计算逻辑、存储键名与事件流（openTextDiff 事件、DESTROYABLE_KEYS 均不动），blast radius 限于 textDiff 模块内
- 字号机制保留：用户可调 `--diff-font-size` CSS 变量（12-24px）是合法设计，SCSS 中 `var(--diff-font-size, 14px)` 引用保留
- vue-diff 自带 inputDelay 防抖，无需自行处理；大文本性能优化列入扩展路线图
- 图标使用 mdi 系列（离线集合已加载），不需要新增 FEATURE_ICONS 注册，`pnpm validate:icons` 不受影响
- 性能：组件拆分为纯结构性变更，数据流（props 下行 / emit 上行）不变，无额外渲染开销

## 架构设计

无架构变更。仍为「Manager（types/index.ts 持有 createModalVueApp 弹窗）→ index.vue 主面板 → InputPanel 子组件」的单向数据流：

- Manager 创建持久弹窗并挂载 `__textDiff`（DESTROYABLE_KEYS 统一销毁）
- index.vue 持有 originalText/modifiedText 响应式状态，v-model 下发至两个 InputPanel 实例，实时传给 vue-diff 计算
- InputPanel 自包含文件导入（选择/拖拽/读取），通过 `update:modelValue` / `update:fileName` 回传

## 目录结构

```
src/features/textDiff/
├── index.ts              # 不变（已合规：registerFeature + __textDiff 自挂载）
├── index.vue             # [MODIFY] 引用 InputPanel；模板补 i18n 中文注释、Iconify 图标、空状态提示、隐藏输入 class 化
├── README.md             # [MODIFY] 完善功能说明 + 扩展建议路线图
├── utils.ts              # [NEW] textDiffI18n(i18n, key) 共享 i18n 辅助函数（2 文件共用，按分层规则提取）
├── components/
│   └── InputPanel.vue    # [NEW] 单侧文本输入面板：自包含文件选择/拖拽/FileReader；props: titleKey/placeholderKey/modelValue/fileName/i18n；emits: update:modelValue/update:fileName
├── types/
│   ├── index.ts          # [MODIFY] TextDiffManager.destroy() 补 modal.destroy()；toggle() 改用 visible 判断
│   └── storage.ts        # [MODIFY] 补文件头功能说明注释
└── styles/
    ├── _mixins.scss      # [NEW] 共享 mixin（codex-meta-label/codex-border-card/codex-btn-base/flex-row）
    ├── InputPanel.scss   # [NEW] InputPanel 子组件专属样式（input-panel/panel-header/textarea/drag-overlay，遮罩 top 改 inset:0 布局）
    └── index.scss        # [RENAME] 原 TextDiff.scss 重命名；.drag-overlay span 字号 sm→xs
```

## Agent Extensions

### Skill

- **Feature Evolution**
- Purpose: 作为本次功能迭代审查的方法论框架（影响分析 → 增量优化 → 回归验证），其影响分析结论确定了「先拆分 InputPanel 再补注释」的执行顺序
- Expected outcome: 变更范围受控（仅 textDiff 模块内），修复后不破坏既有功能与注册链
- **codex-ui-style-guide**
- Purpose: 在 SCSS 重构（_mixins.scss/InputPanel.scss/index.scss）与字号 Token 修正过程中提供 Codex 样式规范依据，复查硬编码尺寸/颜色/#fff 等遗留项
- Expected outcome: 重构后全部样式符合 Token 规范与双行导入规则，无遗漏违规
- **universal-arch-skill**
- Purpose: 校验重构后 textDiff 模块结构与注册链完整性（8 步注册、实例挂载/销毁模式、代码分层）
- Expected outcome: 模块结构合规性得到确认，输出验证清单供用户执行