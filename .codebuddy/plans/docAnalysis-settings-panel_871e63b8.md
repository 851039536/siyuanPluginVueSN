---
name: docAnalysis-settings-panel
overview: 将 docAnalysis 全部配置项（健康度扣分项、0B 排除书签、重名排除、隐藏零值、平台管理、默认笔记本、默认排序）收敛到面板右上角齿轮图标打开的独立「设置」弹窗，统一保存按钮一次性写入；移除 HeroCard 健康度详情弹窗、StatsView 工具栏、重名排除弹窗、平台管理弹窗等全部原分散入口；保留 FilterSettings 查询栏与列表排序切换等查询工具。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex
    - 分区卡片
    - 边框分隔
    - 等宽数值
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 14px
      weight: 600
    subheading:
      size: 12px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - var(--b3-theme-primary)
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface)
    text:
      - var(--b3-theme-on-background)
      - var(--b3-theme-on-surface-variant)
    functional:
      - var(--b3-theme-error)
      - var(--b3-list-hover)
      - var(--b3-border-color)
todos:
  - id: settings-data-layer
    content: 新增 ViewSettings 类型与 storage 槽位，useDocAnalysis 补 loadViewSettings/saveViewSettings
    status: completed
  - id: settings-panel
    content: 新建 SettingsPanel 弹窗（index 容器 + Health/Exclude/Platform/Query 四分区）+ SettingsPanel.scss
    status: completed
    dependencies:
      - settings-data-layer
  - id: statsview-slim
    content: HeroCard 移除健康度详情弹窗与配置 props，StatsView 移除工具栏与重名弹窗，hideZero 改父级传入
    status: completed
  - id: main-panel-integration
    content: index.vue 加齿轮入口与 SettingsPanel，移除平台管理弹窗，DocListView 删平台按钮，保存后按需重新分析
    status: completed
    dependencies:
      - settings-panel
      - statsview-slim
  - id: cleanup-verify
    content: 删除 DuplicateNameFilterModal 与 PlatformManage 目录及样式，更新 README，read_lints 验证
    status: completed
    dependencies:
      - main-panel-integration
---

## 产品概述

将 docAnalysis 功能中分散在面板各处的设置（健康度扣分项、0B 排除书签、重名排除、隐藏零值、平台管理、默认笔记本、默认排序）全部收敛到一个**独立设置弹窗**中，由面板右上角齿轮图标打开。移除所有原分散设置入口，实现"一处配置、全局生效"。

## 核心功能

- **统一设置弹窗**：面板右上角齿轮图标（mdi:cog-outline）打开，Teleport 到 body 的居中弹窗，含头部标题 + 关闭按钮 + 分区滚动内容 + 底部统一「保存/取消」按钮
- **设置分区**（自上而下）：
- 健康度：扣分项勾选（0B空/重名超出/无书签/部分发布/深度>7/字数>2万/孤文档/无标签/未发布）
- 0B 排除书签：动态书签值勾选（选项 = 书签分布 ∪ 已勾选并集去重）
- 名称排除：重名排除 textarea（每行一个，保存去重）
- 平台管理：平台列表增删/上下移/恢复默认/校验（id 非空唯一、name 非空）+ 参与完整发布判定 + 隐藏
- 查询默认：隐藏零值开关 + 默认笔记本下拉 + 默认排序字段/方向
- **统一保存**：弹窗内编辑副本，点「保存」一次性写入生效；zeroByteExcludeBookmarks 或平台配置变化时自动触发重新分析
- **移除全部原入口**：HeroCard 信息图标弹窗、统计工具栏（名称排除/隐藏零值/清除按钮）、重名排除弹窗、平台管理弹窗及 DocListView 平台管理按钮
- **查询栏保留**：FilterSettings 搜索/筛选栏、DocListView 排序切换保持面板原位（属查询工具，不收敛）

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + Vue SFC + SCSS（Codex 设计 Token）+ @iconify/vue 图标，无新增依赖。

## 实现方案

### 核心思路

现有设置分散在 4 处 UI（HeroCard 弹窗 / StatsView 工具栏 / DuplicateNameFilterModal / PlatformManageModal），持久化依赖已成熟（watch 自动持久化 + TypedStorage 显式保存）。方案为新建 **SettingsPanel** 弹窗组件聚合所有设置 UI，打开时从现有 ref/storage 构建聚合副本（SettingsDraft），编辑副本，点「保存」一次性回写各持久化槽位；随后逐处移除原入口。

### 关键决策

1. **统一保存语义**：设置弹窗持有 SettingsDraft 副本（health/dupNames/hideZero/platforms/notebookId/sortField/sortOrder），保存时：

