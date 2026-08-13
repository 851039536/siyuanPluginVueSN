---
name: gitPush-line-ranking-show-all
overview: 移除 gitPush 行数统计「项目代码行数排行」的前 20 截断，改为显示全部有行数变化的项目；汇总卡片（全量合计）与作者排行上限不受影响。
todos:
  - id: remove-rank-truncation
    content: 移除 buildLineRankings 项目排行的 slice 截断，显示全部有行数变化的项目，并同步更新 PROJECT_RANK_LIMIT 常量及 summary 相关注释
    status: completed
---

## 产品概述

「项目代码行数排行」目前只展示前 20 个项目，用户确认需求为：去掉截断，显示全部有行数变化的项目。

## 核心功能

- 「项目代码行数排行」移除 `.slice(0, PROJECT_RANK_LIMIT)` 截断，所有满足 `added + deleted > 0` 的项目全部展示
- 排序规则不变（新增行降序，同新增量按净增降序）
- 汇总卡片（总新增 / 总删除 / 总净增 / 当前总行数）本为全量合计，不受影响
- 作者行数排行（AUTHOR_RANK_LIMIT = 10）、项目提交数排行（rankByCount 复用 PROJECT_RANK_LIMIT）维持现状
- 同步更新涉及「截断」语义的过时注释，保持文档准确性

## 技术方案

### 实现思路

移除 `buildLineRankings` 中项目排行的截断步骤即可，UI 层（`LineStatsPanel.vue`）已通过 props 直接 v-for 渲染 `projectRanking`，无额外数量限制，无需改动模板与样式。

### 修改点

1. **`src/features/gitPush/composables/useCommitAnalysis.ts`**

- `buildLineRankings` 中 `projectRanking` 链式调用移除 `.slice(0, PROJECT_RANK_LIMIT)`（保留 `.filter` 剔除无行数变化项目的逻辑）
- `PROJECT_RANK_LIMIT` 常量保留（第 366 行 `rankByCount` 仍在使用），仅更新其注释：由「项目排行上限 / 作者排行上限」改为「项目提交数排行上限（行数排行已显示全部，不再截断）+ 作者行数排行上限」的准确描述
- `lineStatsSummary` ref 注释中「与截断后的排行解耦」措辞微调（排行不再截断）

2. **`src/features/gitPush/components/analysis/LineStatsPanel.vue`**

- `summary` prop 注释中「与截断排行解耦」措辞同步微调（可选，保持注释一致性）

### 性能与兼容性

- 项目数量通常为几十个量级，v-for 直接渲染无性能压力，无需分页/虚拟列表
- 缓存：去掉截断后新写入缓存存全量排行；旧缓存（截断后 20 条）加载时数据偏少，重新分析后即得全量，无需数据迁移
- 不涉及 i18n 新键、样式或类型变更，无需 `i18n:verify` / `validate:icons`