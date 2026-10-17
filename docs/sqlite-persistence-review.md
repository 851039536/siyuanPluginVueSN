# SQLite 接入审查：可行性、合理性与渐进迁移路径

审查目标：评估在当前插件中接入 SQLite 的可行性，并把现有思源持久化 API（`plugin.saveData` / `loadData`）的数据逐步迁移到 SQLite。

结论先行：**技术上完全可行，且比仓库既有注释的假设更乐观；但对本项目当前的数据规模，"全量迁移"不合理。建议只迁移 2~3 个已到瓶颈的大数据槽位，其余保持现状。**

---

## 一、可行性：决定性事实核查

### 1.1 仓库现有结论已过期（最重要发现）

`src/features/gitPush/managers/indexIo.ts:3-4` 明确记录了拒绝 SQLite 的理由：

```
// 为什么不是 sqlite：思源桌面端为 Electron 33（内置 Node 20，无 node:sqlite），
// better-sqlite3 需原生编译且随思源升级易失效，sql.js 需把全库载入内存（大仓库比 git log 更慢）。
```

**这三条理由在当前环境下已有一条完全不成立、一条已可规避。** 实测本机思源（`E:\Program\SiYuan\SiYuan.exe`）：

| 项目 | 注释假设 | 实测值 | 判定 |
|------|---------|--------|------|
| 思源版本 | — | **3.8.7** | — |
| Electron | 33 | **44.7.0** | 已远超 |
| Node | 20（无 `node:sqlite`） | **24.21.0** | ❌ 假设失效 |
| Chromium | — | 152.0.7977.130 | 仅参考 |

提取方式为二进制字符串表扫描（`Chrome/152.0.7977.130`、`Electron/44.7.0`、`v24.21.0`）。

### 1.2 `node:sqlite` 确实已内置且可用

在 `SiYuan.exe` 二进制中检索到的符号：

```
node:sqlite          occurrences: 7
DatabaseSync         occurrences: 14
StatementSync        occurrences: 7
enableForeignKeyConstraints  2
allowExtension      4
SQLite format 3      occurrences: 4
```

`node:sqlite` 已被编译进 Electron 内置的 Node 运行时。本机 Node 24 实测（同版本线）：

```
node:sqlite OK, exports: DatabaseSync, StatementSync, Session, constants, backup
roundtrip: [{"a":1}]
sqlite_version: {"v":"3.51.3"}
```

**未产生 `ExperimentalWarning`**（`node -e "require('node:sqlite')"` 无任何 stderr 输出）——该模块在 Node 24 已转正，不再是实验特性。这也解释了为何 `--experimental-sqlite` 相关判定已不适用。

关键能力实测（真实文件库）：

```
file WAL: {"journal_mode":"wal"}      ← WAL 模式可用
user_version: {"user_version":3}      ← 迁移版本号机制可用
foreign_keys default: {"foreign_keys":1}  ← 外键默认开启
count: {"c":1000}                     ← 批量写入正常
```

### 1.3 插件进程具备完整 Node 能力（无需原生编译）

思源窗口配置（`resources/app/electron/main.js`）：

```
nodeIntegration: true, contextIsolation: false, webSecurity: false
```

这解释了仓库中 `require("node:fs")`、`@electron/remote` 为何能工作。**`node:sqlite` 是内置模块，不需要 `better-sqlite3` 那样的原生编译与 Electron ABI 重建**——该方案的"随思源升级易失效"风险就此消失，因为它随 Electron 一起分发。

### 1.4 接入成本极低：只需一行配置

`vite.config.ts:240` 的 `external` 列表已外部化 `node:fs` / `node:path` 等：

```ts
external: ["siyuan", "process", "stream", "node:fs", "node:path", ..., "node:crypto"],
```

只需追加 `"node:sqlite"` 即可。并且仓库已有现成的加载范式可照搬（`src/utils/nodeModules.ts` 的 `getNodeModules()` try/catch 延迟 require）。

### 1.5 可行性小结

