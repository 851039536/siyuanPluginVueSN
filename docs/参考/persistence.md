# 持久化规范（参考）

> 本文件是长期参考，规则摘要见 `AGENTS.md` § 存储规范。
> 插件**不使用 SQLite**（2026-11-14 起）：`plugin.db` 位于思源同步目录，Windows 下
> 数据库连接持有文件句柄会让同步引擎的 rename 覆盖失败，表现为
> 「同步失败：读写文件或访问网络权限不足」。

## 1. 分层决策

| 数据形态 | 方案 | 判据 |
|---|---|---|
| 设置项、开关、小对象（整体读写） | `TypedStorage<T>`（思源 saveData JSON 槽） | 简单、同步语义清晰 |
| 记录集合（书签、日志、历史、缓存） | `TypedStorage<T>` + 内存态 + 串行/合并写盘 | 单次写入可控；必须设上限或清理路径 |
| 需按条件查询/排序/聚合 | 读入内存后计算（数据量受上限约束） | 不接受无界增长 |
| 加密单文档（如密码箱条目） | `TypedStorage` + 应用层加密 | 拆分会破坏加密封装 |
| 增量追加日志/索引（体积大、只追加） | 裸 NDJSON 文件（如 `git-push-index/`） | 追加友好；不要整份 JSON 重写 |
| 运行期缓存、可重建 | 内存 | 不作为备份重点 |

**禁止**：
- 使用 `node:sqlite` / `plugin.db` 或任何数据库文件；
- 按功能新建 `.db` 文件；
- 直接 `plugin.loadData/saveData`（唯一例外：`src/config/settings.ts` 的 `plugin-settings`）；
- 在同步目录内长期持有任何文件的写句柄。

## 2. 位置与命名

| 形态 | 位置 | 命名 |
|---|---|---|
| JSON 槽 | `<workspace>/data/storage/petal/<plugin.name>/<key>` | kebab-case，如 `git-push-projects`；**不带 `.json` 后缀** |
| 裸文件 | 同上子目录（如 `git-push-index/`） | 目录名 kebab-case |
| localStorage | 浏览器源 | `sn-plugin-*` 或 `siyuan-*`，仅限白名单 |

存量 key 若不符合命名规范，注册表标 `legacyName: true` 冻结，**不得单独改名**
（改名必须与一次性迁移同批）。

## 3. 与思源同步共存（Windows 强约束）

思源同步引擎（dejavu）下载文件时先写同目录临时文件、再 `os.Rename` 覆盖目标。
Windows 上只要目标文件被进程以独占方式打开（SQLite 就是如此），rename 就报
"Access is denied"，重试 3 次后整轮同步失败。

因此：

- **全插件禁用 SQLite**。原 `plugin.db`（含 `-wal` / `-shm`）已从运行时移除，
  数据回退为 `saveData` JSON 槽；旧库用 `scripts/migrate-sqlite-to-json.mjs` 一次性迁移。
- 普通文件只做「打开 → 读完/写完 → 立即关闭」，禁止长期持有句柄。
- NDJSON 追加写（`git-push-index/`）在写入瞬间打开、写完即关，不跨操作持有。

⚠️ **必须覆盖 `Plugin.onDataChanged`**：思源 3.8.9 以
`plugin.onDataChanged === Plugin.prototype.onDataChanged` 判断插件是否自行处理存储数据变更，
**未覆盖时每次变更都会整插件重载**（teardown → 重新 eval 脚本 → onload）。同步会连续触发
多次数据变更，插件因此被反复卸载/重载，旧实例在途的 `loadData` 全部返回 410
「Plugin lifecycle has ended」。`PluginSample.onDataChanged`（`src/index.ts`）只重读配置并
应用外观，**禁止在其中写入任何存储** —— 写入会再次触发数据变更。

## 4. 槽位生命周期

1. **声明**：在功能 `types/storage.ts` 建 `TypedStorage`；同时在 `src/config/storage/` 注册元数据。
2. **读写**：一律经 `PluginStorage` / `TypedStorage`。
3. **启动加载**：初始化入口用 `loadOrDefault()`，不得因 `load()` 为 null 跳过（否则默认值不生效）。
4. **写串行**：`load → 修改 → save` 必须串行（模块内 promise 队列），否则并发操作会互相覆盖。
5. **清理**：`PluginStorage.remove()` 走 `plugin.removeData()`；读取方仍需容忍历史遗留的空串。
6. **导出/还原**：只经 `storageManager` 的注册表驱动流程，不写功能私有导出逻辑。
7. **迁移**：见 §7。

## 5. 存储注册表

位置：`src/config/storage/`

```ts
// 一槽一行，便于 audit-storage.mjs 解析
jsonSlot("gitPush.projects", ["gitPush"], "git-push-projects", "Git 项目", {
  growth: true,
  exportable: true,
  resettable: true,
})
```

字段：`id`（唯一，`<owner>.<entity>`）、`owners[]`、`kind`（`json` / `file` / `localStorage`）、
`key`、`labelI18nKey?`、`defaultLabel`、`growth`、`sensitive`、`exportable`、`resettable`、
`restorable?`、`legacyName?`、`notes?`。

