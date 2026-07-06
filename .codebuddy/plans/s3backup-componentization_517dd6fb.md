---
name: s3backup-componentization
overview: 将 S3Backup 备份 Tab 中的 7 个功能 section 拆分为 6 个独立 Vue 组件，每个组件有独立的 SCSS 文件，遵循双行 @use 导入规范。
todos:
  - id: create-workspace-info-card
    content: 新建 WorkspaceInfoCard.vue + WorkspaceInfoCard.scss，迁移工作区信息 section 模板和专属样式
    status: completed
  - id: create-backup-mode-selector
    content: 新建 BackupModeSelector.vue + BackupModeSelector.scss，迁移备份模式选择 section 模板和专属样式
    status: completed
  - id: create-progress-section
    content: 新建 BackupProgressSection.vue + BackupProgressSection.scss，迁移备份进度 section 模板和专属样式
    status: completed
  - id: create-manual-backup-card
    content: 新建 ManualBackupCard.vue + ManualBackupCard.scss，迁移手动备份 section 模板和专属样式
    status: completed
  - id: create-auto-backup-card
    content: 新建 AutoBackupCard.vue + AutoBackupCard.scss，迁移自动备份设置 section 模板和专属样式
    status: completed
  - id: create-backup-list-card
    content: 新建 BackupListCard.vue + BackupListCard.scss（泛型列表组件），迁移本地+S3 备份列表模板和样式
    status: completed
  - id: refactor-index-vue
    content: 重构 index.vue：模板替换为 6 个组件引用，脚本移除已迁移的局部方法（如 refreshLocalBackupList/deleteLocalBackup/handleDownload/handleDelete 保留在父组件），清理冗余 import
    status: completed
    dependencies:
      - create-workspace-info-card
      - create-backup-mode-selector
      - create-progress-section
      - create-manual-backup-card
      - create-auto-backup-card
      - create-backup-list-card
  - id: cleanup-index-scss
    content: 清理 styles/index.scss：移除已迁移到组件 SCSS 的选择器，保留共享基座（面板/头部/Tab/卡片/表单 public 类）
    status: completed
    dependencies:
      - refactor-index-vue
  - id: verify-all
    content: 运行 pnpm lint + pnpm i18n:verify 验证所有修改无错误
    status: completed
    dependencies:
      - cleanup-index-scss
---

## 用户需求

将 s3Backup 模块的 index.vue（1116 行）中备份 Tab 的 7 个内联 card-section 拆分为 6 个独立 Vue 组件，每组件配套专属 SCSS 文件，实现功能页面组件化。

## 核心功能

- 将工作区信息、备份模式选择、备份进度、手动备份、自动备份设置 5 个独立卡片拆分为独立组件
- 本地备份列表与 S3 备份列表合并为泛型 BackupListCard，通过具名插槽注入不同操作按钮（本地：删除 | S3：下载+删除）
- 父组件 index.vue 从 1116 行缩减至约 380 行（模板仅保留布局 + 组件引用，脚本仅保留编排逻辑）
- 每个组件配套独立的 PascalCase SCSS 文件，遵循双行 @use 导入规范

## 技术方案

### 组件拆分策略

将 index.vue 备份 Tab 中 7 个 section 拆分为 6 个组件，其中 BackupListCard 同时服务本地和 S3 备份列表：

| 新组件 | 来源 section | 行数 | Props 数量 | Emits 数量 |
| --- | --- | --- | --- | --- |
| WorkspaceInfoCard | 1. 工作区信息 | ~32 行 | 4 | 2 |
| BackupModeSelector | 2. 备份模式选择 | ~20 行 | 2 | 1 (v-model) |
| BackupProgressSection | 3. 备份进度 | ~24 行 | 3 | 0 |
| ManualBackupCard | 4. 手动备份 | ~78 行 | 12 | 7 |
| AutoBackupCard | 5. 自动备份设置 | ~47 行 | 7 | 4 (v-model) |
| BackupListCard | 6+7. 本地+S3 列表 | ~53 行 | 7 | 1 + 插槽 |


### 数据流设计