| 原有顾虑 | 现状 |
|---------|------|
| Node 20 无 `node:sqlite` | ❌ 已失效，Node 24.21 内置 |
| `better-sqlite3` 需原生编译、升级易失效 | ✅ 可完全规避，改用内置模块 |
| `sql.js` 需全库载入内存 | ✅ 可完全规避，`DatabaseSync` 是真正的磁盘库 |
| 浏览器端不可用 | ⚠️ 仍成立，但仓库已有降级范式 |

---

## 二、合理性：真的需要吗？

### 2.1 当前真实数据规模（实测 `E:\siyuan2`）

插件数据目录 `data/storage/petal/siyuan-plugin-vite-vue-sn`：**131 个文件，总计 17.64 MB**，
其中 14.04 MB 是 `bin/bfg-1.15.0.jar`（二进制资产，与存储方案无关）。

**真正的持久化数据合计仅约 3.69 MB / 130 个 JSON 文件。** 头部槽位：

| 大小 | 槽位 | 结构 |
|------|------|------|
| 1529.4 KB | `git-push-analysis-cache` | `entries[n=6786]` + `failedCount: 4` |
| 1225.4 KB | `rssReader-items` | `array n=396` |
| 272.4 KB | `git-push-report-cache` | 单份 report 对象 |
| 149.5 KB | `git-push-op-logs` | `array n=300` |
| 126.1 KB | `flashcard-cards` | `array n=250` |
| 73.6 KB | `scriptLauncher-scripts` | `array n=9` |
| 40.8 KB | `s3-backup-log` | `logs[n=200]` |
| 32.0 KB | `statistics-history` | 按日期分键的对象 |
| 28.8 KB | `git-push-projects` | `array n=64` |

其余 120+ 个文件均在 20 KB 以下，绝大多数 < 2 KB（纯设置项）。

### 2.2 真正的痛点：写放大，而非"存不下"

思源的 `saveData` 把每个 key 存成**整份 JSON 文件**（实测 `git-push-projects` 即为单个 29516 字节文件，非目录）。后果是**任何单条记录的增删改都要重写整个数组**：

- `flashcard-cards` 改一张卡片 → 重写 126 KB / 250 条
- `rssReader-items` 标记一条已读 → 重写 1.2 MB / 396 条
- `git-push-analysis-cache` 写入 → 重写 1.5 MB / 6786 条
- `git-push-op-logs` 每次记一条日志 → 重写全部 300 条

这才是 SQLite 能带来真实收益的地方（O(1) 行级写入 vs O(n) 全量重写）。

### 2.3 但三点让"全量迁移"不合理

**(a) 规模远未到瓶颈。** 3.69 MB / 130 文件对本地 SSD 而言是微不足道的 IO。绝大多数槽位 < 20 KB，重写成本可忽略。为它们引入数据库是纯粹的复杂度增加。

**(b) 仓库已有成熟的大数据方案，且工作良好。** `gitPush` 已经用 **NDJSON 追加日志**（`indexIo.ts`）把大体积提交索引挪出 `loadData`，并附加了：原子写（临时文件 + rename）、崩溃丢尾行容错、按项目分文件隔离并发写、单射文件名转义防碰撞。**追加写的性能特征恰好等价于 SQLite 的 INSERT**，而实现只依赖 `fs`。这是"用对的工具"的现成范例。

**(c) 迁移引入真实风险：**
- **破坏同步性约束**：`src/index.ts:136-145` 依赖 `loadFeatureFlagsSync()` 在 `onload` **同步**阶段读完开关，因为 `addDock()` 必须同步完成。SQLite 虽可用同步 API 满足这一点，但一旦把设置迁入数据库，就必须保证该路径始终同步可用，否则功能注册会静默失效。
- **破坏加密与备份链路**：`src/config/settings.ts` 对 `aiApiKeys` 等做 AES-GCM 加密后再 `saveData`；`src/utils/settingsBackup.ts` 按 `${workspaceRoot}/data/storage/petal/${plugin.name}` 目录做整目录备份。数据一旦进 `.db` 二进制文件，两者都要重写，且备份体积/策略会变（WAL 还带来 `-wal`/`-shm` 附属文件的一致性问题）。
- **思源官方生态的兼容面**：`petal/*` 是思源约定的插件数据格式，第三方工具与用户手动查看依赖其可读性。改成二进制库会牺牲这一点。
- **数据膨胀**：`.db` 是稀疏分配的页文件，小数据会占数倍空间（实测一个仅 1000 行的库即 20 KB）。

