---
name: statistics-milestones-audit-fix
overview: 审查并修复 statistics/milestones 模块：修正稀有度徽章与统计类型名的 i18n 键名直显、MILESTONE_TYPES 误用 label 字段致空白、等级点数随进度倒退等确定性缺陷；将 AchievementsTab/LevelConfigTab 中文硬编码接入已有 i18n 键；消除模板重复/弱类型/prop 钻孔等冗余，并优化规则编辑弹窗与小面板下的 UI 排版。
todos:
  - id: wire-tab-i18n
    content: 修复 AchievementsTab/LevelConfigTab 稀有度徽章与类型名直显键名 bug，全量接线既有 i18n 键并补 Props 声明与中文注释
    status: completed
  - id: stabilize-tier
    content: 重构 utils/milestones.ts 稀有度分配为固定归一化，消除达成进度导致的成就点倒退与等级抖动
    status: completed
  - id: fix-minor-logic
    content: 修复规则行缺失类型默认兜底、useMilestoneStorage 初始化竞态丢写与 tierLabels 容错解析
    status: completed
  - id: dedupe-refactor
    content: 先用 code-explorer 定位引用，再简化 index.vue 传参、统一 TIERS/Tier 类型贯穿并抽 MilestoneChip 子组件与合并成就卡片模板
    status: completed
  - id: ui-polish
    content: 优化规则编辑弹窗窄屏响应式，危险色 Token 化，focus 样式去除 box-shadow，分类标题与更多文案接 i18n
    status: completed
  - id: verify-finalize
    content: 运行 read_lints 逐文件检查，用 universal-arch-skill 做架构合规复查，输出完整审查报告与交付说明
    status: completed
    dependencies:
      - wire-tab-i18n
      - stabilize-tier
      - fix-minor-logic
      - dedupe-refactor
      - ui-polish
---

## 需求概述

对 `src/features/statistics/components/milestones` 里程碑/成就功能执行代码审查（逻辑漏洞、冗余、内存泄漏、死代码、重复类型、UI 排版），交付结构化审查报告，并**直接修复**确认的问题。用户已确认：AchievementsTab / LevelConfigTab 的中文硬编码文案全部接入既有 i18n 键，zh/en 对齐。

## 审查结论摘要（已核实）

### A. 渲染与逻辑缺陷（修复）

- A1 稀有度徽章直显键名：AchievementsTab.vue / LevelConfigTab.vue 模板直接输出 `TIER_LABELS[...]`（值为 i18n 键字符串），界面显示 "tierCommon" 而非译文"普通"。
- A2 `MILESTONE_TYPES` 项无 `label` 字段却被模板/映射当作含 `label` 使用（`t.label`、`TYPE_LABEL_MAP.label`），下拉选项与成就列表类型名渲染为空；`STAT_TYPE_DESCRIPTIONS` 提示同样直显键名。
- A3 两个 Tab 全部 UI 文案硬编码中文，对应 i18n 键已存在于 statistics.json（achEmptyHint/addCustomAchievement/statTypeLabel/levelHelp1-3/milestonePointsLabel/…）但未接线，属死键；LevelConfigTab Props 未声明 `i18n`（父组件已传但被丢弃）；删除确认文案与 AchievementWall 不一致。
- A4 稀有度按动态列表长度占比分配（`tierOf(idx, total)`），列表长度随达成进度增长 → 已达成里程碑 tier 降级 → 成就点缩水、等级/Hero 可能倒退（核心逻辑缺陷）。
- A5 规则编辑器 `buildRows` 对部分缺失类型不生成默认行；A6 useMilestoneStorage 初始化（三次异步 load）完成前保存会静默丢持久化；tierLabels 未经 resolveI18nText 容错。

### B. 冗余 / 死代码 / 重复类型（清理）

- milestones/index.vue 拆 11 个数值 prop 钻孔（父已传完整 stats 对象）。
- MilestoneCategoryList 展开/折叠两块 chip 模板重复；AchievementWall 解锁/锁定两张卡片模板重复。
- 'common/rare/epic/legendary' 字面量与 TIER_LABELS/tierLabels 多处重复定义，缺单一 TIERS 常量。
- 类型弱化：MILESTONE_FIELD_MAP/statCounts/TYPE_META/STAT_TYPE_DESCRIPTIONS/customRules 等 `Record<string,...>`，已定义的 `MilestoneTypeKey` 未贯穿使用。
- THRESHOLD_ACHIEVEMENTS 各分组恒为 `prefix:"ach"` 仅用于拼 id；死 i18n 键 showAllMilestones 等。
- 内存泄漏：未发现明显泄漏（Vue 生命周期自清理、无裸定时器/监听、preloadStopWatch 已正确清理），报告中说明即可。

