---
name: gitpush-report-cleanup-and-extend
overview: 清理质量评分移除后遗留的过期注释 + 重组 reportMetrics.ts 文件工具函数 + 将原质量评分列替换为"删除行数"列（完整原始数据）
todos:
  - id: fix-stale-comments
    content: 修复 4 处过期注释（AuthorContributionSection.scss / reportMetrics.ts / useCodeReport.ts），重组 reportMetrics.ts 文件工具函数区块
    status: completed
  - id: add-deleted-lines-col
    content: 在 AuthorContributionSection.vue 中新增"删除行数"列（表头 + 数据单元格），更新 colspan 9→10
    status: completed
  - id: add-i18n-keys
    content: 在 4 个 i18n 文件中新增 reportDeletedLinesCol 键
    status: completed
---

## 需求概述

分两部分：(A) 修复质量评分移除后遗留的 4 处过期注释，并重组 `reportMetrics.ts` 中混杂的文件工具函数；(B) 在作者贡献度表格中新增"删除行数"列，补齐增删改查四大原始指标（参考 git-fame `--show-deleted-files`）。

## 核心功能

### 子任务 A：注释修复 + 代码重组

- 修复 `AuthorContributionSection.scss`、`reportMetrics.ts`、`useCodeReport.ts` 中提及"等级徽章""启发式评分/聚合"的过期注释
- 将 `reportMetrics.ts` 中混杂在"启发式评分公式"区块下的 3 个文件工具函数（`countFileLines` / `fileExistsInRepo` / `isCodeFile`）提取到独立区块

### 子任务 B：新增"删除行数"列

- 在作者排行表的"新增行数"与"净增"之间插入"删除行数"列
- 列顺序变为：排名 → 作者 → 提交 → 新增 → **删除（新）** → 净增 → 平均大小 → 频率 → 文件 → 活跃天数
- 展开行 colspan 从 9 更新为 10
- 新增 i18n 键 `reportDeletedLinesCol`（中文：删除行数，英文：Deleted Lines）

## 技术方案

### 修改策略

全部为低风险改动：注释修改不涉及逻辑；删除行列的数据源 `AuthorReportRow.linesDeleted` 已存在于类型定义中，仅需在 UI 层渲染。

### 子任务 A：注释与区块重组

#### 1. `AuthorContributionSection.scss` L1

过期内容"等级徽章"已移除，替换为当前实际内容：

```
// gitPush 代码统计报告：代码贡献度分区（作者排行表：HTML table 布局 + 排名徽章 + 净增 mini bar + 展开详情）
```

#### 2. `reportMetrics.ts` L1-L6

将文件头注释中"启发式评分"改为准确描述：

```
// gitPush 代码统计报告指标引擎：numstat 解析 + 作者/文件聚合 + 债务/热点评分（纯函数，无 Vue 依赖）
```

第3行"启发式公式说明"改为"评分公式说明"。

#### 3. `reportMetrics.ts` L183-L230 区块重组

将当前的单一 `// ── 启发式评分公式 ──` 区块拆分为两个区块：

- `// ── 通用工具 ──`：存放 `clamp100`、`round2`
- `// ── 文件读取工具 ──`：存放 `LOC_READ_MAX_BYTES`、`countFileLines`、`fileExistsInRepo`、`isCodeFile`
- 后续的 `// ── 技术债务 ──` 和 `// ── 代码热点 ──` 区块不变

#### 4. `useCodeReport.ts` L1

移除"启发式"措辞：

```
// gitPush 代码统计报告 — 选中项目/时间范围 + git 数据抓取 + 聚合报告（仿 useCommitAnalysis 模式）
```

### 子任务 B：新增"删除行数"列

#### 插入位置

在"新增行数"（`row.linesAdded`）与"净增行数"（`row.netLines`，含 mini bar）之间插入新列，形成 Added → Deleted → Net 的自然语义链。

#### 涉及文件

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `AuthorContributionSection.vue` | 修改 | 表头区：在"新增行数"`<th>`后插入"删除行数"`<th>`；数据行：在 `row.linesAdded` `<td>` 后插入 `row.linesDeleted` `<td>`；展开行 `colspan` 9→10 |
| `src/i18n/zh_CN/gitPush.json` | 修改 | `reportDeletedLinesShort` 后新增 `reportDeletedLinesCol: "删除行数"` |
| `src/i18n/en_US/gitPush.json` | 修改 | 对应位置新增 `reportDeletedLinesCol: "Deleted Lines"` |
| `src/i18n/zh_CN.json` | 修改 | 合并后 JSON 同步新增 |
| `src/i18n/en_US.json` | 修改 | 合并后 JSON 同步新增 |


无需修改：`AuthorReportRow` 已含 `linesDeleted` 字段，`reportMetrics.ts` 无需改动。

### 关键注意点

- 新增列位于第 5 列（数据列第 4 列），插入后列总数从 9 变为 10
- 展开行 `colspan="10"` 需对应更新
- `linesDeleted` 已在 `types/report.ts` 的 `AuthorReportRow` 接口中定义，数据层零改动

## Agent Extensions

无。本次改动为简单的注释修正、区块重组和单列 UI 新增，无需使用外部扩展。