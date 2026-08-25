# src/api.ts 代码审查报告

**来源审核：**
- 来源评级：🟢 A（项目自身源码，本地文件 `src/api.ts`，1274 行）
- 出处：siyuanPluginVueSN 项目 | 基底：frostime/sy-plugin-template-vite 官方模板
- 发布日期：2026-08-25 审查 | 对照基准：思源官方 [API_zh_CN.md](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md) | 利益相关：无
- 时效性：当前（思源 2.x 内核 API）

**领域识别：** 领域：前端/思源笔记插件·内核 API 封装层 | 深度：中级（1-2 年经验） | 目标读者：维护本插件 API 层的开发者

**代码审核结果：**
- 整体评级：**B**（无架构级 🔴，存在 🔴2 处中高风险 + 🟡6 处中等问题，均可低成本修复）
- 代码规模：86 个函数（84 个导出 API + 2 个内部请求封装）+ 17 个类型定义，分 18 个功能分组
- 问题统计：🔴 2 | 🟡 6 | 🟠 8

| # | 位置 | 维度 | 级别 | 问题描述 | 修正建议 |
|---|------|------|------|----------|----------|
| 1 | 第 694 行 `getBlockByID` | 安全性 | 🔴 | `blockId` 字符串拼接 SQL，存在注入面 | 校验 ID 格式 `^[a-z0-9-]{14,}$` 或转义单引号 |
| 2 | 第 130 行 `renameDocById` | 正确性 | 🔴 | 传 `{id, title}`，与官方 `/api/filetree/renameDoc` 契约（`doc`+`path`+`title`）不符；当前无调用方，风险潜伏 | 改为 `{ doc, title }` 或确认内核兼容后删除 |
| 3 | 第 427/742/783/887 行 | 安全性 | 🟡 | 原生 `fetch` 未附加 `Authorization: Token` 鉴权头，依赖思源本地放行 | 统一走 `fetchSyncPost` 或显式注入 token |
| 4 | 第 20 行 `request` | 性能/可读 | 🟡 | 静默吞噬所有异常返回 `null`，调用方无法区分「空结果」与「调用失败」 | 关键 API 改用 `requestOrThrow` |
| 5 | 第 873 行 `fetchExportZip` | 正确性 | 🟡 | 相对路径 `fetch(zipPath)` 隐式依赖页面 URL 与内核同源 | 拼接 `SIYUAN_API_BASE_URL` 绝对路径 |
| 6 | 第 1135 行 | 正确性 | 🟡 | `data?.files ?? data?.content ?? data?.diff` 宽泛兜底，掩盖响应结构变化 | 按实际响应结构收窄解析 |
| 7 | 多处 | 可读性 | 🟡 | `version`/`getDocImageAssets` 声明 `Promise<string>` 实际返回可能为 `null`；`getFile`/`exportData`/`getConf` 用 `any` | 统一 `T \| null` 或精确类型 |
| 8 | 第 703 行 `getDocIdByBlockId` | 可读性 | 🟡 | 依赖 `getBlockByID` 无 `try-catch`，错误信息被 `console.error` 吞掉后返回 `null` | `getBlockByID` 内部捕获并返回 `null` |

---

## 一、总览：这是什么文件？

插件开发者写业务功能时，最常遇到的一个问题是——**「我到底该直接拼内核 API 的 URL，还是找现成的封装？」**

答案就在 `src/api.ts`。它是整个插件唯一被 `@/api` 别名导出的**内核 API 封装层**，把思源内核（运行在 `http://127.0.0.1:6806`）的 HTTP 接口逐一包装成类型安全的 `async` 函数，业务代码禁止直接裸调 `fetch`（项目硬规则，见 AGENTS.md 统一入口原则）。

文件构成：

| 类别 | 数量 | 说明 |
|------|------|------|
| 导出 API 函数 | 84 | 覆盖笔记本、文件树、块、资源、导出等 18 个分组 |
| 内部请求封装 | 2 | `request`（静默失败）/ `requestOrThrow`（抛异常） |
| 接口定义 | 15 | `DocDetail`、`SnapshotInfo`、`HistoryItem` 等 |
| 类型别名 | 2 | `DataType`、`PandocArgs`、`HistoryOp` |

**功能分组全景：**

