/**
 * API提供者注册器
 * 注册所有可用的API提供者
 */
import { createApiReferenceStorage } from './storage'
import type { Plugin } from 'siyuan'

/**
 * 初始化默认API提供者
 */
export async function initializeDefaultProviders(plugin: Plugin) {
  const storage = createApiReferenceStorage(plugin)
  
  // 检查是否已经初始化过
  const existingProviders = await storage.getProviders()
  
  // 如果已有提供者，直接返回
  if (existingProviders.length > 0) {
    return existingProviders
  }

  // 首次使用，创建一个示例API文档
  const defaultProvider = {
    id: 'siyuan-api-demo',
    name: '思源笔记 API 示例',
    description: `# 思源笔记 API 参考

## 简介

思源笔记提供了丰富的 API 接口，支持自动化操作和插件开发。

## 基础信息

- **API 端点**: \`http://127.0.0.1:6806\`
- **认证方式**: Token 认证
- **请求格式**: JSON

## 笔记本操作

### 获取笔记本列表

获取所有笔记本的基本信息。

\`\`\`http
POST /api/notebook/lsNotebooks
Content-Type: application/json
Authorization: token YOUR_TOKEN
\`\`\`

### 创建笔记本

创建一个新的笔记本。

\`\`\`http
POST /api/notebook/createNotebook
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "name": "新笔记本"
}
\`\`\`

## 文档操作

### 创建文档

通过 Markdown 内容创建新文档。

\`\`\`http
POST /api/filetree/createDocWithMd
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "notebook": "notebook-id",
  "path": "/新文档",
  "markdown": "# 标题\\n\\n内容"
}
\`\`\`

### 获取文档内容

获取指定文档的内容。

\`\`\`http
POST /api/export/exportMdContent
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "id": "document-id"
}
\`\`\`

## 块操作

### 插入块

在指定位置插入新的内容块。

\`\`\`http
POST /api/block/insertBlock
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "dataType": "markdown",
  "data": "新的内容",
  "parentID": "parent-block-id"
}
\`\`\`

### 更新块

更新指定块的内容。

\`\`\`http
POST /api/block/updateBlock
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "dataType": "markdown",
  "data": "更新后的内容",
  "id": "block-id"
}
\`\`\`

## 查询操作

### SQL 查询

执行 SQL 查询获取数据。

\`\`\`http
POST /api/query/sql
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "stmt": "SELECT * FROM blocks WHERE content LIKE '%关键词%' LIMIT 10"
}
\`\`\`

## 系统操作

### 获取版本信息

获取思源笔记的版本信息。

\`\`\`http
POST /api/system/version
Content-Type: application/json
Authorization: token YOUR_TOKEN
\`\`\`

### 推送消息

显示系统通知消息。

\`\`\`http
POST /api/notification/pushMsg
Content-Type: application/json
Authorization: token YOUR_TOKEN

{
  "msg": "这是一条通知消息",
  "timeout": 3000
}
\`\`\`

## 更多资源

- [官方 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [插件开发指南](https://github.com/siyuan-note/plugin-sample)
- [社区讨论](https://github.com/siyuan-note/siyuan/discussions)`,
    icon: '📚',
    version: '1.0.0',
    documentationUrl: 'https://github.com/siyuan-note/siyuan/blob/master/API.md',
    baseUrl: 'http://127.0.0.1:6806',
    authType: 'token',
    categories: ['notebook', 'document', 'block', 'query', 'system']
  }

  await storage.saveProviders([defaultProvider])
  await storage.saveMarkdownContent(defaultProvider.id, defaultProvider.description)
  
  return [defaultProvider]
}

/**
 * 获取所有已注册的API提供者
 */
export async function getRegisteredProviders(plugin: Plugin) {
  const storage = createApiReferenceStorage(plugin)
  return await storage.getProviders()
}

/**
 * 获取API提供者
 */
export async function getProvider(plugin: Plugin, id: string) {
  const storage = createApiReferenceStorage(plugin)
  const providers = await storage.getProviders()
  return providers.find(p => p.id === id)
}

/**
 * 搜索API提供者
 */
export async function searchProviders(plugin: Plugin, query: string) {
  const storage = createApiReferenceStorage(plugin)
  const providers = await storage.getProviders()
  const lowercaseQuery = query.toLowerCase()
  
  return providers.filter(provider =>
    provider.name.toLowerCase().includes(lowercaseQuery) ||
    provider.description.toLowerCase().includes(lowercaseQuery)
  )
}