### 2.4 合理性判定

| 数据类别 | 代表槽位 | 是否迁移 | 理由 |
|---------|---------|---------|------|
| 纯设置项（< 20 KB，120+ 个） | `font-settings`、`api-debugger-settings` 等 | ❌ 不迁移 | 无性能问题；需保持同步读与加密链路 |
| 中等列表（20~150 KB） | `flashcard-cards`(250)、`git-push-projects`(64) | ⚠️ 可选 | 收益有限；除非该列表会持续增长 |
| **大列表且高频单条写** | `git-push-analysis-cache`(6786)、`rssReader-items`(396)、`git-push-op-logs`(300) | ✅ **建议迁移** | 写放大明显（0.15~1.5 MB/次），有真实查询/过滤需求 |
| 已用 NDJSON 的 | `git-push-index` | ❌ 保持 | 追加日志已是合适结构，迁移属无谓重写 |

**结论：值得迁移的是 2~3 个"大且高频单条写"的槽位，不是全部。全量迁移是负收益。**

---

## 三、渐进迁移方案

### 原则

1. **按槽位迁移，不按功能迁移** —— 一个功能可同时有 SQLite 槽位与 JSON 槽位。
2. **保持 `TypedStorage` 接口形状** —— 消费方代码零改动（仓库强制的"统一入口原则"，见 `AGENTS.md`）。
3. **默认关闭 + 可回退** —— 任一环节失败即回落到现有 JSON 路径。
4. **先读后写（双读单写）** —— 首次运行导入历史 JSON，之后以 SQLite 为准。

### 阶段 0：验证探针（零风险，先做）

在真实思源里确认 `require("node:sqlite")` 可用，避免基于假设设计。**这是本方案唯一的未知项**——`SiYuan.exe` 里存在符号不等于渲染进程沙箱允许加载，必须实测。

```ts
// 一次性探针，验证后删除
try {
  const { DatabaseSync } = require("node:sqlite")
  const db = new DatabaseSync(":memory:")
  db.exec("create table t(a)")
  console.log("[sqlite-probe] OK", require("node:sqlite").constants?.SQLITE_VERSION ?? "")
  db.close()
} catch (e) {
  console.log("[sqlite-probe] FAIL", e?.message)
}
```

若通过 → 继续阶段 1；若失败 → 本方案终止，维持 NDJSON 路线（该路线已被 gitPush 验证）。

### 阶段 1：新增基础设施（不迁移任何数据）

新增 `src/utils/sqliteDb.ts`，作为**全项目唯一的 SQLite 入口**（与 `PluginStorage` 并列，遵守统一入口原则）：

- `getSqlite(): typeof import("node:sqlite") | null` —— 延迟 require + try/catch，非 Electron 返回 `null`
- `class SqliteDatabase` —— 打开库、`PRAGMA journal_mode=WAL`、`PRAGMA user_version` 迁移、`close()`
- **降级契约**：返回 `null` 时调用方必须回落到 `PluginStorage`，功能不得不可用
- 建库位置：`<dataDir>/storage/petal/<plugin.name>/plugin.db`（复用 `resolveIndexDir` 同款路径解析思路，`plugin.dataDir` 优先、`getWorkspaceDir()` 兜底）

同步在 `vite.config.ts:240` 的 `external` 追加 `"node:sqlite"`。

### 阶段 2：迁移第一个槽位（建议 `git-push-op-logs`）

选它作试点：结构简单（`array n=300`）、写入频繁、失败影响面小（操作日志丢了不致命）。

1. 建表：`op_logs(project_id TEXT, ts INTEGER, level TEXT, message TEXT, ...)` + 索引
2. **首启导入**：若 `.db` 为空且旧 JSON 存在 → 批量 `INSERT`（单事务）→ 记录 `imported_from_json` 标记
3. **双读单写**：读优先 SQLite；SQLite 不可用则读 JSON；写入始终写 SQLite，仅在其不可用时写 JSON
4. 保留旧 JSON 文件**不删除**，作为回退快照
5. 观察一个版本周期，确认无回归