| 分组 | API 数量 | 代表函数 | 稳定性 |
|------|---------|----------|--------|
| Notebook 笔记本 | 8 | `lsNotebooks`、`createNotebook` | 🟢 公开 |
| File Tree 文件树 | 13 | `createDocWithMd`、`getDoc`、`listDocsByPath` | 🟢 公开 |
| Ref 反链 | 1 | `getBacklink`（getBacklink2） | 🟢 公开 |
| Asset 资源 | 11 | `upload`、`renameAsset`、`getUnusedAssets` | 🟢 公开 |
| Block 块操作 | 10 | `insertBlock`、`getBlockKramdown`、`moveBlock` | 🟢 公开 |
| Attributes 属性 | 2 | `setBlockAttrs`、`getBlockAttrs` | 🟢 公开 |
| Tag 标签 | 1 | `listTags` | 🟢 公开 |
| SQL 查询 | 3 | `sql`、`getBlockByID` | 🟢 公开 |
| Template 模板 | 2 | `render`、`renderSprig` | 🟢 公开 |
| File 文件 | 5 | `getFile`、`putFile`、`readDir` | 🟢 公开 |
| Export 导出 | 5 | `exportData`、`exportNotebookMd`、`fetchExportZip` | 🟡 部分非公开 |
| Import 导入 | 1 | `importData` | 🟢 公开 |
| Convert 转换 | 1 | `pandoc` | 🟢 公开 |
| Notification 通知 | 2 | `pushMsg`、`pushErrMsg` | 🟢 公开 |
| Network 网络 | 1 | `forwardProxy` | 🟢 公开 |
| System 系统 | 10 | `getConf`、`getWorkspaceDir`、`reloadUI` | 🟡 部分非公开 |
| Repo/Cloud 快照 | 8 | `createSnapshot`、`getCloudRepoTagSnapshots` | 🟡 部分非公开 |
| History 数据历史 | 2 | `searchHistory`、`getHistoryItems` | 🔴 内核内部接口 |

**分层结构（自上而下）：**

```
业务组件 / composables（features/ 目录）
        ↓ import { api.xxx } from "@/api"
┌─────────────────────────────────┐
│  API 函数层（84 个，按分组注释分区）│
├─────────────────────────────────┤
│  请求封装层（request / requestOrThrow）│
├─────────────────────────────────┤
│  传输层：fetchSyncPost / 原生 fetch   │
└─────────────────────────────────┘
```

> **划重点：** `src/types/api.d.ts` 定义了 `IRes*` 响应结构，`src/types/index.d.ts` 定义了 `BlockId`、`DocumentId`、`Block` 等基础类型，`api.ts` 只做「URL + 参数 + 返回类型」的映射，类型与实现分离清晰。

---

## 二、核心设计模式

### 2.1 双层错误处理策略：`request` vs `requestOrThrow`

先看两段最核心的代码，它们是整个封装层的地基：

```typescript
async function request(url: string, data: any) {
  try {
    const response: IWebSocketData = await fetchSyncPost(url, data)
    const res = response.code === 0 ? response.data : null
    return res
  } catch {
    return null
  }
}

async function requestOrThrow(url: string, data: any) {
  let response: IWebSocketData
  try {
    response = await fetchSyncPost(url, data)
  } catch (e: unknown) {
    throw new Error(getErrorMessage(e) || `API request failed: ${url}`)
  }
  if (response.code !== 0) {
    throw new Error(response.msg || `API error: ${url}`)
  }
  return response.data ?? null
}
```

**代码解析：**
1. `request`：一切异常（网络断、内核返回非 0）统一折叠成 `null`——调用方拿到的永远是「要么数据、要么 null」，**不抛错**。适合查询类、可选增强型功能。
2. `requestOrThrow`：网络错误与 `code !== 0` 都转成带 URL 上下文信息的 `Error` 抛出——调用方必须处理异常。适合**必须成功**的写操作（备份、导出、删除）。

**为什么用 fetchSyncPost？** 思源官方 SDK 的 `fetchSyncPost` 会自动附加 `Authorization: Token` 鉴权头，业务代码无需感知 token 管理。

**对比效果：**

| 维度 | `request` | `requestOrThrow` |
|------|-----------|------------------|
| 失败行为 | 返回 `null` | 抛出 `Error` |
| 错误信息 | 丢失 | 含 URL 上下文 |
| 适用场景 | 查询/可选功能 | 写操作/关键路径 |
| 当前占比 | 约 70% | 约 30% |

### 2.2 二进制传输特例：何时绕过 fetchSyncPost？

`fetchSyncPost` 强制 JSON 序列化，遇到二进制场景必须绕行。文件里共有 4 处特例，均**有注释说明原因**：

