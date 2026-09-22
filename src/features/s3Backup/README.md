# S3 备份

将思源笔记工作区备份到 S3 兼容存储（MinIO、Ceph、AWS S3 等），支持手动备份、备份列表管理、下载与删除。

## 功能

- **S3 配置**：支持自定义 endpoint、access key、secret key、bucket、region、path style、HTTPS 等
- **本地 ZIP 备份**：打包 data/ 为 `data-*.zip` 保存到工作区 `data-backup/` 目录（可选按日期建 `data-YYYYMMDD/` 子文件夹）
- **S3 上传**：上传 `data-backup/` 中的备份 ZIP 到 S3；与本地 ZIP 同时勾选时仅上传本次新生成的 ZIP。上传前按云端已有对象去重（全 key 精确匹配 + 文件名尾部匹配兜底）
- **S3 增量备份**：基于云端 manifest 对比，仅上传新增/变更文件，并清理本地已删除文件
- **备份管理**：查看云端备份列表，支持下载、删除；本地列表含日期子文件夹内的备份，保留数清理只删除插件生成的 `data-*.zip`（用户手工放入的归档不受影响）。下载中按钮进入 loading 且文案切「下载中」，完成后在面板内常驻展示结果；本地/云端删除均写入操作日志
- **连接测试**：保存配置前可测试 S3 连接是否正常

## 使用方式

1. 在设置中启用「S3 备份」功能
2. 打开 S3 备份面板，填写 S3 服务器配置
3. 点击「测试连接」验证配置正确
4. 点击「保存配置」
5. 选择工作区路径后，点击「立即备份」
6. 可在云端备份列表查看、下载或删除历史备份

面板含五个 Tab：**备份**（工作区信息/进度/手动备份/备份列表）、**配置**（备份模式/自动备份/S3 配置）、**日志**、**校验**、**增量**（实验性：增量备份/还原专属入口 + 云端清单状态 + 还原目录一键打开）。

## 增量备份（实验性）

增量备份/增量还原为**实验性功能**，独立入口在「增量」Tab。在「配置」Tab 的备份模式中开启「S3 增量备份」（默认关闭，可与本地 ZIP / S3 上传叠加，纳入「立即备份」组合与自动备份）。

**工作原理**：
- 扫描 `{workspace}/data`（跳过 temp/.recycle/filesys_status_check），与云端清单 manifest（`relativePath → {mtime, size}`）对比
- mtime 或 size 任一变化即视为修改（宽松触发，宁多传不漏传）
- 新增/变更 → 覆盖式上传到 `{prefix}/{s3SubPrefix}/incremental/data/{relativePath}`（固定 key，4 并发 + 2 次重试）
- 本地已删除 → 4 并发删除对应 S3 对象（2 次重试）；删除失败的条目回填新 manifest，下次备份继续重试删除，不残留永久孤儿对象
- 完成后上传新 manifest 到 `{prefix}/{s3SubPrefix}/incremental/manifest.json`

**失败恢复语义**：manifest 以 S3 为唯一事实源；上传失败的文件不写入新 manifest（下次自动重传），删除失败的条目回填旧条目（下次重删），均幂等收敛。首次备份（无 manifest / 404）全量上传。扫描结果为空时中止备份，防止误删全部远端文件。

### 增量还原

「压缩包备份」位于备份 Tab 的手动备份卡片；「增量备份」「增量还原」位于「增量」Tab（不依赖备份模式开关；需 S3 已配置）：

