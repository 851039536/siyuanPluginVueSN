---
name: gitPush components 子文件夹分类重构
overview: gitPush 功能含 4 个视图（list/stats/log/analysis），触发"≥3 个 Tab 必须按 Tab 建子文件夹"强制规则。当前 31 个组件平铺在 components/ 根目录，需按视图重组为 common/、list/、stats/、log/、analysis/ 五个子文件夹，并同步更新所有 import 路径。
todos:
  - id: create-subfolders-move-components
    content: 创建 common/list/stats/log/analysis 五个子文件夹并迁移 31 个组件文件
    status: completed
  - id: update-index-vue-imports
    content: 更新 index.vue 中 17 处组件 import 路径
    status: completed
    dependencies:
      - create-subfolders-move-components
  - id: update-scss-use-paths
    content: 批量更新 31 个迁移组件内 SCSS @use 相对路径（../styles/ → ../../styles/）
    status: completed
    dependencies:
      - create-subfolders-move-components
  - id: update-readme
    content: 同步更新 gitPush/README.md 目录结构说明，使用 [skill:codex-ui-style-guide] 验证 SCSS 规范合规性
    status: completed
    dependencies:
      - update-index-vue-imports
      - update-scss-use-paths
---

## 产品概述

对 `gitPush` 功能模块的 `components/` 目录进行组件文件夹组织规范审查与重构。该模块含 4 个视图（list/stats/log/analysis），31 个组件平铺在根目录，违反了项目规则"≥3 个 Tab 时必须按 Tab 建子文件夹分类"的强制要求。

## 核心功能

- 将 31 个平铺组件按视图归属迁移到 5 个子文件夹（common/list/stats/log/analysis）
- 更新所有受影响的 import 路径（6 个文件共 31 处）
- 确保迁移后 SCSS 导入路径、组件引用链完整无断裂
- 不改变任何组件内部代码逻辑，仅做文件移动和路径更新

## 技术栈

- 纯文件移动 + import 路径更新，不涉及技术栈变更
- Vue 3 SFC 组件，TypeScript import 语句
- SCSS `@use` 导入路径（子组件双行导入规则：组件专属 + 共享 index.scss）

## 实现方案

### 组件归属分类（基于 index.vue 视图分支 + import 链追溯）

**common/（13 个）** — 面板级常驻 / 跨视图复用 / 全局弹窗及其子组件：

- PanelHeader.vue + SearchBox.vue（PanelHeader 子组件）
- BatchProgressBar.vue、ConfirmDialog.vue
- AddProjectDialog.vue、CategoryDialog.vue、SettingsDialog.vue
- IdeManagementDialog.vue、ScanImportDialog.vue
- EditProjectDialog.vue + EditableRemoteList.vue + CloneLogPanel.vue（EditProjectDialog 子组件，随父归 common）
- MarkdownPreviewDialog.vue、GitConfigDialog.vue

**list/（10 个）** — 列表视图专属：

- ListViewToolbar.vue、ProjectCard.vue
- ProjectCard 子组件：BranchCommitList.vue、ConflictSection.vue、MarkdownFileBadge.vue、OutputPanel.vue、StashSection.vue、TagPanel.vue、WorkingTreePanel.vue
- WorkingTreePanel 子组件：WorkingTreeDiffDialog.vue

**stats/（2 个）** — 统计视图专属：

- StatsPanel.vue、RepoLinkAuditSection.vue

**log/（1 个）** — 操作日志视图专属：

- LogPanel.vue

**analysis/（4 个）** — 提交分析视图专属：

- CommitAnalysisPanel.vue、CommitAnalysisSettings.vue、CommitCalendar.vue、CommitHeatmap.vue

### import 路径更新规则

| 文件 | 更新内容 |
| --- | --- |
| index.vue | 17 处 `./components/Xxx.vue` → 按归属改为 `./components/common/Xxx.vue` 或 `./components/list/Xxx.vue` 等 |
| ProjectCard.vue | 7 处 `./Xxx.vue` → `./Xxx.vue`（同文件夹，路径不变） |
| CommitAnalysisPanel.vue | 3 处 `./Xxx.vue` → `./Xxx.vue`（同文件夹，路径不变） |
| WorkingTreePanel.vue | 1 处 `./WorkingTreeDiffDialog.vue` → 同文件夹不变 |
| StatsPanel.vue | 1 处 `./RepoLinkAuditSection.vue` → 同文件夹不变 |
| EditProjectDialog.vue | 2 处 `./Xxx.vue` → `./Xxx.vue`（同文件夹，路径不变） |
| PanelHeader.vue | 如引用 SearchBox，需确认同文件夹不变 |


