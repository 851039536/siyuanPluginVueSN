---
name: gitPush-reportMetrics-遗留优化
overview: 对 reportMetrics.ts 实施遗留优化：去除 18 个无外部引用的冗余 export、提取重复内联类型 LineDelta、消除 emptyRhythmStats 与聚合函数的空桶构造重复。纯函数模块瘦身，行为零变化。
todos:
  - id: remove-exports
    content: 去除 reportMetrics.ts 中 18 个内部符号的 export 关键字，改为模块私有
    status: completed
  - id: extract-linedelta
    content: 提取 LineDelta 接口，sumProjectLines/sumAuthorLines 返回类型改用
    status: completed
    dependencies:
      - remove-exports
  - id: extract-empty-buckets
    content: 提取 emptyWeekdayBuckets/emptyHourBuckets，消除 emptyRhythmStats 空桶构造重复
    status: completed
    dependencies:
      - remove-exports
  - id: verify-build
    content: 运行 read_lints 检查并提示用户执行 npx tsc --noEmit 验证
    status: completed
    dependencies:
      - extract-linedelta
      - extract-empty-buckets
---

## 需求概述

优化上一轮对 `src/features/gitPush/reportMetrics.ts` 审查后遗留的两项建议，纯代码瘦身重构，行为零变化：

1. **去除导出冗余**：18 个符号仅模块内部使用却带 `export` 关键字且外部零引用，去掉 `export` 使其变为模块私有，收窄公共 API 表面
2. **消除重复类型**：`sumProjectLines` 返回 `{ added, deleted }`、`sumAuthorLines` 返回 `Map<string, { added, deleted }>`，内联对象类型重复，提取统一 `LineDelta` 接口
3. **顺带消除空桶构造重复**：`emptyRhythmStats` 中 7 项星期空桶与 12 项时段空桶的手写构造，与 `aggregateWeekdayStats`/`aggregateHourlyStats` 的构造逻辑重复，提取复用函数

## 边界

- 仅修改 `src/features/gitPush/reportMetrics.ts` 单个文件，不改任何调用方
- 保留外部有 import 的符号导出（`parseNumstatBlocks`、`NumstatCommit`、`aggregateFileStats`、`shouldIncludeFile`、`sumProjectLines`、`sumAuthorLines`、`countTrackedFileLinesMap`、`countFileLines`、`calcMovingAverage7`、`countDebtFiles`、`DEBT_SEVERITY_ORDER`、`sinceForRange`、`buildReportData`、`buildEmptyReport`、`DEBT_MIN_MOD_COUNT`）
- 调用方（useCommitAnalysis.ts、ProjectLineDetail.vue）仅按结构读取 `.added`/`.deleted` 成员，返回类型签名变化不影响编译

## 技术栈

- TypeScript 纯函数模块重构，无新依赖、无运行时行为变化

## 实现方案

### 1. 去除 18 个符号的 export 关键字

删除 `export` 前缀，改为模块私有声明。涉及符号（已逐一遍历确认外部零引用）：
`WICK_PAD_HOURS`、`aggregateDailyStats`、`aggregateWeekdayStats`、`aggregateHourlyStats`、`maxCommitStreak`、`buildRhythmStats`、`emptyRhythmStats`、`HOTSPOT_LEVEL_ORDER`、`heatAdviceKey`、`suggestionKey`、`debtRiskScore`、`debtSeverity`、`heatScore`、`heatLevel`、`aggregateAuthorStats`、`isCodeFile`、`fileExistsInRepo`、`fetchFileDiff`

安全依据（已确认）：gitPush 目录无 `.test.*` 测试文件；无 `import * as ... from "reportMetrics"` 批量导入；外部 import 清单已全量核对，仅上述 18 个无引用。

### 2. 提取 LineDelta 接口

在 reportMetrics.ts 内部定义（不 export，调用方无需命名类型）：

```ts
/** 行数增量（新增/删除行） */
interface LineDelta {
  added: number
  deleted: number
}
```

- `sumProjectLines` 返回类型改为 `LineDelta`
- `sumAuthorLines` 返回类型改为 `Map<string, LineDelta>`
- 调用方只读成员属性，结构兼容，零改动

### 3. 提取空桶构造复用

新增两个私有辅助函数，供 `emptyRhythmStats` 使用：

```ts
function emptyWeekdayBuckets(): WeekdayStat[]
function emptyHourBuckets(): HourBucketStat[]
```

- `emptyRhythmStats` 中手写的 7 项 `{dow, count:0}` 与 12 项 `{start,end,count:0}` 改为调用辅助函数
- `aggregateWeekdayStats`/`aggregateHourlyStats` 保持现有 `counts.map` 实现不动（统计后映射，模式不同）

## 实施要点

- 同步更新函数上方 JSDoc 注释中的 `export` 相关描述（如有）
- `NumstatCommit["files"]`、`FileAgg`、`AuthorAgg` 等内部实现类型维持现状
- 重构后文件顶部文件头注释无需改动
- 验证链（用户执行）：`npx tsc --noEmit` 确认零类型错误；`pnpm lint` 确认无未使用导出告警

## 架构设计

无需系统架构变更——单文件封装性收窄，属模块内部可见性调整。所有被外部引用的符号保持导出，模块 API 表面收缩为"仅导出真实消费方"。

## 目录结构

仅修改 1 个文件：

```
src/features/gitPush/
└── reportMetrics.ts  # [MODIFY] 去 18 个内部符号 export、提取 LineDelta、提取空桶构造辅助函数
```