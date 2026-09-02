# gitPush 遗留边界问题修复计划（上轮审查「记录不修复」项转正）

## Summary

落实上轮 gitPush 审查报告中记录不修复的 3 个遗留项：

1. **remote 配置命令 `--` 分隔**（与 A 组 tag/conflict 修复同源，统一收口）
2. **`scanForGitRepos` 同步 BFS 改异步**（消除大目录扫描阻塞渲染进程）
3. **网络命令默认超时 30s → 120s**（GitExecutor 自动路由，用户已确认方案）

改动仅涉及 2 个文件：[RepoOps.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/RepoOps.ts)、[GitExecutor.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/GitExecutor.ts)。

## Current State Analysis（已探明）

- **remote 配置命令**（RepoOps.ts:73-95）：`addRemote`/`removeRemote`/`renameRemote`/`getRemoteUrl`/`setRemoteUrl` 共 5 处均未用 `--` 分隔，remote 名以 `-` 开头会被 git parse-options 当作选项。输入来源为 EditProjectDialog 的 `EditableRemoteList`（仅校验非空，不校验 `-` 开头）。
- **scanForGitRepos**（RepoOps.ts:186-237）：`readdirSync` 同步 BFS，MAX_DEPTH=8 / MAX_RESULTS=500 / SKIP_DIRS 黑名单 / 找到 `.git` 不下钻。唯一调用方 `useGitTagsConflicts.startScan`（composables/useGitTagsConflicts.ts:54-70）已带 `scanning` 加载态，签名不变则调用方零改动。
- **网络命令超时**：GitExecutor.execGit 的 `timeoutMs` 形参默认 30s；push/pull（RemoteOps.ts:149/:175）、fetchRemoteAt（:387）共 3 处网络执行点均走默认值；clone 显式 300s、rebase 显式 120s、ReportOps 显式 60s/10s 不受影响。网络命令识别已有 `NETWORK_COMMANDS` 集合（GitExecutor.ts:29）。

## Proposed Changes

### 1. remote 配置命令补 `--`（RepoOps.ts:73-95）

| 方法 | 现命令 | 修改后 |
|------|--------|--------|
| `addRemote` | `["remote", "add", name, url]` | `["remote", "add", "--", name, url]` |
| `removeRemote` | `["remote", "remove", name]` | `["remote", "remove", "--", name]` |
| `renameRemote` | `["remote", "rename", oldName, newName]` | `["remote", "rename", "--", oldName, newName]` |
| `getRemoteUrl` | `["remote", "get-url", name]` | `["remote", "get-url", "--", name]` |
| `setRemoteUrl` | `["remote", "set-url", name, url]` | `["remote", "set-url", "--", name, url]` |

加一行中文注释说明 `--` 防止 `-` 开头的 remote 名被解析为选项（与 createTag/deleteTag/resolveConflictFile 注释风格一致）。

### 2. scanForGitRepos 异步化（RepoOps.ts:186-237）

- 根目录校验：`fs.existsSync` 保留 + `fs.promises.stat` 判目录（try-catch，TOCTOU 容错沿用现有「路径不存在或不是目录」文案）。
- BFS 主体：`readdirSync` → `await fs.promises.readdir(dir, { withFileTypes: true })`，按**层**处理（每层 `Promise.all` 并行读各目录），保持现有语义不变：
  - SKIP_DIRS 黑名单、`entry.isSymbolicLink()` 跳过、`depth < MAX_DEPTH` 剪枝；
  - 目录含 `.git` → 计入 results 且该层不入队其子目录；
  - 单目录 readdir 失败 try-catch 跳过；`results.length >= MAX_RESULTS` 提前终止。
- 方法签名 `Promise<ScannedGitRepo[]>` 不变 → `startScan` 等调用方零改动；同步阻塞渲染进程问题消除。
- 不引入 worker_threads（扫描已受 MAX_DEPTH/MAX_RESULTS 约束，异步 fs.promises 足够；避免新增基础设施）。

### 3. GitExecutor 网络命令超时自动路由（GitExecutor.ts）

- 常量：新增 `private static readonly DEFAULT_TIMEOUT_MS = 30000` 与 `private static readonly NETWORK_TIMEOUT_MS = 120000`。
- `execGit` 签名：`timeoutMs = 30000` → `timeoutMs?: number`（不设默认），函数体首行计算：
  ```ts
  const effectiveTimeout = timeoutMs ?? (isNetwork ? GitExecutor.NETWORK_TIMEOUT_MS : GitExecutor.DEFAULT_TIMEOUT_MS)
  ```
- execFile 的 `timeout` 选项与错误文案中的 `${timeoutMs}ms` 改用 `effectiveTimeout`。
- 显式传参的调用方（clone 300s / rebase 120s / ReportOps 60s/10s）行为完全不变；push/pull/fetch/ls-remote 未传参时自动获得 120s。
- 更新 execGit 的 JSDoc：注明「网络命令默认 120s，本地命令默认 30s」。

## Assumptions & Decisions

1. 超时方案采用**执行器自动路由**（用户确认），不做用户可配置设置项（影响面大，如后续有需求再单独立项）。
2. 扫描异步化采用 `fs.promises` 层级并发，不引入 worker 基础设施。
3. remote 名不额外做前端输入校验——`--` 已消除选项歧义，非法 remote 名（含空格等）由 git 自身报错，与 A 组 tag 处理策略一致。
4. i18n 无新增键；无 UI 改动。

## Verification

1. `npx tsc --noEmit`（用户执行）— 类型检查通过
2. `pnpm lint`（用户执行）
3. 人工验证（用户执行）：
   - 编辑项目弹窗添加/改名/删除 remote 正常（含普通名回归）
   - 扫描导入大目录（如含 node_modules 的工程目录）时 UI 不卡顿，结果与之前一致
   - 弱网络下 push/fetch 不再在 30s 报「命令超时」，超时上限为 120s