**关键发现**：子组件跟随父组件进入同一子文件夹后，子组件之间的 `./Xxx.vue` 相对路径无需修改。只有 index.vue 顶层引用的 17 处 import 需要更新路径前缀。

### SCSS 导入路径

子组件迁移到子文件夹后，SCSS 双行导入中的相对路径从 `../styles/` 变为 `../../styles/`（多一层目录）。需逐个检查并更新。

## 实现备注

- **SCSS 路径是最易出错点**：每个迁移的 .vue 文件内的 `<style>` 块有两行 `@use`，从 `../styles/` 变为 `../../styles/`。31 个文件共 62 行需检查
- **子组件内部 import 不变**：同一子文件夹内的组件互相引用仍用 `./Xxx.vue`，无需改动
- **不改动任何逻辑代码**：仅移动文件 + 更新 import/@use 路径
- **README.md 同步**：迁移完成后更新 `gitPush/README.md` 中的目录结构说明

## 目录结构

```
src/features/gitPush/
├── components/
│   ├── common/           # 13 个：面板常驻 + 全局弹窗及其子组件
│   │   ├── PanelHeader.vue
│   │   ├── SearchBox.vue
│   │   ├── BatchProgressBar.vue
│   │   ├── ConfirmDialog.vue
│   │   ├── AddProjectDialog.vue
│   │   ├── CategoryDialog.vue
│   │   ├── SettingsDialog.vue
│   │   ├── IdeManagementDialog.vue
│   │   ├── ScanImportDialog.vue
│   │   ├── EditProjectDialog.vue
│   │   ├── EditableRemoteList.vue
│   │   ├── CloneLogPanel.vue
│   │   ├── MarkdownPreviewDialog.vue
│   │   └── GitConfigDialog.vue
│   ├── list/             # 10 个：列表视图专属
│   │   ├── ListViewToolbar.vue
│   │   ├── ProjectCard.vue
│   │   ├── BranchCommitList.vue
│   │   ├── ConflictSection.vue
│   │   ├── MarkdownFileBadge.vue
│   │   ├── OutputPanel.vue
│   │   ├── StashSection.vue
│   │   ├── TagPanel.vue
│   │   ├── WorkingTreePanel.vue
│   │   └── WorkingTreeDiffDialog.vue
│   ├── stats/            # 2 个：统计视图专属
│   │   ├── StatsPanel.vue
│   │   └── RepoLinkAuditSection.vue
│   ├── log/              # 1 个：操作日志视图专属
│   │   └── LogPanel.vue
│   └── analysis/         # 4 个：提交分析视图专属
│       ├── CommitAnalysisPanel.vue
│       ├── CommitAnalysisSettings.vue
│       ├── CommitCalendar.vue
│       └── CommitHeatmap.vue
├── index.vue             # [MODIFY] 17 处 import 路径更新
├── README.md             # [MODIFY] 目录结构说明同步
└── ...（其他文件不变）
```

## 关键代码结构

index.vue import 路径更新示例（17 处）：

```typescript
// 修改前
import PanelHeader from "./components/PanelHeader.vue"
import ProjectCard from "./components/ProjectCard.vue"
import StatsPanel from "./components/StatsPanel.vue"
import LogPanel from "./components/LogPanel.vue"
import CommitAnalysisPanel from "./components/CommitAnalysisPanel.vue"

// 修改后
import PanelHeader from "./components/common/PanelHeader.vue"
import ProjectCard from "./components/list/ProjectCard.vue"
import StatsPanel from "./components/stats/StatsPanel.vue"
import LogPanel from "./components/log/LogPanel.vue"
import CommitAnalysisPanel from "./components/analysis/CommitAnalysisPanel.vue"
```

子组件 SCSS 路径更新示例（每个迁移文件）：

```
// 修改前（平铺在 components/ 下）
@use '../styles/MyComponent.scss';
@use '../styles/index.scss';

// 修改后（在 components/common/ 等子目录下）
@use '../../styles/MyComponent.scss';
@use '../../styles/index.scss';
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose: 验证迁移后 SCSS 导入路径是否符合 Codex UI 样式规范，确保 `@use` 双行导入规则在子目录层级下仍正确
- Expected outcome: 所有迁移组件的 SCSS 路径合规，无样式断裂风险