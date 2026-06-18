---
name: gitpush-index-vue-split-refactor
overview: 将 2483 行的 gitPush/index.vue 拆分为 7 个弹窗子组件 + 1 个项目卡片子组件 + 3 个细粒度 composables，预计缩减至 ~1000 行。
todos:
  - id: extract-useTimeUtils
    content: 抽取 useTimeUtils.ts composable（relativeTime/activityLevel/sortProjects）
    status: completed
  - id: extract-useProjectFilters
    content: 抽取 useProjectFilters.ts composable（智能视图/筛选/搜索/暂停状态）
    status: completed
  - id: extract-useIdeManagement
    content: 抽取 useIdeManagement.ts composable（IDE检测/打开/自定义管理全部逻辑）
    status: completed
  - id: extract-dialogs
    content: 拆分 7 个弹窗子组件（AddProject/Category/Settings/EditProject/ScanImport/IdeManagement/RemoteConfig）
    status: completed
    dependencies:
      - extract-useIdeManagement
  - id: extract-projectcard
    content: 拆分 ProjectCard.vue 项目卡片组件（~450行 template）
    status: completed
    dependencies:
      - extract-useTimeUtils
      - extract-useProjectFilters
      - extract-useIdeManagement
      - extract-dialogs
  - id: wire-index-vue
    content: 整合 index.vue，引入子组件和 composable，缩减至 ~1000 行
    status: completed
    dependencies:
      - extract-projectcard
  - id: verify-build
    content: 验证 vue-tsc 类型检查 + vite build 构建通过
    status: completed
    dependencies:
      - wire-index-vue
---

## 产品概述

将 `src/features/gitPush/index.vue`（~2483 行）拆分为多个子组件和 composable，目标是将 index.vue 缩减至 ~1000 行以内，提升可维护性。拆分过程不违反 CLAUDE.md 规则。

## 核心功能

- **7 个弹窗子组件**：AddProjectDialog、CategoryDialog、SettingsDialog、EditProjectDialog、ScanImportDialog、IdeManagementDialog、RemoteConfigDialog
- **1 个项目卡片组件**：ProjectCard（最大单块，当前 ~450 行 template）
- **3 个细粒度 composable**：useIdeManagement、useTimeUtils、useProjectFilters
- 拆分后 index.vue 作为枢纽，通过 props/emit 与子组件通信，通过 composable 复用逻辑

## 技术栈

- Vue 3 + TypeScript + `<script setup lang="ts">`
- 子组件模式：`defineProps<{ ... }>()` + `defineEmits<{ ... }>()`
- Composable 模式：返回 ref/computed/function

## 实现方案

### 拆分策略（5 阶段，按依赖顺序执行）

**阶段一：抽取 3 个 composable（脚本层，无 template 依赖）**
先把纯逻辑抽离，消除 index.vue 脚本中的大段工具函数和 computed 链：

1. `useTimeUtils.ts` — `relativeTime()`, `activityLevel()`, `sortProjects()` 三个纯函数
2. `useProjectFilters.ts` — `viewMode`, `showArchived`, `searchQuery`, `selectedTags`, `smartViewProjects`, `filteredGroups`, `gitOpsPaused`（含 watch 持久化）及 `VIEW_MODE_META`
3. `useIdeManagement.ts` — `IDE_ENTRIES`, `IDE_PRESETS`, `detectedIdes`, `customIdes`, `scanIdes()`, `handleOpenIde()`, `launchIde()`, `isCmdAvailable()`, `resolvePath()`, `findSlnFile()`, `addCustomIde()`, `doRemoveCustomIde()`, `loadCustomIdes()`, `saveCustomIdes()`, `getIdePresetIcon()`, `startEditIde()`, `saveEditIde()`, `handleOpenCustomIde()` 及管理弹窗相关 ref（`showIdeDialog`, `addIdePreset`, `addIdePath`, `editingIdeIdx`, `editIdePreset`, `editIdePath`, `confirmingMgmtDelIdx`）

