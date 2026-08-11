---
name: gitPush-analysis-loc-ranking
overview: 在 gitPush 提交分析页面新增代码行数排行榜功能：通过 git log --numstat 跨项目聚合新增/删除行数，生成项目代码量排行和作者代码量排行两个榜单。
todos:
  - id: extend-data-layer
    content: 扩展数据层：类型定义（meta.ts）、聚合工具函数（reportMetrics.ts）、ReportOps/GitPushManager 的 maxCount 参数
    status: completed
  - id: extend-composable
    content: 扩展 useCommitAnalysis：enableLineCount 开关、numstat 并行获取、行数排行聚合、缓存持久化
    status: completed
    dependencies:
      - extend-data-layer
  - id: extend-panel-ui
    content: 扩展 CommitAnalysisPanel：工具栏 toggle 开关 + Pair3 双栏行数排行区块 + SCSS 样式
    status: completed
    dependencies:
      - extend-composable
  - id: add-i18n
    content: 添加 i18n 翻译键：zh_CN 和 en_US 各新增 8 个行数排行相关键
    status: completed
    dependencies:
      - extend-panel-ui
---

## 用户需求

在 gitPush 提交分析页面新增代码行数统计分析功能，分析全部项目的代码行数（新增行/删除行/净增行），并生成排行榜。

## 核心功能

- 在提交分析面板工具栏添加「启用行数统计」开关按钮（默认关闭，避免 numstat 查询的性能开销）
- 开启后，分析按钮同时获取每项目最近 N 条提交的 numstat 数据（新增/删除行数），与现有提交元信息分析并行执行
- 生成两个排行榜：**项目代码行数排行**（按新增行 + 删除行 + 净增行排序）和**作者代码行数排行**（按新增行 + 删除行 + 净增行排序）
- 以水平条形图形式展示，复用现有 `.gpa-bar-list`/`.gpa-bar-row` 视觉模式
- commitCount 选择器（30/50/100/200）同步控制提交元和行数分析的条数范围
- 行数排行数据随分析缓存一起持久化，切换视图或重启后复用

## 视觉效果

- 工具栏右侧，在条数选择器与「开始分析」按钮之间新增一个 toggle 开关，标签为「行数统计」
- 面板底部新增 Pair 区块（双列网格），左列为「项目代码行数排行」（带新增/删除/净增三色条形），右列为「作者代码行数排行」（同上）
- 净增行为正时条形显示绿色，为负时显示红色，与 Codex 风格的语义色一致

## 技术栈

- 语言：TypeScript + Vue 3（Composition API）
- 样式：SCSS（Codex 设计 Token）
- 数据源：`git log --numstat`（复用现有 `ReportOps.getNumstatLog()`）
- 持久化：`TypedStorage`（复用现有 `commitAnalysisCache` 槽位，扩展字段）

## 实现方案

### 核心策略

在现有提交分析流程中新增一个可选的 numstat 并行查询通道。用户通过工具栏 toggle 决定是否启用行数统计。启用时，`runAnalysis()` 对每个项目同时执行 `getCommitLog()`（现有）和 `getNumstatLog(projectPath, commitCount)`（新增），将文件级增删行聚合为项目级和作者级排行。关闭时不执行 numstat 查询，零额外开销。

### 数据流

```mermaid
flowchart TD
    A[用户点击「开始分析」] --> B{enableLineCount?}
    B -->|关闭| C[仅 getCommitLog - 现有流程]
    B -->|开启| D[并行: getCommitLog + getNumstatLog]
    C --> E[聚合 CommitAnalysisEntry[]]
    D --> F[聚合 CommitAnalysisEntry[]]
    D --> G[聚合项目行数排行]
    D --> H[聚合作者行数排行]
    E --> I[写入 analysisStats computed]
    F --> I
    G --> I
    H --> I
    I --> J[CommitAnalysisPanel 渲染]
    I --> K[持久化到 commitAnalysisCache]
```

### 关键设计决策

1. **toggle 默认关闭，启用后附加 numstat 查询**：numstat 比普通 git log 重（每个文件记录两列数字），对大型仓库可能有性能影响。默认关闭确保不影响现有用户体验，按需开启。

2. **行数聚合在 composable 中完成**：`NumstatCommit` 不含 `projectId`，项目上下文由 `useCommitAnalysis` 的 `projects.value.map()` 循环提供。每个项目聚合一次本地行数（调用 `reportMetrics.ts` 中新增的 `sumProjectLines()` 和 `sumAuthorLines()`），然后跨项目 merge 排序。聚合逻辑不放在组件中，保持数据层自包含。

3. **扩展类型而非新增类型**：行数排行数据直接扩展 `CommitAnalysisStats` 接口（新增 `projectLineRanking` 和 `authorLineRanking`），保持面板单 prop 模式不变。`CommitAnalysisCache` 同步扩展以持久化。

4. **`getNumstatLog` 增加 `maxCount` 参数，向后兼容**：在 `ReportOps.getNumstatLog()` 和 `GitPushManager.getNumstatLog()` 中新增可选的第 3 个参数 `maxCount?: number`，传入时在 git log 命令前插入 `-<maxCount>`。不影响现有调用方（code report 模块传 `since` 不传 `maxCount`）。