| 函数 | 用途 | 绕过原因 |
|------|------|----------|
| `getFile` | 读取文件二进制 | 需 `arrayBuffer()` 重建 `Blob`（Electron 伪 Blob 问题） |
| `putFile` | 上传文件 | FormData 被 JSON 序列化后文件仅剩 ~52 字节元数据 |
| `getRepoSnapshotContent` | 快照内容 | 响应可能非标准 JSON，需手解析 |
| `importData` | 导入备份 | FormData 上传 |

其中 `getFile` 的注释给出了关键经验：

```typescript
// Electron 环境下 response.blob() 可能返回无法正确序列化到 FormData 的伪 Blob
const arrayBuffer = await response.arrayBuffer()
return new Blob([arrayBuffer])
```

> **划重点：** 二进制走原生 `fetch` 是正确选择，但代价是**丢失鉴权头自动注入**（见三、问题 #3），修复时需权衡。

### 2.3 类型层设计

文件内自定义了 17 个类型，其中两个亮点：

```typescript
/** getDoc 返回的文档详情（created/updated 为 YYYYMMDDHHMMSS 格式字符串） */
export interface DocDetail {
  // ...
  /** SiYuan /api/filetree/getDoc 返回的块属性（可能是对象或 JSON 字符串，created/updated 可能在内） */
  ial?: string | { created?: string; updated?: string }
}

/** getBacklink2 返回的反链/反提及条目（对齐思源前端 IBlockTree 结构） */
export interface IRefFile {
  box: string
  id: string
  name: string
  hPath: string  // 注意：该结构只有 hPath（人类可读路径），没有 path 字段
}
```

- `DocDetail.ial` 用联合类型 `string | {created?, updated?}` 容纳内核「有时返回对象、有时返回 JSON 字符串」的怪癖；
- `IRefFile` 注释明确标注「只有 hPath 没有 path」，避免后续调用方误用。

这些注释是在后期维护中补上的，比模板原版强得多。

#### 小结

通过这一部分，我们了解了：
- `api.ts` 采用「请求封装层 + API 函数层」双层结构，类型独立放在 `types/*.d.ts`
- 错误处理分化成「静默 null」与「抛异常」两套策略，按 API 重要性取舍
- 二进制传输主动绕过 `fetchSyncPost`，但带来了鉴权缺口

---

## 三、代码审查发现的问题

### 3.1 严重问题详解

#### 🔴 问题 #1：`getBlockByID` 存在 SQL 注入面

```typescript
export async function getBlockByID(blockId: string): Promise<Block> {
  const sqlScript = `select * from blocks where id ='${blockId}'`
  const data = await sql(sqlScript)
  return data[0]
}
```

**风险分析：** `blockId` 直接拼接进 SQL。思源 `/api/query/sql` 接口只接受 `stmt` 字符串，**不支持参数化查询**，所以拼接是唯一写法。当前 3 处调用方（`imageCompressor`、`aiContentGenerator`、`tableOfContents`）传入的都是思源生成的块 ID，格式安全，实际可利用性低——但**注入面真实存在**，任何未来新调用方传入用户可控字符串即可能被利用。

**修正建议：** 拼接前校验 ID 格式，非法格式直接返回 `null`：

```typescript
const BLOCK_ID_RE = /^[a-z0-9-]{14,}$/
if (!BLOCK_ID_RE.test(blockId)) return null
```

#### 🔴 问题 #2：`renameDocById` 与内核契约不符（且为死代码）

```typescript
/** 根据 ID 重命名文档 */
export async function renameDocById(id: DocumentId, title: string): Promise<DocumentId> {
  const data = { id, title }
  const url = "/api/filetree/renameDoc"
  return request(url, data)
}
```

思源官方契约要求 `doc`（文档 ID）为主键，`path` 可选、`title` 必填。`renameDocById` 传 `{ id, title }`，其中 `id` 字段不在契约内——若内核按字段白名单校验，`id` 被忽略将导致调用失败。

**更重要的发现：** 全局搜索确认 `renameDoc` 与 `renameDocById` **均无任何调用方**，属模板保留的死代码。另一个连带问题：`renameDoc` 的参数名 `notebook` 实际承载的是文档 ID，语义误导。

**修正建议：** 二选一——确认无计划使用后直接删除；或改为合规签名 `renameDocById(doc: DocumentId, title: string)` 并传 `{ doc, title }`。

### 3.2 中等问题详解

#### 🟡 问题 #3：原生 `fetch` 丢鉴权

