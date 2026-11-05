# 插件持久化审计（plugin-persistence-audit）

- 日期：2026-11-05
- 对象：本插件全部持久化形态（`plugin.saveData` JSON 槽、`plugin.db`、裸文件/NDJSON、localStorage）
- 依据：静态走查 + 仓库内既有实测数据（`docs/completed/sqlite-persistence-review.md`）
- 方式：未在真机落盘复核的结论已标「未验证」

## 1. 结论摘要

1. 持久化实际分为 **三套体系**，彼此没有统一视图：
   - **JSON 槽**：约 100 个 key，经 `PluginStorage` → `plugin.saveData` 落到
     `<workspace>/data/storage/petal/<plugin.name>/<key>`，**一 key 一裸文件、无扩展名**。
   - **SQLite**：全插件唯一 `plugin.db`，6 张表，按表名前缀隔离（`wn_` / `es_` / `s3fm_` / `gp_`）。
   - **裸文件**：`git-push-index/*.ndjson` + `meta.json`、`bin/bfg-*.jar`、`bfg-backups/*.bundle`、
     `imageCreation` 的 `cover/` 与 `codeimage/` 图片；另有 3 个 localStorage 键。
2. `src/utils/settingsBackup.ts` 已实现「整目录 zip 备份 + 上传 zip 还原」，但**全仓库 0 调用、0 UI**；
   其备份产物 `data-backup/sn-plugin-*.zip` 与 s3Backup 的 `data-*.zip` 同目录却互不可见。
3. key 命名四种风格并存，无注册表、无审计脚本，`AGENTS.md` 只有 SQLite 一节，
   缺「槽位生命周期 / 备份契约 / 迁移规则 / README 存储章节」。
4. 存在 5 项已确认缺陷（见 §5），其中 `feature-flags.json` 从未落盘会直接影响冷启动开关。
5. 写放大集中在 `rssReader-items`、`git-push-analysis-cache`、`git-push-op-logs`、`statistics-history`，
   符合 `AGENTS.md` 既有判据的「应上 SQLite」条件（见 §4）。

## 2. 持久化资产清单

> 文件位置：除特别标注外，均位于 `<workspace>/data/storage/petal/siyuan-plugin-vite-vue-sn/`。
> `growth` = 记录集合会随使用增长；`敏感` = 含密码/密钥/令牌/请求凭据。
> 本表是 `src/config/storage/` 注册表的核对清单；以 `pnpm audit:storage` 的输出为准。

### 2.1 核心（core）

| key / 文件 | 形态 | growth | 敏感 | 说明 |
|---|---|---|---|---|
| `plugin-settings` | JSON | 否 | 是 | 全局配置；`aiApiKeys` / `aiProfiles[].apiKey` 经 AES-GCM 加密；唯一允许直调 `loadData/saveData` 的键 |
| `feature-flags.json` | 裸文件（派生） | 否 | 否 | `enable*` 开关快照；**当前实际从不落盘**（见 §5-1），降级 `localStorage["sn-plugin-feature-flags"]` |
| `plugin.db` | SQLite | 是 | 否 | 唯一库；含下表 6 张表，WAL 模式（`-wal` / `-shm`） |

### 2.2 JSON 槽（按 owner）

