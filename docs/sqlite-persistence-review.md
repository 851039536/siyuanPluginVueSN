# SQLite 接入审查：可行性、合理性与渐进迁移路径

审查目标：评估在当前插件中接入 SQLite 的可行性，并把现有思源持久化 API（`plugin.saveData` / `loadData`）的数据逐步迁移到 SQLite。

结论先行：**技术上完全可行（已在思源真实运行时中实测通过）；但对本项目当前的数据规模，"全量迁移"不合理。建议只迁移 2~3 个已到瓶颈的大数据槽位，其余保持现状。**

> ### ✅ 已实测验证（2026-10-17）
>
> 用 `ELECTRON_RUN_AS_NODE=1` 驱动 `E:\Program\SiYuan\SiYuan.exe` 本体，**在思源自己的 Electron 运行时中**验证：
>
> ```
> electron-as-node: 44.7.0  node: 24.21.0      ← 思源真实运行时
> SQLITE OK -> [{"a":42}]                       ← DatabaseSync 可用
> version -> {"v":"3.53.4"}                     ← SQLite 3.53.4
> ```
>
> 追加验证（同一运行时，真实文件库）：
>
> | 能力 | 结果 |
> |------|------|
> | `require("node:sqlite")` | ✅ 成功，**无 `ExperimentalWarning`**（非实验特性） |
> | `PRAGMA journal_mode=WAL` | ✅ `wal` |
> | `PRAGMA user_version` | ✅ 读写成 `7`（迁移机制可用） |
> | `PRAGMA foreign_keys` | ✅ 默认 `1`（已开启） |
> | 事务批量插入 5000 行 | ✅ 6 ms |
>
> 因此 **§1「可行性」的全部结论已由实测坐实，不再是推断**。详见 §0 验证记录。

---

## 〇、验证记录（2026-10-17 实测）

验证方法：以 `ELECTRON_RUN_AS_NODE=1` 驱动思源自带的 `SiYuan.exe`，使**思源自身的 Electron 运行时**执行探针脚本。
这比"本机另装 Node 测试"强得多——它用的正是插件将来运行其上的那个二进制。

### 0.1 运行时身份（思源真实值）

```
electron-as-node: 44.7.0   node: 24.21.0
SQLITE OK -> [{"a":42}]
version -> {"v":"3.53.4"}
```

对照 §1.1 的字符串扫描推断（Electron 44.7.0 / Node 24.21.0）——**完全一致，推断已被证实**。

### 0.2 能力清单

| 能力 | 探针 | 结果 |
|------|------|------|
| 模块加载 | `require("node:sqlite")` | ✅ 成功 |
| 实验状态 | 加载时 stderr | ✅ **无 `ExperimentalWarning`** |
| 建库/CRUD | `DatabaseSync` + `exec` + `prepare/run/all` | ✅ 通过 |
| WAL | `PRAGMA journal_mode=WAL` | ✅ `{"journal_mode":"wal"}` |
| 迁移版本号 | `PRAGMA user_version=7` 后读回 | ✅ `{"user_version":7}` |
| 外键 | `PRAGMA foreign_keys` | ✅ `{"foreign_keys":1}`（默认开） |
| 批量写性能 | 事务内 5000 行 INSERT | ✅ **6 ms** |
| SQLite 版本 | `select sqlite_version()` | 3.53.4 |

产出物含 `-wal` / `-shm` 附属文件（与思源内核自身的 `temp/*.db` 同形），证实 WAL 真实生效。

### 0.3 收益量化（用真实数据做基准）

基准取自真实槽位 `git-push-analysis-cache`：**1.49 MB / 6786 条 entries**。

模拟"改 1 条记录 × 20 次"：

| 方案 | 20 次单条改动耗时 | 相对 |
|------|------------------|------|
| 现状：整份 JSON 重写 | **181 ms** | 1x |
| SQLite：行级 UPDATE | **14 ms** | **约 13x 更快** |

体积对比：同一份数据 JSON 1529 KB → SQLite **744 KB（约 1/2）**。

> 注意：744 KB 比 JSON 小，是因为列式存储 + 去掉重复键名；但这是"有 6786 行真实数据"时的表现。
> **对空库/小数据，`.db` 会因页对齐反而占更多空间**（实测 1000 行的小库即 20 KB），
> 这也是 §2.4 判定"小设置项不该迁移"的原因之一。

### 0.4 验证过程的安全性说明

