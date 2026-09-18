# S3 文件管理

面向 S3 兼容存储（MinIO、Ceph、AWS S3、OpenList/Alist 代理等）的可视化文件管理器，仿 Windows 资源管理器交互：目录浏览、上传/下载、新建文件夹、移动/复制/重命名/删除、面包屑导航、右键菜单、操作日志与进度提示。

## 功能

- **独立 S3 配置**：拥有自有配置键（`s3-file-manager-config`），支持 endpoint / access key / secret key / bucket / region / path style / HTTPS / 自签名证书 / 目录前缀；提供「测试连接」与「从 S3 备份导入」（只读复制 `s3-backup-config`，永不回写）
- **双视图列表**：详细信息视图（名称 / 大小 / 修改日期，可点列头排序、`aria-sort` 表出方向，文件夹恒置顶）与图标网格视图；条目超阈值时「加载更多」增量渲染
- **多选交互**：单击、Ctrl+单击、Shift+范围选、全选 / 清空，语义对齐资源管理器
- **文件操作**：新建文件夹、重命名、复制、移动、删除；文件夹操作递归收集全部 key，**移动先全量复制成功后才批量删除源**（避免半完成态丢数据），失败清单写入日志 detail
- **上传 / 下载**：多文件上传（重名先确认覆盖，>100MB 大文件警告），单文件 / 多选 / 文件夹递归下载（保持相对路径）
- **拖拽**：外部文件/文件夹拖入浏览区即上传到当前目录（文件夹递归保持相对结构）；内部条目拖到文件夹=移动（多选整批拖动）
- **导航**：面包屑（根为 bucket 名）+ 返回上级 + 双击进入文件夹
- **右键菜单**：复用共享 `TieredMenu` 的 popup 模式，菜单项按选中态动态生成
- **操作日志**：所有文件操作记录到 `s3-file-manager-log`（成功 / 失败徽章、相对时间、失败清单可折叠展开），最多保留 200 条
- **进度反馈**：面板内共享 `ProgressBar` + 状态栏后台任务（progress / complete / fail）

## 使用方式

1. 在设置中启用「S3 文件管理」功能
2. 通过超级面板或 `openS3FileManager` 事件打开面板
3. 首次使用点击「配置」填写 S3 连接（或「从 S3 备份导入」），测试连接后保存
4. 在列表中浏览、上传、下载或管理文件；右键条目可执行更多操作

## 架构

- **协议层复用**：S3 协议能力位于共享层 `src/utils/s3/`（`types` / `s3Protocol` / `s3Client` / `s3ObjectOps` / `s3Multipart` / `concurrency`），与 `s3Backup` 共用同一套 AWS SigV4 实现，本模块零直接导入其他 feature
- **跨模块共享常量**：`TRANSFER_MAX_RETRIES` / `MAX_LOG_COUNT` / `MAX_LOG_DETAIL_FILES` / `S3_BACKUP_CONFIG_KEY` 定义在 `@/utils/s3/types`，两模块引用同一来源（存储键不再靠字面量维系）；重试循环走 `@/utils/s3/concurrency` 的 `runWithRetries`
- **目录列举**：`listDir` 基于 ListObjects V1 + `delimiter=/`，自动翻页聚合当前层文件与子文件夹前缀；代理不支持 delimiter 时降级为全量拉取后按 `/` 客户端聚合（`normalizeListing` 统一口径）
- **复制 / 移动**：`copyObject` 的 `x-amz-copy-source` 头进签名（signedHeaders 字母序），源 key 复用 `encodeKeyPath` 的 RFC 3986 分段编码，规避中文 / 空格 key 的 403 SignatureDoesNotMatch
- **批量删除**：不使用 DeleteObjects 批量 API，改用 `runWithConcurrency` + 单对象删除（并发 4）
- **组件划分**：`index.vue`（薄壳编排）+ `components/`（Toolbar / Breadcrumb / EntryList / ContextMenu / ConfigDialog / NameDialog / MoveCopyDialog / LogPanel）+ `composables/`（依赖注入，client / entries / selection / fileOps / transfer / logs / confirm / prefs）
- **UI 复用共享组件**：弹窗外壳走 `Dialog`（遮罩点关「按下并抬起」语义、焦点接管与归还、`role="dialog"`、fade+scale 过渡）；确认走 `ConfirmDialog`；工具栏走 `Toolbar`；日志徽章走 `Tag`、失败清单折叠走 `Panel`；进度条走 `ProgressBar`；右键菜单走 `TieredMenu`（popup）。模块内**不再自建**同类控件
- **确认入口单一**：`composables/useFmConfirm.ts` 提供唯一的 Promise 式 `requestConfirm`（回调式旧 API 与原生 `confirm` 回退已移除）
- **存储**：PluginStorage + TypedStorage 持久化（config / logs / prefs），凭证经 AES-GCM 加解密
- **UI**：Vue 3 persistent Modal（`72vw` × `85vh`），Codex 风格，全 Token 化样式

## 已知约束

- 上传为 Buffer 整体读入内存（SigV4 需全量 payload hash），超过 100MB 的文件仅警告不阻断；**未接入**共享层已有的 `uploadFileSmart`（`s3Backup` 三条上传路径已用），故无 Multipart 分片上传
- 文件夹为 S3 的 0 字节占位对象（key 以 `/` 结尾），依赖 delimiter 或客户端聚合呈现层级