| owner | keys | 数量 | growth | 备注 |
|---|---|---|---|---|
| `generalSettings` | `font-settings`、`codeblock-settings`、`heading-settings`、`list-settings`、`highlight-settings`、`document-font-settings`、`table-style-settings`、`list-style-settings`、`doc-count-settings`、`tabpin-settings`、`appearance-settings` | 11 | 否 | 小配置对象；`clearAllSettings()` 目前是死代码 |
| `pageLock` + `generalSettings`（共享） | `global-password` | 1 | 否 | 存 `{hash, salt}`；generalSettings 误按 `string` 读且会误删（见 §5-3） |
| `gitPush` | `git-push-projects`、`git-push-categories`、`git-push-tags`、`git-push-commit-templates`、`git-push-profiles`、`git-push-custom-ides` | 6 | 是 | 项目/分类/模板/账号；令牌加密 |
| `gitPush` | `git-push-concurrency`、`git-push-concurrency-migration`、`git-push-network-timeout`、`git-push-local-timeout`、`git-push-ops-paused`、`git-push-show-archived`、`git-push-branch-mode`、`git-push-card-layout`、`git-push-compare-base`、`git-push-analysis-view`、`git-push-report-prefs`、`git-push-rulecheck-prefs`、`git-push-commitfix-prefs`、`git-push-dropcommit-prefs`、`git-push-repoclean-prefs`、`git-push-bfg-prefs`、`git-push-index-enabled`、`git-push-index-max-commits`、`git-push-scan-dir`、`git-push-probe-config`、`git-push-default-profile` | 21 | 否 | 小配置/开关 |
| `gitPush` | `git-push-op-logs`、`git-push-analysis-cache`、`git-push-line-stats-cache`、`git-push-consistency-cache`、`git-push-report-cache`、`git-push-index-meta` | 6 | 是 | **写放大重灾区**（analysis-cache 实测 1.49MB / 6786 条） |
| `gitPush` | `script-session-pids` | 1 | 否 | 会话 pid 列表 |
| `passwordVault` | `password-vault-master-password`、`password-vault-verify-salt`、`password-vault-encryption-salt`、`password-vault-hint`、`password-vault-entries`、`password-vault-categories` | 6 | 是 | 条目内容单独加密；导出为明文 JSON（无导入） |
| `docAnalysis` | `doc-analysis-options`、`doc-analysis-platforms`、`doc-analysis-dup-filter`、`doc-analysis-publish-promote`、`doc-analysis-health-settings`、`doc-analysis-view-settings` | 6 | 否 | 配置 + 平台元数据 |
| `s3Backup` + `s3FileManager`（共享） | `s3-backup-config` | 1 | 是 | AK/SK 加密；`s3FileManager` 只读 |
| `s3Backup` | `s3-backup-settings`、`s3-backup-history`、`s3-backup-log`、`s3-backup-checksums`、`s3-backup-upload-host-map` | 5 | 部分 | 有上限（50/200/100/200），仍整份重写 |
| `s3FileManager` | `s3-file-manager-config`、`s3-file-manager-prefs` | 2 | 是 | 配置 + 视图偏好 |
| `rssReader` | `rssReader-settings`、`rssReader-feeds`、`rssReader-items` | 3 | 否 | **`rssReader-items` 标一篇已读重写约 1.2MB** |
| `htmlViewer` | `html-viewer-snippets`、`html-viewer-categories` | 2 | 否 | 片段库 |
| `prompts` | `siyuan-prompts`、`siyuan-categories`；legacy `siyuan-skills` | 3 | 否 | legacy key 只回读不删除 |
| `quickNote` | `quick-note-data`、`quick-note-settings` | 2 | 否 | 有串行写锁 |
| `statusBar` | `statusBar-shortcuts`、`statusBar-monitors`、`statusBar-categories`、`statusBar-feature-category` | 4 | 否 | 小数组/映射 |
| `statistics` | `statistics-history`、`statistics-settings` | 2 | 否 | `history` 每天 +1、无裁剪、整份重写 |
| `statistics` | `milestone-rules`、`milestone-custom-achievements`、`milestone-level-config` | 3 | 否 | 里程碑配置 |
| `flashcardReading` | `flashcard-cards`、`flashcard-typing-settings` | 2 | 否 | 改一张卡重写 126KB（实测） |
| `skillLearning` | `skill-learning-cards`、`skill-learning-preset-loaded` | 2 | 否 | 卡片数组 |
| `pageLock` | `page-lock-data` | 1 | 是 | `Record<docId, PageLockInfo>`，随锁定文档数增长 |
| `encryption` | `encryption_password.json` → `encryption-password` | 1 | 是 | 旧 key 带 `.json` 后缀且**明文存密码**（见 §5-2） |
| `apiDebugger` | `api-debugger-settings` | 1 | 是 | 请求历史含请求头/体，可能带密钥；上限 50 |
| `everythingSearch` | `everything-search-config`、`everything-search-options`、`everything-search-cache-clean` | 3 | 否 | 配置 |
| `imageCreation` | `image-creation-cover-settings`、`image-creation-code-image-settings` | 2 | 否 | 偏好；图片走 `putFile` |
| `docNavigation` | `docNavigation-settings` | 1 | 否 | camelCase 命名（legacy 冻结） |
| `diskBrowser` | `disk-browser-settings` | 1 | 否 | 配置 |
| `minimalBrowser` | `minimal-browser-settings` | 1 | 否 | 书签数据在 `wn_*` 表 |
| `bookmarkMarker` | `bookmark-marker-settings` | 1 | 否 | 规则数组 |
| `textDiff` | `textdiff-settings` | 1 | 否 | 配置 |
| `formatAssistant` | `format-assistant-settings` | 1 | 否 | 配置 |
| `aiContentGenerator` | `ai-content-generator-settings` | 1 | 否 | 配置 |
| `componentPreview` | `component-preview-size` | 1 | 否 | 单值 |
| `toolCollection` | `toolCollection-tabOrder`、`toolCollection-width`、`toolCollection-height`、`word-query-settings`、`plugin-toolCollection-shortcut-custom`；legacy `plugin-shortcuts-custom`、`plugin-shortcuts-all` | 5+2 | 否 | legacy key 迁移后已删 |
| `scriptLauncher` | `scriptLauncher-scripts`、`scriptLauncher-settings`、`scriptLauncher-running-processes` | 3 | 否 | 脚本清单落 `data/storage/sc/*` |
| `resourceManager` | `resourceManager-customCategories`、`resourceManager-hiddenBuiltIn` | 2 | 否 | 分类列表 |

