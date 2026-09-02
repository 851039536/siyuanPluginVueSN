# gitPush 在任意 commit 上打 Tag

## Summary

在 gitPush 项目卡片 LOG Tab（BranchCommitList）中新增两个能力：

1. **行内显示已有 Tag**：每条提交记录旁显示该 commit 已命中的 Tag 徽标（tag→hash 映射查询）。
2. **弹窗打 Tag**：每条提交 hover 显示"打 Tag"入口，点击弹出对话框输入 Tag 名 + 可选注解，在指定 commit 上创建 Tag（`git tag <name> <hash>`）。

## Current State Analysis

- `RepoOps.createTag`（[RepoOps.ts#L31](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/RepoOps.ts#L31)）只支持在 HEAD 打 Tag，无 commitRef 参数。
- Tag 数据链路：`useCardData.loadTags` → `manager.getTags(path())`（limit 默认 10，仅取最新 10 条）→ TagPanel 展示。
- Tag 写操作链路：`useGitHandlers.handleCreateTag` → `useGitTagsConflicts.createTagOp` → `GitPushManager.createTag`（`writeLock.runExclusive`）→ `RepoOps.createTag`；成功后 `bumpCardRefresh(id, "tags")` 经 cardRefreshSignals 触发卡内 `loadTags` 重载。
- 提交列表 [BranchCommitList.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/ListView/BranchCommitList.vue) 无 Tag 展示与打 Tag 入口；`CommitLogEntry.hash` 为 7 位短 hash，可直接作为 git tag 的 commitRef。
- 弹窗范式参考 [CommitFixDialog.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/common/CommitFixDialog.vue)：Teleport + `gp-mask`/`gp-dialog`（styles/index.scss 全局）、Esc 关闭、`i18n` prop、保存中 loading 态。
- i18n 分片 `src/i18n/{zh_CN,en_US}/gitPush.json` 为编辑源，`pnpm i18n:merge` 合并到聚合文件，`pnpm i18n:verify` 校验。

## Proposed Changes

### 1. 数据层：`managers/RepoOps.ts`

- `getTags` 的 `--format` 追加两段：`%1f%(*objectname)%1f%(objectname)`；解析时 `hash = *objectname || objectname`（annotated tag 取解引用后的 commit hash，lightweight tag 的 objectname 即 commit hash）。
- `createTag` 增加可选参数 `commitRef?: string`，追加到参数尾部：
  - 有注解：`["tag", "-m", message, "--", name, commitRef]`
  - 无注解：`["tag", "--", name, commitRef]`
  - `commitRef` 在 `--` 之后，不存在选项注入面。

### 2. 类型：`types/storage.ts`

- `TagInfo` 增加 `hash?: string`（Tag 指向的 commit hash，可选，向后兼容）。

### 3. Manager：`GitPushManager.ts`

- `createTag(projectPath, name, message?, commitRef?)` 透传 `commitRef`，仍包在 `writeLock.runExclusive` 内。

### 4. Composables

- `useGitTagsConflicts.createTagOp(id, name, message?, commitRef?)` 透传。
- `useGitHandlers.handleCreateTag(id, name, message?, commitRef?)` 透传（含第 26 行类型声明）；成功后已有 `bumpCardRefresh(id, "tags")`，自动重载 tags + 映射。

### 5. 卡片数据：`composables/useCardData.ts`

- `loadTags` 改为一次拉取大 limit（`manager.getTags(path(), 500)`，防异常大仓库失控），派生：
  - `tags.value = all.slice(0, 10)`（TagPanel 展示行为不变）
  - 新增 `tagCommitMap = ref<Map<string, string[]>>`：hash → Tag 名数组，由全量列表构建
- 导出 `tagCommitMap`；tags 域刷新信号触发 `loadTags` 时映射同步更新。

### 6. 提交列表：`components/ListView/BranchCommitList.vue` + `styles/BranchCommitList.scss`

- 新 prop `tagCommitMap?: Map<string, string[]>`。
- 每行 hash 之后渲染 Tag 徽标（`mdi:tag-outline` + 名字，超过 1 个时 `title` 显示全部）。
- 每行 hover 显示"打 Tag"按钮（`mdi:tag-plus-outline`，`title = i18n.createTag`，样式仿 `.bcl-refresh-btn` hover 显隐），点击 `emit("addTag", entry)`。

### 7. 新组件：`components/common/TagCommitDialog.vue` + `styles/TagCommitDialog.scss`

- 仿 CommitFixDialog 骨架：Teleport + `gp-mask`（点击 self 关闭）+ `gp-dialog` + Esc 关闭。
- 内容（精简）：
  - 标题：`i18n.tagOnCommitTitle`（"在此提交上打 Tag"）
  - 元信息行：项目名 + commit hash（复用 `gp-fix-meta`/`gp-fix-hash` 样式思路）
  - 该提交已有 Tag 徽标列表（无则不显示区块）
  - Tag 名输入（placeholder 复用 `tagNamePlaceholder`，Enter 提交、空名禁用确认）
  - 注解输入（placeholder 复用 `tagMsgPlaceholder`）
- 确认按钮 loading 态由父层传入（`creating` prop），emit `create: [name, message]` 与 `close: []`。
- 样式对齐 gitPush 范式：background/surface 层级、遮罩 `rgba(0,0,0,0.5)` 无 backdrop-filter、过渡 0.12s ease、`$vp-mono` + `tabular-nums` 数值文本。

### 8. 编排：`components/ListView/ProjectCard.vue`

- 新增 `taggingEntry = ref<CommitLogEntry | null>(null)` 与 `tagCreating = ref(false)`。
- BranchCommitList 增加绑定：`:tag-commit-map="tagCommitMap"`、`@add-tag="taggingEntry = $event"`。
- 渲染 TagCommitDialog（`v-if="taggingEntry"`），`@create` → `ops.handleCreateTag(project.id, name, message, entry.hash)`，成功后关闭弹窗；`@close` 清空。

### 9. i18n：`src/i18n/{zh_CN,en_US}/gitPush.json` + `pnpm i18n:merge`

新增键（zh / en 成对）：
- `tagOnCommitTitle`："在此提交上打 Tag" / "Tag This Commit"
- `tagOnCommitHash`："提交" / "Commit"（弹窗元信息标签）
- `commitTagsLabel`："已有 Tag" / "Existing Tags"
- 失败提示复用 `createTagFailed`；按钮复用 `createTag`；输入框复用现有 placeholder 键。

## Assumptions & Decisions

- 仅 LOG Tab 提供打 Tag 入口；TagPanel 保持现状（最新 10 条 + HEAD 打 Tag）。
- tag→hash 映射上限 500 个 Tag（与扫描 MAX_RESULTS 防失控思路一致），超大仓库截断可接受。
- 重复 Tag 名不做前端预校验，由 git 报错经 `safeGitOp` 走 `createTagFailed` 提示。
- 短 hash（7 位）作为 commitRef 在同仓库内唯一性足够（git 自身语义）。
- 弹窗不引入 ConfirmDialog 二次确认（打 Tag 无破坏性，仅本地引用新增）。

## Verification

1. `pnpm lint`、`npx vue-tsc --noEmit` 通过。
2. `pnpm i18n:merge` 后 `pnpm i18n:verify` 键同步通过。
3. 手工回归：
   - LOG Tab 非 HEAD 提交打 Tag（带/不带注解），Tag Tab 与行内徽标同步出现。
   - HEAD 上打 Tag、重复 Tag 名失败提示、Esc/遮罩关闭弹窗。
   - TagPanel 原有行为（最新 10 条、推送/删除/刷新）不回归。
