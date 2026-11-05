# 持久化规范（参考）

> 本文件是长期参考，规则摘要见 `AGENTS.md` § 持久化规范。
> 审查背景与资产清单见 `docs/plugin-persistence-audit.md`。

## 1. 分层决策

| 数据形态 | 方案 | 判据 |
|---|---|---|
| 设置项、开关、小对象（< 20 KB，整体读写） | `TypedStorage<T>`（JSON） | 无写放大、需要同步/简单读 |
| 记录集合且**单条改动会重写 > 50 KB**，或体积 > 150 KB | `plugin.db` 表 | **写放大判据，不看绝对体积** |
| 需按条件查询/排序/聚合 | `plugin.db` 表 | 索引 + SQL |
| 加密单文档（如密码箱条目） | `TypedStorage` + 应用层加密 | 拆表会破坏加密封装 |
| 增量追加日志/索引 | 裸 NDJSON 或 SQLite 表 | 追加友好；不要整份 JSON 重写 |
| 运行期缓存、可重建 | 内存或既有缓存表 | 不作为备份重点 |

**禁止**：按功能新建 `.db` 文件；直接 `fs.writeFileSync` 写业务数据；直接 `plugin.loadData/saveData`
（唯一例外：`src/config/settings.ts` 的 `plugin-settings`）。

## 2. 位置与命名

| 形态 | 位置 | 命名 |
|---|---|---|
| JSON 槽 | `<workspace>/data/storage/petal/<plugin.name>/<key>` | kebab-case，如 `git-push-projects`；**不带 `.json` 后缀** |
| SQLite | 同目录 `plugin.db`（+ `-wal` / `-shm`） | 表名 `<前缀>_<实体>`，由 `featureTables()` 生成 |
| 裸文件 | 同上子目录（如 `git-push-index/`） | 目录名 kebab-case |
| localStorage | 浏览器源 | `sn-plugin-*` 或 `siyuan-*`，仅限白名单 |

存量 key 若不符合命名规范，注册表标 `legacyName: true` 冻结，**不得单独改名**（改名必须与一次性迁移同批）。

## 3. 槽位生命周期

1. **声明**：在功能 `types/storage.ts` 建 `TypedStorage`/表常量；同时在 `src/config/storage/` 注册元数据。
2. **读写**：一律经 `PluginStorage` / `TypedStorage` / `openPluginDatabase()`。
3. **启动加载**：初始化入口用 `loadOrDefault()`，不得因 `load()` 为 null 跳过（否则默认值不生效）。
4. **清理**：`PluginStorage.remove()` 已改为 `plugin.removeData()`（真正删文件）；SQLite 用 `DELETE`。
5. **导出/还原**：只经 `storageManager` 的注册表驱动流程，不写功能私有导出逻辑。
6. **迁移**：见 §6。

## 4. 存储注册表

位置：`src/config/storage/`

```ts
// 一槽一行，便于 audit-storage.mjs 解析
jsonSlot("gitPush.projects", ["gitPush"], "git-push-projects", {
  defaultLabel: "Git 项目",
  growth: true,
  exportable: true,
  resettable: true,
})
```

字段：`id`（唯一，`<owner>.<entity>`）、`owners[]`、`kind`、`key`、`labelI18nKey?`、`defaultLabel`、
`growth`、`sensitive`、`exportable`、`resettable`、`restorable?`、`legacyName?`、`notes?`。

**双真相的处理**：注册表只承载元数据，功能代码里的 key 常量仍是写入口；一致性由
`pnpm audit:storage` 双向 diff（源码 → 注册表 / 注册表 → 源码）保证。新增槽位必须在同一提交里
同时出现「注册表条目 + 功能常量」。

```bash
pnpm audit:storage            # 文本报告，退出码 0/1
pnpm audit:storage -- --json  # 机器可读
```

## 5. 备份与还原契约

### 5.1 全量备份

- 入口：`src/utils/settingsBackup.ts`（`storageManager` 面板调用）。
- **SQLite 必须用 `snapshotTo()` / `snapshotDatabaseFile()` 生成单文件快照**，
  禁止直接复制运行中的 `.db`，禁止只做 `wal_checkpoint`（并发写时可能 busy 而不截断）。
- zip 内用快照替换 `.db`，**跳过 `-wal` / `-shm`**；临时快照放 `data-backup/.tmp/`（扫描目录之外）。
- 产物：`<workspace>/data-backup/sn-plugin-<YYMMDD-HHmmss>.zip`。

### 5.2 运行中还原（逻辑还原）

Windows 下无法安全覆盖被连接持有的 `plugin.db`，因此运行中还原只做**逻辑写回**：

1. 先自动做一次全量备份（失败即中止）。
2. JSON 槽：从 zip 顶层按 key 读取 → `saveData`。
3. SQLite：把 zip 内 `plugin.db` 解压到临时文件 → 用临时连接读表 → 对活动库 `DELETE + INSERT`（单表事务）。
4. 文件槽：仅 `git-push-index` 可还原；`bin/`、`bfg-backups/` 跳过。
5. 完成后 `emitCustomEvent("storageRestored")`，提示用户重载插件；**不自动 reload**。

### 5.3 原始还原（二进制整库）

必须在**禁用插件后**手动解压 zip 覆盖 `petal/<plugin>/`。
运行中不要尝试；代码不提供该入口（P2 再评估 marker 方案）。

## 6. 一次性迁移

- 必须有守卫（`user_version` 或迁移标记键），**只执行一次**，禁止每次启动侦测。
- 建议「双读单写」：新表先写、旧 key 保留观察一轮，确认无误后删旧 key。
- 迁移前 `snapshotTo()`，失败保留旧数据并记录原因。
- 迁移逻辑不放进 `_prepare()`（`_prepare` 只建表 + 播种）。

## 7. 新增槽位 checklist

- [ ] 选择 JSON / SQLite / 文件（按 §1 判据）
- [ ] key / 表名符合命名规范；SQLite 用 `featureTables()`
- [ ] 在 `src/config/storage/` 登记（含 growth / sensitive / exportable / resettable）
- [ ] `DEFAULT_XXX` 注册在 `types/storage.ts`
- [ ] 初始化入口用 `loadOrDefault()`
- [ ] 提供清理/重置路径（或显式登记 `resettable: false` 并说明原因）
- [ ] 敏感数据走 `settingsCrypto`，并在注册表标 `sensitive`
- [ ] 功能 `README.md` 增加「存储」章节（key / 表 / 位置）
- [ ] `pnpm audit:storage`、`pnpm typecheck` 通过

## 8. 常见错误

| 错误 | 后果 |
|---|---|
| 用 `plugin.dataDir` 拼路径 | 运行时为 `undefined`，生成相对路径或伪路径；统一用 `resolvePluginDataDir()` / `joinPluginDataPath()` |
| 只复制 `.db` 备份 | WAL 未归并 → 得到空库（`no such table`） |
| 增长型数组整份 `save` | 写放大（实测 13x）；按 §1 判据迁移 |
| 两个功能各写同一个 key | 后写覆盖、类型漂移；共享槽用 `owners[]` + 唯一共享工具 |
| `remove()` 后假设文件消失 | 旧实现只写空串；新实现走 `removeData`，但读取方仍需容忍 `""` |
| localStorage 存业务数据 | 端口变化导致源变化、冷启动丢失；仅白名单可用 |
