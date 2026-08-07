---
name: tech-debt-algorithm-cleanup
overview: 修复 gitPush 技术债务统计算法（门槛缺失导致修改 1 次也算债务、类型分类无区分度导致建议雷同），并删除 5 类信息冗余（stability/complexity 派生列、description 重复文案、classifyDebt 与 severity 重复分类、DebtType 元数据、关联 i18n 键）。参考 code-maat 的 churn 分析思路，聚焦 modCount + authorCount 两个原始指标。
todos:
  - id: rewrite-metrics
    content: 重写 reportMetrics.ts：删除 5 个冗余函数，重写 debtRiskScore/debtSeverity，加 DEBT_MIN_MOD_COUNT 门槛，精简 buildReportData
    status: pending
  - id: clean-types
    content: 清理 types/report.ts 和 types/index.ts：删除 DebtType/DEBT_TYPE_META + FileStatRow.stability/complexity + DebtFileRow.debtType/description
    status: pending
    dependencies:
      - rewrite-metrics
  - id: clean-ui-i18n
    content: 更新 TechDebtSection.vue 模板移除 3 列+说明行，更新 SCSS 移除 desc 样式，删除 4 个 i18n 文件共 40 个冗余键
    status: pending
    dependencies:
      - clean-types
---

## 用户需求

修复 gitPush 代码统计报告中技术债务分区的两个问题：(1) 每个文件的"类型"列显示都一样（都是"高频修改"）；(2) 修改仅 1 次的文件也被列为技术债务。同时审查并删除冗余的统计算法和 UI 元素。

## 产品概述

当前技术债务统计存在三组问题：(1) 无门槛——所有被 git 历史触碰过的文件都进入债务列表，即使只修改过 1 次；(2) 类型分类无区分度——`classifyDebt` 的 `frequentChanges` 兜底分支吞掉了绝大多数文件，导致"类型"列千篇一律；(3) 大量冗余——`stability` 列是 `modCount` 的线性变换、`complexity` 列是 `loc+modCount` 的线性组合、`description` 说明文案逐字复述这三列数字、`DebtType` 与 `DebtSeverity` 基于同组输入做两次分类。优化后技术债务表只展示真正有风险的文件，列简洁无派生冗余。

## 核心改动

- 引入债务门槛（modCount ≥ 3），低于阈值的文件不进入债务列表
- 重写风险评分公式为 `modCount*2.5 + authorCount*6`，消除对 stability/complexity 的循环依赖
- 严重度直接由 riskScore 分档（severe≥50 / high≥30 / medium≥15），移除 classifyDebt 双重判断
- 删除 stability 列、complexity 列、类型列、说明文案行及其配套的类型定义、元数据、函数、i18n 键

## Tech Stack

- Vue 3 + TypeScript（`<script setup>`）
- SCSS（独立样式文件，设计 Token 驱动）
- 纯函数统计算法（`reportMetrics.ts`，无 Vue 依赖）

## Implementation Approach

### 策略：门槛过滤 + 公式重写 + 冗余删除

当前 `buildReportData` 把所有 `rankedFiles`（即所有被修改过的现存文件）都 push 进 `debtRows`，没有"是否构成债务"的判定。`classifyDebt` 的 `frequentChanges` 是兜底分支——修改次数少的文件 stability 高（100-1*3.6=96）、complexity 低，几乎全部落入此分支，导致"类型"列千篇一律。`stability` 和 `complexity` 都是 `modCount`/`loc` 的线性派生，在表格中与原始列信息重复。`description` 说明文案逐字复述这三列数字，信息零增量。

### 关键技术决策

| 决策 | 取值 | 理由 |
| --- | --- | --- |
| 债务门槛 | `DEBT_MIN_MOD_COUNT = 3` | 1-2 次是正常迭代；参考 code-maat churn 分析的默认阈值 |
| riskScore 公式 | `clamp100(modCount*2.5 + authorCount*6)` | 聚焦 churn + 多人触碰风险；去掉对派生指标 stability/complexity 的循环依赖 |
| 严重度分档 | severe≥50 / high≥30 / medium≥15 | 基于 riskScore 统一分档，消除 classifyDebt 与 debtSeverity 双重判断 |
| 保留列 | 文件 / 修改次数 / 参与人数 / 代码行数 / 风险评分 | 全部为原始数据或单一维度评分，无派生冗余 |


### 性能与可靠性

- `DEBT_MIN_MOD_COUNT` 过滤在 `rankedFiles.forEach` 前用 `.filter` 一次完成，O(n) 无额外开销
- 移除 `countFileLines` 对非债务文件的调用（门槛过滤后债务文件数减少，LOC 读取次数同步减少）
- `debtRiskScore` 新公式仅 2 次乘法 + 1 次加法 + clamp，比原公式（3 次乘法 + 3 次加法 + 条件分支 + clamp）更轻

### Avoiding Technical Debt

- 所有引用均在 gitPush 模块内（search 已确认 26 处匹配），不影响其他 feature
- HotspotSection.vue 不显示 stability/complexity（已读取确认），移除 FileStatRow 字段对其零影响
- `heatScore` 不依赖 stability/complexity，无需改动
- `countFileLines`/`fileExistsInRepo` 保留（前者读 LOC 列，后者过滤幽灵文件，不属本次冗余）

## Implementation Notes

