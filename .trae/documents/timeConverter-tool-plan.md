# 计划：toolCollection 新增「时间转换」工具（date/unixtime/timestamp）

## 概述

在底部面板「工具合集」（toolCollection）中新增第 9 个工具：**时间转换**（timeConverter），对标 uTools 时间转换插件：

1. **智能识别输入框**（uTools 风格）：单输入框自动识别 10 位秒级 / 13 位毫秒级 Unix 时间戳、`YYYY-MM-DD HH:mm:ss` 等常见日期字符串，实时显示识别类型
2. **时间格式转换**：时间戳 ⇄ 日期字符串双向转换，多格式输出（本地时间 / ISO 8601 / UTC / Unix 秒 / Unix 毫秒），每行一键复制
3. **时间戳获取**：常驻「当前时间」区，实时显示当前时间戳（秒 / 毫秒）并支持复制，1 秒自动刷新
4. **标准时间**：实时显示本地标准时间（`YYYY-MM-DD HH:mm:ss` + 星期）

## 现状分析（Phase 1 探索结论）

- **注册机制**：工具在 `src/features/toolCollection/tools/registry.ts` 集中注册（`TOOL_REGISTRY` + `TOOL_LABEL_KEYS`），无需走 8 步功能注册清单，无需修改 `index.vue`（README「注册新工具」4 步流程）
- **无重复实现**：全仓搜索确认没有现成的时间戳/日期转换工具（`floatingBox` i18n 描述提到"时间戳"但无实际实现；`video` 中仅有局部 `formatDate`）
- **Props 约定**：工具主组件统一接收 `{ plugin: Plugin, i18n }`，`i18n` 由 `index.vue` 传入 `plugin.i18n`
- **i18n 分片**：每工具一个分片（如 `jsonFormatter.json` 嵌套在 `jsonFormatter` 键下），中英分片同步
- **参考实现**：`unitConverter/tools/unitConverter/`（styles 共享 mixin 模式、Input 用法 `size="xsmall"`、computed 驱动转换）
- **可用基建**：
  - `copyToClipboard(text): Promise<boolean>` — `@/utils/domUtils`
  - `TimerRegistry`（`setInterval`/`clearAll`）— `@/utils/timerRegistry`（当前时间实时刷新必须走此入口，禁裸 setInterval）
- **无需图标注册**：侧栏为纯文字列表（本轮已移除 ToolMeta.icon），工具内图标用 `@iconify/vue` 已预加载的 mdi 集

## 变更清单

### 1. 新建 `src/features/toolCollection/tools/timeConverter/utils/time.ts`

纯函数层（不依赖 Vue），文件头注释必备：

```ts
/** 识别结果判别联合 */
export type TimeParseResult =
  | { kind: "seconds" | "milliseconds" | "date"; date: Date }
  | null

export function parseTimeInput(input: string): TimeParseResult
export function formatDateParts(date: Date): {
  local: string      // YYYY-MM-DD HH:mm:ss + 周X
  iso: string        // toISOString()
  utc: string        // toUTCString()
  unixSec: number
  unixMs: number
}
export function getNowInfo(): { local: string; unixSec: number; unixMs: number }
```