- **压缩包备份**：单独触发一次本地 ZIP 打包，与「立即备份」的模式分发互不影响
- **增量备份**（增量 Tab）：单独触发一次增量上传，与「立即备份」的模式分发互不影响
- **增量还原**（增量 Tab）：确认后按云端 manifest 并发下载（4 并发 + 2 次重试）全部文件到 `{workspaceRoot}/{localBackupDir}/incremental-restore-{时间戳}/`，保持 data/ 的目录结构。**不会覆盖运行中的 data/**，如需恢复请关闭思源后手动替换。下载失败的文件计入失败数并在日志中记录，可重新执行还原重试。云端无 manifest 时给出明确提示；清单中被路径穿越防护过滤的不安全路径会计数提示「已跳过 N 个不安全路径」（控制台留痕明细）。还原成功后记录目标目录，可一键打开。

**已知约束**：
- **多设备互删**：云端清单以「最后备份者」为准，两台设备交替增量备份会互删对方独有的文件（单工作区假设），多设备场景请使用全量 ZIP 备份
- **还原目录膨胀**：每次增量还原生成新的 incremental-restore-{时间戳} 目录，无自动清理
- 云端备份列表使用 ListObjects V1 自动翻页（最多 100 页 × 1000 个对象），增量小文件已从列表过滤但仍占用列举配额
- mtime 被同步盘/文件恢复工具还原且 size 不变时可能漏检该文件（罕见场景）

### 大文件上传策略

三条上传入口（全量上传 / 增量备份 / 手动上传）共用「大文件感知」上传：文件 > 100MB 自动走 S3 Multipart 分片上传（fd 定位读、单分片 16MB、内存峰值恒定），≤100MB 保持整读单 PUT；任一分片失败会中止会话并整文件重试。若存储端（OpenList/Alist 等代理）不支持 Multipart 协议，自动降级为整包单 PUT 并在控制台保留「大文件整体读入内存上传」警告。分片实现位于共享层 `src/utils/s3/s3Multipart.ts`（`S3Client` 本体零改动）。

## 反馈通道约定（重要）

本面板由 `createModalVueApp` 承载，遮罩固定 `z-index: 10000`（见 `src/utils/vueAppHelper.ts`）；而思源全局提示 `#message`（`.b3-snackbars`）的层级取自运行时自增的 `window.siyuan.zIndex`（基准 10）。**面板打开期间 `showMessage` 的提示会被遮罩完全盖住**。

因此约定：**关键操作结果必须写回面板内状态**（如下载的 `downloadingKey` 按钮 loading + `lastDownloadResult` 常驻结果条，或 `statusTask` 状态栏），`showMessage` 仅作面板关闭后的补充，不得作为唯一反馈。新增交互时请遵循此约定。

> 已知权衡：`styles/index.scss` 被 11 个子组件以 `scoped` 方式 `@use`，导致 `.card-section` / `.section-header` / `.form-hint` / `.empty-state` 等基座规则在 `dist/index.css` 中重复若干次。这是仓库 84 个组件共用的既有约定，单独调整会造成不一致，故保留现状。

## S3 兼容性

使用 AWS Signature V4 签名协议，兼容以下 S3 存储：
- MinIO
- Ceph (RADOS Gateway)
- AWS S3
- LocalStack
- DigitalOcean Spaces
- 任何 S3-compatible 存储

## 技术实现

- **签名算法**：AWS Signature V4，基于 Node.js crypto 模块，无外部 SDK 依赖
- **备份方式**：本地 ZIP 打包（JSZip）→ 上传 `data-backup/` 中的 ZIP（上传超时可配置（默认 240s），扫描跳过 temp/.recycle/filesys_status_check 目录）。S3 key 的日期段取备份文件自身日期（日期子目录名或文件名内嵌日期，YYYYMMDD），与本地目录语义一致；手动上传与自动上传共用同一 key 规则（`utils.buildBackupUploadKey`），保证跨备份去重可命中。ZIP 打包中断时自动清理半成品文件（删除失败时改名 `.part`，避免损坏包被当作有效备份）
- **增量对比**：`utils.ts` 纯函数 diff（mtime+size 快筛）+ `composables/useIncrementalBackup.ts` 编排，绝不使用 listObjects 做增量判断（1000 条截断风险）
- **任务互斥**：立即备份/压缩包备份/增量备份/增量还原以及自动备份触发共用运行守卫，任一任务运行中不并发启动新任务（自动备份遇忙记日志跳过）
- **存储**：PluginStorage + TypedStorage 持久化配置；操作日志上限 200 条（单条结构化清单每类最多 200 项）、校验值上限 100 条、上传来源映射上限 200 条（均超限丢弃最旧），抑制存储单调膨胀
- **任务编排**：四个入口（立即备份/压缩包/增量备份/增量还原）共用互斥守卫，运行标志在进入时即置位（含目录选择对话框挂起期间），避免并发空窗
- **错误本地化**：模块层（`BackupManager` / `backupScanner`）零文案依赖，只抛 `BackupError`（错误码 + 不含文案的技术细节）；视图层经 `utils.localizeBackupError` 按 `BACKUP_ERROR_KEYS` 映射 i18n 键后拼接展示，模块层保持纯净且文案可翻译
- **代码分层**：纯函数集中在 `utils.ts`（`withRetry` / `capFileList` / `isUnsafeRelativePath` / `resolveBackupDir` / `localizeBackupError` / key 构建等），常量与类型在 `types/index.ts`，实例辅助（`persistS3BackupStorage`）在 `instance.ts`，同一规则全模块只有一处定义
- **UI**：Vue 3 Modal，Codex 风格；标签栏复用共享组件 `Tabs` 五件套（`lazy` 保持「进入即挂载、离开即卸载」），徽章统一用 `Tag`（日志类型 7 种配色齐全、状态/比对结果走 success/danger），下拉用 `Select`，进度条用 `ProgressBar`（自带 `role="progressbar"` 无障碍语义）
