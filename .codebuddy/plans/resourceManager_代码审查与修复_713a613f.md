---
name: resourceManager 代码审查与修复
overview: 审查 resourceManager 模块，修复确认的逻辑漏洞（路径穿越、文件名兜底错用新文件名、移动失败仍保存自定义分类）、内存泄露（模块级 storage 单例）、死代码（未使用的 i18n 字段）与冗余（跨文件重复 SQL 查询）。
todos:
  - id: fix-move-chain-bugs
    content: 修复移动链路三处逻辑漏洞（路径穿越校验、文件名兜底、失败不保存分类）
    status: completed
  - id: remove-storage-singleton
    content: 移除 useResourceManager 模块级 storage 单例消除内存泄露
    status: completed
    dependencies:
      - fix-move-chain-bugs
  - id: remove-dead-i18n-fields
    content: 删除 ResourceManagerI18n 及 i18n 分片中未使用的 description/allCategories
    status: completed
  - id: extract-shared-sql
    content: 提取 useAssetLocator 与 useResourceManager 重复的 blocks LIKE 查询到 utils.ts
    status: completed
    dependencies:
      - fix-move-chain-bugs
      - remove-storage-singleton
---

## 产品概述

对 `src/features/resourceManager`（思源笔记资源管理 Dock 面板）做代码审查，并修复已确认的逻辑漏洞、内存泄露、死代码与冗余，不改变现有 UI 与功能行为。

## 核心功能

- **修复路径穿越漏洞**：`isValidAssetMovePath` 先解码再校验，阻断 `%2e%2e` 等编码形式绕过 `..` 检查后通过 `renameFile` 穿越出 `assets/` 目录。
- **修复文件名兜底 bug**：`updateAssetReferences` 的文件名兜底改用旧路径文件名查询引用，避免移动时改文件名导致历史引用自愈失效。
- **修复移动失败仍保存分类**：`handleMoveAsset` 返回成功状态，`applyCustomCategory` 仅在移动成功时把自定义分类写入持久化存储。
- **消除内存泄露**：移除 `useResourceManager` 中的模块级 `sharedStorage` 单例，避免其长期持有旧 `Plugin` 实例。
- **清理死代码**：删除 `ResourceManagerI18n` 中从未使用的 `description`、`allCategories` 字段及对应 i18n 分片键。
- **消除冗余**：提取 `useAssetLocator` 与 `useResourceManager` 中重复的 blocks 表 markdown LIKE 查询到 `utils.ts` 共享函数。

## 技术栈

- Vue 3 + TypeScript（沿用现有项目技术栈，仅做逻辑层修改）
- 无新增依赖，不涉及 UI/样式改动

## 实现方案

### 1. 路径穿越修复（utils.ts）

`isValidAssetMovePath` 当前只检查原始字符串，未捕获 URL 编码的 `..`。改为先 `safeDecodeURI(path)` 解码，再校验解码结果：

- `startsWith("assets/")`
- 不含 `..`
- 不以 `/` 结尾

`safeDecodeURI` 已在同文件定义，直接复用，无需新增工具。

### 2. 文件名兜底修复（useResourceManager.ts）

`updateAssetReferences` 中 `const baseName = newBase.split("/").pop()` 误用新路径文件名。改为：

```ts
const oldBase = safeDecodeURI(oldPath)
const newBase = safeDecodeURI(newPath)
const variants = buildVariantPairs(oldBase, newBase)
const baseName = oldBase.split("/").pop() ?? ""
const namePairs = baseName ? buildVariantPairs(baseName, newBase) : []
```

确保「按旧文件名查引用旧目录的块」的兜底语义正确。

### 3. 移动失败状态传递（useResourceManager.ts）

- `handleMoveAsset` 签名改为 `Promise<boolean>`：所有失败分支（空路径、路径相同、路径无效、文件不存在、renameFile/引用更新异常）返回 `false`，成功路径返回 `true`。
- `applyCategory` 改为 `return handleMoveAsset(currentPath)` 透传结果。
- `applyCustomCategory` 在 `await applyCategory(...)` 后判断 `moved`，仅 `moved === true` 时才更新 `customCategories` 并 `storage.save`；无论成功失败都清空 `customCategory`。

### 4. 移除 storage 单例（useResourceManager.ts）

删除文件顶部的 `let sharedStorage` 与 `getStorage` 函数，在 `useResourceManager` 内部直接 `const storage = new PluginStorage(plugin)`。`PluginStorage` 构造仅保存 plugin 引用、开销可忽略，而 Dock 面板 Vue 实例在插件生命周期内通常仅创建一次，单例无实际收益且造成旧 plugin 无法回收。

### 5. 死代码清理（types + i18n）

- `src/features/resourceManager/types/index.ts`：从 `ResourceManagerI18n` 删除 `description` 与 `allCategories` 字段。
- `src/i18n/zh_CN/resourceManager.json` 与 `src/i18n/en_US/resourceManager.json`：同步删除 `"description"`、`"allCategories"` 两个键。
- 删除后需运行 `pnpm i18n:merge` 重新生成顶层合并 JSON（构建产物禁止手动改）。

### 6. 冗余 SQL 提取（utils.ts + 两个 composable）

在 `utils.ts` 新增共享查询函数（需补充 `import { sql } from "@/api"`）：

```ts
export async function queryBlocksByMarkdown(needle: string, limit: number): Promise<{ id: string; root_id: string; markdown: string }[] | null>
```

内部执行 `SELECT id, root_id, markdown FROM blocks WHERE markdown LIKE '%${escapeSqlLike(needle)}%' ESCAPE '\\' ORDER BY updated DESC LIMIT ${limit}`。

- `useAssetLocator.queryBlockRefs`：改为调用该函数，遍历行取 `id || root_id` 去重（保持原定位行为）。
- `useResourceManager.queryRefBlocks`：改为调用该函数，遍历行取 `id` 与 `markdown` 存入 `blockMap`。

`ORDER BY updated DESC` 对更新引用场景无副作用（blocks.id 为主键，DISTINCT 本无实际去重意义，可省略）。

## 实施注意事项

- 所有修改保持文件头注释规范（`.ts` 文件顶部功能说明注释不删除）。
- `if` 语句必须有花括号 `{}`。
- 禁止跨 feature 直接导入；本次仅在 resourceManager 模块内修改。
- 修改完成后由用户自行验证：`npx tsc --noEmit`、`pnpm i18n:verify`（键对齐）、`pnpm i18n:merge`（重新生成合并文件）；AI 不执行 `pnpm vite build` 与 `pnpm lint`。

## 目录结构

```
src/features/resourceManager/
├── utils.ts                        # [MODIFY] isValidAssetMovePath 解码校验；新增 queryBlocksByMarkdown 共享查询
├── types/index.ts                  # [MODIFY] 删除 description/allCategories 死字段
├── composables/
│   ├── useResourceManager.ts       # [MODIFY] 移动链路三处修复 + 移除 storage 单例 + queryRefBlocks 改用共享查询
│   └── useAssetLocator.ts          # [MODIFY] queryBlockRefs 改用共享查询
src/i18n/
├── zh_CN/resourceManager.json      # [MODIFY] 删除 description/allCategories 键
└── en_US/resourceManager.json      # [MODIFY] 删除 description/allCategories 键
```