---
name: gitpush-diff-review-fixes
overview: 修复审查发现的 3 项问题：discardFile 对已暂存新增文件必失败的既有 bug、未跟踪兜底判据在 git rm --cached 场景的边角、差异弹窗头部窄窗口溢出风险。
todos:
  - id: worktree-ops-fixes
    content: WorktreeOps.ts：discardFile 按 isFileInHead 分流（新增类 reset 后走 clean），getFileDiff 兜底判据按 scope 区分并新增 isFileInIndex
    status: completed
  - id: header-wrap
    content: WorkingTreeDiffDialog.scss：头部 flex-wrap 换行 + 操作区 margin-left:auto，窄窗口防裁剪
    status: completed
  - id: verify-memory
    content: 跑 read_lints 与 pnpm typecheck，按 5 项逻辑自查表核对，同步 2026-09-14 记忆
    status: completed
    dependencies:
      - worktree-ops-fixes
      - header-wrap
---

## Product Overview

对「gitPush 差异弹窗修复 + 两项遗留修复」的审查已完成：发现 2 处轻度越界（AGENTS*.md 规范文档改动、CommitMsgGenerator 提示词由中文状态改为机器可读 id，均已披露、无需回退）与 3 项应修问题。本计划只落地这 3 项审查修复，不扩大范围。

## Core Features

- **丢弃已暂存新增文件不再报错**：对「新增已暂存」（A/AM/AD）文件执行「取消暂存并丢弃更改」时，现状 `reset HEAD` 后跟 `checkout --` 必然 pathspec 报错、文件残留为未跟踪；修复后按「文件是否在 HEAD」分流——不在 HEAD 的新增类改用 `git clean -f` 删除工作区文件，在 HEAD 的修改/删除类维持 `checkout` 原行为。
- **`git rm --cached` 场景下未跟踪条目差异可见**：差异兜底判据按比较基线区分——工作区范围（`git diff` 比 index）改判「文件是否在 index」，暂存区范围（`--cached` 比 HEAD）维持「是否在 HEAD」；未跟踪/`rm --cached` 条目均回退 `--no-index` 显示整文件内容。
- **窄窗口弹窗头部不裁剪**：差异弹窗头部允许换行（`flex-wrap` + 操作区 `margin-left: auto`），独立浮动窗口宽 < ~420px 时按钮不再被 `overflow: hidden` 裁掉（该类名被提交内 diff 弹窗共享，wrap 对两者均为良性防裁剪）。

## Tech Stack

沿用现状：Vue 3 + TypeScript + SCSS（设计 Token）、`WorktreeOps`/`GitExecutor` 数据层，无新增依赖。

## Implementation Approach

三处小改动，全部有已核实的代码事实支撑：

1. **`WorktreeOps.discardFile`（既有 bug）**：staged 分支在 reset 前调用既有私有方法 `isFileInHead`（`git ls-tree HEAD -- <path>`，无提交/失败按 false）；不在 HEAD（新增类）→ `reset HEAD -- file` 后改用 `clean -f -- file`（与未跟踪分支同款命令）；在 HEAD → 维持 `reset + checkout`。破坏性操作仍向上抛错的注释语义不变。
2. **`WorktreeOps.getFileDiff`（本次修复的边角）**：空差异兜底判据改为按 scope 取基线——`staged=false` 用新私有方法 `isFileInIndex`（`git ls-files --error-unmatch -- <file>`，退出码 0 = 在 index，catch 按 false）；`staged=true` 维持 `isFileInHead`。命中最坏路径仍只多 1 次子进程，常态零开销。
3. **`styles/WorkingTreeDiffDialog.scss`（UI 风险）**：`.wt-diff-header` 加 `flex-wrap: wrap`、`.wt-diff-header-actions` 加 `margin-left: auto`。不触碰 `.wt-dl-*` 行渲染规则；该 scss 的头部类被 `CommitFileDiffDialog.vue` 间接共享，wrap 行为对两弹窗均为纯增益（放不下才换行，宽窗口视觉零变化）。

## Implementation Notes

- 模块层零文案：`isFileInIndex`、`discardFile` 不产出用户文案，失败仍由调用方呈现。
- `git clean -f -- <不存在的路径>` 退出码 0、`ls-files --error-unmatch` 不命中时退出码非 0——两处均已按 catch 语义处理，不依赖 stderr 文案判别。
- 验证：`pnpm typecheck`（0 error）+ `read_lints`（WorktreeOps.ts 与弹窗相关文件 0 条）；逻辑自查表——①已暂存新增丢弃→reset+clean 文件消失无报错 ②已暂存修改丢弃→reset+checkout 同旧行为 ③未跟踪差异→整文件新增（保持） ④`rm --cached` 未跟踪条目差异→整文件新增（本次目标） ⑤tracked 真无差异→空态不误报。
- `pnpm lint` / `pnpm vite build` 由用户执行；禁临时脚本。

## Directory Structure

```
src/features/gitPush/
├── managers/
│   └── WorktreeOps.ts                   # [MODIFY] discardFile 按 isFileInHead 分流（新增类走 clean）；getFileDiff 兜底判据按 scope 分（新私有 isFileInIndex）；其余不动
└── styles/
    └── WorkingTreeDiffDialog.scss       # [MODIFY] .wt-diff-header 加 flex-wrap: wrap；.wt-diff-header-actions 加 margin-left: auto（窄窗口防裁剪）
.codebuddy/memory/2026-09-14.md          # [MODIFY] 追记审查结论（2 越界披露 + 3 修复）与验证结果
```