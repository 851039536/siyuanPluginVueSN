---
name: milestones-审查修复
overview: 对 statistics/milestones 模块（7 个组件 + types/composables/utils 依赖）进行全面代码审查，输出问题清单并直接修复确认的逻辑漏洞、冗余、死代码与重复类型，以逻辑漏洞修复为最高优先级。
todos:
  - id: fix-zero-tier-logic
    content: 修复里程碑 0 值终止语义与稀有度动态分配（utils/milestones.ts + MilestoneRuleEditor.vue）
    status: completed
  - id: fix-meta-storage
    content: 修复 metaChecks 隐式耦合为 id 映射，并给 initMilestoneStorage 加幂等守卫（MilestonesCard.vue + useMilestoneStorage.ts）
    status: completed
  - id: types-i18n-dedup
    content: Tier 类型复用收窄、删除 MilestoneRulesData 死代码、成就墙分类 i18n 化并新增 i18n 键（milestoneRules.ts + milestoneData.ts + AchievementWall.vue + i18n 分片）
    status: completed
    dependencies:
      - fix-meta-storage
  - id: redundancy-cleanup
    content: 消除冗余：复用 pointsForLevel、删除 rows 透传 computed、合并 AchievementsTab 双 script 块、删入口 i18n computed
    status: completed
    dependencies:
      - fix-zero-tier-logic
      - types-i18n-dedup
---

## 产品概述

对思源笔记插件 statistics 功能中 milestones（里程碑）模块进行代码审查并修复。该模块包含里程碑卡片（等级横幅/下一目标/分类里程碑/成就墙）与规则设置弹窗（里程碑阈值表格/自定义成就管理/等级曲线配置），数据经模块级 composable（useMilestoneStorage）共享并持久化。

## 审查范围

- 逻辑漏洞、冗余、内存泄露、死代码、重复类型五个维度
- 覆盖 `components/milestones/` 全部 7 个组件及其依赖（types/milestoneData.ts、types/milestoneRules.ts、composables/useMilestoneStorage.ts、utils/milestones.ts、utils/achievements.ts、statistics/index.vue）

## 核心发现（确认修复项）

- 逻辑漏洞：里程碑阈值填 0/留空被 `|| 1` 强制转成 1，「填入 0 表示不再生成里程碑」功能失效；稀有度分配固定分母 50 与实际里程碑数脱节；meta 成就 check 数组与配置长度隐式耦合存在崩溃风险；initMilestoneStorage 被两处重复调用产生冗余 IO；成就墙分类 Tab 中文硬编码且默认 i18n fallback 缺键
- 冗余：等级曲线预览公式与 utils 中 pointsForLevel 完全重复；rows computed 纯透传；AchievementsTab 双 script 块混用；入口 i18n computed 多余包装
- 死代码：MilestoneRulesData 接口全库零引用
- 重复类型：CustomAchievement.tier 与 Tier 字面量重复；TIER_LABELS/tierPoints 键集与 Tier 重复；AchCategory 与 CategoryI18nDef 字段重叠
- 内存泄露：未发现实质泄露（纯展示组件 + 模块级状态符合设计），仅报告不改动

## 交付

输出问题清单并直接修复全部确认项（逻辑漏洞优先）。

## 技术栈

沿用现有 Vue 3 + TypeScript + SCSS 架构，不引入新依赖、不改动样式文件、不新增功能。

## 实现方案

### 1. 逻辑漏洞修复（优先）

**L1 里程碑 0 值终止语义**（`utils/milestones.ts` + `MilestoneRuleEditor.vue`）

- 根因：模板 `parseInt(...) || 1` 把 0/空强制转 1，且 `milestoneTargetOfWithRules` 对数组内的 0 不终止，`generateMilestones` 中 target=0 会被判永久已达成（current/0=Infinity）
- 修复：`onTargetChange` 改传原始字符串并解析为 `Number.isNaN(v) ? 0 : Math.max(0, v)`，input `min="1"`→`min="0"`；`milestoneTargetOfWithRules` 取到 `<=0` 返回 Infinity；`generateMilestones` 循环内 `target <= 0` break；`onSave` 裁剪末尾 0 序列

**L2 稀有度按实际数量分配**（`utils/milestones.ts`）

- 根因：`tierOf(n - 1, 50)` 固定分母，级数调成 3 或 200 时稀有度占比失真
- 修复：push 阶段暂存 tier，循环结束后 `result.forEach((m, i) => { m.tier = tierOf(i, result.length) })`

**L3 meta 成就 check 显式映射**（`MilestonesCard.vue`）

- 根因：`META_ACHIEVEMENTS.map((meta, i) => check: metaChecks[i])` 长度隐式耦合，漏加即崩溃
- 修复：改为 `Record<meta.id, () => boolean>` 按 id 映射，`?? (() => false)` 兜底

**L4 initMilestoneStorage 幂等守卫**（`composables/useMilestoneStorage.ts`）

- 根因：statistics/index.vue 与 MilestonesCard.vue 两处调用，重复 new PluginStorage + 3 次 load
- 修复：模块级 `boundPlugin` 记录，`if (!plugin || boundPlugin === plugin) return`

**L5 成就墙 i18n 化**（`types/milestoneData.ts` + `AchievementWall.vue` + `MilestonesCard.vue` + i18n 分片）

