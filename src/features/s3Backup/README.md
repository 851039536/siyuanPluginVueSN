# S3 备份

将思源笔记工作区备份到 S3 兼容存储（MinIO、Ceph、AWS S3 等），支持手动备份、备份列表管理、下载与删除。

## 功能

- **S3 配置**：支持自定义 endpoint、access key、secret key、bucket、region、path style、HTTPS 等
- **本地 ZIP 备份**：打包 data/ 为 `data-*.zip` 保存到工作区 `data-backup/` 目录（可选按日期建 `data-YYYYMMDD/` 子文件夹）
- **S3 上传**：上传 `data-backup/` 中的备份 ZIP 到 S3；与本地 ZIP 同时勾选时仅上传本次新生成的 ZIP。上传前按云端已有对象去重（全 key 精确匹配 + 文件名尾部匹配兜底）
- **S3 增量备份**：基于云端 manifest 对比，仅上传新增/变更文件，并清理本地已删除文件
- **备份管理**：查看云端备份列表，支持下载、删除；本地列表含日期子文件夹内的备份，保留数清理只删除插件生成的 `data-*.zip`（用户手工放入的归档不受影响）
- **连接测试**：保存配置前可测试 S3 连接是否正常

## 使用方式

1. 在设置中启用「S3 备份」功能
2. 打开 S3 备份面板，填写 S3 服务器配置
3. 点击「测试连接」验证配置正确
4. 点击「保存配置」
5. 选择工作区路径后，点击「立即备份」
6. 可在云端备份列表查看、下载或删除历史备份

## 增量备份

在「配置」Tab 的备份模式中开启「S3 增量备份」（默认关闭，可与本地 ZIP / S3 上传叠加）。

**工作原理**：
- 扫描 `{workspace}/data`（跳过 temp/.recycle），与云端清单 manifest（`relativePath → {mtime, size}`）对比
- mtime 或 size 任一变化即视为修改（宽松触发，宁多传不漏传）
- 新增/变更 → 覆盖式上传到 `{prefix}/{s3SubPrefix}/incremental/data/{relativePath}`（固定 key，4 并发 + 2 次重试）
- 本地已删除 → 删除对应 S3 对象
- 完成后上传新 manifest 到 `{prefix}/{s3SubPrefix}/incremental/manifest.json`

**失败恢复语义**：manifest 以 S3 为唯一事实源；上传失败的文件不写入新 manifest，下次备份自动重传（幂等）。首次备份（无 manifest / 404）全量上传。扫描结果为空时中止备份，防止误删全部远端文件。

### 增量还原

手动备份卡片提供「压缩包备份」「增量备份」「增量还原」三个独立按钮（不依赖备份模式开关；增量两项需 S3 已配置）：

- **压缩包备份**：单独触发一次本地 ZIP 打包，与「立即备份」的模式分发互不影响
- **增量备份**：单独触发一次增量上传，与「立即备份」的模式分发互不影响
- **增量还原**：确认后按云端 manifest 并发下载（4 并发 + 2 次重试）全部文件到 `{workspaceRoot}/{localBackupDir}/incremental-restore-{时间戳}/`，保持 data/ 的目录结构。**不会覆盖运行中的 data/**，如需恢复请关闭思源后手动替换。下载失败的文件计入失败数并在日志中记录，可重新执行还原重试。云端无 manifest 时给出明确提示。

**已知约束**：
- 云端备份列表使用 ListObjects V1 自动翻页（最多 100 页 × 1000 个对象），增量小文件已从列表过滤但仍占用列举配额
- 上传为 Buffer 整体读入内存（SigV4 需全量 payload hash），超过 100MB 的文件仅警告不阻断
- mtime 被同步盘/文件恢复工具还原且 size 不变时可能漏检该文件（罕见场景）

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
- **备份方式**：本地 ZIP 打包（JSZip）→ 上传 `data-backup/` 中的 ZIP（上传超时可配置（默认 240s），扫描跳过 temp/.recycle 目录）。开启日期子文件夹时，S3 key 的日期段只取日期部分（YYYYMMDD），与本地目录语义一致，保证跨备份去重可命中
- **增量对比**：`utils.ts` 纯函数 diff（mtime+size 快筛）+ `composables/useIncrementalBackup.ts` 编排，绝不使用 listObjects 做增量判断（1000 条截断风险）
- **任务互斥**：立即备份/压缩包备份/增量备份/增量还原以及自动备份触发共用运行守卫，任一任务运行中不并发启动新任务（自动备份遇忙记日志跳过）
- **存储**：PluginStorage + TypedStorage 持久化配置
- **UI**：Vue 3 Modal，Codex 风格