- healthSettings 更新 ref（现有 watch 自动持久化 `doc-analysis-health-settings`）
- duplicateNameFilter 更新 ref（现有 watch 自动持久化 `doc-analysis-dup-filter`）
- viewSettings 调 `viewSettings.save()`（新增槽位 `doc-analysis-view-settings`，旧数据无此键时 `loadOrDefault` 返回默认）
- platformMeta 调 `savePlatformMeta()`（显式保存 + 校验）
- filterOptions 用 `Object.assign` 合并 notebookId/sortField/sortOrder + `saveOptions()`

2. **保存后联动分析**：仅 zeroByteExcludeBookmarks 或 platformMeta 变化时需重新分析（SQL 统计层生效）；对比方式沿用 `join("\u0000")` 序列化差异检测。SettingsPanel emit `saved` 后由 index.vue 对比判断并 `handleAnalyze()`
3. **hideZero 提升为持久化设置**：新增 `ViewSettings { hideZero: boolean }` + `DEFAULT_VIEW_SETTINGS { hideZero: false }`；index.vue 持有 hideZero ref 传给 StatsView（表格 filterZeroRows 逻辑不变），SettingsPanel 保存后同步更新
4. **平台管理 UI 迁移**：PlatformManageModal 的列表编辑/校验/增删/移动/恢复默认逻辑整体迁入 PlatformSection.vue（保留 fullCheck undefined 视为参与判定的语义），旧组件与样式删除
5. **HeroCard 瘦身**：仅保留总文档数、健康度进度条/百分比、healthTooltip title、问题速览徽章；删除 Teleport 弹窗、信息图标、配置相关 props（healthSettings/deductionRows/healthyDocs）与 toggleDeduction/toggleExcludeBookmark/excludeBookmarkOptions/closeDetail。`useStatsOverview` 的 healthPct/healthTooltip 计算保留（内部依赖不动），StatsView 停止解构 deductionRows/healthyDocs（避免未使用变量 lint 报错）
6. **中文硬编码**：docAnalysis 现有 UI 未用 i18n，设置弹窗跟随中文硬编码 + 模板中文注释模式

### 性能与可靠性

- 设置弹窗仅打开时构建副本（浅拷贝 + matchers 深拷贝），关闭时丢弃，无常驻开销
- 保存写入为少量小对象，无性能风险；重新分析仅在必要配置变更时触发（与现有 onPlatformSaved 模式一致）
- 兼容旧存储：ViewSettings 新槽位由 loadOrDefault 默认兜底，healthSettings/duplicateNameFilter 已有兼容逻辑

## 架构设计

数据流：齿轮图标 → SettingsPanel 打开（构建 SettingsDraft 副本）→ 各分区编辑副本 → 点「保存」emit saved 并回写各持久化槽位 → index.vue 检测 zeroByteExcludeBookmarks/platformMeta 差异 → 变化且 hasAnalyzed 时 handleAnalyze() → 统计按新配置重算；hideZero 同步到 StatsView 表格过滤。

设置项归属表：

| 设置项 | 原位置 | 持久化槽位 | 收敛后 |
| --- | --- | --- | --- |
| 健康度扣分项 | HeroCard 弹窗 | doc-analysis-health-settings（watch） | SettingsPanel/HealthSection |
| 0B 排除书签 | HeroCard 弹窗 | 同上 | SettingsPanel/HealthSection |
| 重名排除 | 工具栏 + 弹窗 | doc-analysis-dup-filter（watch） | SettingsPanel/ExcludeSection |
| 隐藏零值 | 工具栏（本地） | doc-analysis-view-settings（新增） | SettingsPanel/QuerySection |
| 平台管理 | 平台管理弹窗 | doc-analysis-platforms（显式） | SettingsPanel/PlatformSection |
| 默认笔记本/排序 | FilterSettings/列表（查询态） | doc-analysis-options（显式） | SettingsPanel/QuerySection |


## 目录结构

