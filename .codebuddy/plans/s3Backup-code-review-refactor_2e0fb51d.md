---
name: s3Backup-code-review-refactor
overview: 对 s3Backup 模块进行全面代码审查与重构：修复逻辑漏洞与边界异常、消除冗余代码与重复逻辑、优化性能瓶颈，确保符合 AGENTS.md 编码规范。
todos:
  - id: fix-logic-vulnerabilities
    content: 修复 5 项逻辑漏洞：node!非空守卫(index.vue)、backupTime NaN验证(index.ts)、testConnection副作用移除(S3ConfigForm.vue)、注释编号修复(index.ts)、未使用参数清理(BackupManager.ts + index.vue)
    status: completed
  - id: merge-redundant-code
    content: 合并 6 项冗余代码：提取buildS3Key函数、统一pad函数、简化saveWorkspaceSettings调用、合并listBackups/listExistingKeys、合并buildUrl queryString处理、合并saveConfig/loadConfig
    status: completed
  - id: optimize-performance
    content: 优化 3 项性能：requireHttp模块级缓存、Date对象统一创建、S3 list max-keys 100→1000(s3Client.ts)
    status: completed
  - id: fix-standards-compliance
    content: 修复 3 项规范合规：移除__s3Backup any访问(index.ts+index.vue)、requireCrypto走getNodeModules(s3Client.ts)、移除performManualBackup双重持久化(index.vue)
    status: completed
---

## 产品概述

对 s3Backup 模块进行深度代码审查与重构，覆盖逻辑漏洞修复、冗余代码合并、性能优化和规范合规修复四大类。

## 核心功能

1. **修复逻辑漏洞**：非空断言守卫、backupTime 格式验证、testConnection 副作用移除、注释编号修复
2. **合并冗余代码**：提取 keyParts 公共构建函数、统一 pad 函数、合并 saveConfig/loadConfig、合并 listBackups/listExistingKeys 公共逻辑、合并 buildUrl queryString 处理
3. **优化性能**：模块级缓存 requireHttp、统一 Date 对象创建、增加 S3 list max-keys
4. **规范合规修复**：移除 `(plugin as any).__s3Backup` 改用 getS3BackupInstance()、requireCrypto 统一走 getNodeModules、移除未使用的 _workspacePath 参数

## 技术方案

### 修改范围

共涉及 6 个核心文件 + 2 个组件文件，总计约 8 个文件。

### 实现策略

**1. 逻辑漏洞修复**

- **node! 非空断言**：`index.vue` performS3Backup 中添加 early return 守卫 `if (!node) { throw new Error(...) }`
- **backupTime 格式验证**：`index.ts` startAutoBackupTimer 的 daily 分支添加 `if (isNaN(targetHour) || isNaN(targetMinute)) { return }` 守卫
- **testConnection 副作用**：`S3ConfigForm.vue` 的 handleTestConnection 中移除 `emit("configChanged", ...)` 调用，仅测试连接不修改父组件状态；测试用的 S3Client 直接用 localConfig 构建临时实例
- **注释编号修复**：`index.ts` detectAndInitWorkspace 将 "4. 持久化存储" 改为 "3. 持久化存储"

**2. 冗余代码合并**

- **keyParts 提取**：`index.vue` performS3Backup 中提取 `buildS3Key(file, prefix, sub, datePath)` 局部函数，诊断日志和上传循环均调用
- **pad 函数统一**：`BackupManager.ts` 的 `formatTimestamp` 中的 pad 提取为模块级 `padNum(n)` 导出；`index.vue` performS3Backup 中的 pad 改为使用 `padNum`
- **saveWorkspaceSettings 简化**：`index.vue` performManualBackup try 块移除重复的参数对象，直接调用 `saveWorkspaceSettings()` 并传全部字段（两者本就相同）
- **listBackups/listExistingKeys 合并**：`composables/useS3Backup.ts` 提取 `fetchBackupList()` 内部函数，listBackups 调用它返回数组，listExistingKeys 调用它返回 Set
- **buildUrl queryString 合并**：`s3Client.ts` buildUrl 方法将两个分支中相同的 `const qs = queryString ? queryString : ""` 提到分支前统一处理
- **saveConfig/loadConfig 合并**：`composables/useS3Backup.ts` 提取 `applyConfig(config)` 内部函数，两者均调用

**3. 性能优化**

- **requireHttp 缓存**：`s3Client.ts` 模块顶层使用 `let _httpCache: { http: any; https: any } | null = null`，requireHttp 首次调用赋值后复用
- **Date 对象统一**：`s3Client.ts` request 方法中创建 `const now = new Date()`，amzDate/dateStamp 改为接收 Date 参数的版本；或直接在 request 中内联计算
- **list max-keys 增加**：`s3Client.ts` list 方法中 `max-keys=100` → `max-keys=1000`，同时保持 method 签名不变（内部常量变更）

**4. 规范合规修复**

- **移除 __s3Backup any 访问**：`index.vue` handleTimerRestart 中 `props.plugin?.__s3Backup` → `getS3BackupInstance()`；`index.ts` registerS3Backup 中移除 `;(plugin as any).__s3Backup = s3BackupInstance`
- **requireCrypto 走 getNodeModules**：`s3Client.ts` requireCrypto 从 `require("node:crypto")` 改为 `return node.crypto`
- **移除闲置参数**：`BackupManager.ts` 构造函数参数 `_workspacePath` 移除（需同步修改所有调用方：`index.vue` initBackupManager 中 `new BackupManager(workspacePath.value, workspaceRoot.value)` 改为 `new BackupManager(workspaceRoot.value)`）；`updateWorkspacePaths` 同样移除闲置参数

### 向后兼容性保障

- BackupManager 构造函数签名变更需同步修改 `index.vue:284` 的调用方（唯一调用方）
- 所有内部函数提取不影响外部 API
- requireCrypto 改为 node.crypto 需确认 getNodeModules 返回的 node 对象确实包含 crypto 属性