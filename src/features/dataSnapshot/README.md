# 数据快照

管理思源笔记的数据快照，支持创建、查看、恢复和云端同步。

## 功能

- **创建快照**：通过思源 Repo API 创建本地数据快照，支持自定义备注
- **查看快照**：查看快照详情（时间、文件数、大小、设备、文件类型分布）
- **恢复快照**：将数据恢复到指定快照状态（需二次确认）
- **云端下载**：从云端下载快照到本地
- **云端标签管理**：删除云端快照标签（需二次确认，含状态栏反馈）

## API 端点

| 端点 | 说明 |
|------|------|
| `/api/repo/createSnapshot` | 创建本地快照 |
| `/api/repo/getRepoSnapshots` | 获取本地快照列表 |
| `/api/repo/importRepo` | 恢复快照 |
| `/api/repo/getCloudRepoTagSnapshots` | 获取云端快照列表 |
| `/api/repo/downloadCloudSnapshot` | 从云端下载快照 |
| `/api/repo/removeCloudRepoTag` | 删除云端快照标签 |
