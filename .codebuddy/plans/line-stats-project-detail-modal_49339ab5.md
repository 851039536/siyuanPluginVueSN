---
name: line-stats-project-detail-modal
overview: 行数统计视图中，点击项目行弹出独立 Modal 弹窗，双 Tab 展示该项目的文件明细（路径/新增/删除/净增/占比）与作者明细（作者/新增/删除/净增），数据来源于分析时保留的 per-project NumstatCommit[]。
todos:
  - id: types-and-composable
    content: 在 types/meta.ts 新增 FileLineDetailRow 接口；在 useCommitAnalysis.ts 新增 perProjectNumstat Map、runCore 填充逻辑、导出 getProjectNumstat 方法
    status: completed
  - id: detail-modal-component
    content: 新建 ProjectLineDetail.vue 双 Tab 弹窗组件（Teleport + 遮罩 + 卡片 + 文件表格 + 作者排行 + ESC 关闭）
    status: completed
    dependencies:
      - types-and-composable
  - id: detail-modal-styles
    content: 新建 ProjectLineDetail.scss，使用 [skill:codex-ui-style-guide] 确保 Codex 风格合规
    status: completed
    dependencies:
      - detail-modal-component
  - id: panel-clickable
    content: 修改 LineStatsPanel.vue（项目行加 @click + emit viewProject + 挂载弹窗）和 LineStatsPanel.scss（新增 clickable 交互样式）
    status: completed
    dependencies:
      - types-and-composable
  - id: index-vue-wiring
    content: 修改 index.vue 传递 lineDetailProjectId + perProjectNumstat + getProjectNumstat + 关闭 handler 给 LineStatsPanel
    status: completed
    dependencies:
      - panel-clickable
      - detail-modal-component
  - id: i18n-and-icons
    content: 新增 i18n 键（zh_CN + en_US 各约 10 个）；如需新图标则在 icons.ts 注册
    status: completed
    dependencies:
      - detail-modal-component
---

## 产品概述

为 gitPush 的行数统计视图增加「项目详情弹窗」。用户点击项目排行中的某个项目行后，弹出 Modal 弹窗展示该项目的逐文件行数分析详情和按作者的行数排行。

## 核心功能

- **文件明细 Tab**（默认选中）：排序表格，列出该项目下所有被统计文件的新增/删除/净增行数 + 占比条形，按新增行降序。每行展示：文件路径（等宽字体、防截断）、新增行（绿色）、删除行（红色）、净增行（正绿负红）、占比进度条
- **作者明细 Tab**：该项目内各作者的增删行排行，展示：排名序号、作者名、新增/删除/净增三列数字，样式与面板中全局作者排行保持一致
- **弹窗交互**：ESC 键或遮罩层点击关闭弹窗；Tab 切换即时响应；弹窗为 Teleport 到 body 的独立 Modal，不影响面板滚动
- **clickable 行样式**：项目行增加可点击视觉反馈（cursor:pointer + hover 时项目名变为主题色），与 CommitAnalysisPanel 交互模式一致

## 技术栈

- Vue 3 Composition API + TypeScript
- SCSS（Codex 设计 Token + 独立样式文件）
- 思源笔记插件 API（Teleport to body 弹窗模式）

## 实现方案

### 数据保留策略

当前 `useCommitAnalysis.ts` 的 `runCore(true)` 中每个项目返回完整 `NumstatCommit[]`（含 `files: Array<{path, added, deleted}>`），但在 `buildLineRankings()` 聚合后丢弃了原始数据。修复方案：在 composable 中新增 `perProjectNumstat: Ref<Map<string, NumstatCommit[]>>`，分析完成后遍历 settled 结果填充（仅 fulfilled 结果），下次分析时覆盖。数据仅存内存不持久化，避免缓存膨胀。

### 弹窗数据流

弹窗采用自包含模式（与 FileDetailModal 一致）：props 接收 `projectId` + `getNumstat(projectId)` 函数，内部通过 computed 即时调用 `aggregateFileStats()` / `sumAuthorLines()` 生成 FileLineDetailRow[] 和 AuthorLineRankItem[] 数组。关闭时 emit `close` 通知父组件，无中间状态传递。

### 组件架构

