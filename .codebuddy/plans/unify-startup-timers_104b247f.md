---
name: unify-startup-timers
overview: 统一程序启动定时器入口：新建 timerRegistry 统一注册/生命周期工具，改造 4 处启动定时器（s3Backup/pageLock/DocCountManager/BookmarkMarker），并新增硬规则"新定时任务必须走统一入口"写入 AGENTS.md 与 AGENTS_API.md。
todos:
  - id: create-timer-registry
    content: 新建 src/utils/timerRegistry.ts，实现 TimerRegistry 类的 setInterval/setTimeout/clear/clearAll
    status: completed
  - id: refactor-s3backup
    content: 改造 s3Backup/index.ts 定时器接入 TimerRegistry，保留调度状态机逻辑不变
    status: completed
    dependencies:
      - create-timer-registry
  - id: refactor-pagelock-doccount
    content: 改造 pageLock/index.ts 与 DocCountManager.ts 定时器接入 TimerRegistry
    status: completed
    dependencies:
      - create-timer-registry
  - id: refactor-bookmark
    content: 改造 BookmarkMarker.ts 三个定时器接入 TimerRegistry，保留有界轮询语义
    status: completed
    dependencies:
      - create-timer-registry
  - id: update-rules
    content: 在 AGENTS.md 统一入口表格与硬规则、AGENTS_API.md 新增定时任务统一入口规则
    status: completed
    dependencies:
      - create-timer-registry
  - id: arch-verify
    content: 使用 [skill:universal-arch-skill] 校验统一入口合规与注册完整性，确认无违规项
    status: completed
    dependencies:
      - refactor-s3backup
      - refactor-pagelock-doccount
      - refactor-bookmark
      - update-rules
---

## 产品概述

将程序启动链路（`onload → registerFeatures → init`）中直接启动的 4 处定时器统一接入新增的定时器注册工具，并新增硬规则：**新增定时任务必须走统一入口**，禁止裸 `setInterval` / `setTimeout`。

## 核心功能

- 新建统一定时器工具 `TimerRegistry`（注册 / 清理 / 销毁），托管 `setInterval` 与 `setTimeout` 句柄
- 改造 4 处启动定时器接入统一入口，业务回调逻辑（S3 调度状态机、retry 有界轮询）一字不动
- 在 `AGENTS.md` 与 `AGENTS_API.md` 落定"定时任务统一入口"硬规则，约束未来新增代码

## 边界（明确不做）

- S3 备份的 `checkAndBackup` 调度状态机不改
- BookmarkMarker 两个 retry 的有界轮询（self-terminate）语义不改
- 组件内 `onMounted` 后启动的定时器（statusBar / rssReader / quickNote 等）不在本次改造范围，仅由规则约束未来新增
- 不做 `PeriodicTask` 二次抽象、不做全量调度器（第三层方案明确否决）

## 技术栈

- 沿用项目现有 TypeScript + 模块化工具链，新建工具放入 `src/utils/`，符合项目统一入口原则
- 无新增第三方依赖

## 实现方案

### 1. 新建 `src/utils/timerRegistry.ts`

实例化 `TimerRegistry` 类（非模块级单例），随功能实例生命周期创建与销毁，避免多实例句柄串扰（如 s3Backup 重复注册防护会先 destroy 旧实例）：

```ts
// 统一定时器注册与清理工具（文件头注释，10~30 字）
export class TimerRegistry {
  private timers = new Set<ReturnType<typeof setInterval>>()
  /** 注册周期定时器，返回统一句柄（number） */
  setInterval(cb: TimerHandler, ms: number): number
  /** 注册一次性定时器，返回统一句柄（number） */
  setTimeout(cb: TimerHandler, ms: number): number
  /** 清理单个句柄（不存在时静默忽略） */
  clear(handle: number): void
  /** 清理全部句柄，供 destroy 统一调用 */
  clearAll(): void
}
```

设计要点：

- 句柄类型统一为 `ReturnType<typeof setInterval>`（即 `number`），顺带消除现有 `window.setInterval` 与裸 `setInterval`、`number` 与 `ReturnType<...>` 混用问题
- 内部用 `Set` 去重，`clear` 幂等，`clearAll` 遍历 `clearInterval`/`clearTimeout` 后清空集合
- 不引入全局单例，不改变调用方对句柄字段的持有方式（`this.xxxTimer = timers.setInterval(...)` 模式保持）