### C. UI 排版（优化）

- 规则编辑弹窗固定 720px 无 max-width，独立浮动窗/窄屏横向溢出；左列固定宽 130px + 输入 64px 组合在窄面板下超宽。
- 硬编码危险色 `rgba(207,34,46)`/`--stat-color-danger` 两处重复，未 Token 化；focus 使用 box-shadow 违反 Codex 风格。
- MilestoneCategoryList「里程碑分类 / +N 更多」等中文文案未 i18n；多处 `$spacing-*`/gap 字面量可规整。

## 交付物

1. 结构化审查报告（对话呈现，结论见上）。
2. 修复 A/B/C 全部确认问题，两个 Tab 全量接线 i18n。
3. 等级稀有度稳定化（A4），交付说明中提示分布数值体验变化。

## 技术栈

沿用现有 Vue 3 + TypeScript + SCSS 组合，零新增依赖。纯函数进 `utils/`、类型/常量进 `types/`、组件只做视图（模块内三层分层不变）。

## 实现方案

### 1. 两个 Tab 的 i18n 接线与显示修复（A1-A3）

- AchievementsTab.vue：新增对 `i18n` 的依赖使用——下拉选项改为 `i18n[t.labelKey]`；类型标签用 `i18n[msType*]`（或经 props.i18n 解析）；稀有度徽章 `i18n[TIER_LABELS[tier]]`；提示文案 `i18n[STAT_TYPE_DESCRIPTIONS[type]]`；全部表单 label/占位符/按钮/空态/删除确认切换为既有键，删除确认与 AchievementWall 统一用 `i18n.confirmDeleteAchievement`；每处渲染 i18n 的位置补中文注释。
- LevelConfigTab.vue：Props 补 `i18n` 声明（父已传）；帮助/区块标题/公式/预览/保存按钮全部接 levelHelp*/milestonePointsLabel/pointsUnit/curveMultiplierLabel/curveFormulaHint/curvePreviewLabel/saveLevelConfigBtn；稀有度徽章 `i18n[TIER_LABELS[tier]]`。
- 模板注释规范：沿用 `<!-- 文案："…" -->` 模式。

### 2. 稀有度稳定化（A4，核心）

- `utils/milestones.ts`：tier 判定从「动态列表长度占比」改为「固定归一化上限」。将 while 循环上限 `200` 提取为常量 `MAX_MILESTONES_PER_TYPE`；`tierOf(n, total)` 语义改为按序号的固定桶位（与现有难度增长协调，如 idx &lt; 8 common / &lt; 22 rare / &lt; 60 epic / 其余 legendary 之类，比例在实现时按 0-200 轴标定并在交付说明中提示分布变化）；`generateMilestones` 不再在循环后覆写 tier。
- 效果：达成里程碑只增不减，totalPoints 单调，等级/Hero/meta 成就判定稳定。
- 校验：以若干进度点（0/达成 1 个/全部）跑纯函数断言点数不倒退（tsc + 阅读输出）。

### 3. 次要逻辑修复（A5/A6）

- MilestoneRuleEditor.buildRows：缺失类型的 key 一律以 `generateDefaultRules()` 对应列兜底（保留既有值优先）。
- useMilestoneStorage：`initMilestoneStorage` 中同步 `new PluginStorage(plugin)`（不依赖 await），仅三项 `load` 异步；save 系列在 `storage` 未就绪时先补齐创建，避免静默丢写。
- MilestonesCard.tierLabels 改走 `resolveI18nText` 容错。

### 4. 冗余 / 类型收窄 / 死代码（B）

- milestones/index.vue 改直传 `stats` 对象；MilestonesCard Props 收敛为 `stats?`（最小标识 + 保持 i18n/plugin），statCounts 内部映射，兼容主面板现有传参。
- `types/milestoneRules.ts` 导出 `TIERS: Tier[]`（'common','rare','epic','legendary'）作为稀有度遍历单一数据源，LevelConfigTab/编辑处复用；milestoneData `prefix` 字段去除，id 改由 type 推导。
- 类型贯穿：`MILESTONE_FIELD_MAP`/`TYPE_META`/`MILESTONE_LABEL_FNS`/`STAT_TYPE_DESCRIPTIONS` 与 statCounts 的键收窄为 `MilestoneTypeKey`（或派生 Record&lt;MilestoneTypeKey,...&gt;），先经 [subagent:code-explorer] 全量定位引用点再改，杜绝 MISSING_EXPORT/漏改。
- 抽取子组件：MilestoneCategoryList 的 chip 重复块抽 `MilestoneChip.vue`（复用现有 MilestonesCard.scss 中 `.milestone-chip` 样式，遵循子组件双行 @use 模式）；AchievementWall 解锁/锁定卡片合并为一处渲染（以 prop 区分 locked 态）。
- 删除确认文案、注释按项目规范补齐。