4 处绕过 `fetchSyncPost` 的代码（`getFile`/`putFile`/`getRepoSnapshotContent`/`importData`）均未附加 `Authorization: Token` 请求头。在思源默认配置下本地请求通常放行，但**未开启放行时这些 API 会静默返回 401**。`getRepoSnapshotContent` 有 catch 兜底返回 `[]`，故障会被完全掩盖——用户看到的是「快照内容为空」，实际是鉴权失败。

#### 🟡 问题 #4：`request` 静默吞噬错误

约 70% 的 API 走 `request`，网络故障/内核错误一律折叠为 `null`。连锁效应在 `getWorkspaceDir` 这类函数上看得最清楚：

```typescript
export async function getWorkspaceDir(): Promise<string> {
  const data = await getConf()
  return data?.conf?.system?.workspaceDir || ""
}
```

`getConf` 失败返回 `null` → `getWorkspaceDir` 返回 `""` → 调用方拿空字符串继续走逻辑，**根因被层层吞掉**。建议对关键链路（配置、快照、备份）改用 `requestOrThrow`。

#### 🟡 问题 #5：`fetchExportZip` 相对路径依赖页面同源

```typescript
export async function fetchExportZip(zipPath: string): Promise<Blob> {
  const response = await fetch(zipPath)
```

思源桌面端页面 URL 为 `http://127.0.0.1:6806/stage/...`，相对路径 `fetch("export/xxx.zip")` 恰好解析到内核同源，**当前可用**。但这是隐式依赖：一旦在独立窗口（`desktop-window`）或自定义宿主环境下，页面 URL 变化即静默失效。该函数被 `useMarkdownExport` 三处调用（工作空间 ZIP 下载），是项目自定义的真实功能，建议改为拼接绝对地址。

#### 🟡 问题 #6：宽泛兜底解析

```typescript
return data?.files ?? data?.content ?? data?.diff ?? []
```

`getRepoSnapshotContent` 对响应结构做了三级兜底，确实稳健，但若内核调整响应结构，三层全部落空后静默返回 `[]`，无从察觉。建议对非预期结构打一条 `console.warn`。

#### 🟡 问题 #7：返回类型不精确

| 函数 | 声明类型 | 实际可能 | 影响 |
|------|---------|----------|------|
| `version()` | `Promise<string>` | `null` | 类型谎报 |
| `getDocImageAssets()` | `Promise<string[]>` | `null` | 类型谎报 |
| `getFile()` | `Promise<any>` | `Blob \| null` | 丢失类型信息 |
| `exportData()` | `Promise<any>` | 结构不明 | 丢失类型信息 |
| `getConf()` | `Promise<any>` | 结构不明 | 丢失类型信息 |
| `getBlockByID()` | `Promise<Block>` | `undefined` | 越界访问 |

统一建议：声明 `Promise<T | null>`，与 `request` 的实际行为对齐。

#### 🟡 问题 #8：`getBlockByID` 无异常保护

`getBlockByID` 没有 `try-catch`，SQL 失败会直接抛错；而它唯一的封装消费方 `getDocIdByBlockId` 捕获后 `console.error` 并返回 `null`——错误只留下日志，业务层无法感知。既然 SQL 是本地库、极少失败，建议在 `getBlockByID` 内部捕获返回 `null`，与 `request` 风格统一。

### 3.3 低级别问题清单

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| 9 | `forwardProxy` 第 948 行 | 局部变量命名 `url1`（参数占用 `url` 后随手起的名字） | 改 `endpoint` 或 `targetUrl` |
| 10 | `upload`/`putFile` | `files: any[]`、`file: any` 类型过宽 | 收窄为 `File[]` / `File \| Blob` |
| 11 | `request` | `data: any` 无泛型约束 | `request<T>(url, data): Promise<T \| null>` |
| 12 | 全局 | 注释覆盖不一致：模板原版函数（`insertBlock`、`prependBlock`、`moveBlock`、`listTags` 等）无 JSDoc，后期新增函数（`searchHistory`、`getHistoryItems` 等）JSDoc 完整 | 逐步补齐 |
| 13 | `getCloudRepoTagSnapshots` 第 1164 行 | `(snap as any).tag` 类型断言 | 为 `SnapshotInfo` 补充 `tag` 字段 |
| 14 | 非公开接口 | `reloadUI`/`reloadFiletree`/`exportNotebookMd`/`searchHistory` 等非公开接口未统一标注「非公开、可能变更」 | 在 JSDoc 首行统一标注 |
| 15 | `getBlockMarkdown` | 属性正则只移除块末尾的 `{: id=...}`，嵌套属性会残留 | 可接受（单块场景），如遇问题再扩展 |
| 16 | `importData` | 返回 `response.json()` 未校验 `code` | 与 `putFile` 一致，非 0 抛错 |

