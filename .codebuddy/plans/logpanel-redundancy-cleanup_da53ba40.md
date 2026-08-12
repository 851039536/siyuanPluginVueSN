---
name: logpanel-redundancy-cleanup
overview: 提取 LogPanel.vue 与 LogDetailDialog.vue 中重复的 3 个函数到 utils.ts，优化 stats 计算为单次遍历，简化 dateLabelOf 日期比较逻辑。
todos:
  - id: add-utils-functions
    content: 在 utils.ts 末尾追加 formatLogTime、hasLogPlatforms、logActionLabel 三个导出函数
    status: completed
  - id: refactor-logpanel
    content: 修改 LogPanel.vue：导入 3 个工具函数，删除本地定义，stats 改为 1 次 reduce，dateLabelOf 改为日期对象比较
    status: completed
    dependencies:
      - add-utils-functions
  - id: refactor-logdetaildialog
    content: 修改 LogDetailDialog.vue：导入 3 个工具函数，删除本地定义
    status: completed
    dependencies:
      - add-utils-functions
---

## 产品概览

消除操作日志面板中 LogPanel.vue 与 LogDetailDialog.vue 之间的代码冗余，提取 3 个逐字相同的函数到 utils.ts（符合模块内代码分层规则），同时优化 stats computed 的遍历效率与 dateLabelOf 的字符串构建逻辑。

## 核心功能

1. **提取公共函数到 utils.ts**：`formatTime`（ISO→日期时间）、`hasPlatforms`（判断是否有平台明细）、`actionLabel`（操作类型→中文标签），三个函数在两个组件中逐字相同，提取后各组件改为 import 调用，消除重复定义
2. **stats computed 1 次 reduce**：当前按 push/pull/commit 分别 filter 全量 logs 再 filter ok（共 6 次遍历），改为 1 次 for-of 循环 + Map 聚合，O(3n)→O(n)
3. **dateLabelOf 日期比较简化**：去掉手动 pad 拼接 todayKey/yesterdayKey 与 dateKeyOf 重复的逻辑，改用 Date 对象去除时分秒后直接比较毫秒差

## 技术方案

### 实施策略

改动 3 个文件，按「追加→替换删除→优化」顺序执行：

1. 在 utils.ts 末尾追加 3 个导出函数
2. LogPanel.vue 导入新函数，删除本地定义，改写 stats 和 dateLabelOf
3. LogDetailDialog.vue 导入新函数，删除本地定义

### 函数签名设计

```typescript
// utils.ts 新增
export function formatLogTime(iso: string): string
export function hasLogPlatforms(entry: GitOpLogEntry): boolean
export function logActionLabel(action: string, i18n: Record<string, any>): string
```

注：utils.ts 已有 `formatTime` 语义冲突风险（gitPush 内无同名函数，但全局可能），使用 `formatLogTime`/`hasLogPlatforms`/`logActionLabel` 前缀避免歧义。

### stats 优化

当前（6 次 filter）：

```typescript
const types = ["push","pull","commit"]
types.map(t => {
  const items = logs.filter(e => e.action === t)   // filter #1,3,5
  const ok = items.filter(e => e.ok).length         // filter #2,4,6
  return { key: t, label: actionLabel(t), ok, fail: items.length - ok }
})
```

优化后（1 次 for-of）：

```typescript
const acc = { push: [0,0], pull: [0,0], commit: [0,0] } as Record<string, [ok: number, fail: number]>
for (const e of props.logs) {
  const r = acc[e.action]; if (r) { e.ok ? r[0]++ : r[1]++ }
}
return Object.entries(acc).map(([key, [ok, fail]]) => ({ key, label: logActionLabel(key, props.i18n), ok, fail }))
  .filter(s => s.ok + s.fail > 0)
```

### dateLabelOf 简化

当前手动拼接 todayKey/yesterdayKey 字符串与 dateKeyOf() 逻辑重复：

```typescript
const todayKey = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
const yesterdayKey = `${yesterday.getFullYear()}-...`
```

改为 Date 对象直接比较（去时分秒）：

```typescript
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
const diff = Math.round((today.getTime() - target.getTime()) / 86400000)
if (diff === 0) return i18n.logDateToday
if (diff === 1) return i18n.logDateYesterday
return dateKeyOf(iso)
```

### 目录结构

```
src/features/gitPush/
├── utils.ts                              # [MODIFY] 末尾追加 formatLogTime/hasLogPlatforms/logActionLabel
├── components/log/
│   ├── LogPanel.vue                      # [MODIFY] 导入工具函数，删除本地定义，优化 stats+dateLabelOf
│   └── LogDetailDialog.vue               # [MODIFY] 导入工具函数，删除本地定义
```

### 实现要点

- **向后兼容**：三个函数签名对调用方透明（`formatLogTime`/`hasLogPlatforms` 参数不变，`logActionLabel` 需额外传 i18n），模板中 `actionLabel(entry.action)` 改为 `logActionLabel(entry.action, i18n)`
- **无新增依赖**：不涉及 i18n 键、图标、类型定义变更
- **性能收益**：stats 从 6 次 O(n) 遍历降为 1 次，300 条上限下差异微小但消除代码异味
- **行数变化**：LogPanel.vue 净减约 30 行，LogDetailDialog.vue 净减约 25 行，utils.ts 净增约 35 行