### 2. 改造 4 处启动定时器（仅替换句柄注册/清理，业务回调零改动）

| 文件 | 改造点 | 动态清理保留 |
| --- | --- | --- |
| `src/features/s3Backup/index.ts` | `startAutoBackupTimer()` :187 改用 `timers.setInterval`；`stopAutoBackupTimer()` :190 改用 `timers.clear`；`destroy()` :274 增加 `timers.clearAll()` | `restartAutoBackupTimer` 逻辑不变 |
| `src/features/pageLock/index.ts` | :379 改用 `timers.setInterval`；destroy 中 `timers.clearAll()` 替代逐条 `clearInterval` | — |
| `src/features/generalSettings/modules/DocCountManager.ts` | `startAutoUpdate()` :176 / `stopAutoUpdate()` :184 改用 `timers.setInterval` / `timers.clear`；destroy 中 `clearAll()` | `setUpdateInterval` 重启逻辑不变 |
| `src/features/bookmarkMarker/modules/BookmarkMarker.ts` | `startAutoUpdate()` :449、`startFileTreeRetry()` :261、`startProtyleRetry()` :380 改用 `timers.setInterval`；retry 内部 self-terminate 分支改用 `timers.clear`；`stop()` 中 `clearAll()` | 有界轮询计数与终止条件不变 |


注意：各功能实例需在构造函数/初始化处创建 `private timers = new TimerRegistry()`，句柄字段（`autoBackupTimer` / `updateTimer` 等）保留原语义，仅改变赋值来源与清理方式。

### 3. 硬规则落点（用户新增要求）

- `AGENTS.md`「统一入口原则（强制）」（:128 起）表格新增一行：定时器 → `TimerRegistry`（`@/utils/timerRegistry`）
- `AGENTS.md`「硬规则」章节（:177 起）新增条目：**定时任务统一入口**——新增定时任务必须走 `TimerRegistry`，禁止裸 `setInterval`/`setTimeout`，句柄类型统一 `ReturnType<typeof setInterval>`；动态启停必须通过 `clear(handle)` / `clearAll()`，生命周期随功能实例 destroy 清理
- `AGENTS_API.md` 在 API 参考区域补充 `TimerRegistry` 用法说明（含最小示例），参照既有 AI 调用硬规则（:588 起）的写法

### 4. 架构与性能

- `DESTROYABLE_KEYS` 生命周期模式不变，`onunload` 统一 destroy 链无需改动
- 无新增开销：`Set` 增删均为 O(1)，定时器 tick 频率与原有完全一致
- 不引入跨 feature 依赖，`timerRegistry` 属于 `@/utils` 通用层，符合统一入口原则

## 目录结构

```
project-root/
├── src/
│   └── utils/
│       └── timerRegistry.ts        # [NEW] TimerRegistry 类：setInterval/setTimeout/clear/clearAll
└── src/features/
    ├── s3Backup/index.ts           # [MODIFY] 定时器句柄接入 TimerRegistry（:187/:190/:274）
    ├── pageLock/index.ts           # [MODIFY] 缓存清理定时器接入（:379 + destroy）
    ├── generalSettings/modules/DocCountManager.ts  # [MODIFY] startAutoUpdate/stopAutoUpdate 接入（:175/:184）
    └── bookmarkMarker/modules/BookmarkMarker.ts    # [MODIFY] autoUpdate + retry×2 接入（:449/:261/:380）
├── AGENTS.md                       # [MODIFY] 统一入口表格 + 硬规则新增"定时任务统一入口"
└── AGENTS_API.md                   # [MODIFY] 新增 TimerRegistry API 参考小节
```

## 实施要点（防回归）

- 所有改造保持"业务回调一字不动"：`checkAndBackup`、retry 计数/终止条件、防重复标记（`lastExecutedHour` / `lastExecutedDateStr`）均不触碰
- retry 的 self-terminate 分支必须改用 `timers.clear(handle)`，禁止遗漏导致 `Set` 残留
- 新建 `.ts` 文件顶部加功能说明注释（10~30 字）
- 验证链条由用户执行：`npx tsc --noEmit` + `pnpm lint`（AI 不执行 build 与 lint）

## Agent Extensions

### Skill

- **universal-arch-skill**
- 用途：最终对本次改动做架构合规校验（统一入口、注册完整性、代码分层），确认 TimerRegistry 接入与硬规则落点符合项目规范
- 预期产出：改动后架构审查通过，无统一入口违规项