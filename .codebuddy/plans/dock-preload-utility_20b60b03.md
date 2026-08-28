---
name: dock-preload-utility
overview: 将 statistics 的"模块级单例状态 + core 启动预载"模式抽象为通用 Dock 预加载工具 src/utils/dockPreload.ts（注册表 + 状态机 + 状态栏），statistics 接入改造，src/index.ts 统一执行与清理，并更新 AGENTS.md/AGENTS_API.md 规则。
todos:
  - id: create-dock-preload
    content: 新建 src/utils/dockPreload.ts 注册表，实现 registerDockPreload/runAllDockPreloads/refreshDockPreload/getDockPreloadState/clearDockPreloads 与状态机
    status: completed
  - id: statistics-migrate
    content: 改造 statistics：core.ts 改注册模式并走 refreshDockPreload，useStatistics.ts 移除状态栏逻辑，index.vue 分流改用 getDockPreloadState
    status: completed
    dependencies:
      - create-dock-preload
  - id: plugin-wiring
    content: src/index.ts 接线：onload 加 runAllDockPreloads，onunload 加 clearDockPreloads
    status: completed
    dependencies:
      - statistics-migrate
  - id: rules-update
    content: 更新规则：AGENTS.md 统一入口表格与硬规则、AGENTS_API.md 新增 Dock 预加载小节
    status: completed
    dependencies:
      - create-dock-preload
  - id: arch-verify
    content: 使用 [skill:universal-arch-skill] 校验统一入口合规与注册完整性，确认无违规项
    status: completed
    dependencies:
      - statistics-migrate
      - plugin-wiring
      - rules-update
---

## 产品概述

将 statistics 功能已实现的"启动预载 + 底部状态栏可见刷新中"模式，抽象为**统一的 Dock 预加载注册表**（`@/utils/dockPreload`），集中管理所有 Dock 功能（当前为 statistics，未来可扩展）的启动预载、状态栏提示与手动/定时刷新入口，并更新项目规则文档约束后续新增功能复用统一入口。

## 核心功能

- 新增通用 Dock 预加载注册表：注册、启动统一执行、手动/定时刷新、状态查询、卸载清理
- statistics 从"自建预载模式"切换为"注册通用工具"模式，行为不变（启动预载 + 底部可见刷新中 + 面板打开不重复刷新）
- 插件启动链路集中执行所有已注册预载；卸载统一清理
- 规则更新：AGENTS.md 统一入口表格 + 硬规则、AGENTS_API.md API 参考

## 技术栈

- 沿用项目现有 TypeScript + 模块化工具链，新工具放 `src/utils/`（通用工具层，符合统一入口原则）
- 状态栏复用 `useStatusBarTask`（AGENTS.md 统一入口表格既有允许项，模块级 reactive store 按 taskId 去重）
- 无新增第三方依赖

## 实现方案

### 1. 新建 `src/utils/dockPreload.ts`（通用注册表）

模块级 `Map` 注册表 + 状态机 + 状态栏统一管理，所有 API 为模块级函数：

```ts
// 统一 Dock 预加载注册表：集中管理 Dock 功能的启动预载/刷新入口与状态栏提示
export interface DockPreloadLabels { refreshing: string; done: string; failed: string }
export interface DockPreloadOptions {
  id: string        // 唯一标识（同时作状态栏任务 id），如 "statistics"
  icon: string      // 状态栏图标（Iconify 已注册），如 "mdi:chart-bar"
  labels: DockPreloadLabels  // 状态栏文案，功能注册时从 plugin.i18n.<feature> 提取
  refresh: () => Promise<void>  // 数据刷新函数（功能模块级共享入口）
}
export type DockPreloadState = "idle" | "loading" | "ready" | "error"

export function registerDockPreload(opts: DockPreloadOptions): void  // 幂等：重复注册覆盖配置，不重置已达成状态
export function runAllDockPreloads(): Promise<void>  // 插件启动统一执行（串行，防并发 SQL 风暴）
export function refreshDockPreload(id: string): Promise<void>  // 手动/定时刷新入口（state==="loading" 防重；带状态栏三态）
export function getDockPreloadState(id: string): DockPreloadState  // 面板 onMounted 分流查询
export function clearDockPreloads(): void  // 插件卸载清理注册表
```

设计要点：

- 内部 `Map<id, { opts, state }>`，`refreshDockPreload` 统一实现状态流转（idle→loading→ready/error）与 `useStatusBarTask(id, icon)` 三态提示
- 状态栏文案由注册时 `labels` 提供，解决"core 启动时面板未挂载、i18n 无法从 props 获取"的问题（替代现有 `setStatisticsI18n`）
- `runAllDockPreloads` 串行执行（await 逐个），避免多个 Dock 功能同时全量 SQL 查询形成风暴
- 文件头注释（10~30 字）符合项目规则；无定时器，不涉 TimerRegistry