### 5. UI 排版优化（C）

- MilestoneRuleEditor.scss：`.rule-editor-panel` 增加 `max-width: calc(100vw - 32px)`；弹窗 body 内左列固定宽改用 `min-width` + 滚动或窄屏媒体查询，防横向溢出。
- 危险色统一为设计 Token（`stats.$color-danger` 或模块共享变量），消除 `rgba(207,34,46)` 字面量；focus 发光由 box-shadow 改 border-color/outline 高亮（符合 Codex 风格）。
- 硬编码间距（gap/padding 字面量）就近归并 `$spacing-*`；MilestoneCategoryList「里程碑分类」「+N 更多」文案接 i18n（若需新文案则 zh/en 成对新增键）。
- Hero 区与成就网格在小面板下的换行/列数体验微调（低风险）。

### 6. 收尾校验

- 修改文件逐个 read_lints 检查（AI 可执行）；不执行 `pnpm vite build` / `pnpm lint`，由用户跑 `pnpm lint`、`pnpm i18n:verify`、`npx tsc --noEmit`。
- 用 [skill:universal-arch-skill] 做一次模块架构/设计 Token 合规复查（分层、SCSS 分离、文件头注释、i18n 注释）。

## 关键约束

- i18n 只改分片 `src/i18n/{zh_CN,en_US}/statistics.json`，顶层合并 json 禁止手改；新增键必须 zh/en 成对。
- 模板文案必须 i18n 键 + 中文注释；.vue 顶部保留文件头注释；新组件补注释。
- 禁止跨 feature 直接导入；统一入口原则不变。
- 修改尽量局限 milestones 目录及其 types/utils/composables/样式/i18n，不触碰统计模块其它 Tab。

## 目录结构（改动清单）

```
src/features/statistics/
├── components/milestones/
│   ├── index.vue                    # [MODIFY] 收敛为直传 stats 对象，去除 11 字段钻孔
│   ├── MilestonesCard.vue           # [MODIFY] Props 收敛 + tierLabels 容错 + 分类/成就视图引用调整
│   ├── AchievementWall.vue          # [MODIFY] 解锁/锁定卡片模板合并、删除确认文案统一
│   ├── MilestoneCategoryList.vue    # [MODIFY] chip 重复块抽组件、标题/更多文案 i18n
│   ├── MilestoneChip.vue            # [NEW] 里程碑 chip 展示子组件（复用 .milestone-chip 样式）
│   ├── MilestoneRuleEditor.vue      # [MODIFY] buildRows 缺失类型兜底
│   ├── AchievementsTab.vue          # [MODIFY] i18n 全量接线 + labelKey/稀有度/类型名显示修复
│   └── LevelConfigTab.vue           # [MODIFY] Props 补 i18n + 全量接线 + 稀有度徽章修复
├── types/
│   ├── milestoneData.ts             # [MODIFY] THRESHOLD prefix 去除、TypeMeta 键收窄
│   └── milestoneRules.ts            # [MODIFY] 新增 TIERS 常量、Record 键收窄为 MilestoneTypeKey
├── utils/
│   └── milestones.ts                # [MODIFY] 稀有度固定归一化（A4）、200 上限提为常量
├── composables/
│   └── useMilestoneStorage.ts       # [MODIFY] storage 同步创建、save 防静默丢写
├── styles/
│   ├── MilestonesCard.scss          # [MODIFY] 危险色 Token 化、小面板排版微调
│   └── MilestoneRuleEditor.scss     # [MODIFY] 弹窗 max-width 响应式、focus 样式规整
src/i18n/
├── zh_CN/statistics.json            # [MODIFY] 复用既有键为主，按需新增少量键
└── en_US/statistics.json            # [MODIFY] 与 zh 对齐（pnpm i18n:verify 由用户执行）
```

## Agent Extensions

### Skill

- **universal-arch-skill**
- Purpose：修复完成后对 statistics/milestones 模块执行架构合规复查（三层分层、SCSS 分离、设计 Token、文件头/i18n 注释、注册完整性不涉及）。
- Expected outcome：输出合规结论，若存在违规项给出精确文件与行级修正点，确保改动符合项目 AGENTS 规范。

### SubAgent

- **code-explorer**
- Purpose：在执行「类型收窄与 TIERS 常量贯穿」前批量定位 statCounts / TYPE_META / MILESTONE_LABEL_FNS / STAT_TYPE_DESCRIPTIONS / 稀有度字面量等在 statistics 模块的全部引用点，防止漏改导致 MISSING_EXPORT 或类型错配。
- Expected outcome：完整的引用点清单（文件+行），支撑一次到位地完成 Record 键类型收窄与常量替换。