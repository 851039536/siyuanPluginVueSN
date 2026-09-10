# 数据快照

管理思源笔记的数据快照：创建、查看、恢复到本地历史，以及云端快照的下载与标签清理。

## 功能

- **创建快照**：通过思源 Repo API 创建本地快照，支持自定义备注（备注为空时自动使用「创建快照 + 当前时间」）
- **查看快照**：查看详情（时间、文件数、大小、设备、Tag 更新、文件类型分布）
- **恢复快照**：将数据恢复到指定快照状态（危险操作，二次确认后执行）
- **云端下载**：从云端下载快照到本地（按标签分组展示）
- **云端标签管理**：删除云端快照标签（危险操作，二次确认后执行）
- 所有耗时操作经 `useStatusBarTask` 在状态栏展示进行中 / 成功 / 失败三态

## 目录结构

```
dataSnapshot/
├── index.ts                      # 注册入口：addIcons + createVueDockApp
├── index.vue                     # Dock 面板：页签、创建行、视图切换与二次确认
├── components/
│   ├── LocalSnapshotList.vue     # 本地快照列表（查看 / 恢复）
│   ├── CloudSnapshotList.vue     # 云端快照列表（按标签分组，下载 / 删除标签）
│   └── SnapshotDetail.vue        # 快照详情（字段信息 + 文件类型分布）
├── composables/
│   └── useDataSnapshot.ts        # 状态与操作：列表加载、创建、恢复、下载、删除标签
├── types/
│   ├── index.ts                  # 类型转出（SnapshotInfo / CloudSnapshotTag / SnapshotView / 操作态）
│   └── i18n.ts                   # DataSnapshotI18n + getDataSnapshotI18n（类型化 i18n 取值）
├── utils.ts                      # 时间 / 大小格式化纯函数
├── styles/
│   └── index.scss                # 面板样式基座（入口与子组件各自 @use）
└── README.md
```

## 共享组件

面板不自行实现任何控件，全部消费 `src/components/`：

| 场景 | 共享组件 |
|------|---------|
| 刷新 / 创建 / 查看 / 恢复 / 下载 / 删除 / 页签 | `Button`（页签用 `text` 外观 + `variant` 表达选中态；危险操作用 `variant="danger"`；耗时操作接 `loading`） |
| 快照备注输入 | `Input`（`size="small"`） |
| 恢复与删除的二次确认 | `ConfirmDialog`（`v-model:visible` + 标题 / 文案 / 加载态，支持自定义消息插槽） |
| 图标 | `IconWrapper`（仅使用 `src/config/icons.ts` 已注册的 `IconKey`） |

## 配置项

- `enableDataSnapshot` — 是否启用数据快照功能（默认 `true`）

## API 端点

| 端点 | 封装函数 | 说明 |
|------|---------|------|
| `/api/repo/createSnapshot` | `createSnapshot` | 创建本地快照 |
| `/api/repo/getRepoSnapshots` | `getRepoSnapshots` | 获取本地快照列表（支持页码） |
| `/api/repo/getRepoSnapshotContent` | `getRepoSnapshotContent` | 获取快照内容（文件列表 / 差异） |
| `/api/repo/checkoutRepo` | `importRepo` | 恢复快照（覆盖当前数据） |
| `/api/repo/getCloudRepoTagSnapshots` | `getCloudRepoTagSnapshots` | 获取云端快照列表（按 tag 分组） |
| `/api/repo/downloadCloudSnapshot` | `downloadCloudSnapshot` | 从云端下载快照 |
| `/api/repo/removeCloudRepoTag` | `removeCloudRepoTag` | 删除云端快照标签 |
| `/api/repo/uploadCloudSnapshot` | `uploadCloudSnapshot` | 上传本地快照到云端（已封装，面板暂未接入） |

## 扩展建议

1. **接入上传**：`@/api` 已提供 `uploadCloudSnapshot(id, tag)`，可在本地列表项增加「上传」按钮，并在 `useDataSnapshot` 中补对应操作与状态栏三态
2. **快照比较**：`getRepoSnapshotContent` 已封装，可扩展为差异视图（响应中的 `files` / `diff` 字段）
3. **分页加载**：`getRepoSnapshots(page)` / `getCloudRepoTagSnapshots(page)` 均支持页码，当前仅加载第 1 页
4. **新增文案**：键集中在 `src/i18n/{zh_CN,en_US}/dataSnapshot.json` 的 `dataSnapshot` 分组（嵌套结构），新增后中英必须同步；`types/i18n.ts` 的 `DataSnapshotI18n` 需一并补键
