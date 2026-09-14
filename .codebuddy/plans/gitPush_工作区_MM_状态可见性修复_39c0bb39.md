---
name: gitPush 工作区 MM 状态可见性修复
overview: 修复 WorkingTreePanel 在「暂存后又修改文件」场景下不显示未暂存状态的问题：根因是无自动刷新导致数据陈旧 + MM 文件无行级标记。改动为 WorkingTreePanel.vue 增加行级 MM 标记 + focus 自动刷新，配套 SCSS 与 i18n。
todos:
  - id: cleanup-memory
    content: 精简整理 .codebuddy/memory/MEMORY.md：合并去重条目、删除过时信息，修复超长截断
    status: completed
  - id: mm-marker
    content: WorkingTreePanel.vue 文件行增加 MM 双状态标记（file.staged && file.unstaged 时显示标记点 + title），样式写入 WorkingTreePanel.scss
    status: completed
  - id: focus-refresh
    content: WorkingTreePanel 挂载防抖 focusin 监听，gitOpLoading/refreshingWorkingTree 期间跳过，触发 refreshWorkingTree 事件，onUnmounted 清理
    status: completed
  - id: i18n-keys
    content: zh_CN/en_US gitPush.json 新增标记提示键，执行 pnpm i18n:merge 后 pnpm i18n:verify
    status: completed
    dependencies:
      - mm-marker
  - id: verify-and-log
    content: 跑 read_lints + pnpm typecheck 校验改动，写入当日 memory 记录
    status: completed
    dependencies:
      - focus-refresh
      - i18n-keys
---

## 需求背景

用户在 gitPush 工作区面板中暂存 1 个文件后再修改该文件，面板不显示「未暂存 1」，而 VS Code 等 git 软件会同时显示「已暂存 1 + 未暂存 1」。经审查确认：解析层无 Bug（`parseWorktreeStatus` 对 MM 状态双计数），根因是**工作区状态数据陈旧**——外部编辑器修改文件后面板无自动刷新机制，只有 4 个刷新时机（卡片首次点击 / Tab 切回 / 手动刷新按钮 / 面板内 git 操作后）。

## 核心功能（修复内容）

1. **焦点自动刷新**：WorkingTreePanel 挂载 focusin 监听（防抖），用户切回面板操作时自动触发已有的 `refreshWorkingTree` 事件链路，消除「外部修改后状态陈旧」的显示问题
2. **MM 行级标记**：`file.staged && file.unstaged` 的文件行（已暂存后又修改）显示视觉标记点 + title 悬停提示，明确告知用户该文件同时存在未暂存改动
3. **提交认知保护**：通过以上两点消除「以为全部改动会进提交、实际提交的是暂存时快照」的静默误导风险

## 边界与约束

- 无数据损坏风险已确认（git 操作直连命令、commit 只提交 index 快照），本次仅做显示层增强，不动 `gitOutput.ts` 解析与 Manager 层
- 焦点刷新须防抖且在 `gitOpLoading` / `refreshingWorkingTree` 期间跳过，避免子进程风暴
- 卸载时清理监听器与防抖定时器，遵循项目实例销毁规范
- 验证走既有入口：`read_lints` + `pnpm typecheck` + `pnpm i18n:verify`，lint/build 由用户执行

## 技术栈

- 既有栈：Vue 3 Composition API + TypeScript + SCSS（零新依赖）
- 数据链路（已验证，无需改动解析层）：
`git status --porcelain` → `WorktreeOps.getWorkingTreeStatus` → `parseWorktreeStatus`（MM 双计数，正确）→ `useGitOps.loadWorkingTree` → `workingTrees[id]` → `ProjectCard` → `WorkingTreePanel`

## 实现方案

### 1. 焦点自动刷新（WorkingTreePanel.vue）

