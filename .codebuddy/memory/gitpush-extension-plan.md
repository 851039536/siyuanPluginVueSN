# GitPush 功能扩展计划

> 生成日期: 2026-06-17 | 基于当前 21 文件 / ~7000 行代码审查

## 总览

| # | 功能 | 优先级 | 预估工作量 | 风险 |
|---|------|--------|-----------|------|
| 1 | 快捷操作工具栏 | P1 高 | 2h | 低 |
| 2 | Git Tag 管理 | P2 中 | 3h | 中 |
| 3 | 冲突检测与解决引导 | P2 中 | 2h | 低 |
| 4 | 项目组/工作区 | P3 低 | 4h | 高 |
| 5 | 提交信息模板 | P3 低 | 1.5h | 低 |

---

## 1. 快捷操作工具栏（P1 高）

### 场景
列表视图每个项目卡片底部有 6-8 个操作按钮（拉取/推送/stash/配置/编辑/删除），高频操作（拉取全部、推送全部）需要展开卡片才能看到。

### 方案
在卡片顶部名称行右侧新增 3 个快捷图标按钮（Hover 时显示）：
- **拉取全部**（`mdi:source-pull`）：仅在有远程且需要拉取时显示
- **推送全部**（`mdi:cloud-upload`）：仅在需要推送时高亮显示
- **Stash 快速暂存**（`mdi:archive-outline`）：有未提交变更时显示

点击后立即执行，使用 `withConfirm` 可选确认。

### 所需修改
- `index.vue` 卡片模板：名称行右侧新增 3 个图标按钮
- `styles/index.scss`：`.gp-card-quick-actions` 样式（opacity 0 → hover 1 过渡）
- 无需新增文件

### 收益
- 减少 80% 的卡片展开操作
- 推送/拉取从"展开卡片 → 找到按钮 → 点击"简化为"hover → 点击图标"

---

## 2. Git Tag 管理（P2 中）

### 场景
项目发版时需要打 tag（如 `v1.2.0`），当前只能通过命令行操作。

### 方案
在工作区面板下方新增 "Tag 管理" 折叠区：
- **创建 Tag**：输入 tag 名称（带快捷键版本号建议 `vX.Y.Z`），可选 message 注解标签
- **Tag 列表**：显示本地 tags（`git tag -l --sort=-creatordate`），最多 10 条
- **推送到远程**：tag 列表每项有推送按钮（`git push <remote> <tag>`）
- **删除 Tag**：确认后删除本地 tag（`git tag -d <name>`）

### 所需修改
- **`types/index.ts`**：新增 `getTags(path)`、`createTag(path, name, message?)`、`deleteTag(path, name)` 方法
- **`composables/useGitPush.ts`**：新增 `loadTags`/`createTagOp`/`deleteTagOp`/`pushTag` 方法 + tags ref
- **`index.vue`**：工作区面板下方新增 Tag 折叠区模板
- **`components/TagPanel.vue`** [NEW]：Tag 列表 + 创建表单组件
- **`styles/TagPanel.scss`** [NEW]
- **i18n**：zh_CN/en_US gitPush.json 新增 12 键

### 收益
- 覆盖发版工作流的关键缺失环节
- 配合推送功能实现完整 release 操作

---

## 3. 冲突检测与解决引导（P2 中）

### 场景
拉取（pull）操作遇到 merge conflict 时，用户只看到错误输出，不知道如何解决。

### 方案
在 `pullToAll`/`pullSingle` 的 catch 中检测冲突关键词（`CONFLICT`、`Automatic merge failed`）：
- 解析冲突文件列表（`git diff --name-only --diff-filter=U`）
- 在工作区面板顶部显示冲突警告条：红色背景 + 冲突文件列表 + 三个操作按钮

**冲突解决操作**：
1. **中止合并**（`git merge --abort`）：恢复到 pull 前状态
2. **保留远程版本**（`git checkout --theirs <file>`）：逐个文件解决
3. **打开冲突文件**：调用 `shell.openPath` 在编辑器中打开

### 所需修改
- **`types/index.ts`**：新增 `checkConflicts(path)`、`abortMerge(path)`、`resolveFile(path, file, strategy)` 方法
- **`composables/useGitPush.ts`**：新增 `conflicts` ref + `loadConflicts`/`abortMerge`/`resolveFile` 方法
- **`index.vue`**：卡片内新增冲突警告条模板
- i18n 新增 10 键

### 收益
- 用户不再需要切到命令行处理冲突
- 降低 Git 使用门槛

---

## 4. 项目组/工作区（P3 低）

### 场景
用户同时维护多个项目的多个分支（如 `feature-a` 在项目 A、B、C 都需要修改），需要逐个切换分支执行相同操作。

### 方案
新增"项目组"概念，允许用户将多个项目分组为一个工作区：
- **创建项目组**：命名 + 多选项目 + 可选指定分支
- **批量操作**：选中项目组 → 对组内所有项目执行：切换分支、拉取、推送、stash
- **项目组面板**：折叠列表显示各组，展开显示成员项目 + 批量操作按钮

### 所需修改
- **`types/storage.ts`**：新增 `ProjectGroup` 接口 + `groups` TypedStorage
- **`types/index.ts`**：新增 `createGroup`/`deleteGroup`/`batchSwitchBranch`/`batchPull`/`batchPush` 方法
- **`composables/useProjectGroups.ts`** [NEW]
- **`components/GroupPanel.vue`** [NEW]
- **`index.vue`**：左侧新增项目组列表侧边栏（宽度 ~200px）
- i18n 新增 20 键

### 收益
- 覆盖多项目管理场景
- 批量操作提升效率 3-5x

### 风险
- 改动较大（涉及布局调整）
- 批量操作失败处理复杂（部分成功/部分失败的状态展示）

---

## 5. 提交信息模板（P3 低）

### 场景
AI 生成提交信息有时不理想，用户希望有预设模板可快速选择。

### 方案
在工作区面板提交区新增"模板"下拉：
- 预置 5 个模板：`feat:`、`fix:`、`chore:`、`refactor:`、`docs:`
- 可自定义 3 个用户模板（存储到 TypedStorage）
- 选择模板后自动填充提交信息输入框前缀
- 模板支持占位符：`{branch}` → 当前分支名，`{files}` → 变更文件数

### 所需修改
- **`types/storage.ts`**：新增 `CommitTemplate` 接口 + templates TypedStorage
- **`components/WorkingTreePanel.vue`**：提交表单区域新增模板下拉
- i18n 新增 5 键

### 收益
- 规范化提交信息格式
- 减少手动输入

---

## 实现策略建议

### 第一期（本周）
- **快捷操作工具栏**（P1）：投入产出比最高，减少高频操作步骤
- **冲突检测**（P2）：用户痛点明确，代码改动小

### 第二期（下周）
- **Tag 管理**（P2）：完善发版工作流
- **提交信息模板**（P3）：改动小，快速交付

### 第三期（后续）
- **项目组/工作区**（P3）：复杂功能，需充分测试