```
index.vue（编排层，~380 行）
├── WorkspaceInfoCard      props: workspacePath/workspaceRoot/lastBackupTime/i18n
│                          emits: selectPath → selectWorkspacePath(), openFolder → openWorkspaceFolder()
├── BackupModeSelector     v-model: backupModeLocal
├── BackupProgressSection  props: backupProgress/phaseLabel/i18n（纯展示，无 emits）
├── ManualBackupCard       props: 12 个状态 + emits: performBackup/triggerS3Upload 及字段 update
├── AutoBackupCard         v-model: autoBackupEnabled/backupFrequency/backupTime/keepBackupCount
├── BackupListCard (本地)   props: items=localBackupList, 插槽 actions: 删除按钮
└── BackupListCard (S3)    props: items=backupList, 插槽 actions: 下载+删除按钮
```

### BackupListCard 泛型设计

使用泛型 props + 具名插槽实现复用：

```
<!-- 本地备份列表 -->
<BackupListCard
  :title="i18n.localBackups || '本地备份列表'"
  :empty-text="i18n.noLocalBackups || '暂无本地备份'"
  :items="localBackupList"
  :is-loading="isLoadingLocal"
  :disable-refresh="!workspaceRoot"
  :i18n="i18n"
  @refresh="refreshLocalBackupList"
>
  <template #actions="{ item }">
    <Button variant="danger" size="small" @click="deleteLocalBackup(item)">
      {{ i18n.delete || '删除' }}
    </Button>
  </template>
</BackupListCard>

<!-- S3 备份列表 -->
<BackupListCard
  :title="i18n.s3Backups || '云端备份列表'"
  :empty-text="i18n.noBackups || '暂无云端备份'"
  :items="backupList"
  :is-loading="isLoading"
  :disable-refresh="!isConfigured"
  :i18n="i18n"
  @refresh="refreshBackupList"
>
  <template #actions="{ item }">
    <Button size="small" @click="handleDownload(item)">{{ i18n.download || '下载' }}</Button>
    <Button variant="danger" size="small" @click="handleDelete(item)">{{ i18n.delete || '删除' }}</Button>
  </template>
</BackupListCard>
```

Item 通过泛型 props 传入，组件内部展示 `item.name`、`item.time`/`item.lastModified`，`formatFileSize(item.size)`。

### 样式迁移规则

| 当前 index.scss 选择器 | 迁移到 |
| --- | --- |
| `.info-grid` `.info-item` `.info-label` `.info-value` | WorkspaceInfoCard.scss |
| `.backup-mode-section` | BackupModeSelector.scss |
| `.progress-section` 及子选择器 | BackupProgressSection.scss |
| `.backup-actions-row` `.backup-hint` `.path-preview*` | ManualBackupCard.scss |
| `.auto-backup-section` | AutoBackupCard.scss |
| `.backup-list` `.backup-item` `.backup-info` `.backup-name` `.backup-time` `.backup-size` `.backup-actions` `.empty-state` | BackupListCard.scss |
| 保留在 index.scss | `.s3-backup-panel` `.s3-backup-header` `.s3-tab-bar` `.s3-tab-btn` `.settings-container` `.card-section` `.section-header` `.workspace-path-row` `.workspace-path` `.path-actions` `.form-group-checkbox` `.form-hint` `::deep` 公共组件覆盖 |


## 实现注意事项

### 执行顺序

1. 先创建 6 个组件 .vue + 配套 .scss（12 个新文件）
2. 再修改 index.vue（替换模板 + 精简脚本）
3. 最后清理 index.scss 中已迁移的选择器
4. 运行 lint + i18n:verify 验证

### 关键约束

- 每个组件顶部必须有文件头注释（`// xxx 组件`）
- Vue 模板中不再使用内联 SCSS，仅 `@use` 双行导入
- 组件不直接调用 `getS3BackupInstance()` 或思源 API，所有数据通过 props 传入
- `formatFileSize` 在 BackupListCard 内部导入使用
- index.vue 保留 `handleClose`、初始化逻辑、自动备份触发监听等编排代码