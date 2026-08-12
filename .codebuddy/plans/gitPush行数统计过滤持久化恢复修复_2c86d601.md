---
name: gitPush行数统计过滤持久化恢复修复
overview: 修复 gitPush 行数统计视图「文件格式过滤」勾选扩展名的持久化恢复缺口：使 `loadLineStatsCache` 无论行数排行缓存是否有数据都恢复 `selectedExtensions`，确保重启插件/重开面板后勾选不丢失。
todos:
  - id: fix-ext-persistence-restore
    content: 修复 useCommitAnalysis.ts 的 loadLineStatsCache：将 selectedExtensions 恢复语句上移到排行判断之前，实现无条件恢复勾选的扩展名
    status: completed
---

## 需求概述

gitPush 插件行数统计视图的「文件格式过滤」功能（黑名单排除语义：勾选扩展名 = 统计时跳过该格式），要求**勾选的扩展名列表持久化保存**，在重启插件、重开面板后自动恢复，避免用户每次重新设置。

## 功能边界（已与用户确认）

- **二进制文件不参与统计**：git `--numstat` 对二进制文件（.dll/.sdb/.pdb 等）输出 `-\t-`（无行数），`parseFileLines` 解析层已跳过，这些格式本就从未进入统计数据。勾选它们统计无变化是**符合预期的正确行为**，不修改 numstat 解析层。
- **过滤只针对文本文件**（.ts/.vue/.js 等有行数的格式），排除文本格式时统计应明显变化——这是验证过滤生效的正确方式。
- 保存链路已正确：弹窗点「应用」→ `updateSelectedExtensions()` 即时持久化；「开始行数分析」→ `runCore` 全量保存。**缺口仅在恢复链路**。

## 技术方案

### 实现思路

持久化的保存链路（`updateSelectedExtensions`、`runCore` 的 needNumstat 分支）已正确写入 `git-push-line-stats-cache` 槽位，本次只修复**恢复链路**的一个条件缺陷。

### 核心改动（单点）

文件：`src/features/gitPush/composables/useCommitAnalysis.ts` 的 `loadLineStatsCache()`（约第 255-274 行）

**现状缺陷**：`selectedExtensions.value = cache.selectedExtensions ?? []` 被包在 `if (cache.projectLineRanking.length > 0 || cache.authorLineRanking.length > 0)` 条件分支内。当行数排行缓存为空时（用户只设置了过滤但从未分析、勾选「排除全部」导致排行为空、项目全部删除等场景），走 `loadCachedAnalysis()` 回退分支，勾选的扩展名不会恢复 → 重开面板/重启插件后过滤选择丢失。

**修复方式**：将 `selectedExtensions.value = cache.selectedExtensions ?? []` **上移到 `const cache = await manager.storage.lineStatsCache.loadOrDefault()` 之后、排行数据条件判断之前**，无条件从缓存恢复。无论独立行数缓存是否有排行数据，勾选的扩展名都先恢复，再按排行数据存在性决定走主分支还是回退分支。

### 设计考量

- **最小改动**：仅移动一行赋值语句，不改变函数签名、不新增存储槽位、不触碰 `LineStatsCache` 类型（`selectedExtensions: string[]` 字段已存在，老版本缓存缺字段时 `?? []` 兜底）。
- **与现有持久化模式一致**：复用 `commitCount` 无条件恢复的既有模式，符合本项目「设置必须加载并立即应用」的启动链路规范。
- **性能**：无额外开销——`loadLineStatsCache` 已有 `lineStatsCacheLoaded` 标志防重复读盘，本改动不增加任何 I/O 或遍历。
- **影响范围**：仅影响 `loadLineStatsCache()` 一处；`reportMetrics.ts`、`ExtFilterDialog.vue`、`LineStatsPanel.vue`、`index.vue`、`types/`、i18n、SCSS 均不改动。

### 验证

- 用户自行执行 `npx tsc --noEmit`（不执行 `pnpm lint` / `pnpm vite build`，项目硬规则）。
- 手工验证路径：勾选若干扩展名（建议先用文本格式如 .ts/.vue 验证过滤生效）→ 点「应用」→ 重开面板/重载插件 → 进入行数统计视图 → 过滤按钮徽标数量与弹窗勾选状态应恢复。