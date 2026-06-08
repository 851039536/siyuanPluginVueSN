# 数据快照

管理思源笔记的数据快照，支持创建、查看、对比、恢复和云端同步。

## 功能

- **创建快照**：通过思源 Repo API 创建本地数据快照，支持自定义备注
- **查看快照**：浏览快照的文件列表和详情
- **对比快照**：选择两个快照进行差异对比，显示新增/删除/修改的文件
- **恢复快照**：将数据恢复到指定快照状态（需二次确认）
- **云端同步**：上传本地快照到云端、从云端下载快照、管理云端快照标签

## 存储键

| 键名 | 说明 |
|------|------|
| `data-snapshot-settings` | 快照设置（上次上传标签等） |

## API 端点

| 端点 | 说明 |
|------|------|
| `/api/repo/createSnapshot` | 创建本地快照 |
| `/api/repo/getRepoSnapshots` | 获取本地快照列表 |
| `/api/repo/getRepoSnapshotContent` | 获取快照文件列表 |
| `/api/repo/importRepo` | 恢复快照 |
| `/api/repo/uploadCloudSnapshot` | 上传快照到云端 |
| `/api/repo/getCloudRepoTagSnapshots` | 获取云端快照列表 |
| `/api/repo/downloadCloudSnapshot` | 从云端下载快照 |
| `/api/repo/removeCloudRepoTag` | 删除云端快照标签 |
