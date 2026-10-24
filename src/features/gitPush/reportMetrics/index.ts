// gitPush 报告指标引擎 — 汇聚入口（按域拆分到同名子模块，导出面与拆分前 reportMetrics.ts 逐一对应）
//
// 域划分：parseNumstat numstat 解析 / aggregateAuthor 作者聚合 / aggregateFile 文件聚合
//        dailyStats K 线日聚合 / rhythm 提交节奏 / scoring 债务与热点评分
//        fileLines 行数与存在性索引 / assemble 报告组装
//
// ⚠️ 本 barrel 的导出面是对外契约（消费方：useCodeReport / htmlReport / ReportOps / CommitIndex /
// CodeReport 组件群 / LineStats / useCommitAnalysis / GitPushManager 及各自 spec），增删导出即破坏契约。
// 子模块间 import 一律直连（如 assemble → ./scoring），不走本 barrel 防环。
// 本目录及其子模块禁 import "../utils" / "../types" 桶（桶含 GitPushManager 运行时模块，
// 会破坏 Node 单测环境可加载性），只允许直连 ../types/report、../types/storage、../utils/analysis、../utils/project 叶子。

// ── 解析层 ──
export type { NumstatCommit } from "./types"
export { parseNumstatBlock, parseNumstatBlocks } from "./parseNumstat"

// ── 聚合层 ──
export { aggregateFileStats, shouldIncludeFile, sumAuthorLines, sumLineDeltas, sumProjectLines } from "./aggregateFile"
export type { LineDelta } from "./aggregateFile"
export { calcMovingAverage7, collapseDailyStats, MAX_CANDLES } from "./dailyStats"

// ── 评分层 ──
export { countDebtFiles, daysSince, DEBT_MIN_MOD_COUNT, FIXED_HEAT_THRESHOLDS, quantileHeatThresholds } from "./scoring"
export type { HeatThresholds } from "./scoring"

// ── 文件读取层 ──
export { countFileLines, countTrackedFileLinesMap, LOC_READ_MAX_BYTES } from "./fileLines"

// ── 组装层 ──
export { buildEmptyReport, buildReportData } from "./assemble"
