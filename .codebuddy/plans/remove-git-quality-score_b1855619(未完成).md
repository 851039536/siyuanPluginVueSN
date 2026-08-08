---
name: remove-git-quality-score
overview: 移除 gitPush 报告中的"质量评分"列及 qualityScore/qualityGrade 启发式公式，改为仅展示原始多维度指标。
todos:
  - id: remove-types
    content: 移除 QualityGrade 类型、GRADE_META 常量、AuthorReportRow 中 quality/grade 字段、CodeReportData.teamOverview 中 avgQuality 字段，以及 types/index.ts 中的重导出
    status: pending
  - id: remove-functions
    content: 移除 reportMetrics.ts 中的 qualityScore/qualityGrade 函数，清理 aggregateAuthorStats/buildReportData/buildEmptyReport 中的相关调用与赋值
    status: pending
    dependencies:
      - remove-types
  - id: remove-ui-columns
    content: 修改 AuthorContributionSection.vue 移除质量评分列UI（表头、渲染td、GRADE_META import、derived rows）、更新 colspan；修改 TeamOverviewSection.vue 移除平均质量卡片
    status: pending
    dependencies:
      - remove-types
  - id: remove-styles
    content: 移除 AuthorContributionSection.scss 中的 .gpr-grade-chip 和 .gpr-stars 样式块
    status: pending
    dependencies:
      - remove-ui-columns
  - id: remove-i18n
    content: 移除 4 个 i18n 文件中的 reportAvgQuality/reportQualityCol/reportGrade 系列键
    status: pending
---

## 用户需求

移除 GitPush 代码统计报告中的"代码质量评分"列及其背后的启发式综合评分公式（`qualityScore` / `qualityGrade`），改为仅展示各维度的原始数据（提交次数、代码行数、净增、频率、文件数、活跃天数、流失率），让用户自行判断贡献度，不做单一加权评分。

## 核心功能

- 移除作者排行表中的"质量评分"列（含等级徽章 + 星级），表格列数从 10 减为 8
- 移除团队总览中的"平均代码质量"KPI 卡片
- 移除 `qualityScore()` 和 `qualityGrade()` 两个启发式评分函数
- 清理所有相关的类型定义、常量、i18n 键、样式

## 技术方案

### 修改范围

纯删除操作，不引入新逻辑。涉及 1 个核心引擎文件、2 个类型文件、2 个 UI 组件、1 个样式文件、4 个 i18n 文件。

### 实施顺序

按依赖关系从底层到上层：类型定义 → 引擎函数 → 重导出 → UI 组件 → 样式 → i18n。这样每一步删除后编译器可立即检测到残留引用。

### 关键注意点

- `clamp100()` 函数不可删除，因为它仍被 `debtRiskScore()` 和 `heatScore()` 使用
- 合并后的 i18n JSON（`zh_CN.json` / `en_US.json`）由 `pnpm i18n:merge` 自动从分片生成，修改分片后需运行合并命令
- `colspan` 从 10 改为 8（移除质量评分列导致列数减 1，共 9 列，但展开行 colspan 覆盖全部列=8）

### 文件清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/features/gitPush/reportMetrics.ts` | 修改 | 移除 `qualityScore()`(L204-209)、`qualityGrade()`(L212-218) 函数；`aggregateAuthorStats()` 移除 L142+L163-164；`buildReportData()` 移除 L416+L434；`buildEmptyReport()` 移除 `avgQuality: 0` |
| `src/features/gitPush/types/report.ts` | 修改 | 移除 `QualityGrade` 类型(L22-23)、`GRADE_META` 常量(L26-32)；`AuthorReportRow` 移除 `quality`(L65) + `grade`(L67)；`CodeReportData.teamOverview` 移除 `avgQuality`(L160) |
| `src/features/gitPush/types/index.ts` | 修改 | 移除 `GRADE_META`、`QualityGrade` 的重导出(L61, L66) |
| `src/features/gitPush/components/report/AuthorContributionSection.vue` | 修改 | 移除质量评分表头 `<th>`(L42)；移除质量评分 `<td>` 渲染(L105-116)；展开行 `colspan` 10→8(L127)；移除 `GRADE_META` import(L180)；移除 `rows` computed 中的 `gradeLabel/gradeColor/gradeBg/stars` 派生(L225, L237-241) |
| `src/features/gitPush/components/report/TeamOverviewSection.vue` | 修改 | `overviewCards` 移除第 4 项"平均代码质量"卡片(L45) |
| `src/features/gitPush/styles/AuthorContributionSection.scss` | 修改 | 移除 `.gpr-grade-chip`(L178-185) + `.gpr-stars`(L188-193) 样式块 |
| `src/i18n/zh_CN/gitPush.json` | 修改 | 移除 `reportAvgQuality`(L301)、`reportQualityCol`(L310)、`reportGradeS/A/B/C/D`(L318-322) |
| `src/i18n/en_US/gitPush.json` | 修改 | 对应移除上述 7 个键的英文翻译 |
| `src/i18n/zh_CN.json` | 修改 | 移除 `reportAvgQuality`、`reportQualityCol`、`reportGradeS/A/B/C/D` 对应行 |
| `src/i18n/en_US.json` | 修改 | 移除 `reportAvgQuality`、`reportQualityCol`、`reportGradeS/A/B/C/D` 对应行 |