### 阶段 3：按需推广

试点稳定后，同法处理 `git-push-analysis-cache`（6786 条，收益最大）与 `rssReader-items`（396 条）。**每次只动一个槽位**，每个都带独立回退。

### 明确不做

- ❌ 不迁移 `plugin-settings`（同步读约束 + AES-GCM 加密链路 + 备份链路）
- ❌ 不迁移 `password-vault-*`（加密数据，收益低风险高）
- ❌ 不迁移 120+ 个 < 20 KB 的设置项槽位
- ❌ 不迁移 `git-push-index`（NDJSON 已合适）
- ❌ 不引入任何需要原生编译的依赖（`better-sqlite3`）

### 同步性红线

任何进入 SQLite 的槽位，若其读取路径出现在 `onload` 同步阶段（参照 `loadFeatureFlagsSync`），则**必须**使用 `DatabaseSync` 的同步 API，不得引入 `await`。当前建议的 3 个迁移目标都不在同步路径上。

---

## 四、审查结论

| 维度 | 判定 |
|------|------|
| 技术可行性 | ✅ 可行。Electron 44 / Node 24.21 内置 `node:sqlite`（已转正、无实验警告），WAL 与迁移机制实测可用，`external` 加一行、无需原生编译 |
| 仓库既有结论 | ⚠️ `indexIo.ts:3-4` 的"Electron 33 / Node 20 无 node:sqlite"已过期，该注释需修正 |
| 全量迁移合理性 | ❌ 不合理。实际数据仅 3.69 MB / 130 文件，绝大多数 < 20 KB，收益为负 |
| 定向迁移合理性 | ✅ 合理。`git-push-analysis-cache`(1.5 MB/6786 条)、`rssReader-items`(1.2 MB/396 条)、`git-push-op-logs` 存在真实写放大 |
| 渐进路径 | ✅ 探针 → 基础设施 → 单槽位试点 → 按需推广；每步可回退 |
| 主要风险 | 同步性约束、加密与备份链路、生态可读性、`.db` 空间开销 |

**建议：不要"慢慢把当前持久化 API 的信息转移到 SQLite"。** 应改为"精准迁移少数已达瓶颈的大槽位"。这样既能吃到行级写入的收益，又不动 120+ 个本无问题的设置项，风险面从"全插件"收缩到"2~3 个可回退的槽位"。

无论是否推进 SQLite，**第一步都应是阶段 0 的探针**——在真实思源中确认 `node:sqlite` 可加载，而不是基于二进制符号推断。

---

## 附：证据来源

| 结论 | 证据 |
|------|------|
| Electron 44.7.0 / Node 24.21.0 / 思源 3.8.7 | `E:\Program\SiYuan\SiYuan.exe` 字符串表；`resources/app/package.json` |
| `node:sqlite` / `DatabaseSync` 内置 | `SiYuan.exe` 符号扫描（7 / 14 处） |
| `node:sqlite` 可用且非实验态 | 本机 Node 24.15 实测；SQLite 3.51.3 |
| WAL / user_version / 外键 | 真实文件库实测 |
| 渲染进程有完整 Node | `resources/app/electron/main.js:2082` 等 `nodeIntegration: true, contextIsolation: false` |
| `external` 需加一行 | `vite.config.ts:240` |
| 数据规模 3.69 MB / 130 文件 | `E:\siyuan2\data\storage\petal\siyuan-plugin-vite-vue-sn` 实测统计 |
| `saveData` 为整文件 JSON | `git-push-projects` 为单个 29516 字节文件 |
| 同步读约束 | `src/index.ts:136-145`、`src/config/settings.ts:220-284` |
| 加密与备份链路 | `src/config/settings.ts`、`src/utils/settingsBackup.ts:56,92` |
| NDJSON 既有方案 | `src/features/gitPush/managers/indexIo.ts` |
