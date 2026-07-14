---
name: s3Backup-module-code-review
overview: 对 src/features/s3Backup 模块进行全面的代码规范审查，修复所有已发现的问题，涵盖：缺失文件头注释、localStorage 违规使用、SCSS token 硬编码、不存在类型导入、冗余 try-catch、内联样式违规、i18n 缺失等。
todos:
  - id: fix-ts-error
    content: 修复 BackupProgressSection.vue 类型导入错误（ProgressInfo → BackupProgress）
    status: completed
  - id: add-file-headers
    content: 为 index.vue 和 S3ConfigForm.vue 补充文件头注释
    status: completed
  - id: fix-localstorage
    content: 移除 index.vue 和 index.ts 中的原生 localStorage 调用，统一使用 PluginStorage
    status: completed
  - id: fix-i18n-and-scss
    content: 修复 WorkspaceInfoCard i18n 硬编码、S3ConfigForm.scss 的 line-height 硬编码、AutoBackupCard 内联样式提取、尾部空行清理
    status: completed
  - id: cleanup-redundant
    content: 清理 useS3Backup.ts 中的冗余 try-catch，加固 index.vue Props 类型
    status: completed
---

## 用户需求

对 `src/features/s3Backup` 模块进行全面的代码审查，按照项目 CODEBUDDY.md/AGENTS_RULES.md 中的规则集修复所有违规项。

## 审查范围

- TypeScript 编译错误修复
- 文件头注释补充
- 统一入口原则违规修正（localStorage 改为 PersistableStorage）
- i18n fallback 缺失补充
- SCSS 规范违规修复（硬编码值→设计 Token、内联样式提取）
- 冗余代码清理
- 类型安全加固

## 预期效果

修复后模块通过 lint、tsc、i18n:verify、validate:icons 四重验证，无硬规则违规。

## 技术方案

### 修复策略

**1. TypeScript 编译错误修复（P0）**

- `BackupProgressSection.vue` 第 21 行 `import type { ProgressInfo } from "../types"` 改为 `import type { BackupProgress } from "../modules/BackupManager"`
- Props 类型同步更新为 `BackupProgress`

**2. 缺失文件头注释补充（P0）**

- `index.vue` 顶部添加 `<!-- S3 备份主面板 — 备份/配置双 Tab 视图，编排子组件、自动备份触发、事件监听 -->`
- `components/S3ConfigForm.vue` 顶部添加 `<!-- S3 配置表单组件 — Endpoint/AccessKey/SecretKey/Bucket 等字段输入、连接测试、配置保存 -->`

**3. 统一入口原则修复（P0）**

- `index.vue` 第 301 行：`localStorage.setItem("siyuan-workspace-root", root)` → 移除，同步到 S3Backup 实例即可（`saveWorkspaceSettings` 已通过 PluginStorage 持久化 workspaceRoot）
- `index.ts` 第 263 行：`localStorage.getItem("siyuan-workspace-root")` → 移除该兜底分支（API 获取 + 持久化存储兜底已足够）
- 工作区路径恢复流程简化为：环境变量 → API 自动获取 → 持久化存储兜底

**4. i18n fallback 补充（P1）**

- `WorkspaceInfoCard.vue` 第 17 行：`{{ i18n.openFolder || "打开文件夹" }}`

**5. SCSS 规范修复（P1）**

- `styles/S3ConfigForm.scss` 第 66 行：`line-height: 1.5` → `$line-height-normal`
- `components/AutoBackupCard.vue` 第 37 行：移除内联 `style="width: 3rem;"`，在 `AutoBackupCard.scss` 中新增 `.keep-count-input { width: 3rem; }` 并应用 class

**6. 冗余代码清理（P2）**

- `composables/useS3Backup.ts`：`downloadBackup` 和 `deleteBackup` 移除冗余 try-catch（直接调用 s3Client 方法，异常自然向上传播）

**7. 类型安全加固（P2）**

- `index.vue` Props 接口：`i18n?: any` → `i18n: Record<string, string>`，`plugin?: any` → `plugin: Plugin | null`

**8. 尾部空行清理（P3）**

- `styles/index.scss` 第 189-195 行：删除尾部多余空行

### 不涉及的变更

- 8 步注册链已完整，无需修改
- SCSS 文件分离规范已遵守，无需调整
- 跨功能联动：statusBar → s3Backup 通过 `emitCustomEvent("openS3Backup")` 解耦，符合规范
- 子组件数据流为简单展示型组件（卡片模式），属于合理范畴