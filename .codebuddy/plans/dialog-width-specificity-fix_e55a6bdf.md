---
name: dialog-width-specificity-fix
overview: 修复 4 个弹窗宽度声明被 `.gp-dialog` 基础样式（Dialog.scss 经 index.scss 后置加载的 420px/90vw）同优先级覆盖的问题：单类选择器统一改为 `.gp-dialog.<name>` 组合选择器（对齐 SettingsDialog/CommitFilesDialog 既有范式）。
todos:
  - id: fix-dialog-width-selectors
    content: 将 DropCommitDialog/BatchFixDialog/TagCommitDialog/RepoCleanPanel(.grcp-wizard) 四处宽度声明改为 .gp-dialog.
    status: completed
---

## 产品概述

修复 gitPush 模块 4 个弹窗的宽度覆盖缺陷。审查确认：`.gp-dialog { width: 420px; max-width: 90vw }`（Dialog.scss，经 index.scss 后置加载）会以同优先级覆盖以下 4 个弹窗的单类宽度声明，导致设计宽度从未生效（实际渲染均为 420px）：

1. **DropCommitDialog**：`.gp-drop-dialog`（意图 480px，实际 420px）——删除历史提交弹窗
2. **BatchFixDialog**：`.gp-fix-batch-dialog`（意图 640px，实际 420px）——批量修正弹窗，影响最大（本应加宽容纳多条违规条目）
3. **TagCommitDialog**：`.gp-tagc-dialog`（宽度 420px 与覆盖值恰好同值，无视觉差，但 max-width 92vw 被覆盖为 90vw）——打 Tag 弹窗
4. **RepoCleanPanel 的 `.grcp-wizard`**（意图 520px，实际 420px）——BFG 清理向导弹窗

## 核心功能

- 4 处宽度声明选择器统一改为 `.gp-dialog.<name>` 组合选择器（优先级 0,2,0 稳定胜出，与加载顺序无关），width/max-width 值保持原值不变
- 修复后各弹窗恢复设计意图宽度，纯选择器变更、零视觉回归风险

## 已核实不受影响（无需改动）

- SettingsDialog（`.gp-dialog.gp-dialog--settings` 双类，注释明确记载此坑）、CommitFilesDialog（`.gp-dialog.gcf-dialog`）、CommitFixDialog（本会话已修复）
- ScanImportDialog / EditProjectDialog / IdeManagementDialog：宽度定义在 index.scss 正文，同优先级后置胜出，生效
- CategoryDialog / AddProjectDialog：无修饰类，设计上就用基础 420px
- 非 gp-dialog 体系：AiErrorAnalysisDialog / ConsistencyAuditDialog / ConfirmDialog / CommitFileDiffDialog 均不受影响

## Tech Stack

- 纯 SCSS 选择器变更，无新增依赖、无 TS/Vue 逻辑改动

## Implementation Approach

- 4 处修改完全同质：将单类选择器改为 `.gp-dialog.<name>` 组合选择器，参照项目既有范式（`SettingsDialog.scss` 的 `.gp-dialog.gp-dialog--settings`、`CommitFilesDialog.scss` 的 `.gp-dialog.gcf-dialog`）
- 每处补充一行原因注释（说明单类会被基础 `.gp-dialog` 同优先级后置覆盖），对齐 CommitFixDialog.scss 刚修复时的注释风格
- width / max-width 数值保持各自原值，产物样式仅消除覆盖、恢复设计意图

## Implementation Notes

- 不触碰任何 .vue 模板（class 组合已含 `gp-dialog`，无需改动）
- 不改 AGENTS/STYLE 文档（除非用户要求）；修复完成后更新 memory 记录
- lint 校验 4 个 scss 文件无错误