- `FileStatRow` 被 `DebtFileRow` 和 `HotspotFileRow` 共同 extends。移除 `stability`/`complexity` 字段后需确认 HotspotSection 不引用这两个字段——已读取确认 HotspotSection.vue 模板仅使用 `heat`/`level`/`modCount`/`authorCount`/`lastModified`/`path`/`advice`，不触碰 stability/complexity
- `buildReportData` 中 `hotspotRows` 的构造也设置了 `complexity`/`stability`（通过 `base`），移除这两个字段后 `base` 对象同步精简，hotspotRows 不受影响
- `rangeDurationKey` 函数仅被 `buildDebtDescription` 调用，删除 description 后一并删除
- i18n 删除键后需运行 `pnpm i18n:verify` 确认中英文对齐（由用户执行）
- `reportTypeCol`/`reportComplexityCol`/`reportStabilityCol` 表头键需检查是否有其他组件引用后再决定删除——已确认仅 TechDebtSection.vue 使用

## Architecture Design

无架构变更——纯算法函数修改 + 类型字段精简 + UI 列调整，沿用现有 `reportMetrics.ts`（纯函数引擎）→ `types/report.ts`（类型 + 元数据）→ `TechDebtSection.vue`（视图）的分层。

## Directory Structure

```
src/features/gitPush/
├── reportMetrics.ts                    # [MODIFY] 删除 5 个函数 + 重写 riskScore + 加门槛 + 精简 buildReportData
├── types/
│   ├── report.ts                       # [MODIFY] 删除 DebtType/DEBT_TYPE_META + FileStatRow.stability/complexity + DebtFileRow.debtType/description
│   └── index.ts                        # [MODIFY] 移除 DEBT_TYPE_META/DebtType 的 re-export
├── components/report/
│   └── TechDebtSection.vue             # [MODIFY] 移除类型/复杂度/稳定性列 + 说明文案行 + 相关导入
└── styles/
    └── TechDebtSection.scss            # [MODIFY] 移除 .gpr-row--desc/.gpr-cell--desc 样式
```

i18n 文件（4 个）：

```
src/i18n/
├── zh_CN/gitPush.json                  # [MODIFY] 删除 10 个键
├── en_US/gitPush.json                  # [MODIFY] 删除 10 个键
├── zh_CN.json                          # [MODIFY] 删除对应 10 个键
└── en_US.json                          # [MODIFY] 删除对应 10 个键
```

### 文件变更详情

**reportMetrics.ts** [MODIFY]

- 删除 `stabilityScore`（:201）、`complexityEstimate`（:206）、`classifyDebt`（:248）、`buildDebtDescription`（:290）、`rangeDurationKey`（:280）共 5 个函数
- 删除 import 中的 `DebtType`（:14）
- 重写 `debtRiskScore`：参数从 `(stability, complexity, modCount)` 改为 `(modCount, authorCount)`，公式 `clamp100(modCount*2.5 + authorCount*6)`
- 重写 `debtSeverity`：参数从 `(stability, complexity)` 改为 `(riskScore)`，分档 severe≥50 / high≥30 / medium≥15
- 新增常量 `DEBT_MIN_MOD_COUNT = 3`
- `buildReportData` 中：`rankedFiles.forEach` 前加 `.filter(([, agg]) => agg.modCount >= DEBT_MIN_MOD_COUNT)`；移除 `complexity`/`stability` 变量计算；`base` 对象移除 `complexity`/`stability` 字段；`debtRows.push` 移除 `debtType`/`description` 赋值，`severity` 改为 `debtSeverity(riskScore)`，`riskScore` 改为 `debtRiskScore(agg.modCount, agg.authors.size)`；`hotspotRows.push` 的 `base` 同步精简（移除 complexity/stability）
- 删除 `SEVERITY_ORDER` 常量（:357）的引用不变（仍按 severity 排序），但确认排序逻辑仍有效

**types/report.ts** [MODIFY]

- 删除 `DebtType` 类型（:73）、`DEBT_TYPE_META` 常量（:76-80）
- `FileStatRow` 移除 `complexity`（:93）和 `stability`（:96）字段
- `DebtFileRow` 移除 `debtType`（:103）和 `description`（:107）字段

**types/index.ts** [MODIFY]

- 移除 `DEBT_TYPE_META` 的 re-export（:61）
- 移除 `DebtType` 的 re-export（:67 行的 type export 列表中删除 DebtType）

**TechDebtSection.vue** [MODIFY]

- 模板：移除表头"类型"列（:23）、"复杂度"列（:26）、"稳定性"列（:28）
- 模板：移除数据行对应 3 个 cell（:64-66 类型 chip、:71 复杂度、:73 稳定性）
- 模板：移除说明文案行（:75-81 `v-if="row.description"` 整块）
- script：移除 `DEBT_TYPE_META` 导入（:94），仅保留 `DEBT_SEVERITY_META`

**TechDebtSection.scss** [MODIFY]

- 移除 `.gpr-row--desc` 规则块（:65-73）及其内部 `.gpr-cell--desc` 子规则

**i18n（4 文件）** [MODIFY]

- 删除键（每个文件 10 个）：`reportDebtTypeUnstable`、`reportDebtTypeHighComplexity`、`reportDebtTypeFrequentChanges`、`reportDebtDescModified`、`reportDebtDescComplexity`、`reportDebtDescStability`、`reportDurAll`、`reportDur3m`、`reportDur6m`、`reportDur1y`