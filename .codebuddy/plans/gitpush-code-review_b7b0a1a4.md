---
name: gitpush-code-review
overview: 对 gitPush 功能进行代码审查，输出逻辑漏洞、冗余代码、内存泄漏风险的详细报告，包含问题位置、严重程度和修复建议。
todos:
  - id: deep-review
    content: 逐文件深度审查所有源文件（index.ts / GitPushManager.ts / utils.ts / types/*.ts / composables/*.ts），记录每个逻辑漏洞、冗余、泄漏点
    status: completed
  - id: cross-verify
    content: 对照 CODEBUDDY.md 和 CLAUDE_RULES.md 规范进行交叉验证，检查统一入口 API 使用合规性
    status: completed
    dependencies:
      - deep-review
  - id: aggregate-report
    content: 汇总发现，按严重程度（高/中/低）分级排序，生成结构化审查报告并写入 docs/gitPush-code-review.md
    status: completed
    dependencies:
      - cross-verify
---

## 审查范围

对 `src/features/gitPush/` 目录下所有源文件进行系统性代码审查，覆盖以下维度：

### 1. 逻辑漏洞

- 竞态条件（信号量并发、TOCTOU）
- 错误处理缺失或不当吞没（swallowed exceptions）
- 输入校验缺失
- 路径解析不一致

### 2. 冗余代码

- 重复函数/逻辑
- 死代码（不可达分支、未使用的函数/变量）
- 可合并的类型定义

### 3. 内存/资源泄漏风险

- 事件监听器未清理
- 定时器/延迟回调未取消
- ref / Map / Set 缓存无界增长
- Promise 永不 resolve（僵尸 Promise）
- 子进程残留

## 输出产物

一份结构化 Markdown 审查报告，保存至 `docs/gitPush-code-review.md`。每个问题包含：

- 严重程度（高/中/低）
- 文件路径 + 行号
- 问题描述
- 风险分析
- 修复建议

## 审查策略

### 审查流程

采用**逐文件渐进式审查**策略，分四步执行：

1. **逐文件深度分析**：按 index.ts → types/ → GitPushManager.ts → utils.ts → composables/*.ts 顺序逐个审读，记录每个发现（位置、类型、严重程度）
2. **交叉验证**：对照 CODEBUDDY.md 规范检查统一入口、API 使用合规性（如 PluginStorage/TypedStorage/事件总线 是否正确使用）
3. **汇总分级**：将发现按严重程度（高/中/低）聚合，合并同类项
4. **生成报告**：输出结构化 Markdown 文档

### 关键检查规则

| 检查维度 | 具体规则 |
| --- | --- |
| 竞态条件 | execGit 信号量 + gitWaitQueue 的正确性；并发 push/pull 的状态一致性 |
| 错误吞没 | catch 块中是否静默丢弃（无 log / 无 fallback）、fire-and-forget Promise |
| 死代码 | 未导出的函数/ref 是否被模板引用、if/else 分支是否等价 |
| 内存泄漏 | addEventListener 配对 removeEventListener、setInterval 配对 clearInterval、Map/Set 无清理上限 |
| 项目规范 | 是否使用统一入口（PluginStorage/TypedStorage）、是否直接调用 siyuan 框架底层 API |


### 已识别的高严重度问题（初步清单）

1. **GitPushManager.ts:479** — `checkPushStatus` catch 块使用 `project.path` 而非 `cwd`（resolved path），多设备路径场景下导致 git 命令在错误目录执行
2. **GitPushManager.ts:1070-1072** — `destroy()` 空实现，execGit 中等待队列的 Promise 永不 resolve，造成僵尸 Promise + 内存泄漏
3. **GitPushManager.ts:1015** — `heuristicCommitMessage` 返回 `type: "types"`，不是 Conventional Commits 有效值

### 已识别的中严重度问题（初步清单）

1. **useGitOps.ts:93-96** — `getUsedPath()` if/else 分支返回值相同，死代码
2. **index.vue:1956-1966** — `openRemoteConfig` 函数从未被模板调用，连带 ref `remoteConfigProject`/`editingRemoteName`/`editingRemoteUrl` 为死代码
3. **useGitOps.ts:119/134/146/160** — push/pull 操作中 `loadPushStatus(id)` 为 fire-and-forget，错误被静默吞没
4. **index.vue:1367** — `setTimeout` 200ms 延迟无 `onUnmounted` 清理，组件销毁后仍可能修改响应式状态
5. **index.vue:990-994 / useGitOps.ts:18-25** — `pruneCache` 与 `pruneRecordCache` 重复逻辑
6. **useIdeManagement.ts:212-216** — `isCmdAvailable` 中 ENOENT 以外的 spawn 错误返回 true，误判命令可用
7. **useGitTagsConflicts.ts:115-124** — `importScanResults` 静默导入，成功/失败无反馈且不刷新项目列表

### 已识别的低严重度问题（初步清单）

1. **index.vue:1230** — `lastRefreshTime` Map 无清理上限（有界于项目数但理论持续增长）
2. **useProjectFilters.ts:47-49** — 自行创建 PluginStorage 实例而非复用 manager 的统一存储
3. **index.vue:1434-1436** — 使用 `alert()` 而非插件通知系统
4. **index.vue:1257-1262** — `newRemoteName`/`newRemoteUrl` ref 仅被 `openRemoteConfig` 使用（该函数为死代码），连带冗余