---
name: s3Backup 增量备份/还原审查修复与独立实验性 Tab 迁移
overview: 对 s3Backup 增量备份/增量还原做完整代码审查修复（3 个 P1 问题 + 已知限制标注），并将增量手动操作从备份 Tab 迁移到新的第 5 个「增量（实验性）」Tab，含实验性警告横幅、云端 manifest 状态展示、打开还原目录按钮三项增强。备份模式三开关保留在配置 Tab 不动。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex 风格
    - 边框卡片
    - 语义色 Token
    - 实验性 badge
    - 等宽字体点缀
    - 与现有 Tab 一致
  fontSystem:
    fontFamily: 等宽/无衬线混合（项目 $vp-mono Token）
    heading:
      size: $font-size-base
      weight: .nan
    subheading:
      size: $font-size-sm
      weight: .nan
    body:
      size: $font-size-xs
      weight: .nan
  colorSystem:
    primary:
      - $color-primary
      - $color-accent
    background:
      - $color-bg
      - $color-surface
      - warning-lightest（横幅浅底）
    text:
      - $color-fg
      - $color-muted
    functional:
      - $color-warning（badge/横幅边框）
      - $color-danger
      - $color-success
todos:
  - id: fix-incremental-core
    content: 修复 useIncrementalBackup 三处 P1：删除阶段并发+重试+失败回填 manifest、还原过滤路径 console.warn 与跳过计数上报
    status: completed
  - id: create-incremental-panel
    content: 新建 useIncrementalPanel composable：迁入增量触发逻辑并修复静默返回，新增 manifest 信息加载、lastRestoreDir 记录、openRestoreFolder，瘦身 useBackupOrchestrator
    status: completed
    dependencies:
      - fix-incremental-core
  - id: create-incremental-tab
    content: 新建 IncrementalTab.vue + IncrementalTab.scss：实验性横幅、云端清单状态卡、操作按钮卡（含打开还原目录）、进度区
    status: completed
    dependencies:
      - create-incremental-panel
  - id: wire-tab-and-cleanup
    content: index.vue 新增第五 Tab（含实验 badge），ManualBackupCard 与 BackupTab 移除增量按钮及绑定，index.scss 加 badge 样式
    status: completed
    dependencies:
      - create-incremental-tab
  - id: i18n-and-readme
    content: 补充 zh_CN/en_US 双语 i18n 键（约 12 个，模板加中文注释），同步更新 s3Backup/README.md
    status: completed
    dependencies:
      - wire-tab-and-cleanup
---

## 用户需求

对 `src/features/s3Backup` 的增量备份与增量还原功能进行完整代码审查，并将两个手动操作按钮（增量备份/增量还原）迁移到新的独立 Tab 页，标注实验性。

## 审查发现的问题（需全部修复）

1. **P1-静默返回**：`useBackupOrchestrator.ts` 的 `triggerIncrementalRestore` 在非桌面环境（`!pathModule`）直接 return，无任何提示（`MSG_DESKTOP_ONLY` 常量已存在未使用）
2. **P1-删除阶段缺陷**：`useIncrementalBackup.ts` 远端删除（a）无重试——上传有 `withRetry(2次)` 而删除只有 try/catch；（b）串行 for-await 执行；（c）删除失败后条目已从新 manifest 消失 → 永久孤儿对象且下次不再尝试删除
3. **P1-过滤静默**：`performIncrementalRestore` 的路径穿越安全过滤完全静默（无 console.warn、跳过数量未上报）

## 新 Tab 需求（用户已确认）

- 配置 Tab「备份模式」三开关保留不动，仅手动按钮迁移
- 新 Tab 内容含四部分：实验性警告横幅（含已知限制说明）、云端清单状态展示（文件数/生成时间/来源设备，需下载 manifest）、增量备份/增量还原操作按钮 + 打开还原目录按钮（还原完成后记录目标目录一键打开）、进度显示

## 已知限制（写入横幅说明，不改逻辑）

- 多设备共享同一 manifest 会互删对方独有文件（单工作区假设）
- 还原目录 `incremental-restore-<timestamp>` 无清理上限
- 还原不覆盖 data/，需手动替换

## 技术栈

- Vue 3 + TypeScript + SCSS（项目现有栈，零新依赖）
- 复用：`@/utils/electronDialog` 的 `openFolderInExplorer(path)`（支持任意路径，还原目录打开直接复用）、`BackupProgressSection.vue`、设计 Token（`$color-*` 等）

## 实现方案

### 一、P1 修复（useIncrementalBackup.ts）

