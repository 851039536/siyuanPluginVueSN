# 数据备份

工作区数据备份和恢复功能，支持自动备份、手动备份和云同步。

## 功能

- **全量备份**：打包工作区所有文件为 zip 格式
- **插件设置备份**：仅导出插件配置数据，用于跨设备迁移
- **自动备份**：支持每分钟、每小时、每天定时备份
- **云同步**：支持七牛云、阿里云 OSS、腾讯云 COS
- **多云上传选择**：备份历史中可为每个备份项选择目标云服务商上传
- **备份恢复**：通过思源 API 导入备份数据

## 目录结构

```
dataBackup/
├── index.ts                  # 注册入口 + DataBackup 类（自动备份定时器管理）
├── index.vue                 # 主设置面板（所有 UI 逻辑）
├── modules/
│   ├── BackupManager.ts      # 全量备份管理器（扫描/打包/压缩/保存）
│   └── CloudBackupManager.ts # 云备份管理器（七牛/阿里云/腾讯云 Provider）
├── types/
│   └── index.ts              # 类型定义 + DataBackupStorage 存储类
├── styles/
│   └── index.scss            # 组件样式
└── README.md
```

## 存储键

| 键名 | 说明 |
|------|------|
| `data-backup-settings` | 备份设置（频率、时间、保留数等） |
| `backup-history` | 备份历史列表 |
| `cloud-backup-config` | 云存储默认配置 |
| `cloud-backup-config-{id}` | 指定 ID 的云配置（多云管理） |

## 关键设计

### 云备份架构

- **Provider 模式**：每个云厂商实现统一 `CloudProvider` 接口（`upload/download/list/delete/test`）
- **Provider 注册表**：通过 `providerFactories` 映射类型到工厂函数，新增云厂商只需添加 Provider 类和注册项
- **多云支持**：`CloudBackupManager` 支持按 `configId` 保存/加载多套云配置，备份历史中可选择目标云上传
- **公共 XML 解析**：阿里云 OSS 和腾讯云 COS 共用 `parseOssXmlResponse` 解析列举结果

### 自动备份定时器

- 在 `index.ts` 的 `DataBackup` 类中通过 `setInterval` 实现
- 启动时通过 `persistent` modal 模式预注册 `autoBackupTrigger` 事件监听器
- 支持分钟/小时/每日三种频率
