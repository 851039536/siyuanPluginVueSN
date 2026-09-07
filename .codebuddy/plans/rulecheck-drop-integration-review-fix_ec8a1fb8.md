---
name: rulecheck-drop-integration-review-fix
overview: 修复删除功能集成审查发现的 2 处问题：index.vue 文件头注释过时（仍写"修正弹窗"，实际挂载 3 个弹窗）、删除按钮复用 .grc-item-fix 类名语义不符（应为 .grc-item-drop）。
todos:
  - id: fix-index-comments
    content: 更新 CommitRuleCheck/index.vue 文件头与 script 顶部两处注释为「修正/删除/批量修正弹窗」表述
    status: completed
  - id: fix-drop-btn-class
    content: ViolationListSection.vue 删除按钮改用 grc-item-drop 类名，CommitRuleCheckPanel.scss 合并声明 .grc-item-fix 与 .grc-item-drop 共用规则
    status: completed
---

## 需求描述

将「AI 深度分析修正提交信息」的输出格式从"一句话"升级为多行结构化格式，参考用户样例：

```
feat(gitPush): 实现提交规则违规的批量修正功能，包含：

- 违规列表新增全选/批量修正入口与多选交互
- 新增批量修正弹窗，支持AI批量生成、逐条保存与进度展示
- 新增merge提交检测逻辑，标记不可修正的merge提交
- 补充多语言文案与样式文件
- 优化同项目多违规的处理顺序，避免链式修正失效
```

即：第一行为 Conventional Commits 标题行（type(scope): 中文描述），空行后为逐条要点列表，概括 diff 中的主要改动维度。

## 范围与边界

- 仅改 AI 深度分析（`deepAnalyzeCommitFix`）；普通「AI 生成修正」（`generateCommitFix`，基于统计摘要的单行版）保持不变
- 已验证多行链路兼容，下游零改动：
  - `checkCommitRule` 仅校验开头 type 前缀 + 冒号分隔 + 描述含中文，多行 body 兼容（生成侧已有 `.trim()` 满足首尾空白规则）
  - `amendCommitMessage`（`commit --amend -m`）与 `HistoryRewriter.rewriteMessage`（commit-tree）均以字符串参数传递，git 保留换行
  - `CommitFixDialog` 的 `newMessage` textarea（rows=4）可滚动展示多行

## 技术方案

### 修改点（集中于 `src/features/gitPush/managers/CommitMsgGenerator.ts` 的 `deepAnalyzeCommitFix`）

1. **user prompt 重写**：
   - 明确输出格式：第一行 `type(scope): 中文标题`（type 限 COMMIT_TYPE_VALUES；scope 可选；标题概括核心改动意图）
   - 空一行后输出 `- ` 要点列表，3~6 条，覆盖 diff 中的主要改动维度（新增功能/修复/文案/样式/优化等）
   - 给出具体格式示例（对照用户样例），强调：以 diff 实际改动为准、不要输出解释/Markdown 代码块、不要用 ``` 包裹
2. **systemPrompt 同步**：改为"第一行输出 conventional commit 标题，随后空一行输出改动要点列表"
3. **maxTokens：60 → 600**（多行要点列表需要更多输出空间）
4. **校验逻辑零改动**：`checkCommitRule(trimmed)` 多行兼容已验证，校验失败/异常仍降级启发式单行结果（`fixCommitMessageHeuristically`）
5. **temperature 0.1 保持**（格式稳定性优先）

### 性能与回归

- 仅 prompt/参数调整，无 UI、无链路、无持久化改动；多行输出经 `--amend -m`（单 argv 参数保留换行）与 commit-tree 重写均正常落盘
- 若 AI 输出格式偶发不合格，降级为单行启发式结果，功能不中断

### README（可选同步）

- `src/features/gitPush/README.md` 提交历史条目中深度分析描述补充"多行要点格式"表述
