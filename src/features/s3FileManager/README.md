# S3 文件管理

面向 S3 兼容存储（MinIO、Ceph、AWS S3、OpenList/Alist 代理等）的可视化文件管理器，仿 Windows 资源管理器交互：目录浏览、上传/下载、新建文件夹、移动/复制/重命名/删除、面包屑导航、右键菜单、操作日志与进度提示。

## 功能

- **独立 S3 配置**：拥有自有配置键（`s3-file-manager-config`），支持 endpoint / access key / secret key / bucket / region / path style / HTTPS / 自签名证书 / 目录前缀；提供「测试连接」与「从 S3 备份导入」（只读复制 `s3-backup-config`，永不回写）
- **双视图列表**：详细信息视图（名称 / 大小 / 修改日期，可点列头排序、`aria-sort` 表出方向，文件夹恒置顶）与图标网格视图；条目超阈值时「加载更多」增量渲染
- **多选交互**：单击单选、Ctrl/Cmd+单击切换、Shift+范围选（锚点失效时退化为单选）；右键未选中项时自动单选它；跨目录导航与写操作后自动清空选中
- **文件操作**：新建文件夹、重命名、复制、移动、删除；文件夹操作递归收集全部 key，**移动先全量复制成功后才批量删除源**（避免半完成态丢数据），失败清单写入日志 detail
- **上传 / 下载**：多文件 / 文件夹上传（重名先确认覆盖；大于 100MB 由共享层自动分片，内存峰值恒定），单文件 / 多选 / 文件夹递归下载（保持相对路径，已存在时先确认覆盖）
- **拖拽**：外部文件/文件夹拖入浏览区即上传到当前目录（文件夹递归保持相对结构，空目录补占位对象）；内部条目拖到文件夹=移动（多选整批拖动）
- **导航**：面包屑（根为 bucket 名）+ 返回上级 + 双击进入文件夹
- **右键菜单**：复用共享 `TieredMenu` 的 popup 模式，菜单项按选中态动态生成
- **操作日志**：所有文件操作记录到 `s3-file-manager-log`（成功 / 失败徽章、相对时间、失败清单可折叠展开），最多保留 200 条
- **进度反馈**：面板内共享 `ProgressBar` + 状态栏后台任务（progress / complete / fail），支持软取消（停止未开始的任务，在途文件传完收尾）

## 使用方式

1. 在设置中启用「S3 文件管理」功能
2. 通过超级面板或 `openS3FileManager` 事件打开面板
3. 首次使用点击「配置」填写 S3 连接（或「从 S3 备份导入」），测试连接后保存
4. 在列表中浏览、上传、下载或管理文件；右键条目可执行更多操作

## 存储

全部走 `PluginStorage` + `TypedStorage`（思源 `saveData` JSON 槽）。**不使用 SQLite**：插件数据目录位于思源同步目录内，Windows 下 SQLite 连接持有 `.db` 句柄会让同步引擎的 rename 失败。

| key | 内容 | 增长性 | 清理方式 |
| --- | --- | --- | --- |
| `s3-file-manager-config` | 自有连接配置（AK/SK 经 AES-GCM 加解密） | 固定单对象 | 设置面板重填；`sensitive: true` / `resettable: false`，不参与一键重置 |
| `s3-file-manager-log` | 操作日志（成功/失败、失败清单 detail） | 增长，上限 200 条 | 超限自动截断；日志面板「清空」 |
| `s3-file-manager-prefs` | 视图模式与排序偏好 | 固定单对象 | 切换视图/排序即覆盖 |

- **跨模块只读槽**：`s3-backup-config` 由 s3Backup 写入，本模块经共享常量 `S3_BACKUP_CONFIG_KEY`（`@/utils/s3/types`，与写入侧同源）只读消费，用于「从 S3 备份导入」，**永不回写**
- **槽位登记**：以上 key 在 `src/config/storage/jsonSlots.ts` 登记（owner `s3FileManager`），由 `pnpm audit:storage` 双向核对
- **写盘策略**：日志与偏好各自串行化写盘（后一次等待前一次完成），并以写入瞬间的快照落盘；日志整份重写，体积由 200 条上限约束，不接受无界增长