- 验证在**独立工作空间**（临时目录）+ 独立 `--user-data-dir` 中进行，**未触碰 `E:\siyuan2` 用户真实工作空间**（已核对文件时间戳未变）。
- 用户正在运行的原思源会话全程未受影响（进程号前后一致）。
- 所有探针产物（临时工作空间、user-data、测试 `.db`）已清理。

### 0.5 仍未验证的项（诚实边界）

| 项 | 状态 |
|----|------|
| 渲染进程内 `require("node:sqlite")` | ⚠️ **未直接实测**（未向运行中的渲染进程注入脚本）。但 §1.3 已证 `nodeIntegration: true` / `contextIsolation: false`，且插件现有 `require("node:fs")` 已在用同一通道 —— 风险很低，**仍建议在阶段 1 用 5 行探针在插件内确认一次** |
| Vite 打包后 `require("node:sqlite")` 是否被正确外部化 | ⚠️ 未实测（需真实构建）。按 `vite.config.ts:240` 既有 `node:*` 外部化模式，追加一项即可，风险低 |
| 中文/长文本/二进制 blob 的存取 | 未实测（本项目当前无非文本大字段需求） |
| 多实例并发写同一 `.db` | 未实测。WAL 支持多读者单写者，但**多进程写需自行避让** —— 属设计约束，见 §5.2 |

**结论：核心命题（思源运行时能否用 SQLite）已确证为"能"。** 剩余为工程落地细节，风险可控。

---

## 〇之二、存放位置：放哪里？（已实测）

### 0.6 当前 `saveData` 的真实落盘位置

`plugin.saveData(key, data)` 写到：

```
<workspace>/data/storage/petal/<plugin.name>/<key>
```

