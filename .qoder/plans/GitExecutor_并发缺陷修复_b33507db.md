# GitExecutor 并发缺陷修复

## 范围
仅修改 `src/features/gitPush/managers/GitExecutor.ts`（外部接口不变，调用方无需改动）。

## 核心修复

### 1. 队列项携带 reject，移除即拒绝（修僵尸 Promise）
- 队列项类型从 `{ run, signal }` 改为 `{ run, reject: (e: Error) => void, signal? }`
- `onAbort` 中过滤队列前，对被移除项逐一调用 `reject(new Error("操作已取消"))`
- `destroy()` 中清空队列前，对所有排队项调用 `reject(new Error("操作已取消"))`，注释同步修正

### 2. 早退路径接力调度（修池饿死/死锁）
- 提取私有方法 `scheduleNext(isNetwork: boolean)`：循环 shift 队列直到成功启动一个可运行项（跳过并 reject 已中止项）
- `run()` 的两个早退分支（`signal?.aborted`、`!cp`）reject 后调用 `scheduleNext(isNetwork)`，保证唤醒机会不被消耗
- 完成回调中原有的 `next.run()` 改为统一走 `scheduleNext`

### 3. maxBuffer 显式设为 10MB
- `execFile` options 增加 `maxBuffer: 10 * 1024 * 1024`，防止全量 diff / 大仓库 status 超过 Node 默认 1MB 报错
- 常量加中文注释说明用途（SCSS 魔法值注释规范同理适用于代码魔法值）

### 4. 正常完成时移除 abort 监听器
- 完成回调中调用 `signal?.removeEventListener("abort", onAbort)`

### 5. 网络命令识别跳过全局 flag
- 提取命令名时跳过前导 `-c <value>` / `-C <value>` 形式的全局参数对，再查 `NETWORK_COMMANDS`
- 保持现有调用方行为不变（当前命令均在 args[0]）

### 6. any 类型收紧
- 顶部增加 `import type { ChildProcess } from "node:child_process"`（type-only，编译期擦除，不影响动态加载）
- `Set<any>` → `Set<ChildProcess>`；execFile 回调 `error: any` → `Error & { code?: number } | null`（或 `ExecFileException`）；`d: any` → `Buffer | string`

## 验证
- 由用户执行 `npx tsc --noEmit` 类型检查（按项目约定 AI 不运行 lint/build）
- 手动场景回归：推送中点取消（进度应变 fail 且不挂起）、并发多项目推送、插件卸载时有排队任务

## 假设
- "操作已取消" 中文错误文案沿用现有先例，不做 i18n 化（与 useGitOps 审查结论一致）
