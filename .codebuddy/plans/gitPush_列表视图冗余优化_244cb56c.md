---
name: gitPush 列表视图冗余优化
overview: 对 gitPush 列表视图做保守式冗余优化：合并卡片上两处重复展示的信息位（分支名双重展示、behind 状态「徽章 + 警告条」双提示），并清理代码层两处冗余传递（ListView 的 projects prop 仅用于判空、分组类型重复定义）。不减少任何功能入口。
todos:
  - id: dedup-branch-display
    content: CardRemotes 分支名改条件显示，ProjectCard 传 branchRowVisible，同步 CardHeader 注释
    status: completed
  - id: merge-behind-hint
    content: CardRemotes 删除 conflict-warn 警告条，behind 徽章加 conflictWarn tooltip，清理 SCSS
    status: completed
    dependencies:
      - dedup-branch-display
  - id: drop-dead-hasbehind
    content: 同步删除 hasBehind 死代码（usePushStatusView / cardServices 契约 / 根 index.vue provide）
    status: completed
    dependencies:
      - merge-behind-hint
  - id: trim-props-type
    content: ListView/ListViewToolbar 移除 projects prop 并内联判空，GroupedProject 收敛至 types/index.ts
    status: completed
    dependencies:
      - drop-dead-hasbehind
  - id: verify-gates
    content: 跑 read_lints + pnpm typecheck + pnpm i18n:verify + pnpm validate:icons 自查闸
    status: completed
    dependencies:
      - trim-props-type
---

## 产品概述

对思源插件 gitPush 功能的「列表视图」进行保守式冗余优化：去掉卡片上重复展示的信息位，并清理代码层面冗余的数据传递，不减少任何功能入口、不改变交互行为。

## 核心功能

- **分支名去重展示**：远程区当前分支名仅在顶栏分支标签行未加载时显示；分支标签行懒加载就绪后由顶栏统一承担（保留可切换入口与当前标识），消除同名分支两处并列。
- **behind 状态去重提示**：删除卡片底部整行「远程有新的提交」警告条（已论证其 100% 被 per-remote 的 ↓N 徽章覆盖），把行动建议「建议先拉取再推送」下沉为 behind 徽章的悬停提示，保留精确到远程的状态指示与操作建议。
- **代码冗余清理**：移除 ListView / ListViewToolbar 的 `projects` prop（唯一用途是判空，已证明与 `groupedProjects.some(g => g.projects.length > 0)` 等价，「未分组」合成分类恒存在保证无项目被漏出）；将分组类型 `GroupedProject` 收敛到 `types/index.ts` 单一定义，消除 ListViewToolbar 的内联重复定义。
- **死代码清理**：`hasBehind` 随警告条删除成为死代码，从 `usePushStatusView` / `cardServices` 契约 / 根组件 provide 三处同步移除。
- **保留不动的疑似重复**（附理由）：推送菜单瞬态文案 vs OutputPanel 明细（职责不同）、Tab 计数徽章 vs 面板摘要计数（导航 vs 明细）、三个远程刷新入口（功能入口重复，用户要求全保留）、reloadLog/refreshTags 两层转发（下沉收益不抵复杂度）。

视觉变化：每张卡片在 behind 场景少一条整行警告（高度略降），分支名不再两处并列；全部按钮、菜单、面板功能入口原样保留。

## 技术栈

- 既有项目：Vite + Vue 3 + TypeScript 思源插件，gitPush 为单体插件内的功能模块，无新增依赖、无架构变更
- 复用既有模式：卡片区块经 `useCardServices` 注入 + props 传卡片自持数据（`useCardData`）；共享组件 `Tag`（根元素为 div，`title` 经 Vue attr 透传原生生效，已核实 `Tag.vue` 无 `inheritAttrs: false`）
- 验证链（AI 可跑）：`read_lints` + `pnpm typecheck` + `pnpm i18n:verify` + `pnpm validate:icons`；`pnpm lint` / `pnpm vite build` 按 AGENTS 规则由用户执行