实测 `E:\siyuan2\data\storage\petal\siyuan-plugin-vite-vue-sn\` 下：

- **129 个无扩展名文件** = `saveData` 的 key（如 `git-push-projects`、`flashcard-cards`）
- **1 个 `.json`** = `encryption_password.json`（手动 `fs` 写入，非 `saveData`）

即 `saveData` **不做扩展名、不做目录、一个 key 一个裸文件**。

### 0.7 生态现状：petal/ 下没有任何插件用 `.db`

全量扫描 `data/storage/petal/`（含全部 30+ 个插件）：**`.db` 文件数 = 0**。
参照两个数据量较大的插件：

- `siyuan-plugin-copilot`：`chat-sessions.json`、`prompts.json`、`settings.json`… 全是 JSON
- `siyuan-plugin-task-note-management`：`project.json`、`reminder.json`、`statuses.json`… 全是 JSON

**结论：社区约定就是 JSON 文件。放 `.db` 是引入新范式，不违反任何规则，但没有先例可循。**

### 0.8 ⚠️ 最关键的发现：WAL 会让"目录整体备份"静默丢数据

这是决定存放位置的**硬约束**。实测（2000 行，库保持打开 = 插件运行中的真实状态）：

| 文件 | 大小 |
|------|------|
| `x.db` | **4096 B**（几乎空壳） |
| `x.db-wal` | **49472 B**（**全部真实数据在这里**） |
| `x.db-shm` | 32768 B |

| 备份方式 | 结果 |
|---------|------|
| 只复制 `x.db` | ❌ **`no such table: t` —— 全部数据丢失** |
| 复制 `.db` + `-wal` + `-shm` 三个文件 | ✅ 2000 行完整恢复 |
| `sqlite.backup(sourceDb, destPath)`（在线备份 API） | ✅ 500 行完整（**推荐**） |

**为什么这条对本项目是致命的**：仓库现有备份工具 `src/utils/settingsBackup.ts:50-60`
的 `backupPluginData()` 用 `addDirToZip()` **递归打包整个 `petal/<plugin>/` 目录**。

- 若 DB 放在 `petal/<plugin>/`：该备份会**顺带**把 `.db`/`-wal`/`-shm` 一起打包。
  - 侥幸面：三个文件都进 zip → 恢复时可用（实测第 2 行通过）。
  - 风险面：`jszip` 逐个 `readFileSync` 三个文件时**不在同一事务快照内**，若备份期间恰有写入，
    可能抓到「新 `.db` + 旧 `-wal`」的错配组合 → 恢复出损坏库。且用户手动从备份里只取 `.db` 就会丢全部数据。
- 若 DB 放在 `petal/<plugin>/` **之外**（如 `<workspace>/data/storage/petal/<plugin>/db/`）：
  仍在该目录树下，同样被扫到。

### 0.9 位置建议

| 方案 | 路径 | 评价 |
|------|------|------|
| **A. 与 JSON 同目录**（推荐） | `petal/<plugin>/plugin.db` | 最贴近 `saveData` 语义，用户心智一致；备份目录共置。**必须**配套：备份改走 `sqlite.backup()`，或先 `wal_checkpoint(TRUNCATE)` 再打包 |
| B. 同目录下子目录 | `petal/<plugin>/db/plugin.db` | 便于把三个 WAL 文件聚在一起、便于排除；但仍被 `addDirToZip` 递归扫到 |
| C. 独立目录 | `<workspace>/data/storage/petal/<plugin>-db/plugin.db` | 可绕开现有备份的递归范围，但**游离于插件数据约定之外**，卸载插件时可能不被 SiYuan 清理，且用户找不到 |

**判定：选 A，但必须做两件事**（否则数据安全有隐患）：

1. **`PRAGMA journal_mode=WAL` 之后，备份前必须二选一**：
   - 用 `sqlite.backup(db, destPath)` 产出**单文件一致性快照**再入 zip（推荐，见 §0.8 第 3 行）；或
   - 打包前执行 `PRAGMA wal_checkpoint(TRUNCATE)` 把 WAL 并回主库（仅适用于确定无并发写时）
2. **恢复流程要认得 `.db` 三件套**：`restoreFromUpload()` 解压时不应只认 `.json`；
   若备份含 `-wal`/`-shm`，恢复后应让 SQLite 自行完成 WAL 恢复（**不要**手动删 `-wal`）。

> **一句话回答**：可以放同一目录（`petal/<plugin>/`），这也是推荐位置；
> 但**不能**像搬 JSON 那样"搬完就不管" —— WAL 模式下 `.db` 单独存在时几乎是空的，
> 必须让备份/恢复链路同步升级，否则会出现"备份看起来成功了、恢复出来是空库"的静默故障。

---

## 〇之三、统一单库架构（2026-10-17 定稿）

### 0.10 为什么必须统一单库

早期实现按功能建库（`website-navigation.db`），这是**错误方向**：

- 迁移的初衷就是「petal 目录下散落文件太多」，结果只是把 N 个 JSON 换成 N 个 `.db`（每个还带 `-wal`/`-shm` 两个附属文件，实际文件数 ×3）
- 备份/快照/校验要对每个库各做一遍
- 跨功能事务、跨功能查询无法实现

**定稿方案：全插件共用一个 `plugin.db`，靠表名前缀隔离。**

| 项 | 规则 |
|----|------|
| 库文件 | `<插件数据目录>/plugin.db`（唯一），常量 `PLUGIN_DB_NAME` 在 `src/utils/sqliteDb.ts` |
| 表命名 | `<功能前缀>_<实体>`，如 `wn_entries` / `wn_categories`；由 `featureTables("wn", [...])` 生成 |
| 新增功能 | 只加表，不建库；前缀取功能缩写且不得与已有冲突 |

### 0.11 迁移已完成，运行时不导入（迁移脚本已下线）

**原实现的问题**：把「从 JSON 导入」写进运行时的 `_prepare()`，导致每次启动都要检查库是否为空、要不要导入、要不要删旧文件——是常驻的侦测逻辑，且一旦逻辑有 bug 就会反复触发。

**最终形态**：迁移作为**一次性动作**已经执行完毕并验证通过，随后：

| 项 | 状态 |
|----|------|
| `scripts/migrate-sqlite.mjs` | **已删除**（完成使命，不再需要） |
| `pnpm db:dry` / `pnpm db:migrate` | **已移除**（`package.json` 中不再存在） |
| 运行时 `_prepare()` | 只做 `CREATE TABLE IF NOT EXISTS` + 空库播种默认分类 |
| 旧 JSON / 旧 per-feature 库 | 已删除（`*.bak-<时间戳>` 保留作证据，可手动清理） |

迁移当时的做法（供将来新增功能参考）：数据源优先级为**旧 per-feature 库 > 旧 JSON**，
单事务导入、逐 id 比对通过后才删源文件、写库前自动备份。
若将来需要为别的功能做同类迁移，按 [AGENTS.md § SQLite 存储规范](../AGENTS.md#sqlite-存储规范强制2026-10-17)
重建一次性脚本即可，**不要**把导入逻辑放回运行时。

迁移完成后的目录形态：

```
petal/siyuan-plugin-vite-vue-sn/
├── plugin.db            ← 唯一库（wn_entries 28 行 / wn_categories 6 行）
├── plugin.db-wal
├── plugin.db-shm
└── *.bak-<时间戳>       ← 旧格式备份（确认无忧后可手动删）
```

### 0.12 存储语义：纯 SQLite（无回退）

`plugin.db` 是 websiteNavigation 与 minimalBrowser 的**唯一数据源**，
`WebsiteNavigationStorage` 已移除 JSON 回退分支。

`plugin.db` 打不开时（环境无 `node:sqlite` / 工作区路径未就绪），
读方法会抛错，由调用方的 `loadData()` / `loadFavorites()` 的 `try/catch` 捕获并返回 `false`，
面板显示空态 —— 不会白屏，但也不会有数据。

环境门槛：思源 Electron 44+ / Node 24+（实测思源 3.8.7 可用，SQLite 3.53.4）。

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

提取方式为运行时自报（§0.1，权威）与二进制字符串扫描（`Chrome/152.0.7977.130`、`Electron/44.7.0`、`v24.21.0`，佐证）双重确认。

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

`node:sqlite` 已被编译进 Electron 内置的 Node 运行时。**思源运行时实测（§0.1，权威证据）**：

```
SQLITE OK -> [{"a":42}]
version -> {"v":"3.53.4"}       ← 思源自带 SQLite 版本
```

**未产生 `ExperimentalWarning`**——该模块在 Node 24 已转正，不再是实验特性。这也解释了为何 `--experimental-sqlite` 相关判定已不适用。

关键能力实测（思源运行时 + 真实文件库，详见 §0.2）：

```
file WAL: {"journal_mode":"wal"}          ← WAL 模式可用
user_version: {"user_version":7}          ← 迁移版本号机制可用
foreign_keys default: {"foreign_keys":1}  ← 外键默认开启
5000 行事务插入: 6 ms                      ← 批量写正常
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

