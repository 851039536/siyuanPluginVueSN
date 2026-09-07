---
name: gitpush-diff-dedupe
overview: 消除本次 gitPush 改动引入的 diff 渲染重复（抽 DiffLines 共享组件 + DIFF_SIGN/countDiffStats 工具函数），并清理 200 默认值硬编码与过时注释。
todos:
  - id: extract-shared-diff-utils
    content: 在 utils.ts 新增 DIFF_SIGN、countDiffStats、DEFAULT_LOG_LIMIT 三个共享导出
    status: completed
  - id: create-diff-lines-component
    content: 新建 DiffLines.vue 共享 diff 图例与着色行渲染片段
    status: completed
    dependencies:
      - extract-shared-diff-utils
  - id: refactor-diff-dialogs
    content: 重构 WorkingTreeDiffDialog.vue 与 CommitFileDiffDialog.vue 使用共享常量、统计函数与 DiffLines 组件
    status: completed
    dependencies:
      - create-diff-lines-component
  - id: dedupe-log-limit-and-fix-comment
    content: useCardData.ts 与 BranchCommitList.vue 改用 DEFAULT_LOG_LIMIT，并修正文件按钮过时注释
    status: completed
    dependencies:
      - extract-shared-diff-utils
---

## 用户需求

对本次 gitPush 系列改动作冗余清理，执行审查报告中确认的三项修复：

1. **消除 diff 渲染跨文件重复**：`WorkingTreeDiffDialog.vue` 与 `CommitFileDiffDialog.vue` 中存在相同的 `DIFF_SIGN` 常量、相同的增删行统计逻辑、以及几乎逐字相同的 diff 行渲染模板。需提取共享实现，两处复用。
2. **消除 `200` 默认值双处硬编码**：`useCardData.ts` 与 `BranchCommitList.vue` 分别硬编码默认日志条数 200，需提取为单一共享常量。
3. **修正过时注释**：`BranchCommitList.vue` 文件按钮注释仍写「hover 显示」，实际已改为常显。

改动仅限内部重构，不改变任何对外行为与视觉，不涉及 i18n 变更。

## 核心要点

- 共享 `DIFF_SIGN` 映射与 `countDiffStats` 统计函数，下沉到 `utils.ts`
- 新建 `DiffLines.vue` 共享 diff 图例与着色行渲染片段
- 两个 diff 弹窗保留各自不同的 header（工作区含暂存/丢弃；提交版含 hash 徽标与文件导航），仅复用图例与内容区
- 提取 `DEFAULT_LOG_LIMIT` 常量统一默认日志条数来源
- 修正文件按钮注释为「常显」

## 技术栈

- Vue 3 + TypeScript + SCSS（沿用现有 gitPush 模块技术栈）
- 复用既有 `parseDiffLines()` 与 `.wt-diff-*` 视觉类，不引入新依赖

## 实现方法

以「共享下沉 + 保留宿主差异」为策略：将两个 diff 弹窗完全一致的部分（`DIFF_SIGN`、增删统计、图例、diff 行渲染）提取为共享工具与共享子组件；两个宿主各自保留 header 区差异，通过 props 组合共享内容区。

### 关键决策

- `DIFF_SIGN` 与 `countDiffStats` 放入 `utils.ts`：该文件已是纯工具函数集中地，两个宿主均已有对 `utils` 的导入，且 `DiffLine`/`DiffLineType` 类型也定义于此，语义聚合最自然。
- 新建 `DiffLines.vue` 作为共享渲染片段：返回 legend + content 两个顶层节点（Vue3 fragment），放进宿主弹窗的 flex column 容器后，`content` 的 `flex: 1` 仍可正确占满剩余高度。
- `DEFAULT_LOG_LIMIT` 放入 `utils.ts`：`useCardData` 与 `BranchCommitList` 均已依赖 `utils`，避免引入新耦合；`countOptions` 保持组件内定义不变（其首项 200 与常量语义一致，仅在注释中说明对应关系）。
- 不处理 `CommitFilesDialog` 项目加载失败静默问题：属极轻微且非本次确认范围，避免扩大改动面。

## 实现注意事项

- `DiffLines.vue` 需自行 `@use "../../styles/WorkingTreeDiffDialog.scss"` 以获得 `.wt-diff-*` 类；Sass 对同一模块多次 `@use` 会自动去重，不会产生重复 CSS。
- `DiffLines` 使用多根 fragment（legend + content），须确保宿主模板中二者紧邻 header 之后，且不额外包一层破坏 flex 布局的容器。
- 重构后宿主的 `DIFF_SIGN` 本地常量应删除，避免未使用声明触发 lint；统计命名保持各自现有模板引用一致（工作区 `diffStats`，提交版 `stats`）。
- 不改变 `parseDiffLines` 的输入输出契约，仅新增工具函数与组件，保证工作区 diff 行为零回归。
- 无 i18n 键新增或删除，不影响 `pnpm i18n:verify`。

## 目录结构

```
src/features/gitPush/
├── utils.ts                                    # [MODIFY] 新增 DIFF_SIGN、countDiffStats、DEFAULT_LOG_LIMIT
├── components/
│   ├── common/
│   │   ├── DiffLines.vue                        # [NEW] 共享 diff 图例 + 着色行渲染片段
│   │   └── CommitFileDiffDialog.vue             # [MODIFY] 移除本地 DIFF_SIGN/stats/行模板，改用共享实现
│   └── ListView/
│       ├── WorkingTreeDiffDialog.vue            # [MODIFY] 同上，保留工作区 header 差异
│       └── BranchCommitList.vue                 # [MODIFY] 引用 DEFAULT_LOG_LIMIT；修正按钮注释
└── composables/
    └── useCardData.ts                           # [MODIFY] 使用 DEFAULT_LOG_LIMIT 初始化 logLimit
```

## 关键代码结构

```ts
// utils.ts 新增导出
import type { DiffLine, DiffLineType } from "./types"

/** diff 行类型 → 行首符号 */
export const DIFF_SIGN: Record<DiffLineType, string> = {
  add: "+",
  del: "−",
  hunk: "@",
  ctx: " ",
  meta: " ",
}

/** 统计 diff 增/删行数 */
export function countDiffStats(lines: DiffLine[]): { add: number, del: number } {
  let add = 0
  let del = 0
  for (const line of lines) {
    if (line.type === "add") add++
    else if (line.type === "del") del++
  }
  return { add, del }
}

/** LOG 默认显示条数（与 BranchCommitList.countOptions 首项一致） */
export const DEFAULT_LOG_LIMIT = 200
```

```
<!-- DiffLines.vue props 契约 -->
<script setup lang="ts">
import type { DiffLine } from "../../types"
defineProps<{
  i18n: Record<string, any>
  lines: DiffLine[]
}>()
</script>
```