5. **净增行语义着色**：净增为正 → `var(--b3-theme-primary)`（绿），净增为负 → `var(--b3-theme-error)`（红），零 → `var(--b3-border-color)`（灰）。纯 CSS class 控制，不引入计算属性。

### 性能分析

- 时间复杂度：O(P × C × F)，P=项目数，C=每项目提交数（≤200），F=每提交平均文件数。典型场景（10 项目 × 100 提交 × 5 文件 = 5000 次累加），可忽略不计。
- git 命令开销：每个项目多一次 `git log --numstat`（已有 60s 超时保护），受 GitExecutor 并发限流控制，不会击穿系统。
- 缓存策略：行数排行随 entries 一起缓存，切换视图直接复用，不重新执行 git 命令。

### 实现注意事项

- **向后兼容**：`getNumstatLog` 的 `maxCount` 参数可选，现有 code report 调用无需修改。
- **缓存加载**：`loadCachedAnalysis()` 时需同时恢复 `projectLineRanking`/`authorLineRanking`，否则旧缓存无这些字段时按空数组兜底。
- **enableLineCount 持久化**：作为用户偏好独立存储（新 TypedStorage 槽位 `git-push-analysis-line-toggle`），不混入分析缓存。
- **文件头注释**：所有新增/修改的 `.ts` 和 `.vue` 文件顶部必须有简要功能说明注释。
- **i18n 模板注释**：模板中每处 i18n 键上方必须有中文 HTML 注释标注实际文案。

## 架构设计

### 模块关系

```
types/meta.ts          ← 扩展 CommitAnalysisStats、CommitAnalysisCache、新增 LineRankItem
reportMetrics.ts       ← 新增 sumProjectLines()、sumAuthorLines() 纯函数
managers/ReportOps.ts  ← getNumstatLog 增加 maxCount 参数
GitPushManager.ts      ← getNumstatLog 透传 maxCount
composables/useCommitAnalysis.ts  ← enableLineCount toggle、numstat 并行获取、排行聚合、缓存
components/analysis/CommitAnalysisPanel.vue  ← toggle 开关 + Pair3 排行区块
styles/CommitAnalysisPanel.scss  ← 新增 toggle、排行行号样式
i18n/zh_CN/gitPush.json  ← 新增翻译键
i18n/en_US/gitPush.json  ← 新增翻译键
```

## 目录结构

所有修改均限于 `src/features/gitPush/` 目录下：

```
src/features/gitPush/
├── types/
│   └── meta.ts              # [MODIFY] 扩展 CommitAnalysisStats（+projectLineRanking/+authorLineRanking）、CommitAnalysisCache（同上）、新增 ProjectLineRankItem/AuthorLineRankItem 接口
├── reportMetrics.ts         # [MODIFY] 新增 sumProjectLines(commits): {added,deleted}、sumAuthorLines(commits): Map<string,{added,deleted}> 两个纯聚合函数
├── managers/
│   └── ReportOps.ts         # [MODIFY] getNumstatLog 增加可选 maxCount 参数，插入 -N 到 git log 参数
├── GitPushManager.ts        # [MODIFY] getNumstatLog 签名增加可选 maxCount 参数并透传
├── composables/
│   └── useCommitAnalysis.ts # [MODIFY] 新增 enableLineCount ref + setEnableLineCount()、runAnalysis() 内并行 numstat 查询与聚合、analysisStats computed 扩展、缓存 save/load 扩展
├── components/
│   └── analysis/
│       └── CommitAnalysisPanel.vue  # [MODIFY] 工具栏新增行数统计 toggle 按钮、新增 Pair3 双栏排行区块、新增 props/emit
├── styles/
│   └── CommitAnalysisPanel.scss  # [MODIFY] 新增 .gpa-line-toggle / .gpa-bar-col* / .gpa-bar-num--positive/negative 样式
├── i18n/
│   ├── zh_CN/gitPush.json   # [MODIFY] 新增 8 个行数排行相关键
│   └── en_US/gitPush.json   # [MODIFY] 新增 8 个行数排行相关键
```

## 关键代码结构

### 新增类型定义（types/meta.ts）

```typescript
// 行数排行基础字段
interface LineRankBase { added: number; deleted: number; net: number }

// 项目代码行数排行
interface ProjectLineRankItem extends LineRankBase { id: string; name: string }

// 作者代码行数排行
interface AuthorLineRankItem extends LineRankBase { author: string }

// CommitAnalysisStats 扩展字段
interface CommitAnalysisStats {
  // ... 现有字段保持不变
  projectLineRanking: ProjectLineRankItem[]  // 新增：项目行数排行
  authorLineRanking: AuthorLineRankItem[]    // 新增：作者行数排行
}
```

### 新增聚合函数（reportMetrics.ts）

```typescript
// 从 NumstatCommit[] 汇总单项目总增删行数
export function sumProjectLines(commits: NumstatCommit[]): { added: number; deleted: number }

// 从 NumstatCommit[] 汇总每人增删行数（Map<作者名, {added, deleted}>）
export function sumAuthorLines(commits: NumstatCommit[]): Map<string, { added: number; deleted: number }>
```