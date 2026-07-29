# BackupListCard 类型与冗余修复

## 摘要
消除 `Record<string, any>` 与 stringly-typed `timeKey` 设计，清理组件本体 1 处 + 调用点 7 处 i18n 兜底，修正列表 key 与中文注释。涉及 3 个文件。

## types/index.ts
- 新增列表展示项基础类型（放在 S3FileInfo / LocalBackupInfo 附近）：
  ```ts
  export interface BackupListDisplayItem {
    name: string
    size: number
    time?: string
    lastModified?: string
  }
  ```
  `LocalBackupInfo` 与 `S3FileInfo` 结构上均满足该约束，无需改动。

## BackupListCard.vue
- 泛型化组件：`<script setup lang="ts" generic="T extends BackupListDisplayItem">`，`items: T[]`，`#actions` 插槽的 `item` 随之获得调用方精确类型（父级可安全访问 `item.path` / `item.key`）
- 删除 `timeKey` prop 与 `withDefaults`（timeKey 是唯一默认值），模板时间列改为 `formatTime(item.time ?? item.lastModified ?? "")`
- L12 删除 `|| "刷新"` 兜底（`s3Backup.json` 已有 `refresh` 键）
- `:key="index"` 改为 `:key="item.name"`（v-for 的 index 变量同步移除）
- `hostMap && hostMap[item.name]` 简化为 `hostMap?.[item.name]`（v-if 与插值两处）
- 补充中文注释：刷新按钮 i18n 渲染点（如 `<!-- 按钮："刷新" -->`）+ 结构区块注释（备份条目列表 / 空状态提示）

## index.vue（L100-141 两个调用区块）
- S3 列表移除 `time-key="lastModified"` 绑定
- 删除 7 处 i18n 兜底：`localBackups`、`noLocalBackups`、`alreadyUploaded`、`s3Backups`、`noBackups`、`download`、`delete`（键已全部核实存在于 `src/i18n/{zh_CN,en_US}/s3Backup.json`，无需改 i18n 文件）

## 验证
- `npx tsc --noEmit` 确认 s3Backup 模块无新增错误（现有 17 个错误均属其他模块）
- 手动确认：本地/云端两个列表时间列显示正常，云端列表设备名后缀正常

## 不改动项
- `formatTime` / `formatFileSize` 复用 `@/utils/format`，保持不变
- 样式块与插槽复用设计符合规范，保持不变
- 父组件其他区域的 i18n 兜底不在本次范围