**阶段二：抽取弹窗子组件（template + 对应脚本）**
每个弹窗独立为 `components/*Dialog.vue`，通过 `defineProps<{ i18n, plugin, manager, ... }>()` + `defineEmits<{ close: [] }>()` 模式通信：

1. `AddProjectDialog.vue`（628-698 行）：prop: `i18n`, `categories`；emit: `close`, `added`
2. `CategoryDialog.vue`（701-745 行）：prop: `i18n`, `categories`；emit: `close`, `add-category`, `delete-category`
3. `SettingsDialog.vue`（748-774 行）：prop: `i18n`, `concurrency`；emit: `close`, `save`
4. `EditProjectDialog.vue`（968-1100 行）：最复杂弹窗，含远程仓库管理。prop: `i18n`, `project`, `manager`, `REMOTES`；emit: `close`, `saved`
5. `ScanImportDialog.vue`（824-899 行）：prop: `i18n`, `manager`, `categories`；emit: `close`, `imported`
6. `IdeManagementDialog.vue`（777-821 行）：prop: `i18n`, `customIdes`, `IDE_PRESETS`, `getIdePresetIcon`；emit: `close`, `add-ide`, `remove-ide`, `edit-ide`（由 useIdeManagement composable 处理）
7. `RemoteConfigDialog.vue`（902-965 行）：prop: `i18n`, `project`, `manager`, `REMOTES`，`remoteList`, `error`；emit: `close`, `add-remote`, `remove-remote`, `edit-remote`

**阶段三：抽取 ProjectCard 组件（175-621 行）**
这是最大的单块，约 450 行 template。拆分为 `components/ProjectCard.vue`：

- Props：`project`, `i18n`, `manager`, `pushStatuses`, `workingTrees`, `commitLogs`, `pushOutputs`, `pullOutputs`, `stashes`, `conflicts`, `fileDiffs`, `REMOTES`, `expanded`, `refreshing`, `editingNameId`, `editingNameInput`, `generatingMsgs`, `commitOutputs`, `gitOpLoading`, `openIdeMenu`, `detectedIdes`, `customIdes`, `confirmingDelIdx` 等
- Emits：卡片内所有操作（star, edit-name, refresh, remove, open-edit, open-ide, push-single, push-all, pull-single, pull-all, commit, generate-msg, stash-*, conflict-*, tag-*, expand, copy-url, open-web, open-path 等）

**阶段四：整合 index.vue**
index.vue 缩减为：

- Template：头部 + 视图切换 + 筛选工具栏 + `<ProjectCard>` + 弹窗 `<component :is="...">` + `<StatsPanel>`
- Script：import 子组件和 composable，组合 refs，生命周期编排

**阶段五：验证**
`npx vue-tsc --noEmit` + `npx vite build`

### 通信模式

```
index.vue (枢纽)
  ├── useGitPush.ts (已有，不动)
  ├── useIdeManagement.ts (新)
  ├── useTimeUtils.ts (新)
  ├── useProjectFilters.ts (新)
  ├── ProjectCard.vue ← props:project + emit:操作事件
  ├── AddProjectDialog.vue ← props:i18n + emit:close
  ├── CategoryDialog.vue ← props:i18n + emit:close
  ├── SettingsDialog.vue ← props:i18n + emit:close
  ├── EditProjectDialog.vue ← props:project,manager + emit:close
  ├── ScanImportDialog.vue ← props:manager + emit:close
  ├── IdeManagementDialog.vue ← props:customIdes + emit:close
  └── RemoteConfigDialog.vue ← props:project,manager + emit:close
```

## 目录结构