## 实现方案

- **策略**：四处文件改动（CardRemotes.vue / ProjectCard.vue / CardHeader.vue 注释）+ 两处死代码同步（usePushStatusView / cardServices / 根 index.vue）+ 两处 props/类型收敛（ListView / ListViewToolbar / 根 index.vue），全部为删减式改动，无新增逻辑分支。
- **分支名条件显示**：ProjectCard 向 CardRemotes 传 `:branch-row-visible="branches.length > 0"`（branches 来自既有 `useCardData`，零新增查询）；CardRemotes 内 `v-if="pushStatus?.branch && !branchRowVisible"`。懒加载未完成时远程区仍展示分支名，信息不丢失。
- **警告条合并**：behind 徽章加 `:title="kind === 'behind' ? i18n.conflictWarn : undefined"`（复用既有 i18n 键，不增翻译键；原 `statusBadgeClass` 已重构为 `statusKind` 语义分类，判据不变），删除 `gp-conflict-warn` 整块模板与 SCSS 规则。
- **projects prop 移除**：ListViewToolbar 内 `const hasAnyProject = computed(() => groupedProjects.some(g => g.projects.length > 0))` 替换判空；同步删除根 index.vue 对 ListView 的 `:projects` 传参（其他视图不受影响）。
- **类型收敛**：`GroupedProject` 接口移至 `src/features/gitPush/types/index.ts`，ListView/index.vue 与 ListViewToolbar.vue 均从 types 导入，符合项目「类型定义放 types/index.ts」分层规范。

## 架构设计

数据流不变：根 index.vue（useGitPush/useProjectFilters 派生）→ ListView（纯渲染容器）→ ProjectCard（编排层，useCardServices + useCardData）→ CardRemotes/CardHeader 等区块组件。本次仅做「删重复展示位 + 删冗余 prop + 删死代码」，不新增派发路径、不新增 computed 遍历热点（`some` 为 O(分类数)，分类数为个位数，可忽略）。

## 目录结构

```
src/features/gitPush/
├── components/ListView/
│   ├── CardRemotes.vue          # [MODIFY] 分支名改为条件显示；behind 徽章加 tooltip；删除 gp-conflict-warn 警告条
│   ├── ProjectCard.vue          # [MODIFY] CardRemotes 使用点传 branchRowVisible（branches.length > 0）
│   ├── CardHeader.vue           # [MODIFY] 更新 16-18 行「两者不重复」注释为新分工说明
│   ├── ListViewToolbar.vue      # [MODIFY] 删 projects prop 与 GitProject/ProjectCategory 导入，改 hasAnyProject computed；GroupedProject 从 types 导入
│   └── index.vue                # [MODIFY] 删 projects prop；GroupedProject 改为从 types 导入并 re-export 保持兼容
├── styles/
│   └── CardRemotes.scss         # [MODIFY] 删除 .gp-conflict-warn 规则块（57-68 行）
├── composables/
│   └── usePushStatusView.ts     # [MODIFY] 删除 hasBehind 函数与导出
├── types/
│   ├── index.ts                 # [MODIFY] 新增 GroupedProject 接口定义（分类 + 项目列表）
│   └── cardServices.ts          # [MODIFY] derived 契约删除 hasBehind 行
└── index.vue                    # [MODIFY] 删 ListView 的 :projects 传参；删 hasBehind 解构与 provide
```

## 执行要点

- `i18n.conflictWarn` 键保留（复用为徽章 tooltip），不触发 i18n 键对齐变化
- `Tag` 的 `title` 透传依赖 Vue attr 继承（已核实根元素为 div 且未禁用 inheritAttrs），无需改共享组件
- 警告条删除后 `hasBehind` 三处同步删，避免留下死契约；`read_lints` 确认无残留引用
- 不新建临时校验脚本；不动共享组件与 AGENTS 登记的 8 步注册链（无新功能）