### 2. statistics 切换为注册模式

| 文件 | 改动 |
| --- | --- |
| `core.ts` | 删除 `preload()` 与 `setStatisticsI18n`；`init()` 改为同步 `registerDockPreload({ id: "statistics", icon: "mdi:chart-bar", labels: 从 plugin.i18n.statistics 提取, refresh: refreshStatisticsData })`；`manualRefresh()` 与定时器回调改调 `refreshDockPreload("statistics")`；destroy 仅保留 TimerRegistry 清理 |
| `useStatistics.ts` | 删除 `statusTask` / `statusI18n` / `setStatisticsI18n`；`refreshStatisticsData()` 变纯数据刷新（保留模块级 loading 供面板 UI；防重由注册表 state 承担） |
| `index.vue` | onMounted 分流改用 `getDockPreloadState("statistics")`：ready→仅 `loadHistoricalData()`；loading→watch 等数据到达后补历史；idle/error→兜底 `refreshData()` |


### 3. 启动/卸载接线（src/index.ts）

- `onload()`：`this.registerFeatures()` 之后、`initCommands` 之前加 `void runAllDockPreloads()`（此时所有 registerDockPreload 已完成，fire-and-forget 不阻塞启动）
- `onunload()`：`getStatisticsInstance()?.destroy()` 同区域加 `clearDockPreloads()`

### 4. 规则更新

- `AGENTS.md`「统一入口原则」表格新增行：Dock 预加载 → `registerDockPreload` / `runAllDockPreloads` / `refreshDockPreload` / `getDockPreloadState` → `@/utils/dockPreload`
- `AGENTS.md`「硬规则」新增条目：**Dock 预加载统一入口**——需要启动预载的 Dock 功能必须通过 `registerDockPreload` 注册，启动预载由 `runAllDockPreloads` 统一执行，禁止在 register/init 中自行散落预载逻辑；面板打开时用 `getDockPreloadState` 分流，禁止重复全量刷新
- `AGENTS_API.md`「API 参考」在「### 定时器」之后新增「### Dock 预加载」小节（最小接入示例：register + refresh + getState + labels 从 plugin.i18n 提取）

## 性能与可靠性

- 启动预载串行执行，避免多 Dock 并发全量 SQL 查询；`loading` 防重防止启动预载与面板打开并发重复查询
- 状态栏任务按 taskId 去重（useStatusBarTask 模块级 store），多次刷新复用同一任务不叠加
- `registerDockPreload` 幂等 + `clearDockPreloads` 卸载清理，避免插件热重载残留

## 边界（明确不做）

- 本次仅接入 statistics（现状唯一使用方）；不批量接入其他 Dock 功能（imageCompressor / rssReader 等），工具面向未来复用
- 不改 statusBar / createVueDockApp / addDock 底层
- 不改 i18n 键（复用现有 statusRefreshing / statusRefreshDone / statusRefreshFailed）

## 目录结构

```
project-root/
├── src/
│   └── utils/
│       └── dockPreload.ts        # [NEW] 通用 Dock 预加载注册表（注册/统一执行/刷新/状态查询/清理）
└── src/features/statistics/
    ├── core.ts                   # [MODIFY] 删 preload/setStatisticsI18n，改 registerDockPreload，刷新走 refreshDockPreload
    ├── composables/useStatistics.ts  # [MODIFY] 删 statusTask/statusI18n/setStatisticsI18n，refreshStatisticsData 变纯刷新
    └── index.vue                 # [MODIFY] onMounted 分流改用 getDockPreloadState
├── src/index.ts                  # [MODIFY] onload 加 runAllDockPreloads；onunload 加 clearDockPreloads
├── AGENTS.md                     # [MODIFY] 统一入口表格 + 硬规则新增"Dock 预加载统一入口"
└── AGENTS_API.md                 # [MODIFY] API 参考新增「### Dock 预加载」小节
```

## 实施要点（防回归）

- 状态栏文案迁移：labels 从 `plugin.i18n.statistics` 提取（core 注册时），保证启动预载时底部提示正确，行为与现状完全一致
- index.vue 分流语义：`getDockPreloadState` 的 ready 对应原 `stats.value` 判断、loading 对应原 `loading.value` 判断，兜底逻辑不变
- 新建 `.ts` 文件顶部加功能说明注释；单文件行数 ≤300 警戒
- 验证链路由用户执行：`npx tsc --noEmit` + `pnpm lint`（AI 不执行 build 与 lint）

## Agent Extensions

### Skill

- **universal-arch-skill**
- Purpose：最终对改动做架构合规校验（统一入口、注册完整性、代码分层），确认 dockPreload 注册表接入与规则落点符合项目规范
- Expected outcome：架构审查通过，无统一入口违规项