```
src/features/gitPush/
├── index.vue                    # [MODIFY] 缩减至 ~1000行，枢纽角色
├── index.ts                     # 不动
├── types/
│   ├── index.ts                 # 不动
│   └── storage.ts               # 不动
├── composables/
│   ├── useGitPush.ts            # 不动（已有）
│   ├── useIdeManagement.ts      # [NEW] IDE检测/打开/自定义管理（~230行）
│   ├── useTimeUtils.ts          # [NEW] relativeTime/activityLevel/sortProjects（~60行）
│   └── useProjectFilters.ts     # [NEW] 筛选/视图/搜索/pause（~120行）
├── components/
│   ├── StatsPanel.vue           # 不动（已有）
│   ├── WorkingTreePanel.vue     # 不动（已有）
│   ├── TagPanel.vue             # 不动（已有）
│   ├── BranchCommitList.vue     # 不动（已有）
│   ├── ProjectCard.vue          # [NEW] 项目卡片主组件（~500行）
│   ├── AddProjectDialog.vue     # [NEW] 添加项目弹窗（~80行）
│   ├── CategoryDialog.vue       # [NEW] 分类管理弹窗（~55行）
│   ├── SettingsDialog.vue       # [NEW] 设置弹窗（~35行）
│   ├── EditProjectDialog.vue    # [NEW] 编辑项目弹窗（含远程管理）（~160行）
│   ├── ScanImportDialog.vue     # [NEW] 扫描导入弹窗（~90行）
│   ├── IdeManagementDialog.vue  # [NEW] IDE管理弹窗（~60行）
│   └── RemoteConfigDialog.vue   # [NEW] 远程仓库配置弹窗（~80行）
└── styles/
    └── index.scss               # 不动（组件样式已在其中）
```

## 实现细节

### Composable 设计

**useTimeUtils.ts**

```typescript
export function useTimeUtils() {
  function relativeTime(iso?: string): string { /* ... */ }
  function activityLevel(iso?: string): "fresh" | "recent" | "stale" | "dead" { /* ... */ }
  function sortProjects(list: GitProject[]): GitProject[] { /* ... */ }
  return { relativeTime, activityLevel, sortProjects }
}
```

**useProjectFilters.ts**

```typescript
export function useProjectFilters(props: { plugin: Plugin }) {
  const viewMode = ref<"all" | "needsPush" | "uncommitted" | "starred">("all")
  const showArchived = ref(false)
  const searchQuery = ref("")
  const selectedTags = ref<Set<string>>(new Set())
  const gitOpsPaused = ref(false)
  // watch 持久化 gitOpsPaused
  // smartViewProjects, filteredGroups computed
  return { viewMode, showArchived, searchQuery, selectedTags, gitOpsPaused, smartViewProjects, filteredGroups, VIEW_MODE_META }
}
```

**useIdeManagement.ts**

```typescript
export function useIdeManagement(props: { plugin: Plugin }) {
  const detectedIdes = ref<IdeEntry[]>([])
  const customIdes = ref<CustomIde[]>([])
  // 弹窗状态 refs
  // scanIdes(), handleOpenIde(), 增删改查函数
  return { detectedIdes, customIdes, IDE_ENTRIES, IDE_PRESETS, showIdeDialog, ..., scanIdes, handleOpenIde, addCustomIde, doRemoveCustomIde, saveCustomIdes, loadCustomIdes, getIdePresetIcon, startEditIde, saveEditIde, handleOpenCustomIde }
}
```

### 子组件接口规范

每个子组件遵循统一的模式：

- `defineProps<{ i18n: Record<string, string>; ... }>()`
- `defineEmits<{ close: []; [key: string]: [...args: any[]] }>()`
- 弹窗通过 `v-if` 控制显隐，关闭时 emit `close`
- index.vue 中通过 `@close="showXxx = false"` 接收

### 性能注意事项

- ProjectCard 内部已使用 `v-if` 懒加载（expand 时才加载 WorkingTreePanel/CommitLog），拆分后保持不变
- 各 composable 在 `setup` 阶段执行，不会增加运行时开销
- 子组件 props 传递使用响应式引用，避免不必要的 deep copy

### 向后兼容

- `index.ts` 入口文件不动，register 函数签名不变
- `useGitPush.ts` 不动，所有现有调用方不受影响
- 样式文件不动，组件 CSS 类名不变