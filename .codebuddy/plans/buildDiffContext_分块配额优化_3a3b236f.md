---
name: buildDiffContext 分块配额优化
overview: 优化 gitPush 的 diff 上下文分块策略：文件多时引入单文件最小配额避免碎片化；修正场景补充变更文件清单兜底；并加固 perFile 下限与 diff 起点识别两个防御点。
todos:
  - id: optimize-build-diff-context
    content: 在 utils.ts 优化 buildDiffContext：引入单文件最小配额 500、容量截断与省略提示
    status: completed
  - id: anchor-diff-start
    content: 在 WorktreeOps.ts 将 getCommitDeepContext 的消息头拆分改为行首锚定匹配 diff --git
    status: completed
  - id: fix-file-list-fallback
    content: 在 CommitMsgGenerator.ts 为 generateCommitFix/deepAnalyzeCommitFix 补变更文件清单兜底
    status: completed
    dependencies:
      - optimize-build-diff-context
---

## 产品概述

对 gitPush 模块 AI 生成提交信息的 diff 上下文构建逻辑做三项稳健性优化，解决文件数较多时的 diff 碎片化问题，并消除两处低概率边界缺陷。

## 核心功能

- **单文件最小配额**：`buildDiffContext` 在变更文件很多时不再把所有文件均分到极小配额，而是优先完整覆盖前 N 个文件（每文件至少 500 字符），其余文件省略并在返回内容末尾标注数量，避免 AI 只看到一堆 `diff --git` 头碎片。
- **修正场景清单兜底**：`generateCommitFix` / `deepAnalyzeCommitFix` 当前只有 diff、无文件清单，在 diff 被配额省略时会导致信息丢失回归；本次同步为这两个场景补充「变更文件清单」（`git show --name-status`），保证被省略的文件仍有路径与状态可见。
- **下限防御**：文件数超过预算容量时保证至少处理 1 个文件，杜绝 `perFile = 0` 导致预算被首个文件独占的退化。
- **消息头拆分加固**：`getCommitDeepContext` 改用行首锚定识别 `diff --git`，避免提交消息体恰好包含该字符串时误截断。

## 技术栈

- 纯 TypeScript 逻辑修改，无新增依赖、无 UI 变更。
- 沿用 gitPush 现有架构：纯函数放 `utils.ts`，git 命令封装在 `WorktreeOps`，AI 生成编排在 `CommitMsgGenerator`。

## 实现方案

### 1. `buildDiffContext` 分块策略优化（`src/features/gitPush/utils.ts`）

- 新增常量 `MIN_PER_FILE_DIFF_BUDGET = 500`（单文件最小配额）。
- 计算容量 `capacity = Math.max(1, Math.floor(total / MIN_PER_FILE_DIFF_BUDGET))`，只取前 `capacity` 个文件分块；`chunks.length` 超过容量时，剩余文件不再参与 diff 分块。
- `perFile = selected.length === 1 ? total : Math.floor(total / selected.length)`，因此 `perFile` 始终 >= 500，天然覆盖原「`perFile` 可为 0」的缺陷（无需单独 `Math.max(1, ...)`）。
- 返回字符串末尾追加省略提示：`（其余 N 个文件 diff 因上下文预算省略，请结合变更文件清单判断）`，仅在确实省略时出现。
- 保持函数签名与调用点不变（`buildDiffContext(fullDiff, budget)`），截断标注逻辑保留。

### 2. 消息头拆分加固（`src/features/gitPush/managers/WorktreeOps.ts`）

- 将 `getCommitDeepContext` 中的 `text.indexOf("diff --git ")` 改为行首锚定：`/^diff --git /m.exec(text)`。
- `match` 为 null 或 `match.index === undefined` 时维持原兜底 `text.substring(0, 10000)`。
- 其余逻辑（消息头原样保留、diff 部分走 `buildDiffContext`）不变。

### 3. 修正场景补文件清单（`src/features/gitPush/managers/CommitMsgGenerator.ts`）

- 新增私有方法 `buildCommitFileListSection(files: FileChange[]): string`：
- `files` 为空返回空串。
- 每行格式 `- {path}（{状态中文}）`，rename/copy 显示 `oldPath → newPath`；状态中文取自 `FILE_STATUS_META` 的 `title`，缺失时降级为原始 status。
- `generateCommitFix` 与 `deepAnalyzeCommitFix` 中，在调用 `getCommitDeepContext` 后额外调用 `this.worktreeOps.getCommitFiles(projectPath, hash)` 获取 `FileChange[]`，并生成清单段。
- prompt 在「原提交信息」之前插入 `${fileListSection}`（空串时自然不渲染），与 `generateCommitMessage` 已有的「变更文件清单 + 各文件 diff」结构对齐。
- 新增类型导入：`FileChange`（来自 `../types/storage`）、`FILE_STATUS_META`（来自 `../types`，`types/index.ts` 已 re-export）。

## 关键设计说明

- **不回退均分优势**：文件数少时（`chunks.length <= capacity`）行为与原均分完全一致；仅在文件数超容量时切换为「前 N 个完整覆盖 + 清单兜底」。
- **清单兜底闭环**：`generateCommitMessage` 已有 stat 清单；本次为两个修正场景补 name-status 清单，三者均满足「diff 被省略时仍有文件维度信息」。
- **性能**：修正场景每次多一次 `git show --name-status` 子进程，与已有 `git show` 调用同一仓库，开销可接受；不引入并发以保持 GitExecutor 调用简单可控。
- **兼容性**：`buildDiffContext` 与 `getCommitDeepContext` 签名不变，现有 3 处调用点无需调整。