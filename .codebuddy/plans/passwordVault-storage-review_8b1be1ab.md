---
name: passwordVault-storage-review
overview: 全面审查 passwordVault 存储结构，扩展加解密覆盖全部敏感字段，增加存储路径展示与数据完整性校验
todos:
  - id: review-storage
    content: 审查 types/storage.ts：移除未使用的 PasswordVaultData 接口，添加 DATA_VERSION 常量
    status: completed
  - id: refactor-types
    content: 重定义 types/index.ts 中 StoredPasswordEntry 为新格式，添加 LegacyStoredPasswordEntry 辅助类型
    status: completed
    dependencies:
      - review-storage
  - id: extend-crypto
    content: 扩展 utils/crypto.ts：新增 encryptEntryPayload/decryptEntryPayload 整体加解密函数
    status: completed
    dependencies:
      - refactor-types
  - id: migrate-load-save
    content: 重构 index.vue 的 loadEntries/saveEntries/handleChangePassword/exportAllData 适配新格式并支持旧数据自动迁移
    status: completed
    dependencies:
      - extend-crypto
  - id: show-storage-path
    content: 在 HelpDialog.vue 新增 storagePath prop +「数据位置」section，index.vue 计算并传递路径
    status: completed
  - id: codex-scss
    content: 更新 help.scss：新增 .storage-path-section 样式（等宽字体 $vp-mono、Codex 边框卡片、点击复制交互）
    status: completed
    dependencies:
      - show-storage-path
  - id: build-verify
    content: 构建验证：lint 零错误 + pnpm vite build 通过
    status: completed
    dependencies:
      - migrate-load-save
      - codex-scss
---

## 用户需求

### 1. 存储结构审查与修复

- 审查当前 6 个独立 PluginStorage key 的存储方案是否存在逻辑缺陷
- 检查密码哈希（PBKDF2）、盐值派生（verifySalt vs encryptionSalt 分离）、加解密流程是否合理
- 清理死代码（`PasswordVaultData` 接口从未被使用）

### 2. 扩展加解密覆盖范围

- 当前 `StoredPasswordEntry` 仅对 `password` 字段 AES-GCM 加密，`name`/`account`/`description` 为明文
- 改造方案：将 `{name, account, password, description}` 四字段合并为一个 JSON 对象，整体 AES-GCM 加密存入 `encryptedPayload`
- `id`/`category`/`createdAt`/`updatedAt` 保留明文（分类筛选、排序需要）
- **必须兼容旧数据**：自动检测旧格式（entry 含 `encryptedPassword` 字段），首次加载时透明迁移并写回新格式

### 3. 显示数据存储路径

- 在帮助弹窗（HelpDialog.vue）中新增「数据位置」section
- 展示密码箱数据文件在磁盘上的实际物理路径
- 路径可点击复制到剪贴板，使用 `@/utils/domUtils` 的 `copyToClipboard`
- 路径格式：`{workspace}/data/storage/petal/{pluginName}/password-vault-entries.json`

## 技术方案

### 1. 存储架构评估结果

**当前 6 key 方案分析：**

| KEY | 存储内容 | 评估 |
| --- | --- | --- |
| `password-vault-master-password` | PBKDF2 哈希 | 正确，用于密码验证 |
| `password-vault-verify-salt` | 16B 验证盐值 | 正确，独立盐值防止彩虹表 |
| `password-vault-encryption-salt` | 16B 加密盐值 | 正确，与验证盐值分离符合最佳实践 |
| `password-vault-entries` | 加密条目数组 | 需修复——只加密了 password |
| `password-vault-categories` | 分类数组 | 合理——非敏感数据明文存储 |
| `password-vault-hint` | 密码提示 | 合理——提示本就是辅助记忆 |


**结论**：6 key 分离设计无逻辑缺陷，verifySalt/encryptionSalt 分离增加了安全性层次。核心问题是 entries 内敏感字段加密覆盖不足。

### 2. 新 StoredPasswordEntry Schema

```typescript
// 新格式（v2）
export interface StoredPasswordEntry {
  id: string // 明文 — 唯一标识
  category: string // 明文 — 分类筛选依赖
  encryptedPayload: string // Base64 — AES-GCM({name,account,password,description})
  iv: string // Base64 — 初始化向量
  createdAt: number // 明文
  updatedAt: number // 明文
  version?: number // 数据版本标记（可选，2=新格式）
}

// 旧格式（v1，用于迁移检测）
interface LegacyStoredPasswordEntry {
  id: string
  category: string
  name: string
  account: string
  encryptedPassword: string
  iv: string
  description: string
  createdAt: number
  updatedAt: number
}
```

### 3. 加密函数扩展

在 `utils/crypto.ts` 中新增两个函数：

```typescript
// 加密敏感字段集合 → 单一加密 blob
encryptEntryPayload(
  data: { name: string; account: string; password: string; description: string },
  key: CryptoKey
): Promise<{ encryptedPayload: string; iv: string }>

// 解密 → 还原四个明文字段
decryptEntryPayload(
  encryptedPayload: string, iv: string, key: CryptoKey
): Promise<{ name: string; account: string; password: string; description: string }>
```

### 4. 旧数据迁移策略

```
loadEntries()
  ├─ 遍历 stored entries
  ├─ 检测旧格式：entry.encryptedPassword !== undefined
  │   ├─ decryptPassword(entry.encryptedPassword, entry.iv, key) → password
  │   ├─ encryptEntryPayload({name,account,password,description}, key) → payload
  │   └─ 返回新格式 entry
  └─ 新格式：直接 decryptEntryPayload() 获取四字段
  └─ 有旧条目时自动 saveEntries() 写回新格式（静默迁移）
```

### 5. 存储路径展示

- **HelpDialog.vue** 新增 `storagePath?: string` prop
- **index.vue** 传递 computed 路径：`computed(() => ${dataDir}/storage/petal/${pluginName}/password-vault-entries.json)`
- 样式：等宽字体 `$vp-mono`、Codex 边框卡片、悬停高亮
