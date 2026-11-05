# 数据管理（storageManager）

统一的插件持久化数据控制台，Dock 侧边栏面板（宽 440px），三个 Tab：

| Tab | 能力 |
|---|---|
| 总览 | 汇总卡片（JSON / SQLite / 文件 / localStorage / 敏感项）+ 按功能分组的槽位列表（大小、条数、时间、路径），可清空可重置槽位 |
| 备份与还原 | 一键全量 zip 备份（SQLite 自动一致性快照）、备份列表（还原 / 删除）、上传 zip 还原、按模块导出/导入 JSON（可选是否含敏感项） |
| 诊断 | 增长型槽位超过 150KB 的迁移提示，指向 `docs/plugin-persistence-audit.md` 的 P0/P1 路线 |

## 目录结构

```
storageManager/
├── index.ts                 # registerStorageManager（Dock 创建 + 自挂载）
├── index.vue                # 面板外壳：头部、数据目录、Tabs、清空确认
├── composables/
│   └── useStorageManager.ts # 视图状态 / 刷新 / 通知
├── components/
│   ├── SummaryCards.vue
│   ├── OverviewTab.vue
│   ├── SlotRow.vue
│   ├── BackupTab.vue
│   ├── BackupListItem.vue
│   ├── ModuleTransfer.vue
│   └── DiagnosticsTab.vue
├── modules/
│   ├── context.ts           # 插件数据目录 + Node 模块上下文
│   ├── inventory.ts         # 用量盘点（stat / COUNT(*) / 递归文件统计）
│   ├── moduleTransfer.ts    # 按模块导出/导入（JSON + SQLite 表）
│   ├── backup.ts            # 全量备份 / zip 逻辑还原
│   └── reset.ts             # 单槽清空
├── types/
│   ├── index.ts             # StorageManager 类（对外 API）
│   ├── model.ts             # 领域类型
│   └── i18n.ts
├── utils.ts                 # formatBytes / formatTime / 阈值判定（纯函数）
└── styles/                  # index.scss（外壳/通用）+ 各组件专属样式
```

## 对外 API（`StorageManager`）

```ts
getInventory(force?: boolean): Promise<StorageInventory>
exportModule(owners, { includeSensitive }): Promise<Blob>
importModule(file: File): Promise<ImportReport>
createFullBackup(): Promise<BackupResult>
listBackups(): Promise<PluginBackupListItem[]>
deleteBackup(fileName: string): Promise<boolean>
restoreFromZip(file: File): Promise<ImportReport>
resetSlot(slotId: string): Promise<SlotActionResult>
destroy(): void
```

- 导入/还原前**强制全量快照**，失败即中止。
- SQLite 表按「`DELETE` + 参数化 `INSERT`，单表事务」写回；表名/列名先与当前 schema 求交。
- 只接受 `src/config/storage/` 注册表内的槽位；未知 key 拒绝。
- 完成后派发 `storageRestored` 事件并提示重载插件，不自动 reload。

## 存储

本功能自身不写业务数据；它读取 `src/config/storage/` 的注册表并操作用户数据。

| 数据 | 位置 | 说明 |
|---|---|---|
| 备份产物 | `<workspace>/data-backup/sn-plugin-*.zip` | 复用 `@/utils/settingsBackup`；SQLite 走在线快照，zip 内不含 `-wal/-shm` |
| 临时快照 | `<workspace>/data-backup/.tmp/` | 备份/还原期间使用，`finally` 清理 |
| 导出文件 | 用户下载目录 | `storage-export-<ts>.json`（`slots` + `tables`） |

## 安全边界

- 运行中只做**逻辑还原**，不覆盖活动 `plugin.db`；二进制整库还原需禁用插件后手动进行（见 `docs/参考/persistence.md`）。
- 敏感槽位（密码哈希、令牌、API Key、请求凭据）导出默认排除，需用户显式勾选；core 槽位与高敏槽位不可清空。