- `parseTimeInput` 识别规则：
  - `/^\d{10}$/` → Unix 秒（范围校验 ≥ 1e9）；`/^\d{13}$/` → Unix 毫秒（≥ 1e12）
  - 日期字符串：统一分隔符（`/`、`.` → `-`，空格 → `T`）后 `Date` 解析，`isNaN` 校验；支持 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm:ss`、ISO 8601（含 `Z` / `±HH:mm` 时区后缀）
  - 无法识别返回 `null`
- 本地格式化手动拼接（`pad2` 辅助），不依赖 `toLocaleString` 保证一致性

### 2. 新建 `src/features/toolCollection/tools/timeConverter/index.vue`

单视图（无 Tab，uTools 交互范式），Props `{ plugin, i18n }`：

- **智能输入框**（顶部）：`Input size="xsmall"`（对齐 unitConverter 既有用法）实时驱动 computed 解析；下方识别状态徽标（识别为 Unix 秒 / Unix 毫秒 / 日期时间 / 无法识别）
- **转换结果区**：
  - 输入为空 → 默认展示「当前时间」的转换结果（带 `当前时间` 徽标），对齐 uTools 打开即所得
  - 时间戳输入 → 输出：本地标准时间 / ISO 8601 / UTC
  - 日期输入 → 输出：Unix 秒 / Unix 毫秒 / 本地标准时间 / ISO 8601
  - 每行 = 标签 + `$vp-mono` + `tabular-nums` 数值 + 复制按钮（`copyToClipboard`，成功后按钮短暂显示"已复制"，1.5s 恢复，setTimeout 走 TimerRegistry）
  - 无法识别 → 隐藏结果区，显示错误提示条
- **当前时间区**（底部常驻）：本地标准时间（含星期）+ 时间戳秒/毫秒 + 复制按钮；`TimerRegistry.setInterval(1000)` 实时刷新，`onUnmounted` 中 `clearAll()`
- 模板所有 i18n 渲染处上方加中文注释（硬规则），禁 i18n 硬编码兜底

### 3. 新建 `src/features/toolCollection/tools/timeConverter/styles/index.scss`

- 对齐 unitConverter 的 Codex 风格（`@use '@/variables.scss' as *`、`label-style` mixin 同款写法）
- 数值/时间戳全部 `$vp-mono` + `font-variant-numeric: tabular-nums`
- 禁 box-shadow，边框用 `--b3-border-color`，行 hover 用 `--b3-theme-surface`

### 4. 修改 `src/features/toolCollection/tools/registry.ts`

- `TOOL_REGISTRY` 在 `unitConverter` 之后、`pdfViewer` 之前插入：

```ts
{
  id: "timeConverter",
  label: "",
  component: TimeConverterTool,
}
```

- `TOOL_LABEL_KEYS` 添加：`timeConverter: (i18n) => i18n.timeConverter?.title ?? "Time Converter"`（对齐既有兜底模式）
- 顶部 import `TimeConverterTool from "./timeConverter/index.vue"`

### 5. 新建 i18n 分片（嵌套结构，对齐 jsonFormatter.json）

`src/i18n/zh_CN/timeConverter.json` + `src/i18n/en_US/timeConverter.json`，键必须中英同步：

```
timeConverter.title / inputPlaceholder / recognizedSeconds / recognizedMilliseconds
/ recognizedDate / unrecognized / currentBadge / currentStandardTime
/ labelLocal / labelIso / labelUtc / labelUnixSec / labelUnixMs
/ copy / copied / errorHint
```

### 6. 修改 `src/features/toolCollection/README.md`

「已集成工具」表添加一行：时间转换（时间戳⇄日期双向转换 + 实时当前时间戳）

## 决策与假设

| 决策点 | 结论 | 依据 |
|--------|------|------|
| 承载位置 | toolCollection 工具（非独立 feature） | 用户上下文连续两轮在 toolCollection；uTools 时间转换即小工具形态；README 4 步注册即可 |
| 视图结构 | 单视图无 Tab | uTools 范式即单输入框驱动；避免过度设计（Rule of Three） |
| 空输入行为 | 展示当前时间转换结果 | 对齐 uTools「打开即用」体验，同时满足"时间戳获取/标准时间"两条需求 |
| 时间戳位数 | 仅 10 位秒 / 13 位毫秒 | 主流范围，16 位微秒/负数暂不支持，保持简单 |
| Input size | `xsmall` | 与 toolCollection 内既有工具（unitConverter）一致 |
| 定时刷新 | TimerRegistry 托管，onUnmounted clearAll | AGENTS 硬规则：定时任务统一入口 |

## 验证（用户执行）

```bash
pnpm i18n:verify    # 中英分片键对齐
npx tsc --noEmit    # 类型检查
pnpm lint           # ESLint
```

手动验证点：
- 空输入显示当前时间且每秒刷新；复制秒/毫秒时间戳正确
- 输入 `1756889200`（10位）→ 显示 2025-09-03 前后本地时间；输入 13 位毫秒同理
- 输入 `2026-09-03 12:30:00`、`2026/09/03`、`2026-09-03T12:30:00Z` 均正确识别
- 输入乱串 → 显示"无法识别"，无报错
- 底部面板与独立窗口（tab 模式）双形态均正常
