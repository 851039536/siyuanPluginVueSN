---
name: rulecheck-drop-integration-review-fix
overview: 修复删除功能集成审查发现的 2 处问题：index.vue 文件头注释过时（仍写"修正弹窗"，实际挂载 3 个弹窗）、删除按钮复用 .grc-item-fix 类名语义不符（应为 .grc-item-drop）。
todos:
  - id: fix-index-comments
    content: 更新 CommitRuleCheck/index.vue 文件头与 script 顶部两处注释为「修正/删除/批量修正弹窗」表述
    status: completed
  - id: fix-drop-btn-class
    content: ViolationListSection.vue 删除按钮改用 grc-item-drop 类名，CommitRuleCheckPanel.scss 合并声明 .grc-item-fix 与 .grc-item-drop 共用规则
    status: completed
---

## 产品概述

对「删除历史提交功能集成到规则检查视图」的改动进行越界与冗余审查后，修复审查发现的 2 处问题（纯注释与类名语义修正，不改变任何运行行为与视觉效果）。

## 审查结论（只读已完成）

### 越界检查（全部通过）

- 未触碰 DropCommitDialog.vue 本体（复用零改动，符合计划约束）
- 无跨 feature 直接导入（均在 gitPush 模块内部，import 路径为相对路径 `../common/`）
- emit 命名合规：emit 定义侧 camelCase（`openDrop`），模板监听侧 `@open-drop` 与既有 `@open-fix`/`@open-batch-fix` 模式一致
- 弹窗接入符合自包含规范：父组件只传 target + 开关状态，无中间人/props 膨胀
- 删除成功回调照抄 handleFixSaved 既有模式，runAnalysis 复用既有签名（支持单项目重抓）

### 冗余检查

- 可接受项（不修改）：handleFixSaved/handleDropSaved 为两个两行函数（Rule of Three：仅 2 实例，抽象降低可读性）；openDrop 透传 ViolationRow 含 key 字段，与既有 openFix 模式一致
- 需修正项：

1. `CommitRuleCheck/index.vue` 文件头 HTML 注释（L1）与 script 顶部注释（L116）仍写「修正弹窗」，但模板实际挂载 3 个弹窗（CommitFixDialog/DropCommitDialog/BatchFixDialog），注释过时
2. `ViolationListSection.vue` 删除按钮复用了 `.grc-item-fix` 类名（"fix"语义 = 修正），类名与功能不符，应改为语义化的 `grc-item-drop` 并在 SCSS 中合并声明共用规则

## 核心功能

- 更新 index.vue 两处过时注释为「修正/删除/批量修正弹窗」表述
- 删除按钮类名改为 `grc-item-drop`，SCSS 将 `.grc-item-fix` 扩展为 `.grc-item-fix, .grc-item-drop` 合并声明，样式零变化

## Tech Stack

- 复用现有 Vue 3 + TypeScript + SCSS 体系，无新增依赖、无新增 i18n 键

## 实现方案

### 修改 1：index.vue 注释修正

- L1 文件头 HTML 注释：「状态编排 + 各功能区块组合 + 修正弹窗，纯编排无领域状态」→「…+ 修正/删除/批量修正弹窗…」
- L116 script 注释：「状态编排 + 各功能区块组合 + 修正弹窗」→「…+ 修正/删除/批量修正弹窗」

### 修改 2：删除按钮类名语义化

- `ViolationListSection.vue` L68：删除按钮 class 由 `grc-item-fix` 改为 `grc-item-drop`（修正按钮保留 `grc-item-fix` 不动）
- `CommitRuleCheckPanel.scss` L274-283：选择器由 `.grc-item-fix` 改为 `.grc-item-fix, .grc-item-drop`，注释由「违规列表中的修正按钮」改为「违规列表中的修正/删除按钮（共用样式）」；规则体（padding/border-radius/opacity 0.6 + hover 1）零改动

### 性能与回归风险

- 纯注释与 CSS 类名变更：产物样式字节级等价（同一规则合并声明），零运行时行为变化、零回归风险