### 阶段 0：验证探针（✅ 已于 §0 完成主体验证）

**运行时层面的可行性已确证**（思源自身的 Electron 运行时能加载 `node:sqlite`、WAL、事务全部可用）。
剩余只需在**插件内部**补确认一件事：Vite 打包 + 渲染进程 `require` 这条组合链路是否通畅。

```ts
// 一次性探针，验证后删除（放入 onload 或任一 registerFeature 内即可）
try {
  const { DatabaseSync } = require("node:sqlite")
  const db = new DatabaseSync(":memory:")
  db.exec("create table t(a)")
  db.prepare("insert into t values (?)").run(1)
  console.log("[sqlite-probe] OK", JSON.stringify(db.prepare("select * from t").all()))
  db.close()
} catch (e) {
  console.log("[sqlite-probe] FAIL", (e as Error)?.message)
}
```

同时确认 `vite.config.ts:240` 的 `external` 已含 `"node:sqlite"`。
若通过 → 进入阶段 1；若失败 → 维持 NDJSON 路线（该路线已被 gitPush 验证），无损失。

### 阶段 1：新增基础设施（不迁移任何数据）

新增 `src/utils/sqliteDb.ts`，作为**全项目唯一的 SQLite 入口**（与 `PluginStorage` 并列，遵守统一入口原则）：

- `getSqlite(): typeof import("node:sqlite") | null` —— 延迟 require + try/catch，非 Electron 返回 `null`
- `class SqliteDatabase` —— 打开库、`PRAGMA journal_mode=WAL`、`PRAGMA user_version` 迁移、`close()`
- **降级契约**：返回 `null` 时调用方必须回落到 `PluginStorage`，功能不得不可用
- 建库位置：`<dataDir>/storage/petal/<plugin.name>/plugin.db`（复用 `resolveIndexDir` 同款路径解析思路，`plugin.dataDir` 优先、`getWorkspaceDir()` 兜底，见 §0.9 方案 A）
- **必须同时提供** `snapshotTo(destPath)`：内部走 `sqlite.backup(db, destPath)` 产出单文件一致性快照（§0.8）

同步在 `vite.config.ts:240` 的 `external` 追加 `"node:sqlite"`。