```
src/features/docAnalysis/
├── components/
│   ├── SettingsPanel/              # [NEW] 统一设置弹窗目录
│   │   ├── index.vue               # [NEW] 设置弹窗容器：Teleport + 头部 + 分区 + 底部保存/取消；SettingsDraft 副本状态；emit saved
│   │   ├── HealthSection.vue       # [NEW] 健康度分区：扣分项 checkbox + 0B 排除书签 checkbox（选项并集去重）
│   │   ├── ExcludeSection.vue      # [NEW] 名称排除分区：textarea 每行一个（沿用 DuplicateNameFilterModal 的 split/去重逻辑）
│   │   ├── PlatformSection.vue     # [NEW] 平台管理分区：迁移 PlatformManageModal 全部列表编辑/校验/增删/移动/恢复默认逻辑
│   │   └── QuerySection.vue        # [NEW] 查询默认分区：隐藏零值开关（复用 @/components/Switch.vue）+ 默认笔记本下拉 + 排序字段/方向
│   ├── StatsView/
│   │   ├── HeroCard.vue            # [MODIFY] 删除健康度详情 Teleport 弹窗、信息图标、配置相关 props 与 toggle*/exclude* 逻辑；保留健康度条/百分比/徽章
│   │   ├── index.vue               # [MODIFY] 删除 stats-toolbar（名称排除/隐藏零值/清除按钮）与 DuplicateNameFilterModal；hideZero 改为 prop 传入；移除 update:healthSettings/update:duplicateNameFilter emit 转发
│   │   └── DuplicateNameFilterModal.vue  # [DELETE] 重名排除弹窗（逻辑迁入 ExcludeSection）
│   ├── DocListView/
│   │   └── index.vue               # [MODIFY] 删除 platform-manage-btn（openPlatformManage emit）
│   └── PlatformManage/             # [DELETE] 目录整体删除（逻辑迁入 PlatformSection）
├── composables/
│   └── useDocAnalysis.ts           # [MODIFY] 新增 loadViewSettings/saveViewSettings（ViewSettings 槽位加载与保存）
├── types/
│   ├── index.ts                    # [MODIFY] 新增 ViewSettings 接口 + DEFAULT_VIEW_SETTINGS（hideZero: false）
│   └── storage.ts                  # [MODIFY] DocAnalysisStorage 新增 viewSettings: TypedStorage<ViewSettings>（"doc-analysis-view-settings"）
├── styles/
│   ├── SettingsPanel.scss          # [NEW] 弹窗容器 + 各分区样式（Codex Token、无 box-shadow、分区上边框分隔）
│   └── DuplicateNameFilterModal.scss  # [DELETE]
├── index.vue                       # [MODIFY] 右上角新增齿轮按钮 + SettingsPanel；移除 platformManageVisible/PlatformManageModal/onPlatformSaved；新增 hideZero ref 与加载；设置保存后按需 handleAnalyze
└── README.md                       # [MODIFY] 更新功能特性（统一设置页说明）
```

## 实现要点

- SettingsPanel 子分区采用「父持副本、子编辑 emit 片段」模式：index.vue（设置容器）持有 SettingsDraft，各 Section 接收对应片段 prop 并 emit 变更，符合本功能聚合保存语义（区别于"编辑弹窗自包含"模式，因本处需跨 5 个槽位统一提交）
- PlatformSection 迁移时保留：校验（id 非空且唯一、name 非空）、增删/上下移/恢复默认、fullCheck undefined 视为参与判定、matchers 逗号分隔输入
- 健康度分区书签选项 = `stats.bookmarkDistribution` ∪ 已勾选书签并集去重（保证已排除书签可取消勾选，与现有 HeroCard 逻辑一致）
- HeroCard 移除配置后需同步清理 StatsView 传入的 props 与 useStatsOverview 解构（deductionRows/healthyDocs 保留计算、停止解构），避免 TS 未使用变量报错
- hideZero 经 index.vue → StatsView prop 传递，filterZeroRows 逻辑不变
- 删除文件需同步检查引用：PlatformManageModal、DuplicateNameFilterModal 在 index.vue / StatsView 的 import 与模板引用一并清除
- 验证：read_lints 0 error；用户自行执行 `pnpm lint`、`npx tsc --noEmit` 最终确认

## 设计风格

统一设置弹窗遵循项目 Codex 设计语言（思源主题自适应），与 docAnalysis 现有面板视觉一致：

- **弹窗容器**：Teleport 到 body 的居中遮罩 + 面板，复用现有 `%modal-overlay` / `%modal-panel` mixin 模式（参考 PlatformManageModal / HeroCard 弹窗），面板宽约 480px，内部纵向滚动，高度上限约 80vh
- **头部**：标题 + 设置图标（mdi:cog-outline）+ 右侧关闭按钮，底部 1px 边框分隔
- **分区布局**：滚动内容区自上而下五个分区，每区以标题（大写标签风格 + 上边框分隔）开头；平台分区内复用表格行式编辑布局（名称/ID/匹配关键词/URL/操作按钮列）
- **控件风格**：checkbox 使用 `accent-color` 主题色；平台操作按钮为纯图标按钮（上移/下移/删除，danger 色删除）；保存/取消为底部右侧主次按钮（Codex 风格：带图标、主按钮主题色边框）
- **交互**：分区标题 hover 无特效、checkbox 行 hover 背景 `var(--b3-list-hover)`；保存按钮禁用态（platform 校验失败时）；关闭后销毁副本不留状态