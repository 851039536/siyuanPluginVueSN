---
name: gitPush-ListView-architecture-review
overview: 审查 gitPush ListView 目录三层组件架构（index→ProjectCard→叶子）确认其合理性，并对审查发现的过度膨胀组件（CardHeader 操作按钮区、ProjectCard 内嵌 Tab 切换条、WorkingTreePanel 提交表单区）做拆分瘦身，同步修复 ConflictSection/BranchCommitList 的 i18n 硬编码兜底违规。
todos:
  - id: split-card-header-actions
    content: 拆分 CardHeader 操作按钮区为 CardHeaderActions.vue（自包含 services/menu，样式同步迁出）
    status: completed
  - id: extract-card-tabs
    content: 提取 ProjectCard 内嵌 Tab 条为 CardTabs.vue（含计数徽标，样式迁出 index.scss）
    status: completed
  - id: simplify-output-panels
    content: 删除 ProjectCard outputPanels computed，直接渲染 pull/push 两个 OutputPanel
    status: completed
  - id: fix-i18n-violations
    content: 修复 ConflictSection 兜底与 BranchCommitList 硬编码中文，i18n 分片补 3 键
    status: completed
  - id: update-readme-verify
    content: 更新 gitPush README 目录结构并完成 lint/tsc 自检
    status: completed
    dependencies:
      - split-card-header-actions
      - extract-card-tabs
      - simplify-output-panels
      - fix-i18n-violations
---

## 用户需求

- 用户对 `src/features/gitPush/components/ListView/` 目录结构提出疑问：index.vue 只组合 ListViewToolbar 与 ProjectCard，但目录下组件很多，是否合理。
- 澄清后用户选择：**先审查再定方案**，由我给出整体架构审查结论与具体调整建议后再定实施。

## 审查结论（已通读全部 14 个文件）

- **三层结构合理**：`index.vue`（列表容器：工具栏 + v-for 卡片）→ `ProjectCard.vue`（卡片编排层）→ 叶子组件（CardHeader/CardRemotes/CardActionBar/WorkingTreePanel/BranchCommitList/StashSection/TagPanel/ConflictSection/OutputPanel 及其下级弹窗）。无孤儿组件，全部 14 个组件均有引用链。index 只引用 2 个组件是正确抽象，不是缺陷。
- **核心调整方向为"层级内瘦身"而非"去层级"**：`ProjectCard` 不可取消（v-for 内无法调用组合式函数，卡片数据必须按项目实例化）。
- **发现的问题**：

1. `CardHeader.vue`（约 480 行）超 300 行警戒线——右侧操作按钮区（分类/平台/IDE/刷新/编辑/Git 配置/删除）应拆出独立组件。
2. `ProjectCard.vue` 内嵌 4-Tab 切换条（CHANGES/LOG/STASH/TAG + 计数徽标）可提取为独立组件。
3. `ProjectCard` 的 `outputPanels` computed 用数组 v-for 渲染仅 2 个 OutputPanel，可直写两处简化。
4. **i18n 硬编码违规**（违反 AGENTS.md 禁止 `{{ i18n.xxx || '中文兜底' }}` 与硬编码中文）：`ConflictSection.vue` 4 处兜底、`BranchCommitList.vue` 5 处硬编码中文。
5. `StashSection` 与 `TagPanel` 模式相似但仅 2 处（Rule of Three），暂不抽象。

## 技术栈

- 复用现有 Vue 3 + TypeScript + SCSS 组合式 API 模式，零新增依赖。
- 遵循项目 AGENTS.md 硬规则：SCSS 分离到 styles/ 目录、文件头注释、i18n 只改分片文件、i18n 中文注释、Codex 设计 Token。

## 实施方案（纯重构，行为零变化）

### 1. 拆分 CardHeader 操作按钮区 → CardHeaderActions.vue