- 在 `<script setup>` 中用 `onMounted` / `onUnmounted` 对面板根元素（或 window）挂 `focusin` 监听
- **防抖 800ms**：连续点击/焦点切换合并为一次刷新；防抖定时器在 `onUnmounted` 清理
- **跳过条件**：`props.gitOpLoading || props.refreshingWorkingTree` 期间直接 return，防止与进行中的 git 操作竞争子进程
- 刷新复用既有 `emit("refreshWorkingTree")` 事件 → `ops.handleRefreshWorkingTree(project.id)`（`useRefreshOps.ts` 已有引用计数防并发），**零新增数据链路**
- WorkingTreePanel 仅在 worktree Tab 激活时挂载（CardTabs 懒挂载），天然不会在面板不可见时刷新
- 注意：提交信息 Textarea 获焦不触发重复刷新（focusin 只在焦点变化时触发一次，防抖兜底）

### 2. MM 行级标记（WorkingTreePanel.vue + WorkingTreePanel.scss）

- 文件行 `.wt-file-row` 内，当 `file.staged && file.unstaged` 时在状态图标或文件名旁渲染一个小标记点（复用 `.wt-unstaged` 同色系语义色 `$c-warning` 或 `--b3-theme-warning`）
- `:title` 挂 i18n 提示文案（如「该文件暂存后又发生了修改，提交不包含最新改动」）
- 样式写入 `WorkingTreePanel.scss`（面板壳专属样式，嵌套自有根类 `.wt-panel` 下，特异性安全）

### 3. i18n

- `src/i18n/zh_CN/gitPush.json` + `src/i18n/en_US/gitPush.json` 新增 1 个键（如 `stagedAndUnstagedTip`）
- **改完分片必须先 `pnpm i18n:merge` 再 `pnpm i18n:verify`**（合并文件才是运行时真源）

### 4. MEMORY.md 精简（前置任务）

- MEMORY.md 超长被截断：合并去重相关条目、删除过时信息，保留第 1-4 节防回归要点，控制体积在限制内

## 关键决策与权衡

- **focusin 而非 fs.watch**：fs.watch 需对每个项目目录建 watcher，跨平台（Windows）事件语义不稳、清理复杂；focusin 零成本复用既有刷新链路，符合「个人项目、手动操作为主」的定位
- **防抖而非节流**：用户切回面板通常只产生一次焦点事件，防抖足够；节流会引入不必要的状态机
- **不改解析层**：MM 双计数已正确，摘要条 `●1 ●1` 在刷新后会正确显示；行级标记是补充信息维度

## 执行注意事项

- ⚠️ `replace_in_file` 在 CRLF 文件上处理尾部空行会静默失效——改文件尾部先用 `JSON.stringify(s.slice(-30))` 确认行尾符，或用 node 脚本替换
- 监听器/定时器必须在 `onUnmounted` 清理，不留泄漏
- 不触碰 `gitOutput.ts` / `WorktreeOps.ts` / `useGitOps.ts`（blast radius 控制）
- 改动后跑 `read_lints`（注意区分陈旧诊断：回读代码核对）+ `pnpm typecheck` + `pnpm i18n:merge` + `pnpm i18n:verify`

## 目录结构

```
src/features/gitPush/
├── components/ListView/
│   └── WorkingTreePanel.vue      # [MODIFY] ① focusin 防抖自动刷新（onMounted/onUnmounted + emit refreshWorkingTree）
│                                  #         ② 文件行 MM 标记（file.staged && file.unstaged 时渲染标记点 + title i18n）
├── styles/
│   └── WorkingTreePanel.scss     # [MODIFY] 新增 .wt-mm-mark 标记点样式（语义色、尺寸对齐 12px 状态图标体系）
src/i18n/
├── zh_CN/gitPush.json            # [MODIFY] 新增 stagedAndUnstagedTip 键
└── en_US/gitPush.json            # [MODIFY] 同步新增英文文案
.codebuddy/memory/
└── MEMORY.md                     # [MODIFY] 精简去重（合并相关条目、删过时内容，修复超长截断）
```