1. **删除阶段重试 + 并发 + 失败回填**：改用 `runWithConcurrency(diff.toDelete, UPLOAD_CONCURRENCY, ...)` + 复用现有 `withRetry`；删除失败的条目从 `oldManifest.files` 回填进新 manifest（下次 diff 仍会进入 toDelete 重删，幂等且消除永久孤儿）。首次备份（oldManifest=null）时 toDelete 为空，回填逻辑安全。删除失败计数计入 result 并在结果消息中体现
2. **还原过滤路径上报**：拆出 `unsafePaths` 列表，非空时 `console.warn` 逐条 + 在结果日志 message 中追加新 i18n 键 `incrementalRestoreSkippedUnsafe`（`"已跳过 {count} 个不安全路径"`）

### 二、增量面板逻辑抽取（新 composable，解决编排层超行数阈值）

`useBackupOrchestrator.ts` 当前 503 行已超 500 硬阈值，且本次还要新增 manifest 信息/lastRestoreDir 状态。方案：新建 `composables/useIncrementalPanel.ts`（约 190 行），迁移并扩展增量相关逻辑：

- **迁入**：`isIncrementalRunning`/`isIncrementalRestoring` 状态、`triggerIncrementalOnly`、`triggerIncrementalRestore`（迁移时一并修复 P1-1：`!pathModule` 时 `showMessage(MSG_DESKTOP_ONLY)` 后 return）、`runIncrementalBackup`
- **`useIncrementalBackup()` 实例化移入本文件**（performIncrementalBackup/performIncrementalRestore 直接在此接线）
- **新增**：
- `incrementalManifestInfo: Ref<{fileCount, createdAt, hostname} | null>` + `isLoadingManifest` + `refreshIncrementalManifest()`（复用 `loadRemoteManifest` 思路：`getObjectText(buildManifestKey(...))` → `parseManifest` → 投影三字段；404 → null 显示"暂无清单"）
- `lastRestoreDir: Ref<string>`（`triggerIncrementalRestore` 成功后写入还原目标目录）
- `openRestoreFolder()`（`openFolderInExplorer(lastRestoreDir)`，失败 showMessage 路径兜底）
- **依赖注入**：getBackupManager、isConfigured、s3Config、s3SubPrefix、workspaceRoot、localBackupDir、ensureWorkspaceReady、backupProgress、statusTask、isAnyTaskRunning、addLog、i18n（全部由编排层传入）
- `useBackupOrchestrator` 组合 `useIncrementalPanel` 并透传导出到聚合对象（对外 orch 接口字段不变，`isIncrementalRunning` 等绑定迁至新 Tab），编排层行数降至约 460 行

### 三、新 Tab UI

- `index.vue`：`activeTab` 联合类型加 `"incremental"`；Tab 栏新增按钮 `{{ i18n.incrementalTab }}` + `<span class="s3-tab-badge">{{ i18n.experimentalBadge }}</span>`；内容区挂 `<IncrementalTab v-if="activeTab === 'incremental'" :orch="orch" :i18n="i18n" />`
- 新组件 `components/IncrementalTab.vue`（约 150 行，接收 orch + i18n，与 BackupTab 同模式）：

1. **实验性警告横幅**：warning 语义色边框卡片，正文 = `i18n.incrementalExperimentalHint`（实验性 + 三条已知限制）
2. **云端清单状态卡片**：刷新按钮（`refreshIncrementalManifest`，loading 态）+ 信息网格（文件数/生成时间/来源设备，复用 WorkspaceInfoCard 的 `workspace-info-grid` 布局类）；未配置 S3 / 无清单 / 加载失败三种状态文案
3. **增量操作卡片**：增量备份按钮（`triggerIncrementalOnly`）+ 增量还原按钮（`triggerIncrementalRestore`，confirm 确认在内部）+ 打开还原目录按钮（`v-if="orch.lastRestoreDir"`，`openRestoreFolder`）
4. **进度区**：`<BackupProgressSection v-if="orch.isAnyTaskRunning" ...>` 复用

- 子组件自包含：onMounted 时若 isConfigured 自动 `refreshIncrementalManifest()`；还原完成后由编排层 lastRestoreDir 驱动按钮出现
- 样式 `styles/IncrementalTab.scss`：横幅（`$color-warning` 边框 + `--warning-lightest` 浅底）、清单信息网格、空态文案；Tab badge 样式（`.s3-tab-badge`）追加到 `styles/index.scss` 的 s3-tab-bar 区域

### 四、移除旧入口

