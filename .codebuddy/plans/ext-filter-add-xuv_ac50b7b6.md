---
name: ext-filter-add-xuv
overview: 在 gitPush 行数统计的文件格式过滤黑名单中加入 .xuv，排除固件镜像文件对行数统计的污染（HDT525DG-SMT 千万行根因是 .xuv 镜像被整文件替换计数）。
todos:
  - id: add-xuv-ext-filter
    content: 在 useCommitAnalysis.ts 的 LINE_STATS_EXTENSIONS 常量末尾追加 .xuv
    status: completed
  - id: verify-and-memory
    content: 检查 lint 并更新 .codebuddy/memory/2026-08-12.md 记录排查结论与修复
    status: completed
    dependencies:
      - add-xuv-ext-filter
---

## 问题排查结论

用户反馈行数统计视图中 HDT525DG-SMT 项目统计出一千多万行，其他项目正常。经实测诊断（git numstat 聚合最近 100 条提交），根因已确认：

- **统计口径**：行数统计抓取每个项目最近 N 条提交（默认 100）的 `git log --numstat`，聚合每文件的增删行数。该仓库最近 100 条提交累计新增约 1954 万行、删除约 1954 万行。
- **主要来源**：贡献行数 Top4 的文件各 4194304 行（= 2^22，约 4MB 文本），全部是 **.xuv 文件**（Xilinx 固件镜像，文本格式每行一个地址/字节），合计约 1677 万行，占总新增约 86%。这些镜像被整包提交进 `CodeExecutionHub/bin/` 与 `Template/` 目录，发布新版本固件时整删旧文件 + 整增新文件，numstat 叠加出千万级行数。
- **次要来源**：Test Logging 测试日志（.txt，已在黑名单可滤）、TestEngine.py/h、TestEngineAPI.py、MerryDll.cs 等真实源码（每项 ≤3.6 万行）。
- **当前局限**：过滤弹窗黑名单含 .txt 但不含 .xuv，用户无法排除固件镜像文件。

## 功能目标

在行数统计的「文件格式过滤」黑名单中增加 **.xuv** 扩展名，使用户可勾选排除固件镜像文件，消除千万级虚高行数。勾选 .xuv 后（黑名单语义：勾选 = 排除），项目/作者行数排行与顶部汇总卡片全部按新过滤重算；未勾选保持现状不过滤。

## 技术方案

### 实现思路（单点最小改动）

过滤黑名单常量 `LINE_STATS_EXTENSIONS`（src/features/gitPush/composables/useCommitAnalysis.ts 第 32-37 行）末尾追加 `".xuv"`。过滤弹窗的 chip 网格通过 `v-for` 遍历该常量自动渲染新选项，无需改动其他文件。

### 改动链路

- **过滤生效链**：`LINE_STATS_EXTENSIONS` → ExtFilterDialog chip 列表 → `updateSelectedExtensions()` 持久化到 lineStatsCache → `runCore` 的 `buildLineRankings(settled, nameById, selectedExtensions.value)` → `sumProjectLines`/`sumAuthorLines` → `shouldIncludeFile`（reportMetrics.ts 按路径 `endsWith` 匹配、不区分大小写）→ 排除 .xuv 后聚合。
- **数据流**：勾选 .xuv → 点「应用」→ `updateSelectedExtensions` 即时持久化 → 重新点「开始行数分析」→ numstat 聚合时跳过 .xuv 文件 → 排行与汇总按新口径展示。

### 设计考量

- **最小改动**：仅常量追加一个字符串，不改函数签名、不新增存储槽位、不触碰 `LineStatsCache` 类型（`selectedExtensions: string[]` 字段已存在）。
- **语义一致**：沿用既有黑名单排除语义（勾选 = 统计时跳过该格式），与 .dll/.txt/.zip 等一致；`shouldIncludeFile` 大小写不敏感匹配覆盖 `.XUV` 变体。
- **无需加入 .bin/.exe 等二进制镜像**：git numstat 对二进制文件输出 `-\t-`，`parseFileLines` 解析层已跳过，从未进入统计，不存在虚高问题。
- **性能**：零额外开销——过滤发生在内存聚合层（`shouldIncludeFile` 单次遍历匹配），不修改 git 命令，不增加 I/O。
- **使用提示**：已分析过的缓存数据需用户重新点击「开始行数分析」才会按新过滤重算（与现有 .txt 等过滤行为一致，过滤变更不自动重分析）。

### 验证

- 用户自行执行 `npx tsc --noEmit`（不执行 `pnpm lint` / `pnpm vite build`，项目硬规则）。
- 手工验证：行数统计视图 → 点「过滤」按钮 → 弹窗中出现 `.xuv` 选项 → 勾选并应用 → 点「开始行数分析」→ HDT525DG-SMT 项目行数应从千万级降至真实源码量级。