- `AchCategory` 接口 name → i18nKey（复用 CategoryI18nDef 模式），ACH_CATEGORIES 改用 i18nKey（catWriting/catKnowledge/catRich/catPersistence 已存在，新增 catAll/catMeta）
- AchievementWall 渲染改 `props.i18n[cat.i18nKey]`；MilestonesCard 默认 i18n fallback 补齐 tierAll/catAll/catMeta
- `src/i18n/{zh_CN,en_US}/statistics.json` 分片各新增 catAll、catMeta（不碰合并大文件）

### 2. 死代码清理

- 删除 `types/milestoneRules.ts` 中全库零引用的 `MilestoneRulesData` 接口（含 `_version` 字段）

### 3. 重复类型收窄

- `CustomAchievement.tier` 复用 `Tier` 类型（milestoneRules 单向 import milestoneData，无循环依赖）
- `TIER_LABELS: Record<Tier, string>`、`LevelConfig.tierPoints: Record<Tier, number>`
- 同步修正受影响使用点：LevelConfigTab 的 `v-for` 数组加 `as const`（否则 string 索引 Record<Tier,string> 报 TS 错），AchievementsTab 的 `TIER_LABELS[ach.tier]` 随 tier 收窄为 Tier 自动兼容
- `AchCategory` 随 L5 并入 CategoryI18nDef 模式；CategoryDef/CategoryI18nDef 职责不同保留

### 4. 冗余消除

- LevelConfigTab 删除本地 `pointsForLevelPreview`，改导入 `utils/achievements` 的 `pointsForLevel(lv, curveMultiplier)`（公式一致，模板调用点同步改）
- MilestoneRuleEditor 删除纯透传的 `rows` computed，模板改用 `editableRows`（levelCount 仍用 computed，保留 import）
- AchievementsTab 合并普通 `<script>` 与 `<script setup>` 双块为单一 setup 块，import 去重（MILESTONE_TYPES 只留一份）
- milestones/index.vue 删除冗余 `i18n` computed，模板直接用 `props.i18n`

### 5. 内存泄露

未发现实质泄露（各组件为纯展示组件，无定时器/全局监听；模块级 composable 状态随插件生命周期存活符合设计；Statistics.destroy() 已正确清理）。仅报告，不改动。

## 实施注意事项

- 所有 .ts/.vue 保留文件头注释；本次不新增 SCSS；不执行 `pnpm vite build` / `pnpm lint`（由用户验证）
- 修改后用户验证命令：`pnpm i18n:verify`（新增键对齐）、`npx tsc --noEmit`、`pnpm lint`
- MilestonesCard.vue 442 行已超 300 行警戒线（未超 500 硬阈值），本次不做拆分，报告中提示

## 目录结构

```
src/features/statistics/
├── components/milestones/
│   ├── MilestoneRuleEditor.vue   # [MODIFY] L1 0 值语义（模板 raw 传递 + min=0）；R2 删除 rows 透传 computed
│   ├── MilestonesCard.vue        # [MODIFY] L3 metaChecks id 映射；L5 默认 i18n fallback 补 tierAll/catAll/catMeta
│   ├── AchievementWall.vue       # [MODIFY] L5 分类 Tab 渲染改 props.i18n[cat.i18nKey]
│   ├── AchievementsTab.vue       # [MODIFY] R3 双 script 块合并、import 去重
│   ├── LevelConfigTab.vue        # [MODIFY] R1 复用 pointsForLevel；T2 v-for as const
│   └── index.vue                 # [MODIFY] R4 删除冗余 i18n computed
├── types/
│   ├── milestoneRules.ts         # [MODIFY] T1/T2 Tier 复用与收窄；D1 删除 MilestoneRulesData
│   └── milestoneData.ts          # [MODIFY] L5+T3 AchCategory i18nKey 化
├── composables/
│   └── useMilestoneStorage.ts    # [MODIFY] L4 幂等守卫
└── utils/
    └── milestones.ts             # [MODIFY] L1 0 值终止；L2 稀有度动态分配
src/i18n/
├── zh_CN/statistics.json         # [MODIFY] 新增 catAll/catMeta
└── en_US/statistics.json         # [MODIFY] 新增 catAll/catMeta
```

## 关键代码结构

L1 终止逻辑（`utils/milestones.ts`）——核心语义变更：

```ts
// milestoneTargetOfWithRules：命中 <=0 的目标值视为该等级起终止
if (customRules?.[type] && customRules[type].length > 0) {
  if (n <= customRules[type].length) {
    const v = customRules[type][n - 1]
    return v > 0 ? v : Infinity
  }
  return Infinity
}
// generateMilestones 循环内：target <= 0 break；push 后统一按 result.length 重标 tier
```

L3 check 映射（`MilestonesCard.vue`）——解除长度隐式耦合：

```ts
const metaChecks: Record<string, () => boolean> = {
  "ach-all-common": /* 原 metaChecks[0] 逻辑 */,
  "ach-half-all": /* 原 metaChecks[1] 逻辑 */,
  "ach-all-rare": /* 原 metaChecks[2] 逻辑 */,
  "ach-level-10": /* 原 metaChecks[3] 逻辑 */,
}
const metaDefs = META_ACHIEVEMENTS.map((meta) => ({
  ...meta,
  check: metaChecks[meta.id] ?? (() => false),
}))
```