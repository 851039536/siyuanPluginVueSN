# gitPush git 底层调用优化 — 审查报告

审查范围：最近两个 git 底层调用提交

| 提交 | 标题 |
| --- | --- |
| `45ee198e` | refactor(git-ush): 移除工作区状态快速路径改为单次读取 |
| `44aac3e7` | refactor(git-ush): 批量读取远程 ahead/behind 减少 git 进程调用 |

方法：逐项读码 + 真实 git 仓库实测 + 控制流实验 + 运行提交自带单测

## 结论摘要

| 严重度 | 数量 | 说明 |
| --- | --- | --- |
| Critical | 0 | — |
| High | 1 | `for-each-ref` 整体失败时丢失 error 路径，故障被伪装成「未建立上游」 |
| Medium | 0 | — |
| Low | 1 | 调用方串行 await 使懒加载失去意义（无正确性影响） |

`45ee198e` **未发现问题**：纯移除净负收益路径，语义经比对完全一致。

## High：`for-each-ref` 失败被误判为 noUpstream（44aac3e7 引入）

### 现象

新实现 `readRemoteAheadBehind`（RemoteOps.ts L519-541）的 `catch` 返回**空映射**：

```ts
} catch {
  return new Map()
}
```

而调用方（L492-503）把「映射里没有该 ref」一律判定为 `noUpstream`：

```ts
const counts = aheadBehindByRef.get(refName)
if (counts) { ...noUpstream: false... }
// 该远程跟踪 ref 不存在 → noUpstream
const count = await headCommitCount()
results.push({ key, result: { ahead: count, behind: 0, noUpstream: true }, ahead: count })
```

于是 `for-each-ref` **整体失败**（仓库损坏、瞬时 IO 错误、git 异常）与
「该远程确实没有上游分支」两种截然不同的情形，产生了**同一个结果**。

### 与旧实现的差异

旧实现逐远程 `rev-list`，对失败做了二分类（见 `44aac3e7` 删除的代码）：
非 noUpstream 的异常写入 `result.error = errMsg`，UI 可呈现失败。

实测对照（模拟「远程存在但 git 报真实错误」）：

```
旧实现：
  github: {"ahead":0,"behind":0,"noUpstream":false,"error":"fatal: unable to read tree object"}
  gitee : {"ahead":0,"behind":0,"noUpstream":false,"error":"fatal: unable to read tree object"}
  → 携带 error，可提示失败

新实现：
  github: {"ahead":17,"behind":0,"noUpstream":true}
  gitee : {"ahead":17,"behind":0,"noUpstream":true}
  → 无 error，且 ahead 被填成本地提交总数
```

### 影响放大

`noUpstream` 在全仓库被当作「需要推送」消费：

- `utils/platform.ts:75` — `return rs.noUpstream || rs.ahead > 0`
- `composables/usePushStatusView.ts:16` — `if (rs.noUpstream) return \`+${rs.ahead}\``

故一次失败会让 UI 声称用户**每个远程都领先 17 个提交**，
而 `RemoteOps.ts:238` 的智能跳过判据 `!rs.noUpstream` 也因此不再跳过，
触发一次本不该发生的推送流程。用户看到的不是错误，而是误导性的「待推送」状态。

### 建议

`readRemoteAheadBehind` 需要把「整体失败」与「无匹配 ref」区分开，例如返回
`{ ok: boolean, map: Map<...>, error?: string }`；调用方在 `!ok` 时把 `error`
写入各远程的 `result.error`（沿用 `pathWarning` 在 L455-460 的既有呈现方式），
而不是落入 `noUpstream` 分支。

### 测试缺口

`aheadBehind.git.spec.ts`（6 个用例）覆盖了同步 / 领先 / 分叉 / 多远程 /
noUpstream / 精确匹配，**但未覆盖 `for-each-ref` 整体失败**这一分支 ——
回归正是从这里漏出的。

## Low：串行 await 使懒加载优化失效（44aac3e7）

旧实现用 `Promise.all(remoteChecks)` 并发；新实现改为 `for` 循环内
`await headCommitCount()`（L493-503）。

由于 `headCommitCountPromise` 有缓存，后续远程复用同一 Promise，**正确性无损**；
但首个 noUpstream 远程会阻塞循环直到该进程返回，而原生并发版本不会。
注释称「HEAD 提交数（懒加载：仅在确有 noUpstream 远程时才发这次进程）」，
该目标仍达成，只是并发度从 N 降为 1。

当前实现下各远程的 `.get()` 是纯内存操作，串行本身开销可忽略，
故仅记为 Low；若要恢复并发，可先算出全部 `counts` 再 `Promise.all` 补齐 noUpstream 项。

## 已验证正确的关键实现

- **`<behind> <ahead>` 字段顺序（最高风险点）** — 用真实分叉仓库实测确认：
  `rev-list --left-right --count HEAD...up/main` 输出 `1 2`（ahead=1, behind=2），
  而 `for-each-ref` 输出 `2 1`（即 behind 在前）。代码解析 `parts[0]=behind`、
  `parts[1]=ahead` **正确**，源码注释中「切勿按直觉颠倒」的警告是有据的，
  且 `aheadBehind.git.spec.ts` 有专门的「防止 behind/ahead 颠倒」用例。
- **NUL 分隔解析** — 用 `%00` 而非空格分隔 refname 与计数，分支名含空格时不会错位。
- **ref 精确匹配** — 实测 `endsWith('/'+branch)` 过滤 + 调用方按
  `${remoteName}/${branch}` 精确查找的组合：分支名含斜杠（`feature/x`）、
  同前缀分支（`feature-main` vs `main`）、非平台远程均不会互相污染。
- **`45ee198e` 全量** — `fastWhenClean` 快速路径确为净亏（探测 250ms 与全量 255ms 同价，
  合计 505ms ≈ 单次 2 倍），移除后语义一致；`fastWhenClean` 形参保留为 no-op，
  在 `useGitOps.ts` / `cardServices.ts` / `index.vue` / `queryScheduler.ts` 各处均有
  「兼容保留（当前 no-op）」注释，无遗漏调用方。

## 测试

```
npx vitest run aheadBehind.git.spec.ts worktreeFastPath.git.spec.ts gitOutput.spec.ts
→ Test Files 3 passed / Tests 79 passed
```