**同步改造备份链路（否则有静默丢数据风险）**：`src/utils/settingsBackup.ts` 的
`backupPluginData()` 目前直接 `addDirToZip()` 递归打包整个 `petal/<plugin>/`，
遇到 WAL 模式的 `.db` 会抓到「主库近空 + 数据全在 `-wal`」的中间态。
必须改为：打包前对库调用 `snapshotTo(tmp)` 或 `PRAGMA wal_checkpoint(TRUNCATE)`（详见 §0.8/§0.9）。

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
| 技术可行性 | ✅ **已实测确证**。在思源自身 Electron 44.7.0 / Node 24.21.0 运行时中，`node:sqlite`（SQLite 3.53.4）加载成功、无实验警告，WAL / `user_version` / 外键 / 事务批量写全部可用；无需原生编译 |
| 收益量化 | ✅ 真实数据基准：改 1 条记录，SQLite 比整份 JSON 重写**快约 13x**（14 ms vs 181 ms @ 20 次） |
| 仓库既有结论 | ⚠️ `indexIo.ts:3-4` 的"Electron 33 / Node 20 无 node:sqlite"已过期，该注释需修正 |
| 全量迁移合理性 | ❌ 不合理。实际数据仅 3.69 MB / 130 文件，绝大多数 < 20 KB，收益为负 |
| 定向迁移合理性 | ✅ 合理。`git-push-analysis-cache`(1.5 MB/6786 条)、`rssReader-items`(1.2 MB/396 条)、`git-push-op-logs` 存在真实写放大 |
| 渐进路径 | ✅ 探针 → 基础设施 → 单槽位试点 → 按需推广；每步可回退 |
| 主要风险 | 同步性约束、加密与备份链路、生态可读性、`.db` 空间开销、多进程写避让 |

**建议：不要"慢慢把当前持久化 API 的信息转移到 SQLite"。** 应改为"精准迁移少数已达瓶颈的大槽位"。这样既能吃到行级写入的收益，又不动 120+ 个本无问题的设置项，风险面从"全插件"收缩到"2~3 个可回退的槽位"。

**可行性问题已闭环：思源运行时确实能跑 SQLite。** 现在可以放心进入阶段 1（基础设施），
唯一还需在插件内补确认的是"渲染进程 `require` 通道 + Vite 外部化"这一组合（见 §0.5），
用 5 行探针即可，且失败也只是回退到现状、无损失。

---

## 附：证据来源

| 结论 | 证据 |
|------|------|
| **思源运行时可用 `node:sqlite`（SQLite 3.53.4）** | **`ELECTRON_RUN_AS_NODE=1 SiYuan.exe` 实测：`SQLITE OK -> [{"a":42}]`、`{"v":"3.53.4"}`** |
| **WAL / user_version / 外键 / 批量写** | **同一运行时真实文件库实测：`wal`、`7`、`1`、5000 行 6 ms** |
| **13x 收益** | **真实数据 1.49 MB / 6786 条基准：JSON 重写 181 ms vs SQLite 行更新 14 ms** |
| **⚠️ WAL 下 `.db` 单独存在=空壳** | **实测：`.db` 4096 B / `-wal` 49472 B；只复制 `.db` → `no such table`；三件套齐 → 2000 行 OK；`backup(db,dest)` → 500 行 OK** |
| **`saveData` 落盘位置与形态** | `petal/<plugin>/` 下 129 个无扩展名文件 = key；`encryption_password.json` 为手动 fs 写入 |
| **petal/ 下无任何 `.db` 先例** | 全量扫描 30+ 插件目录：`.db` 数 = 0；copilot / task-note-management 全 JSON |
| **现有备份会递归打包整个 petal 目录** | `src/utils/settingsBackup.ts:20,50-60`（`addDirToZip` + `pluginDataDir`） |
| Electron 44.7.0 / Node 24.21.0 / 思源 3.8.7 | `SiYuan.exe` 字符串扫描 + 运行时 `process.versions` 双证；`resources/app/package.json` |
| `node:sqlite` / `DatabaseSync` 符号内置 | `SiYuan.exe` 符号扫描（7 / 14 处） |
| 渲染进程有完整 Node | `resources/app/electron/main.js:2082` 等 `nodeIntegration: true, contextIsolation: false` |
| `external` 需加一行 | `vite.config.ts:240` |
| 数据规模 3.69 MB / 130 文件 | `E:\siyuan2\data\storage\petal\siyuan-plugin-vite-vue-sn` 实测统计 |
| `saveData` 为整文件 JSON | `git-push-projects` 为单个 29516 字节文件 |
| 同步读约束 | `src/index.ts:136-145`、`src/config/settings.ts:220-284` |
| 加密与备份链路 | `src/config/settings.ts`、`src/utils/settingsBackup.ts:56,92` |
| NDJSON 既有方案 | `src/features/gitPush/managers/indexIo.ts` |