---

## 四、API 清单（分组速查）

### 4.1 Notebook 笔记本（8）

| 函数 | 端点 | 参数 | 错误模式 |
|------|------|------|----------|
| `lsNotebooks` | `/api/notebook/lsNotebooks` | — | request |
| `openNotebook` | `/api/notebook/openNotebook` | `notebook` | request |
| `closeNotebook` | `/api/notebook/closeNotebook` | `notebook` | request |
| `renameNotebook` | `/api/notebook/renameNotebook` | `notebook, name` | request |
| `createNotebook` | `/api/notebook/createNotebook` | `name` → `Notebook` | request |
| `removeNotebook` | `/api/notebook/removeNotebook` | `notebook` | request |
| `getNotebookConf` | `/api/notebook/getNotebookConf` | `notebook` | request |
| `setNotebookConf` | `/api/notebook/setNotebookConf` | `notebook, conf` | request |

### 4.2 File Tree 文件树（13）

| 函数 | 端点 | 说明 |
|------|------|------|
| `createDocWithMd` | `/api/filetree/createDocWithMd` | 按 MD 创建文档 → `DocumentId` |
| `renameDoc` | `/api/filetree/renameDoc` | ⚠️ 无调用方；参数名 `notebook` 实为文档 ID |
| `renameDocById` | `/api/filetree/renameDoc` | ⚠️ 无调用方；契约不符（传 `id` 应传 `doc`） |
| `removeDoc` / `removeDocById` | `/api/filetree/removeDoc` | 按路径 / 按 ID 删除 |
| `moveDocs` / `moveDocsById` | `/api/filetree/moveDocs` | 按路径 / 按 ID 移动 |
| `getHPathByPath` / `getHPathByID` | `/api/filetree/getHPath*` | 取人类可读路径 |
| `getIDsByHPath` | `/api/filetree/getIDsByHPath` | 反向取 ID 列表 |
| `listDocsByPath` | `/api/filetree/listDocsByPath` | 支持 `sort=256` 继承笔记本排序、`maxListCount` 限流 |
| `getPathByID` | `/api/filetree/getPathByID` | → `{notebook, path}` |
| `getDoc` | `/api/filetree/getDoc` | `mode`: 0=DOM 1=Markdown → `DocDetail` |

### 4.3 Ref 反链（1）

`getBacklink(id)` → `/api/ref/getBacklink2`，一次返回 `backlinks`（文档级）与 `backmentions`（块级），对齐思源前端反链面板。`k/mk` 空串不过滤、`sort/mSort` "0" 默认排序。

### 4.4 Asset 资源（11）

| 函数 | 说明 |
|------|------|
| `upload` | FormData 上传，→ `{errFiles, succMap}` |
| `fullReindexAssetContent` | 全量重建索引（requestOrThrow） |
| `resolveAssetPath` | 资源相对路径 → OS 绝对路径 |
| `getDocAssets` / `getDocImageAssets` | 文档资源 / 仅图片 |
| `renameAsset` | 重命名并自动更新引用（手动校验 code） |
| `insertLocalAssets` | 本地绝对路径插入 → `{succMap, errFiles}` |
| `getMissingAssets` / `getUnusedAssets` | 丢失 / 未使用资源（requestOrThrow） |
| `removeUnusedAsset` / `removeUnusedAssets` | 删单个 / 全部未使用（requestOrThrow） |

### 4.5 Block 块操作（10）

`insertBlock` / `prependBlock` / `appendBlock` / `updateBlock` / `deleteBlock` / `moveBlock`（均返回 `IResdoOperations[]`）、`getBlockKramdown`、`getBlockMarkdown`（清洗 `{: id=...}` 尾注）、`getChildBlocks`、`transferBlockRef`（引用转移）。

### 4.6 其余分组（Attributes 2 / Tag 1 / SQL 3 / Template 2 / File 5）

- **Attributes**：`setBlockAttrs`、`getBlockAttrs`（`Record<string, string>`）
- **Tag**：`listTags` → `TagInfo[]`（树形）
- **SQL**：`sql(stmt)` 底层查询、`getBlockByID`（⚠️ 注入面）、`getDocIdByBlockId`
- **Template**：`render(id, path)`、`renderSprig(template)`（Sprig 模板）
- **File**：`getFile`（原生 fetch→Blob）、`putFile`（FormData，含 `modTime`）、`removeFile`、`renameFile`、`readDir`（均手动校验 code）

