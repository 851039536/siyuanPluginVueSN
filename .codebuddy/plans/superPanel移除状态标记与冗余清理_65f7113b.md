---
name: superPanel移除状态标记与冗余清理
overview: 从超级面板模块整套移除「功能状态标记」（功能卡片四色徽章 + 顶部状态统计栏）及所有连带项（featureStatus 字段、FEATURE_STATUSES 常量、状态样式、状态 i18n 键、状态相关事件链路），并在 superPanel 模块内部审查、清理冗余/孤立代码。
todos:
  - id: remove-status-types-and-settings
    content: 在 superPanel/types/index.ts 删除 FEATURE_STATUSES/FeatureStatus/Feature.status 及 onStatusFeature 回调与 handleStatusFeature 方法，并在 config/settings.ts 删除 featureStatus 字段与默认值
    status: completed
  - id: remove-status-views
    content: 在 superPanel/index.vue 与 components/FeatureCard.vue 移除状态统计栏、状态徽章弹窗、statusLabels/statusStats/statusFeature 事件链及相关 import
    status: completed
    dependencies:
      - remove-status-types-and-settings
  - id: clean-status-styles-and-orphans
    content: 清理 variables.scss/index.scss/feature-card.scss 的状态样式与颜色变量，删除孤儿 composables/useClickOutside.ts
    status: completed
    dependencies:
      - remove-status-views
  - id: cleanup-i18n-readme
    content: 删除 superPanel.json 中英两端 status* 4 键并更新 README.md 移除「状态标记」描述
    status: completed
    dependencies:
      - clean-status-styles-and-orphans
  - id: redundancy-review
    content: 对 superPanel 模块做冗余复查：grep 状态/useClickOutside 残留、裁剪未用 import 与死代码、核对行数规范后交付验证链
    status: completed
    dependencies:
      - cleanup-i18n-readme
---

## 产品概述

在思源笔记插件「超级面板」中**整套移除状态标记功能**（功能卡片上的四色状态徽章与顶部状态统计栏，用户认为没有意义），并同步清理其全部连带项；随后对 superPanel 模块内部做一次**冗余重复代码审查与清理**（范围仅限本模块）。

## 核心功能

- 移除功能卡片上的状态徽章（含「稳定/待修复/严重/需优化 + 清空」弹出菜单）
- 移除面板顶部状态统计栏（各状态计数的色点统计条）
- 清理连带项：`PluginSettings.featureStatus` 字段与默认值、状态相关类型/常量/事件链、4 个状态 i18n 键（中英对齐删除）、状态专用 SCSS 样式与颜色变量
- 模块内部冗余清理：删除因状态菜单而孤立的 `useClickOutside` composable，复查并清除残留死代码/重复定义/闲置样式与导出
- README 同步移除「状态标记」描述，保留既有 AI 配置档案说明

## 边界与约束

- 不扩大到无关模块：gitPush / s3Backup / docAnalysis / apiDebugger 等其它模块的 `status-*` 类名与颜色为各自独立语义，不得误删
- docNavigation 有独立 useClickOutside 副本，属跨 feature 各自实现，不在本次范围
- statistics 模块引用 superPanel 的 mixins（tablet-only/mobile-only），mixins 文件不可删除，仅清理 status 专用变量与样式
- 顶层 `src/i18n/zh_CN.json` / `en_US.json` 由 `pnpm i18n:merge` 自动生成，禁止手改，只改分片
- themeColor 相关（主题方案 chip / 自定义颜色输入 / getSelectorOptions 等）与 AI 配置档案（刚开发的功能）均保留不动

## 技术栈与方案

沿用项目既有 Vue 3 + TypeScript + SCSS（样式分离、设计 Token）+ PluginSettings 持久化链路，无新增依赖、无新 feature、无 8 步注册流程。

## 实施方案

状态标记功能 = 一处"可写状态仓库"（`settings.featureStatus`）+ 两处展示（卡片徽章、顶部统计栏）+ 一条事件链（FeatureCard → index.vue → SuperPanelManager）。移除时沿同一条链自底向上删除，保证无悬挂引用：

