---
name: gitPush 加载态图标切换 mdi:loading 合规修复
overview: 对 gitPush 功能中不符合「请求加载反馈」规则的加载态图标进行严格合规修复：所有请求期间的触发按钮图标统一切换为 mdi:loading 并保留 gp-spin 旋转，补齐缺失的加载反馈与 disabled 状态。
todos:
  - id: fix-a-class-icons
    content: 修复 A 类 9 处：PanelHeader/ProjectCard(4处)/TagPanel/BranchCommitList/AiErrorAnalysisDialog/CodeReportPanel 的图标三元切换为 mdi:loading + gp-spin
    status: completed
  - id: fix-b-workingtree-refresh
    content: 修复 B 类：useRefreshOps 新增 refreshingWorkingTree 状态，index.vue/ProjectCard/WorkingTreePanel 贯通传递，刷新按钮补 mdi:loading+spin+disabled
    status: completed
    dependencies:
      - fix-a-class-icons
  - id: verify-and-summary
    content: 核对全部改动点与 disabled 覆盖，输出修改摘要供用户执行 lint/tsc/i18n/validate:icons 验证
    status: completed
    dependencies:
      - fix-b-workingtree-refresh
---

## 产品概述

审查并修复 `src/features/gitPush` 中图标旋转不合规问题，使其完全对齐项目硬规则「请求加载反馈」：发起请求时，触发按钮图标必须切换为环形加载图标 `mdi:loading` 并旋转（`animation: spin 1s linear infinite`），请求期间 `disabled` 防重复提交，结束（成功/失败/超时）后还原图标与禁用态。

## 核心功能

- **A 类修复（9 处）**：加载态旋转原图标（`mdi:sync`/`mdi:refresh`/`mdi:arrow-up`/`mdi:arrow-down`/`mdi:chart-box` + `gp-spin`）的按钮，统一改为三元表达式切换为 `mdi:loading` + `gp-spin`，保留原图标作为非加载态显示
- **B 类修复（1 处）**：`WorkingTreePanel.vue` 内联「刷新工作区」按钮完全缺失加载反馈（无 spin、无 disabled、无图标切换），补齐完整状态传递链（useRefreshOps → index.vue → ProjectCard → WorkingTreePanel）
- 仅修改模板 `:icon` 表达式与 B 类状态传递链，不重构业务逻辑、不改 SCSS、不改 i18n

## 视觉效果

- 所有耗时操作（刷新、拉取、推送、标签/日志刷新、重新分析、生成报告、刷新工作区）进行中，按钮图标变为旋转的加载环（`mdi:loading` + `gp-spin` 旋转动画），按钮禁用防止重复提交；操作结束后图标与禁用态自动还原

## 技术方案

### 技术栈选择

- 沿用现有技术栈：Vue 3 + TypeScript + SCSS + @iconify/vue 的 `<Icon>` 组件
- `gp-spin` 旋转动画定义于 `src/features/gitPush/styles/Shared.scss`（`animation: gp-spin 1s linear infinite` + `@keyframes`），经 `styles/index.scss` 引入并由 `index.vue` 非 scoped 全局生效，所有子组件可直接使用，**无需新增任何 SCSS**
- `mdi:loading` 已在 `src/config/icons.ts` 注册（loading 键）；gitPush 各组件通过 `<Icon>` 直接传图标名（不走 FEATURE_ICONS 注册表），切换无需改 icons.ts

### 实现方式

**A 类（9 处）**：将 `icon="xxx"` 静态图标改为 `:icon="loadingState ? 'mdi:loading' : 'xxx'"` 三元表达式，保留原有 `:class="{ 'gp-spin': loadingState }"` 与 `:disabled`。经确认这 9 处按钮 disabled 均已覆盖请求期，仅改 icon 表达式，业务零改动。

**B 类（1 处）**：`WorkingTreePanel` 内联刷新工作区按钮补全加载反馈，最小链路贯通：

1. `useRefreshOps.ts` 新增 per-project `refreshingWorkingTree` 状态 ref，`handleRefreshWorkingTree` 中设置/清除（复用现有 `remoteStatusLoading` 的 Record 模式）
2. `index.vue` 解构并透传至 ProjectCard 新 prop
3. `ProjectCard.vue` props 增加 `refreshingWorkingTree?: boolean` 并转发给 WorkingTreePanel
4. `WorkingTreePanel.vue` props 增加该字段，刷新按钮改为三元切换 + `gp-spin` + `disabled`

### 性能与可靠性

- B 类状态采用 `Record<string, boolean>` + 响应式 ref，与现有 `remoteStatusLoading`/`fetching` 模式完全一致，无额外渲染开销
- 修改范围极小（每处仅一行模板表达式），无性能影响、无回归风险面
- 保持现有事件链（emit → 父层转发 → composable 处理）不变，符合「子组件数据流规则」

### 验证

- 由用户自行执行（AI 不运行）：`pnpm lint`、`pnpm i18n:verify`、`pnpm validate:icons`、`npx tsc --noEmit`
- 人工验证各加载态图标切换、旋转、disabled、结束后还原

### 目录结构与修改文件

```
src/features/gitPush/
├── components/
│   ├── common/
│   │   └── PanelHeader.vue            # [MODIFY] L171: mdi:sync → 三元切换 mdi:loading
│   ├── list/
│   │   ├── ProjectCard.vue            # [MODIFY] L329-332/L412/L591-594/L655-658 四处三元切换；props 新增 refreshingWorkingTree 并转发给 WorkingTreePanel
│   │   ├── WorkingTreePanel.vue       # [MODIFY] L41-46 刷新按钮补 loading/disabled/spin；props 新增 refreshingWorkingTree
│   │   ├── TagPanel.vue               # [MODIFY] L12: mdi:refresh → 三元切换
│   │   ├── BranchCommitList.vue       # [MODIFY] L50: mdi:refresh → 三元切换
│   │   └── AiErrorAnalysisDialog.vue  # [MODIFY] L29-33: mdi:refresh → 三元切换
│   └── report/
│       └── CodeReportPanel.vue        # [MODIFY] L38-42: mdi:chart-box → 三元切换
├── composables/
│   └── useRefreshOps.ts               # [MODIFY] 新增 refreshingWorkingTree ref + handleRefreshWorkingTree 设置/清除 + 返回值导出
└── index.vue                          # [MODIFY] 解构 refreshingWorkingTree 并透传 ProjectCard prop
```

### 关键代码结构（B 类核心接口）

```ts
// useRefreshOps.ts 内新增（与 remoteStatusLoading 同模式）
const refreshingWorkingTree = ref<Record<string, boolean>>({})

async function handleRefreshWorkingTree(id: string) {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  refreshingWorkingTree.value = { ...refreshingWorkingTree.value, [id]: true }
  try {
    const branch = await manager.getBranch(resolveValidPath(project))
    await loadWorkingTree(id, false, branch)
  } finally {
    delete refreshingWorkingTree.value[id]
    refreshingWorkingTree.value = { ...refreshingWorkingTree.value }
  }
}
// 返回值中导出 refreshingWorkingTree
```