```mermaid
flowchart TD
    A[LineStatsPanel.vue] -->|@click emit viewProject| B[index.vue]
    B -->|更新 lineDetailProjectId ref| A
    A -->|v-if 挂载| C[ProjectLineDetail.vue]
    C -->|props: projectId + getNumstat| C
    C -->|computed 调用| D[aggregateFileStats + sumAuthorLines]
    D -->|来自| E[perProjectNumstat Map]
    C -->|emit close| A
    A -->|emit close| B
    B -->|lineDetailProjectId = ''| A
```

### 性能与可靠性

- **内存占用**：NumstatCommit[] 按项目存储，每个项目约 200 条提交 * 平均 5 个文件 = 约 1000 个文件条目，Map 总大小约 1-3MB，可接受
- **弹窗渲染**：文件明细由 computed 即时生成排序后的 FileLineDetailRow[] 数组（O(n log n) 排序，n 通常 < 500），Tab 切换零开销
- **关闭清理**：v-if 控制弹窗生命周期，关闭时组件完全卸载，无残留事件监听
- **边界情况**：文件列表为空时显示空态提示；项目已删除但缓存中仍有该 projectId 时 getNumstat 返回空数组，弹窗显示空态

## 目录结构

```
src/features/gitPush/
├── composables/
│   └── useCommitAnalysis.ts          # [MODIFY] 新增 perProjectNumstat Map + runCore 填充 + 导出 getProjectNumstat
├── components/
│   └── analysis/
│       ├── LineStatsPanel.vue        # [MODIFY] 项目行加 @click + emit viewProject + v-if 挂载弹窗
│       └── ProjectLineDetail.vue     # [NEW] 双 Tab 弹窗组件
├── styles/
│   ├── LineStatsPanel.scss           # [MODIFY] 新增 .gls-bar-row--clickable 交互样式
│   └── ProjectLineDetail.scss        # [NEW] 弹窗样式（遮罩/卡片/头部/Tab 栏/表格/排行行）
├── types/
│   └── meta.ts                       # [MODIFY] 新增 FileLineDetailRow 接口
├── index.vue                         # [MODIFY] 传递 perProjectNumstat + getProjectNumstat + lineDetailProjectId
├── i18n/
│   ├── zh_CN/gitPush.json            # [MODIFY] 新增约 10 个 i18n 键
│   └── en_US/gitPush.json            # [MODIFY] 新增约 10 个 i18n 键
└── config/
    └── icons.ts                      # [MODIFY] 可能需要注册新图标
```

## 关键代码结构

### FileLineDetailRow 类型定义（types/meta.ts 新增）

```typescript
/** 项目行数详情 — 文件明细行 */
export interface FileLineDetailRow {
  path: string
  added: number
  deleted: number
  net: number
  /** 修改次数（来自 FileAgg.modCount） */
  modCount: number
  /** 参与作者数（来自 FileAgg.authors.size） */
  authorCount: number
  /** 净增行数占比，0~100（用于条形宽度） */
  pct: string
  /** 新增行数占项目总新增的百分比，保留 1 位小数 */
  share: string
}
```

### useCommitAnalysis 新增导出（composables）

```typescript
/** per-project 原始 numstat 数据（仅内存，不持久化） */
const perProjectNumstat = ref<Map<string, NumstatCommit[]>>(new Map())

/** 按 projectId 获取该项目的原始 numstat 数据（未找到返回 []） */
function getProjectNumstat(projectId: string): NumstatCommit[] {
  return perProjectNumstat.value.get(projectId) ?? []
}
```

### ProjectLineDetail 组件签名

```typescript
const props = defineProps<{
  i18n: Record<string, any>
  projectId: string
  projectName: string
  getNumstat: (projectId: string) => NumstatCommit[]
}>()

const emit = defineEmits<{ close: [] }>()
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：确保 ProjectLineDetail.scss 完全遵守 Codex 设计规范（禁止 box-shadow、使用设计 Token、BEM 命名、大写弱化标签、边框卡片模式）
- 预期结果：SCSS 文件通过 Codex 规范审查，与 FileDetailModal.scss / ExtFilterDialog.scss 风格一致

### SubAgent

- **code-explorer**
- 用途：在实现阶段深入探索 FileDetailModal.vue 的 ESC 关闭逻辑、aggregateFileStats 的完整参数签名、useDialogKeyboard composable 用法
- 预期结果：获取准确的函数签名和实现细节，确保复用正确