### 4.7 Export/Import/Convert（7）

- `exportMdContent` / `exportResources` / `exportNotebookMd`（→ ZIP 路径）/ `exportData`（备份，可省略 `tempDir`）/ `fetchExportZip`（⚠️ 相对路径）
- `importData(tempDir)`（恢复备份，未校验 code）
- `pandoc(args)`（Pandoc 命令行透传）

### 4.8 Notification / Network / System（13）

- `pushMsg` / `pushErrMsg`：右下角通知，默认 7s、info 类型
- `forwardProxy`：内核侧代理转发 HTTP 请求
- `bootProgress` / `version` / `currentTime` / `getConf` / `getWorkspaceDir`
- `reloadUI` / `reloadFiletree` / `reloadTag` / `reloadAttributeView` / `reloadProtyle`（后两者需传块 ID）

### 4.9 Repo 快照 / History 历史（10）

- **快照**：`uploadCloudSnapshot`、`createSnapshot`（→ ID）、`getRepoSnapshots`（分页）、`getRepoSnapshotContent`（含 tag 分支）、`importRepo`（⚠️ 破坏性，checkoutRepo）、`getCloudRepoTagSnapshots`（自动按 tag 分组）、`downloadCloudSnapshot`、`removeCloudRepoTag`
- **历史**：`searchHistory(op, type, options)`（内核内部接口，依赖「数据历史」开启）、`getHistoryItems(created, op, type)`（配合取具体条目）

#### 小结

回顾一下，这一节完成了从问题发现到 API 清单的过渡：
- 8 个中高优先级问题集中在：SQL 注入面、契约不符死代码、鉴权缺口、类型谎报
- API 覆盖面完整（84 个），分组清晰，注释质量「后期 > 早期」

---

## 五、改进建议（按优先级）

| 优先级 | 建议 | 涉及 | 工作量 |
|--------|------|------|--------|
| **P0** | `getBlockByID` 加 ID 格式校验，封堵注入面 | api.ts:694 | 5 分钟 |
| **P0** | `renameDocById` 改传 `{doc, title}`，或确认无计划后删除死代码 | api.ts:130 | 10 分钟 |
| **P1** | 4 处原生 fetch 显式注入 `Authorization` 头（或换 `fetchSyncPost`） | getFile/putFile/getRepoSnapshotContent/importData | 30 分钟 |
| **P1** | 关键链路（配置/快照/备份）改用 `requestOrThrow` | getConf/getRepoSnapshots 等 | 20 分钟 |
| **P1** | 返回类型统一为 `T \| null`，消除 `any` | 6 个函数 | 15 分钟 |
| **P1** | `fetchExportZip` 拼接 `SIYUAN_API_BASE_URL` 绝对路径 | api.ts:873 | 5 分钟 |
| **P2** | 补齐早期函数 JSDoc；`url1` 改名；`(snap as any)` 消除 | 全局 | 1 小时 |
| **P2** | 非公开接口统一标注「非公开、可能变更」 | reloadUI/searchHistory 等 | 20 分钟 |

> **常见坑：** 直接修改 `api.ts` 后，业务调用方若依赖 `request` 的「永不抛错」行为，切到 `requestOrThrow` 会新增未捕获异常——P1 改动需同步排查调用方 `try-catch`。

---

## 总结

`src/api.ts` 作为插件唯一的内核 API 入口，整体设计是合格的：**双层错误处理策略、类型与实现分离、二进制特例显式化** 三个决策都正确，后期维护补上的 JSDoc 和类型标注（`DocDetail.ial` 联合类型、`IRefFile` 结构说明）质量明显高于模板原版。

如果你要接手这个文件，优先处理三件事：
- **先封堵 `getBlockByID` 的注入面**（一行正则校验）；
- **再清理 `renameDoc`/`renameDocById` 死代码或修正契约**（避免后人踩坑）；
- **最后统一原生 fetch 的鉴权与返回类型**，把「失败被静默吞掉」的隐患逐个暴露出来。

从工程角度看，这个文件的最大风险不在于单一 bug，而在于 `request` 静默失败策略让错误沿调用链层层折叠——修好它，插件 40+ 个功能模块的稳定性都能同步受益。理解 API 封装层，最好的方式永远是亲手加一个功能——跑一遍调用链，比读十篇文档管用。