### 2.3 SQLite 表（`plugin.db`）

| 表 | 模块 | growth | 结构要点 |
|---|---|---|---|
| `wn_entries` | websiteNavigation / minimalBrowser | 是 | `id PK, name, url, category, description, created_at, updated_at`；索引 `category` |
| `wn_categories` | websiteNavigation / minimalBrowser | 是 | `id PK, name, color, sort`；空库播种默认分类 |
| `es_clean_history` | everythingSearch | 是 | 清理历史，上限 500 行，时间索引 |
| `s3fm_logs` | s3FileManager | 是 | 文件操作日志，上限 200 行 |
| `gp_project_stats` | gitPush | 是 | 项目行数统计；`repo_id` 用 `ALTER` 补列 |
| `gp_file_lines` | gitPush | 是 | 文件行数明细，PK `(project_id, path)` |

### 2.4 文件槽

| 路径 | 模块 | growth | 说明 |
|---|---|---|---|
| `git-push-index/`（`commits.ndjson` / `files.ndjson` / `filelines.ndjson` / `meta.json`） | gitPush | 是 | 增量追加、全量载入；NDJSON 形态合适，**不迁 SQLite** |
| `bin/bfg-*.jar` | gitPush | 否 | 可重新下载，备份可不含 |
| `bfg-backups/<项目>/*.bundle` | gitPush | 是 | 保留 3 份，可重生成 |
| `cover/`、`codeimage/` | imageCreation | 弱 | `putFile` 写入的图片 |
| `<workspace>/data-backup/sn-plugin-*.zip` | settingsBackup | 是 | 插件整目录备份产物（当前无 UI 生成） |
| `<workspace>/data-backup/data-*.zip` | s3Backup | 是 | 工作区数据备份产物 |

### 2.5 localStorage

| key | 模块 | 说明 |
|---|---|---|
| `sn-plugin-feature-flags` | core | 功能开关降级缓存（当前为**实际生效**路径） |
| `siyuan-ytdlp-path` | video | yt-dlp 自定义路径 |
| `siyuan-ffmpeg-path` | video | ffmpeg 自定义路径 |

## 3. 写放大热点

| 槽位 | 触发动作 | 重写量 | 依据 |
|---|---|---|---|
| `rssReader-items` | 标记一篇文章已读/收藏 | 约 1.2MB | 实测（sqlite-persistence-review §2.2） |
| `git-push-analysis-cache` | 一次分析 | 1.49MB / 6786 条 | 实测；改 1 条 ×20 次 = 181ms vs SQLite 14ms（约 13x） |
| `git-push-report-cache` / `-consistency-cache` | 生成报告/一致性检查 | 数百 KB~MB | 静态走查 |
| `git-push-op-logs` | 每条日志（1s 防抖） | 300 条整份 | 静态走查 |
| `statistics-history` | 每日快照 | 逐日增长、无裁剪 | 静态走查 |
| `flashcard-cards` | 改一张卡 | 126KB | 实测 |
| `siyuan-prompts` / `html-viewer-snippets` / `page-lock-data` | 单条增删改 | 全量数组重写 | 静态走查 |
| `git-push-line-stats-cache` | 行数统计 | 与 `gp_project_stats` + `filelines.ndjson` **三重存储** | 静态走查 |

## 4. SQLite 迁移路线

判据（与 `AGENTS.md` 一致）：**`growth && (单条写会重写 >50KB 数组 || 体积 >150KB)`，或需要条件查询/排序/聚合。**

### P0（下一轮优先）

1. `rssReader-items` → 表 `rss_items`
   ```sql
   CREATE TABLE IF NOT EXISTS rss_items (
     id TEXT PRIMARY KEY,
     feed_id TEXT NOT NULL,
     title TEXT NOT NULL,
     link TEXT,
     author TEXT,
     published_at INTEGER,
     fetched_at INTEGER,
     read INTEGER NOT NULL DEFAULT 0,
     starred INTEGER NOT NULL DEFAULT 0,
     content TEXT,
     payload_json TEXT
   );
   CREATE INDEX IF NOT EXISTS idx_rss_items_feed_pub ON rss_items(feed_id, published_at DESC);
   ```
   已读/收藏改为单行 `UPDATE`；列表按 feed 分页查询。`rssReader-feeds` / `-settings` 保持 JSON。