- `ManualBackupCard.vue`：删除增量备份按钮（31-40 行）、增量还原按钮（41-50 行）、`isIncrementalRunning`/`isIncrementalRestoring` props、`triggerIncremental`/`triggerIncrementalRestore` emits（`backupModeS3Incremental` prop 保留，backupHintText 仍使用）
- `BackupTab.vue`：删除对应 props 传递与事件绑定（36-44 行中的增量四行）

### 五、i18n 与文档

- `src/i18n/{zh_CN,en_US}/s3Backup.json` 新增约 12 键：incrementalTab、experimentalBadge、incrementalExperimentalHint、incrementalManifestInfo、manifestFiles、manifestCreatedAt、manifestHost、manifestNotFound、manifestLoadFailed、openRestoreFolder、incrementalRestoreSkippedUnsafe 等（en_US 对应翻译）
- 模板中每处 i18n 渲染加中文 HTML 注释
- `s3Backup/README.md` 同步：Tab 结构（5 Tab）、增量实验性说明、已知限制

## 执行注意

- `withRetry`/`runWithConcurrency`/`UPLOAD_CONCURRENCY` 均在 `useIncrementalBackup.ts` 内已有，直接复用
- 删除失败回填 manifest 时 `oldManifest` 需非空断言保护（toDelete 非空则 oldManifest 必非 null，逻辑上已保证，仍建议显式守卫）
- 验证链由用户执行：`pnpm i18n:verify`、`npx tsc --noEmit`、`pnpm lint`（AI 不执行构建/lint）
- 行数守恒：所有新文件 <300 行；useBackupOrchestrator 移出增量逻辑后回到阈值内

## 目录结构

```
src/features/s3Backup/
├── index.vue                              # [MODIFY] Tab 栏 + activeTab 类型加 "incremental"，挂载 IncrementalTab
├── components/
│   ├── IncrementalTab.vue                 # [NEW] 增量实验 Tab：警告横幅 + 清单状态 + 操作按钮 + 进度
│   ├── BackupTab.vue                      # [MODIFY] 移除增量 props/事件传递
│   └── ManualBackupCard.vue               # [MODIFY] 移除两个增量按钮及相关 props/emits
├── composables/
│   ├── useIncrementalPanel.ts             # [NEW] 增量面板状态：触发入口(迁移)+manifest 信息+lastRestoreDir+打开目录
│   ├── useBackupOrchestrator.ts           # [MODIFY] 增量逻辑迁移至 useIncrementalPanel，组合透传（503→约460行）
│   └── useIncrementalBackup.ts            # [MODIFY] P1 修复：删除重试+并发+失败回填、过滤路径上报
├── styles/
│   ├── IncrementalTab.scss                # [NEW] 横幅/清单网格/badge 样式（设计 Token）
│   └── index.scss                         # [MODIFY] 追加 .s3-tab-badge 样式
├── README.md                              # [MODIFY] Tab 结构与实验性说明同步
src/i18n/zh_CN/s3Backup.json               # [MODIFY] 新增约 12 个增量 Tab 相关键
src/i18n/en_US/s3Backup.json               # [MODIFY] 对应英文翻译
```

新 Tab 页 UI 严格遵循项目强制的 Codex 风格（等宽字体点缀、边框卡片、语义色、禁 box-shadow），与 s3Backup 现有四个 Tab 视觉完全一致，不做额外风格发挥。

Tab 栏：现有 `.s3-tab-btn` 样式新增第五个按钮「增量」，右侧紧跟小型 badge「实验」（`$color-warning` 边框 + warning 浅底 + `$font-size-2xs` 大写小标签，等宽字体），一眼传达实验性定位。

IncrementalTab 四个区块自上而下：

1. 实验性警告横幅：warning 语义色左边框卡片，列出实验性说明与三条已知限制，视觉上明显区别于普通卡片
2. 云端清单状态卡：标题 + 刷新按钮（loading 转圈），下方信息网格三列（文件数/生成时间/来源设备），复用 WorkspaceInfoCard 的 label+value 布局语言
3. 增量操作卡：按钮行（增量备份 ghost / 增量还原 ghost / 打开还原目录 ghost，条件显示），禁用态与 loading 态对齐 ManualBackupCard 既有按钮行为
4. 进度区：复用 BackupProgressSection，样式零新增

交互细节：清单信息在 Tab 打开且 S3 已配置时自动加载一次；还原完成后「打开还原目录」按钮渐入；所有操作按钮在任一任务运行中统一禁用（互斥守卫已有）。