---
name: s3backup-datefolder-setting
overview: 修改 S3 备份时间戳格式为紧凑型 `20260706-012735`，并增加可选设置（复选框）控制是否生成日期文件夹。
todos:
  - id: update-types
    content: "修改 types/index.ts：BackupSettings 接口增加 useDateFolder: boolean，S3BackupStorage 默认值增加"
    status: completed
  - id: update-index-ts
    content: 修改 index.ts：loadWorkspaceSettings 返回值增加 useDateFolder，saveWorkspaceSettings 参数增加 useDateFolder
    status: completed
    dependencies:
      - update-types
  - id: update-i18n
    content: 修改 i18n 文件：zh_CN 和 en_US 各新增 useDateFolder 翻译键
    status: completed
  - id: update-vue
    content: 修改 index.vue：新增 useDateFolder ref+加载保存、改时间戳格式、条件构造 S3 路径、添加复选框 UI
    status: completed
    dependencies:
      - update-types
      - update-index-ts
      - update-i18n
  - id: verify-all
    content: 运行 lint + i18n:verify + tsc --noEmit 四重验证
    status: completed
    dependencies:
      - update-vue
---

## 用户需求

1. 将备份文件夹时间戳从 `2026-07-06T01-27-35` 改为紧凑格式 `20260706-012735`
2. 新增可选设置的复选框"生成日期文件夹"，勾选后才生成日期子文件夹（默认勾选保持向后兼容），不勾选则文件直接放在 prefix 目录下

## 产品概述

为 S3 备份功能增加日期文件夹开关和更紧凑的时间戳格式，让用户可以灵活选择是否按日期组织备份文件。

## 核心功能

- 时间戳格式改为 `YYYYMMDD-HHmmss` 紧凑数字格式
- 备份设置面板新增复选框"生成日期文件夹"，默认开启
- 关闭日期文件夹时，所有备份文件直接上传到 prefix 目录（无日期子目录）

## 技术方案

### 涉及文件（5 个）

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/features/s3Backup/types/index.ts` | 修改 | BackupSettings 接口 + 默认值增加 `useDateFolder` |
| `src/features/s3Backup/index.ts` | 修改 | loadWorkspaceSettings/saveWorkspaceSettings 增加 useDateFolder |
| `src/features/s3Backup/index.vue` | 修改 | 新增 ref + 时间戳改格式 + 条件 S3 路径 + 复选框 UI |
| `src/i18n/zh_CN/s3Backup.json` | 修改 | 新增 `useDateFolder` 键 |
| `src/i18n/en_US/s3Backup.json` | 修改 | 新增 `useDateFolder` 键 |


### 数据流

```
用户勾选/取消复选框 → useDateFolder ref 更新 → saveWorkspaceSettings() 持久化到 TypedStorage
插件启动 → loadWorkspaceSettings() → 恢复 useDateFolder ref 值
备份时 → useDateFolder ? `${prefix}${timestamp}/${file}` : `${prefix}${file}`
```

### 实现细节

**时间戳格式变更**（index.vue 第 328 行）：

```ts
// 旧：2026-07-06T01-27-35
new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
// 新：20260706-012735
const d = new Date()
const pad = (n: number) => String(n).padStart(2, "0")
const timestamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
```

**S3 路径构造**（index.vue 第 334 行）：

```ts
// 旧：const s3Key = `${prefix}${timestamp}/${file.relativePath}`
// 新：const s3Key = useDateFolder.value
//   ? `${prefix}${timestamp}/${file.relativePath}`
//   : `${prefix}${file.relativePath}`
```

**复选框 UI**：参考 S3ConfigForm.vue 中 pathStyle/useSSL 的 form-group-checkbox 模式，在手動备份区域的"立即备份"按钮下方添加。

**默认值**：`useDateFolder` 默认 `true`，确保现有用户升级后行为不变。