- 新建 `components/ListView/CardHeaderActions.vue`：props 仅 `project: GitProject`，**自包含**——内部自调 `useCardServices`（取 shared/ops/isRefreshing）与 `useCardMenu`（inject 现有互斥菜单状态），迁移 `platformLinks`/`uniqueCustomIdes`/`projectPath` computed 与全部操作按钮模板（分类下拉、平台/IDE/刷新菜单、编辑/Git 配置/删除按钮）。
- `CardHeader.vue` 瘦身至 300 行内：仅保留信息区（星标/名称/路径/md 徽章折叠/分支/备注）+ 引用 CardHeaderActions。
- 样式：新增 `styles/CardHeaderActions.scss` 承载 `.gp-card-actions`/`.gp-cat-select`/`.gp-platform-*`/`.gp-ide-*`/`.gp-refresh-*`；`CardHeader.scss` 保留信息区样式。共享样式（如 `.gp-caret-icon` 被 CardActionBar 复用）保留在 `CardHeader.scss` 或迁至 `_shared.scss`，禁止重复定义（执行时确认 CardActionBar.scss 是否已含该样式）。

### 2. 提取 ProjectCard 的 Tab 切换条 → CardTabs.vue

- 新建 `components/ListView/CardTabs.vue`：props 为 `modelValue`（worktree/log/stash/tag）+ 4 个计数（变更数、log/stash/tag 数），emit `update:modelValue`；模板即现有 tab-bar（含计数徽标）。
- `ProjectCard.vue` 只保留 Tab 状态 ref 与 4 个面板的 v-if 切换。
- 样式：新增 `styles/CardTabs.scss` 承载 `.gp-stash-tag-tabs`/`.gp-stash-tag-tab-bar`/`.gp-stash-tag-tab`/`.gp-stash-tag-tab-count`，并从 gitPush `styles/index.scss` 移除对应规则（执行时确认无其他消费方）。

### 3. 简化 ProjectCard 的 outputPanels

- 删除 `outputPanels` computed 与 `PushOutputEntry` 类型导入，模板改为直接写两个 `<OutputPanel :key="'pull'" ...>` 与 `<OutputPanel :key="'push'" ...>`（OutputPanel 内部已有 `v-if="lines.length"` 空态控制，行为不变）。

### 4. 修复 i18n 硬编码违规

- `ConflictSection.vue`：移除 4 处 `|| '中文兜底'`（键 conflictDetected/keepOurs/keepTheirs/abortMerge 在 gitPush.json 分片已存在，直接删兜底）。
- `BranchCommitList.vue`：
- `title="刷新提交日志"` → `i18n.refreshCommitLog`（键已存在）
- `加载中...` → `i18n.loading`（键已存在）
- 新增分片键（zh/en 同步）：`commitSearchPlaceholder`（搜索提交信息... / Search commit messages...）、`commitListEmpty`（暂无提交记录 / No commits yet）、`commitListNoMatch`（无匹配结果 / No matching commits）
- 模板每处 i18n 键上方补中文 HTML 注释（符合 i18n 注释规范）。
- 禁止手动改合并 JSON（zh_CN.json/en_US.json 由 merge-i18n 构建时生成）。

## 性能与可靠性

- 纯结构拆分，无运行时行为变化、无新增依赖、无数据流改动；卡片渲染路径不变。
- 拆分后各组件均通过现有 `useCardServices`/`useCardMenu` 注入，数据源单一，不引入重复状态。

## 目录结构（本次涉及文件）

```
src/features/gitPush/
├── components/ListView/
│   ├── CardHeader.vue          # [MODIFY] 瘦身：仅信息区 + 引用 CardHeaderActions
│   ├── CardHeaderActions.vue   # [NEW] 顶栏操作按钮区（自包含 useCardServices/useCardMenu）
│   ├── CardTabs.vue            # [NEW] 4-Tab 切换条 + 计数徽标
│   ├── ProjectCard.vue         # [MODIFY] 用 CardTabs 替换内联 tab-bar；outputPanels 直写两处
│   ├── ConflictSection.vue     # [MODIFY] 移除 4 处 i18n 中文兜底
│   └── BranchCommitList.vue    # [MODIFY] 硬编码中文改 i18n 键
├── styles/
│   ├── CardHeaderActions.scss  # [NEW] 操作按钮区样式（自 CardHeader.scss 迁出）
│   ├── CardTabs.scss           # [NEW] Tab 条样式（自 index.scss 迁出）
│   ├── CardHeader.scss         # [MODIFY] 仅信息区样式
│   └── index.scss              # [MODIFY] 移除 .gp-stash-tag-tab* 规则（确认无其他消费方）
├── README.md                   # [MODIFY] 目录结构补充新组件
└── src/i18n/{zh_CN,en_US}/gitPush.json  # [MODIFY] 新增 3 个键
```