## 架构

- **协议层复用**：S3 协议能力位于共享层 `src/utils/s3/`（`types` / `s3Protocol` / `s3Client` / `s3ObjectOps` / `s3Multipart` / `concurrency`），与 `s3Backup` 共用同一套 AWS SigV4 实现，本模块零直接导入其他 feature（状态栏任务经 `@/features/statusBar/composables/useStatusBarTask` 这一公开入口，属「统一入口原则」的既定例外）
- **跨模块共享常量**：`TRANSFER_MAX_RETRIES` / `MAX_LOG_COUNT` / `MAX_LOG_DETAIL_FILES` / `S3_BACKUP_CONFIG_KEY` 定义在 `@/utils/s3/types`，两模块引用同一来源（存储键不再靠字面量维系）；重试循环走 `@/utils/s3/concurrency` 的 `runWithRetries`
- **目录列举**：`listDir` 基于 ListObjects V1 + `delimiter=/`，自动翻页聚合当前层文件与子文件夹前缀；服务端**明确拒绝** delimiter（405/501 等方法集错误）时降级为全量列举后按 `/` 客户端聚合（`DelimiterUnsupportedError` 判别），网络/鉴权错误直接进入错误态；delimiter 被**静默忽略**（OpenList 等代理返回扁平结果）时由 `normalizeListing` 客户端折叠统一口径
- **复制 / 移动**：`copyObject` 的 `x-amz-copy-source` 头进签名（signedHeaders 字母序），源 key 复用 `encodeKeyPath` 的 RFC 3986 分段编码，规避中文 / 空格 key 的 403 SignatureDoesNotMatch
- **批量删除**：不使用 DeleteObjects 批量 API，改用 `runWithConcurrency` + 单对象删除（并发 4）
- **组件划分**：`index.vue`（编排壳：组合 composables + 装配各弹窗）+ `components/`（Toolbar / Breadcrumb / EntryList / ContextMenu / ConfigDialog / NameDialog / MoveCopyDialog / LogPanel）+ `composables/`（依赖注入：client / entries / selection / fileOps / transfer / logs / confirm / prefs / externalDrop）
- **传输骨架单一实现**：上传与下载的软取消、字节分数聚合、失败清单收集收敛在 `composables/transferBatch.ts` 的 `runTransferBatch`（不依赖 Vue / siyuan，可单测），两条链路只提供「单个任务怎么执行」
- **UI 复用共享组件**：弹窗外壳走 `Dialog`（遮罩点关「按下并抬起」语义、焦点接管与归还、`role="dialog"`、fade+scale 过渡）；确认走 `ConfirmDialog`；工具栏走 `Toolbar`；日志徽章走 `Tag`、失败清单折叠走 `Panel`；进度条走 `ProgressBar`；右键菜单走 `TieredMenu`（popup）。模块内**不再自建**同类控件
- **确认入口单一**：`composables/useFmConfirm.ts` 提供唯一的 Promise 式 `requestConfirm`（类型 `ConfirmRequest`），上传/下载/删除/清空日志共用同一个共享确认框，无回调式旧 API 与原生 `confirm` 回退
- **存储**：PluginStorage + TypedStorage，明细见上方「存储」章节
- **UI**：Vue 3 persistent Modal（`72vw` × `85vh`），Codex 风格，全 Token 化样式

## 已知约束

- 上传走共享层 `uploadFileSmart`：≤100MB 整包单 PUT（256KB 分块写），>100MB 自动 16MB Multipart 分片，存储端不支持分片（OpenList/Alist 等代理）时自动降级整包并告警；内存峰值由分片档位保证
- 文件夹为 S3 的 0 字节占位对象（key 以 `/` 结尾），依赖 delimiter 或客户端聚合呈现层级
- 软取消不中断在途文件：共享层无 abort 通道，硬中断需 `req.destroy` 透出，影响面大于收益
- 重名覆盖确认只覆盖**顶层文件**与远端同名文件（含从选择框与拖拽两条入口）；同名文件夹按 S3 语义合并、不提示，文件夹内部同名文件的覆盖不逐个 `HEAD` 预检