**双真相的处理**：注册表只承载元数据，功能代码里的 key 常量仍是写入口；一致性由
`pnpm audit:storage` 双向 diff（源码 → 注册表 / 注册表 → 源码）保证。新增槽位必须在同一提交里
同时出现「注册表条目 + 功能常量」。

```bash
pnpm audit:storage            # 文本报告，退出码 0/1
pnpm audit:storage -- --json  # 机器可读
```

### 例外清单

`scripts/audit-storage.config.json` 用于记录「有意不一致」的条目，**每个例外都必须在 `reasons` 里写清原因**：

| 字段 | 含义 |
|---|---|
| `ignoreKeys` | 源码侧误报：key 确实存在，但注册表有意不登记（如通用存储层的动态中转 key） |
| `ignoreZombie` | 注册表侧保留、但源码已不再读写的条目（典型：功能已移除，保留旧槽供数据管理面板清空/备份旧数据） |
| `reasons` | `key → 原因`。audit 命中例外时打印 `↷ 忽略… — 原因`；缺原因打印 warning（不改变退出码） |

> 能用「补登记 / 删条目」消除的漂移**不要**进例外清单；例外只用于确实无法在代码侧对齐的情况。
> 例：`git-push-custom-ides` 因 IDE 管理功能已在 `805a6c16` 移除而保留为僵尸条目，旧数据仍需可见、可清理。

## 6. 备份与还原契约

### 6.1 全量备份

- 入口：`src/utils/settingsBackup.ts`（`storageManager` 面板调用）。
- 直接递归打包插件数据目录为 zip；不持有运行期句柄，不需要数据库快照。
- 产物：`<workspace>/data-backup/sn-plugin-<YYMMDD-HHmmss>.zip`。

### 6.2 运行中还原（逻辑还原）

1. 先自动做一次全量备份（失败即中止）。
2. JSON 槽：从 zip 顶层按 key **原样读取文本** → `saveData`（字符串槽不是 JSON，
   禁止强制 `JSON.parse`）；全量还原不受 `exportable` 限制。
3. 文件槽：仅 `git-push-index` 可还原（整目录替换）；`bin/`、`bfg-backups/` 跳过。
4. 旧备份中的 `plugin.db` / `-wal` / `-shm` 一律跳过并在报告中注明。
5. 完成后 `emitCustomEvent("storageRestored")`，提示用户重载插件；**不自动 reload**。
6. 报告区分 applied / failed / skipped，部分失败也显示计数与首个错误。

### 6.3 原始还原（二进制整目录）

必须在**禁用插件后**手动解压 zip 覆盖 `petal/<plugin>/`。运行中不要尝试。

## 7. 一次性迁移

- SQLite → JSON：`pnpm migrate:sqlite-to-json`（脚本 `scripts/migrate-sqlite-to-json.mjs`）。
  - **建议先禁用插件或退出思源后运行**，避免运行中的插件同时写同一份数据；
  - 默认从 `.env.local` 的 `VITE_SIYUAN_WORKSPACE_PATH` 解析数据目录，也可传
    `--data-dir` / `--workspace`；
  - 只读旧 `plugin.db`，写出对应 JSON 槽；目标槽已有非空数据时跳过（`--force` 覆盖）；
  - 确认无误后加 `--delete-db` 删除 `plugin.db` / `-wal` / `-shm`；
  - 脚本不参与插件打包，仅 Node 24+ 可运行。
- 运行时**禁止**做「每次启动侦测并导入」；迁移必须由显式脚本或一次性 marker 守卫。
- 不把迁移逻辑塞进功能初始化路径。

## 8. 新增槽位 checklist

- [ ] 选择 JSON / 文件 / localStorage（按 §1 判据；禁止 SQLite）
- [ ] key 符合 kebab-case、不带 `.json`；文件目录 kebab-case
- [ ] 在 `src/config/storage/` 登记（含 growth / sensitive / exportable / resettable）
- [ ] `DEFAULT_XXX` 注册在 `types/storage.ts`
- [ ] 初始化入口用 `loadOrDefault()`
- [ ] 提供清理/重置路径（或显式登记 `resettable: false` 并说明原因）
- [ ] 增长型数据设置上限或说明清理方式；写操作串行化
- [ ] 敏感数据走 `settingsCrypto`，并在注册表标 `sensitive`
- [ ] 功能 `README.md` 增加「存储」章节（key / 位置）
- [ ] `pnpm audit:storage`、`pnpm typecheck` 通过

## 9. 常见错误

| 错误 | 后果 |
|---|---|
| 使用 SQLite / 持有 `plugin.db` 连接 | Windows 上思源同步 rename 覆盖失败 → 整轮同步报「读写文件或访问网络权限不足」 |
| 用 `plugin.dataDir` 拼路径 | 运行时为 `undefined`，生成相对路径或伪路径；统一用 `resolvePluginDataDir()` / `joinPluginDataPath()` |
| 增长型数组无上限且整份 `save` | 写放大、体积膨胀；必须设上限或改 NDJSON |
| 并发 `load → 修改 → save` 不串行 | 后写覆盖先写，丢数据 |
| 两个功能各写同一个 key | 后写覆盖、类型漂移；共享槽用 `owners[]` + 唯一共享工具 |
| `remove()` 后假设文件消失 | 旧实现只写空串；读取方仍需容忍 `""` |
| localStorage 存业务数据 | 端口变化导致源变化、冷启动丢失；仅白名单可用 |