- **删除顺序**：类型常量（`FEATURE_STATUSES`/`FeatureStatus`/`Feature.status`）→ 数据字段（settings.featureStatus）→ 事件链（onStatusFeature/handleStatusFeature/statusFeature emit）→ 视图（徽章弹窗、统计栏、statusLabels/statusStats）→ 样式（status- *规则块、$status-* 变量、stats 块）→ 孤儿（useClickOutside.ts）→ i18n 键与 README。
- **冗余审查**：状态移除完成后对模块内所有文件做一次引用复查（grep `status|Status|FEATURE_STATUSES|useClickOutside|statusLabels`），确认零残留；再按"单文件行数 <300 警戒 / <500 硬阈值、无重复样式定义、无未使用导入/导出"标准收尾。已知候选：FeatureCard.vue 移除后 `computed/ref` 是否仍被使用需按实际裁剪 import；styles/index.scss 与 AiSettingsPanel.scss 各自职责不同（全局基座 vs 面板局部），审查确认后不做无意义合并。
- **兼容性**：旧存档中残留的 `featureStatus` 键在 loadSettings 合并后自然被忽略（对象展开 + 默认值覆盖），无需数据迁移；删除仅影响展示，不影响任何功能开关与 AI 调用链路。

## 实施要点

- 事件链删除必须同步：`FeatureCard.vue`（emit `statusChange`）→ `index.vue`（`@status-change` + Emits + `status-labels` prop）→ `types/index.ts`（constructor 的 `onStatusFeature` + `handleStatusFeature`），任一处遗漏都会产生 TS 编译错误，逐文件 lint 兜底。
- SCSS 删除后若出现空文件/空块（如 variables.scss 状态色删除后仍保留 spacing 定义，文件非空），按实际留空则删除；AiSettingsPanel.scss / AiProfileManager.scss / feature-card.scss 主体样式必须保留。
- i18n 只删 4 键（两端各 4 键同删），删后两端键数仍一致，验证命令 `pnpm i18n:verify`。
- 文件头注释与行数规范照旧；验证链由用户执行：`pnpm i18n:verify` / `npx tsc --noEmit` / `pnpm lint` / `pnpm vite build`（AI 不运行）。

## 架构设计

数据流现状：FeatureCard 点击徽章 → `statusFeature` 事件 → index.vue → SuperPanelManager.handleStatusFeature → `_updatePluginSettings({ featureStatus })` → settings 落盘；展示侧 index.vue 从 `settings.featureStatus` 读状态并驱动统计栏与卡片徽章。
移除后：上述整条链删除，FeatureCard 仅保留开关/操作/主题选择/子功能开关等既有能力，index.vue 保留搜索与功能列表，`Feature.status` 字段不再存在。无新增组件关系，无需架构图。

## 目录结构

```
src/
├── config/
│   └── settings.ts                    # [MODIFY] 删除 featureStatus 字段（接口 69 行 + 默认值 142 行）
└── features/
    └── superPanel/
        ├── types/
        │   └── index.ts               # [MODIFY] 删 FEATURE_STATUSES/FeatureStatus/Feature.status；
        │                              #          删 constructor 内 onStatusFeature 回调、handleStatusFeature 方法
        ├── index.vue                  # [MODIFY] 删状态统计栏、statusStats/statusLabels、FEATURE_STATUSES 引用、
        │                              #          Feature.status 取值、statusFeature emit 与 :status-labels/:status-change 绑定
        ├── components/
        │   └── FeatureCard.vue        # [MODIFY] 删状态徽章+弹出菜单模板、statusLabels prop、statusChange emit、
        │                              #          状态菜单逻辑与 useClickOutside import，按需精简 computed/ref import
        ├── composables/
        │   └── useClickOutside.ts     # [DELETE] 状态菜单唯一消费方移除后孤儿，整文件删除
        ├── styles/
        │   ├── variables.scss         # [MODIFY] 删 $status-stable/$status-needsFix/$status-critical/$status-minor（保留 spacing）
        │   ├── index.scss             # [MODIFY] 删 .super-panel-stats/.stats-*/.stats-dot/.stats-count 整块
        │   └── feature-card.scss      # [MODIFY] 删 $status-colors map 与 .status-badge/.status-badge-wrapper/
        │                              #          .status-popover/.status-option/.status-option-dot 及过渡类整块
        ├── README.md                  # [MODIFY] 移除「状态标记、」描述，保留 AI 配置档案等其余内容
        └── i18n/{zh_CN,en_US}/superPanel.json
                                       # [MODIFY] 删 statusStable/statusNeedsFix/statusCritical/statusMinor（两端对齐）
```