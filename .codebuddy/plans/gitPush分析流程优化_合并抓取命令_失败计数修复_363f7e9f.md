---
name: gitPush分析流程优化：合并抓取命令+失败计数修复
overview: gitPush 分析流程两处优化：(1) 行数统计视图每项目抓取从 2 条 git 命令合并为 1 条（新开独立方法隔离，报告视图零影响）；(2) 修复 failedCount 恒为 0、路径无效项目静默缺席的问题。
todos:
  - id: extend-numstat-parser
    content: reportMetrics.ts 扩展 NumstatCommit 可选 hash/message 字段，parseNumstatBlocks 改为按 header 段数自适应解析（2 段兼容旧格式）
    status: completed
  - id: add-commit-stats-log
    content: ReportOps.ts 新增 getCommitStatsLog（format 追加 %h/%s，60s 超时），GitPushManager.ts 透传该方法
    status: completed
    dependencies:
      - extend-numstat-parser
  - id: refactor-run-core
    content: useCommitAnalysis.ts runCore 预检 fs.existsSync 路径无效 throw，needNumstat 分支改用 getCommitStatsLog 单命令合并 entries 与行数数据
    status: completed
    dependencies:
      - add-commit-stats-log
  - id: sync-docs
    content: gitPush README.md 方法清单补充 getCommitStatsLog，验证行数统计数值一致性与失败提示，更新 .codebuddy/memory 今日记忆
    status: completed
    dependencies:
      - refactor-run-core
---

## 用户需求

对 gitPush 分析流程实施已选定的两项优化，且**必须隔离到独立方法**，不得连动影响其他功能：

1. **A. 合并 git 抓取命令**：行数统计视图每项目从 2 条 git log 命令（`getCommitLog` + `getNumstatLog`）降为 1 条（2N→N），省一半抓取时间。约束：新增独立方法承载新命令格式，`getNumstatLog`（报告视图共用）与 `getCommitLog`（列表卡片共用）保持原样零改动。
2. **B. 修复失败项目不提示**：`failedCount` 恒为 0 的问题——路径无效的项目静默缺席无提示。修复后进入面板失败提示条（`gpa-fail-hint` / `gls-fail-hint`）自动生效，无需改 UI。

## 核心功能

- 新增 `getCommitStatsLog` 独立方法：一条命令抓取 hash/message/author/date + 每文件增删行
- `parseNumstatBlocks` 升级为 header 段数自适应解析，旧格式（author/date 2 段）与执行统计新格式（hash/author/date/message 4 段）均兼容
- `runCore(true)` 改为单命令抓取，直接由 numstat 结果构造提交条目与行数排行
- `runCore` 项目循环开头预检路径有效性，无效路径计入 `failedCount`

## 技术方案

### 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript，git 命令经 `GitExecutor` 信号量限流执行，无新增依赖。

### 核心思路

采用"新增独立方法 + 解析器向后兼容"策略，把优化影响面压缩在 gitPush 模块内部两条链路，报告视图（`useCodeReport.runReport`）与列表卡片（`useCardData.loadLog`）共用函数零改动：

- **A 合并抓取**：新方法 `getCommitStatsLog(projectPath, maxCount)` 使用 format `%x1e%h%x1f%an%x1f%aI%x1f%s`（原为 `%x1e%an%x1f%aI`），追加 `%h`（hash）与 `%s`（subject）。`NumstatCommit` 新增可选字段 `hash?`/`message?`，`parseNumstatBlocks` 按 header 段数自适应：2 段走旧解析（author/date），4 段额外提取 hash/message，旧数据与新格式互不破坏。
- **B 失败计数修复**：`runCore` 项目循环开头用 `getNodeFsPathOs().fs.existsSync(resolveValidPath(p))` 预检，路径无效直接 throw → `Promise.allSettled` rejected → `fail++`。行数统计分支 `getCommitStatsLog` 失败不再本地 try-catch 降级，向上抛错同样计入失败（git 异常也得到提示），语义统一。

### 关键设计决策

1. **不改 `getNumstatLog`**：报告视图带 `since` 全量范围抓取，行数统计带 `maxCount`，两处参数语义不同。新增 `getCommitStatsLog` 专注行数统计场景，60s 超时与 numstat 一致。
2. **不改 `getCommitLog`**：`useCardData.loadLog`（列表卡片）依赖其返回结构，且其内部吞错返回 `[]` 的语义被卡片视图容忍。B 修复绕过它——用预检替代返回结构改造。
3. **`parseNumstatBlocks` 单一解析器升级而非复制**：避免两套解析逻辑漂移；段数自适应保证老版本缓存/报告数据不受影响。
4. **性能**：`runCore(true)` 每项目 git 调用 2→1，命令总量减半；聚合逻辑（`buildLineRankings`）仍复用现有 O(n) 遍历，无额外开销。`hash?`/`message?` 可选字段对 `buildReportData`/`aggregateAuthorStats`/`aggregateFileStats` 等消费方完全透明（只读 author/date/files）。

### 执行要点

- `parseNumstatBlocks` 用 `header.split("\x1f")` 判断段数：`parts.length >= 4` 走新格式（hash/author/date/message，message 用 `slice(3).join("\x1f")` 防 subject 内含分隔符），`>= 2` 走旧格式（author/date），否则跳过。
- 预检依赖 `getNodeFsPathOs()?.fs`（统一入口 `@/utils/nodeModules`）；fs 不可用（非 Electron 环境）时跳过预检保持原行为。
- 提交分析 `runCore(false)` 仍走 `getCommitLog`（1 条命令），仅路径预检生效；行数统计 `runCore(true)` 走 `getCommitStatsLog`（1 条命令），预检 + 失败计数生效。
- 错误信息仅用于 rejected 计数（UI 只显示失败项目数），文案保持简洁中文即可。
- 验证由用户执行：`pnpm lint` / `npx tsc --noEmit`，并手动回归行数统计数值一致性与失败提示条展示。

### 影响面

- **零影响**：`getNumstatLog`（报告视图）、`getCommitLog`（列表卡片）、`parseNumstatBlocks` 旧格式路径、全部聚合函数、UI 组件。
- **行为变化（预期）**：行数统计中 git 失败项目从"静默降级空数据"变为计入 `failedCount` 并显示提示条，这正是 B 修复目标。