2. gitPush 三个缓存 → `gp_op_logs` / `gp_analysis_cache` / `gp_report_cache`
   - `gp_op_logs(id INTEGER PK AUTOINCREMENT, ts INTEGER, level TEXT, message TEXT, payload_json TEXT)`，插入后按 300 条裁剪。
   - `gp_analysis_cache(project_id TEXT PRIMARY KEY, head_oid TEXT, generated_at INTEGER, payload_json TEXT)`。
   - `gp_report_cache(project_id TEXT PRIMARY KEY, kind TEXT, generated_at INTEGER, payload_json TEXT)`。
   - **同时下线** `git-push-line-stats-cache`（与 `gp_project_stats` / `gp_file_lines` 重复）。

### P1

`statistics-history`（`stat_daily(date TEXT PK, ...ohlc_json)`）、`flashcard-cards`、`siyuan-prompts`、
`page-lock-data`、`html-viewer-snippets`、`git-push-projects`。

### P2 / 不迁移

- `<20KB` 设置项：需保持同步读 + 加密链路，迁移收益为负。
- `plugin-settings`：加密与兼容逻辑集中，保持单键。
- `password-vault-entries`：单文档加密 payload，拆表会破坏加密封装。
- `git-push-index`：NDJSON 增量追加已优于 SQLite 逐行写。

### 迁移工程约束（写进规则）

- 必须「双读单写」+ 一次性 marker 守卫，禁止每次启动侦测。
- 成功后删除旧 key；失败保留旧 key 并记录原因。
- 迁移前后各做一次 `snapshotTo()` 快照。

## 5. 缺陷清单

| # | 缺陷 | 证据 | 影响 |
|---|---|---|---|
| 1 | `feature-flags.json` 从不落盘 | `src/index.ts:136` 传 `plugin.dataDir`（运行时 undefined）；`src/config/settings.ts:223,249,279-308` | 冷启动开关回落默认值；文件备份拿不到开关 |
| 2 | `encryption_password.json` 明文 + 后缀 | `src/features/encryption/types/storage.ts:9,34-35` | 密码明文落盘；key 命名不合规 |
| 3 | `global-password` 双归属 | `generalSettings/types/storage.ts:349,383`；`pageLock/types/storage.ts:27` | 类型不一致；「恢复默认」会删掉页面锁密码 |
| 4 | `indexDir.ts` 把插件目录当工作区根 | `gitPush/managers/indexDir.ts:27` | 若 `dataDir` 被注入会生成 `<petal>/storage/petal/...` 错误路径 |
| 5 | 路径推导三套并存 | `statistics/index.vue:251-262`、`passwordVault/composables/usePasswordVaultData.ts:331-337`、`flashcardReading/components/PanelHeader.vue:79` | UI 展示伪路径；用户无法定位真实文件 |
| 6 | 备份不保证一致 | `settingsBackup.ts:35-64`（checkpoint 在并发写时可能 busy）；`s3Backup/modules/BackupManager.ts:246-270`（直接打包活动库） | zip 内可能是「新 .db + 旧 -wal」组合 |
| 7 | `PluginStorage.remove` 只写空串 | `utils/pluginStorage.ts:95-103` | 文件残留；读取方语义不一致 |
| 8 | `plugin.db` 无连接单例、`user_version` 被单方写 | 4 处 `new DatabaseSync`；`websiteStorage.ts:212` | 未来库级迁移会互相踩踏（P1 架构债） |
| 9 | 设置源重复 | `plugin-settings.statisticsUpdateInterval` vs `statistics-settings.refreshInterval` | 易分叉 |

## 6. UI 缺口

- 无插件级「存储总览」：数据目录、文件数、总量、各槽位大小/条数均不可见。
- 无「导出/导入」：`settingsBackup.ts` 未接线；100+ 槽位无任何导出入口。
- 无「统一清理」：清空入口散落在 apiDebugger / s3Backup / s3FileManager / gitPush / everythingSearch。
- 无「恢复默认」：`GeneralSettingsStorage.clearAllSettings()` 为死代码，且会误删全局密码。
- 唯一展示路径的 statistics 面板显示的是伪路径且默认收起。

## 7. 处理状态

| 项 | 本轮处理 |
|---|---|
| §5-1 / 2 / 3 / 4 / 5 / 6 / 7 | 修复（见 Phase 2） |
| §5-8 / 9 | 登记为 P1 架构债，不修 |
| §4 P0/P1 迁移 | 只出清单，不执行 |
| 统一界面 | 新增 `storageManager` Dock 面板（总览 / 备份与还原 / 诊断） |
| 规则 | 写入 `AGENTS.md` § 持久化规范 + `docs/参考/persistence.md` |

## 8. 复现方式

```bash
pnpm audit:storage        # 源码 key ↔ 注册表双向核对
pnpm test                # registry.spec.ts + utils.spec.ts
```

真机检查（不做浏览器自动验证）：完全退出思源后重启，确认 `petal/<plugin>/feature-flags.json` 存在；
在数据管理面板对照 `plugin.db` 文件大小、JSON 槽大小与 localStorage 三键。
