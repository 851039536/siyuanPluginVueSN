/**
 * Copyright (c) 2023 frostime. All rights reserved.
 * https://github.com/frostime/sy-plugin-template-vite
 *
 * See API Document in [API.md](https://github.com/siyuan-note/siyuan/blob/master/API.md)
 * API 文档见 [API_zh_CN.md](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)
 */

import {
  fetchSyncPost,
  IWebSocketData,
} from "siyuan"

/**
 * 思源笔记 API 基础 URL
 */
export const SIYUAN_API_BASE_URL = "http://127.0.0.1:6806"

async function request(url: string, data: any) {
  let response: IWebSocketData = await fetchSyncPost(url, data)
  let res = response.code === 0 ? response.data : null
  return res
}

// **************************************** Noteboook ****************************************

export async function lsNotebooks(): Promise<IReslsNotebooks> {
  let url = "/api/notebook/lsNotebooks"
  return request(url, "")
}

export async function openNotebook(notebook: NotebookId) {
  let url = "/api/notebook/openNotebook"
  return request(url, { notebook })
}

export async function closeNotebook(notebook: NotebookId) {
  let url = "/api/notebook/closeNotebook"
  return request(url, { notebook })
}

export async function renameNotebook(notebook: NotebookId, name: string) {
  let url = "/api/notebook/renameNotebook"
  return request(url, {
    notebook,
    name,
  })
}

export async function createNotebook(name: string): Promise<Notebook> {
  let url = "/api/notebook/createNotebook"
  return request(url, { name })
}

export async function removeNotebook(notebook: NotebookId) {
  let url = "/api/notebook/removeNotebook"
  return request(url, { notebook })
}

export async function getNotebookConf(
  notebook: NotebookId,
): Promise<IResGetNotebookConf> {
  let data = { notebook }
  let url = "/api/notebook/getNotebookConf"
  return request(url, data)
}

export async function setNotebookConf(
  notebook: NotebookId,
  conf: NotebookConf,
): Promise<NotebookConf> {
  let data = {
    notebook,
    conf,
  }
  let url = "/api/notebook/setNotebookConf"
  return request(url, data)
}

// **************************************** File Tree ****************************************
export async function createDocWithMd(
  notebook: NotebookId,
  path: string,
  markdown: string,
): Promise<DocumentId> {
  let data = {
    notebook,
    path,
    markdown,
  }
  let url = "/api/filetree/createDocWithMd"
  return request(url, data)
}

export async function renameDoc(
  notebook: NotebookId,
  path: string,
  title: string,
): Promise<DocumentId> {
  let data = {
    doc: notebook,
    path,
    title,
  }
  let url = "/api/filetree/renameDoc"
  return request(url, data)
}

/**
 * 根据 ID 重命名文档
 */
export async function renameDocById(
  id: DocumentId,
  title: string,
): Promise<DocumentId> {
  let data = { id, title }
  let url = "/api/filetree/renameDoc"
  return request(url, data)
}

export async function removeDoc(notebook: NotebookId, path: string) {
  let data = {
    notebook,
    path,
  }
  let url = "/api/filetree/removeDoc"
  return request(url, data)
}

/**
 * 根据 ID 删除文档
 */
export async function removeDocById(id: DocumentId) {
  let data = { id }
  let url = "/api/filetree/removeDoc"
  return request(url, data)
}

export async function moveDocs(
  fromPaths: string[],
  toNotebook: NotebookId,
  toPath: string,
) {
  let data = {
    fromPaths,
    toNotebook,
    toPath,
  }
  let url = "/api/filetree/moveDocs"
  return request(url, data)
}

/**
 * 根据 ID 移动文档
 */
export async function moveDocsById(
  fromIDs: DocumentId[],
  toID: DocumentId,
) {
  let data = { fromIDs, toID }
  let url = "/api/filetree/moveDocs"
  return request(url, data)
}

export async function getHPathByPath(
  notebook: NotebookId,
  path: string,
): Promise<string> {
  let data = {
    notebook,
    path,
  }
  let url = "/api/filetree/getHPathByPath"
  return request(url, data)
}

export async function getHPathByID(id: BlockId): Promise<string> {
  let data = {
    id,
  }
  let url = "/api/filetree/getHPathByID"
  return request(url, data)
}

export async function getIDsByHPath(
  notebook: NotebookId,
  path: string,
): Promise<BlockId[]> {
  let data = {
    notebook,
    path,
  }
  let url = "/api/filetree/getIDsByHPath"
  return request(url, data)
}

export interface IFile {
  id: string
  name: string
  icon: string
  path: string
  alias: string
  memo: string
  bookmark: string
  count: number
  size: number
  hSize: string
  mtime: number
  ctime: number
  hMtime: string
  hCtime: string
  subFileCount: number
}

export interface IListDocsByPathResponse {
  box: string
  path: string
  files: IFile[]
}

/**
 * 列出指定路径下的文档
 * @param notebook 笔记本 ID
 * @param path 文档路径，根目录为 "/"
 * @param sort 排序方式（默认 256 使用笔记本排序规则）
 * @param maxListCount 最大列出文档数（≤0 无限制）
 */
export async function listDocsByPath(
  notebook: NotebookId,
  path: string,
  sort: number = 256,
  maxListCount: number = 0,
): Promise<IListDocsByPathResponse> {
  let data = {
    notebook,
    path,
    sort,
    maxListCount,
  }
  let url = "/api/filetree/listDocsByPath"
  return request(url, data)
}

/**
 * 根据 ID 获取文档的存储路径
 * @param id 块 ID
 * @returns 包含 notebook（笔记本ID）和 path（文档路径）的对象
 */
export async function getPathByID(
  id: BlockId,
): Promise<{ notebook: string, path: string } | null> {
  let data = {
    id,
  }
  let url = "/api/filetree/getPathByID"
  return request(url, data)
}

// **************************************** Asset Files ****************************************

export async function upload(
  assetsDirPath: string,
  files: any[],
): Promise<IResUpload> {
  let form = new FormData()
  form.append("assetsDirPath", assetsDirPath)
  for (let file of files) {
    form.append("file[]", file)
  }
  let url = "/api/asset/upload"
  return request(url, form)
}

/**
 * 全量重建资源内容索引
 */
export async function fullReindexAssetContent(): Promise<null> {
  let url = "/api/asset/fullReindexAssetContent"
  return request(url, {})
}

/**
 * 解析资源路径为操作系统绝对路径
 * @param path 资源相对路径（如 assets/xxx.png）
 */
export async function resolveAssetPath(path: string): Promise<string> {
  let url = "/api/asset/resolveAssetPath"
  return request(url, { path })
}

/** 资源文件信息 */
export interface AssetInfo {
  path: string
  name: string
  type: string
  size: number
  box: string
  docpath: string
  hash: string
}

/**
 * 获取文档引用的所有资源文件列表
 * @param id 文档块 ID
 */
export async function getDocAssets(id: string): Promise<{ assets: AssetInfo[] }> {
  let url = "/api/asset/getDocAssets"
  return request(url, { id })
}

/**
 * 获取文档直接引用的图片资源路径列表
 * @param id 文档块 ID
 */
export async function getDocImageAssets(id: string): Promise<string[]> {
  let url = "/api/asset/getDocImageAssets"
  return request(url, { id })
}

/**
 * 重命名资源文件（自动更新所有引用）
 * @param oldPath 旧路径
 * @param newPath 新路径
 */
export async function renameAsset(oldPath: string, newPath: string): Promise<null> {
  let url = "/api/asset/renameAsset"
  return request(url, { oldPath, newPath })
}

/** 插入本地资源返回结果 */
export interface InsertLocalAssetsResult {
  succMap: Record<string, string>
  errFiles: string[]
}

/**
 * 插入本地资源文件到 assets 目录
 * @param assetPaths 本地文件绝对路径列表
 * @param id 目标文档块 ID
 */
export async function insertLocalAssets(
  assetPaths: string[],
  id: string,
): Promise<InsertLocalAssetsResult> {
  let url = "/api/asset/insertLocalAssets"
  return request(url, { assetPaths, id })
}

/**
 * 获取丢失资源列表（有引用但文件不存在）
 */
export async function getMissingAssets(): Promise<string[]> {
  let url = "/api/asset/getMissingAssets"
  return request(url, {})
}

/**
 * 获取未使用资源列表（文件存在但无引用）
 */
export async function getUnusedAssets(): Promise<string[]> {
  let url = "/api/asset/getUnusedAssets"
  return request(url, {})
}

/**
 * 删除单个未使用资源
 * @param path 资源相对路径
 */
export async function removeUnusedAsset(path: string): Promise<null> {
  let url = "/api/asset/removeUnusedAsset"
  return request(url, { path })
}

/**
 * 删除所有未使用资源
 */
export async function removeUnusedAssets(): Promise<null> {
  let url = "/api/asset/removeUnusedAssets"
  return request(url, {})
}

// **************************************** Block ****************************************
type DataType = "markdown" | "dom"
export async function insertBlock(
  dataType: DataType,
  data: string,
  nextID?: BlockId,
  previousID?: BlockId,
  parentID?: BlockId,
): Promise<IResdoOperations[]> {
  let payload = {
    dataType,
    data,
    nextID,
    previousID,
    parentID,
  }
  let url = "/api/block/insertBlock"
  return request(url, payload)
}

export async function prependBlock(
  dataType: DataType,
  data: string,
  parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
  let payload = {
    dataType,
    data,
    parentID,
  }
  let url = "/api/block/prependBlock"
  return request(url, payload)
}

export async function appendBlock(
  dataType: DataType,
  data: string,
  parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
  let payload = {
    dataType,
    data,
    parentID,
  }
  let url = "/api/block/appendBlock"
  return request(url, payload)
}

export async function updateBlock(
  dataType: DataType,
  data: string,
  id: BlockId,
): Promise<IResdoOperations[]> {
  let payload = {
    dataType,
    data,
    id,
  }
  let url = "/api/block/updateBlock"
  return request(url, payload)
}

export async function deleteBlock(id: BlockId): Promise<IResdoOperations[]> {
  let data = {
    id,
  }
  let url = "/api/block/deleteBlock"
  return request(url, data)
}

export async function moveBlock(
  id: BlockId,
  previousID?: PreviousID,
  parentID?: ParentID,
): Promise<IResdoOperations[]> {
  let data = {
    id,
    previousID,
    parentID,
  }
  let url = "/api/block/moveBlock"
  return request(url, data)
}

export async function getBlockKramdown(
  id: BlockId,
): Promise<IResGetBlockKramdown> {
  let data = {
    id,
  }
  let url = "/api/block/getBlockKramdown"
  return request(url, data)
}

/**
 * 获取块的 Markdown 内容（用于拖拽块时只读取块内容）
 * @param blockId 块 ID
 * @returns 块的 Markdown 内容字符串
 */
export async function getBlockMarkdown(
  blockId: string,
): Promise<string | null> {
  try {
    // 方法1: 使用 getBlockKramdown 获取单个块内容
    const kramdownData = await getBlockKramdown(blockId)

    // 注意：getBlockKramdown 返回的是 kramdown 属性，不是 content
    if (kramdownData && kramdownData.kramdown) {
      let content = kramdownData.kramdown

      // 移除思源特有的属性标记（如 {: id="xxx" updated="xxx"}）
      content = content.replace(
        /\n\{: id="[^"]*"(?:\s+updated="[^"]*")?\}$/g,
        "",
      )
      content = content.trim()

      return content
    }

    console.warn("⚠️ getBlockKramdown 返回空内容")
    return null
  } catch (error) {
    console.error("❌ 获取块 Markdown 内容失败:", error)
    return null
  }
}

export async function getChildBlocks(
  id: BlockId,
): Promise<IResGetChildBlock[]> {
  let data = {
    id,
  }
  let url = "/api/block/getChildBlocks"
  return request(url, data)
}

export async function transferBlockRef(
  fromID: BlockId,
  toID: BlockId,
  refIDs: BlockId[],
) {
  let data = {
    fromID,
    toID,
    refIDs,
  }
  let url = "/api/block/transferBlockRef"
  return request(url, data)
}

// **************************************** Attributes ****************************************
export async function setBlockAttrs(
  id: BlockId,
  attrs: { [key: string]: string },
) {
  let data = {
    id,
    attrs,
  }
  let url = "/api/attr/setBlockAttrs"
  return request(url, data)
}

export async function getBlockAttrs(
  id: BlockId,
): Promise<{ [key: string]: string }> {
  let data = {
    id,
  }
  let url = "/api/attr/getBlockAttrs"
  return request(url, data)
}

// **************************************** SQL ****************************************

export async function sql(sql: string): Promise<any[]> {
  let sqldata = {
    stmt: sql,
  }
  let url = "/api/query/sql"
  return request(url, sqldata)
}

export async function getBlockByID(blockId: string): Promise<Block> {
  let sqlScript = `select * from blocks where id ='${blockId}'`
  let data = await sql(sqlScript)
  return data[0]
}

// **************************************** Template ****************************************

export async function render(
  id: DocumentId,
  path: string,
): Promise<IResGetTemplates> {
  let data = {
    id,
    path,
  }
  let url = "/api/template/render"
  return request(url, data)
}

export async function renderSprig(template: string): Promise<string> {
  let url = "/api/template/renderSprig"
  return request(url, { template })
}

// **************************************** File ****************************************

export async function getFile(path: string): Promise<any> {
  let data = {
    path,
  }
  let url = "/api/file/getFile"
  try {
    // 不使用 fetchSyncPost，因为它会尝试解析JSON
    // 直接使用 fetch 获取二进制数据
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      console.error("getFile HTTP error:", {
        path,
        status: response.status,
        statusText: response.statusText,
      })
      return null
    }

    // 直接返回 Blob
    const blob = await response.blob()
    return blob
  } catch (error_msg) {
    console.error("getFile API error:", {
      path,
      error: error_msg,
    })
    return null
  }
}

export async function putFile(path: string, isDir: boolean, file: any) {
  let form = new FormData()
  form.append("path", path)
  form.append("isDir", isDir.toString())
  // Copyright (c) 2023, terwer.
  // https://github.com/terwer/siyuan-plugin-importer/blob/v1.4.1/src/api/kernel-api.ts
  form.append("modTime", Math.floor(Date.now() / 1000).toString())
  form.append("file", file)
  let url = "/api/file/putFile"
  return request(url, form)
}

export async function removeFile(path: string) {
  let data = {
    path,
  }
  let url = "/api/file/removeFile"
  return request(url, data)
}

/**
 * 重命名文件
 */
export async function renameFile(path: string, newPath: string) {
  let data = { path, newPath }
  let url = "/api/file/renameFile"
  return request(url, data)
}

export async function readDir(path: string): Promise<IResReadDir> {
  let data = {
    path,
  }
  let url = "/api/file/readDir"
  return request(url, data)
}

// **************************************** Export ****************************************

export async function exportMdContent(
  id: DocumentId,
): Promise<IResExportMdContent> {
  let data = {
    id,
  }
  let url = "/api/export/exportMdContent"
  return request(url, data)
}

export async function exportResources(
  paths: string[],
  name: string,
): Promise<IResExportResources> {
  let data = {
    paths,
    name,
  }
  let url = "/api/export/exportResources"
  return request(url, data)
}

// **************************************** Convert ****************************************

export type PandocArgs = string
export async function pandoc(args: PandocArgs[]) {
  let data = {
    args,
  }
  let url = "/api/convert/pandoc"
  return request(url, data)
}

// **************************************** Notification ****************************************

// /api/notification/pushMsg
// {
//     "msg": "test",
//     "timeout": 7000
//   }
export async function pushMsg(msg: string, timeout: number = 7000) {
  let payload = {
    msg,
    timeout,
  }
  let url = "/api/notification/pushMsg"
  return request(url, payload)
}

export async function pushErrMsg(msg: string, timeout: number = 7000) {
  let payload = {
    msg,
    timeout,
  }
  let url = "/api/notification/pushErrMsg"
  return request(url, payload)
}

// **************************************** Network ****************************************
export async function forwardProxy(
  url: string,
  method: string = "GET",
  payload: any = {},
  headers: any[] = [],
  timeout: number = 7000,
  contentType: string = "text/html",
): Promise<IResForwardProxy> {
  let data = {
    url,
    method,
    timeout,
    contentType,
    headers,
    payload,
  }
  let url1 = "/api/network/forwardProxy"
  return request(url1, data)
}

// **************************************** System ****************************************

export async function bootProgress(): Promise<IResBootProgress> {
  return request("/api/system/bootProgress", {})
}

export async function version(): Promise<string> {
  return request("/api/system/version", {})
}

export async function currentTime(): Promise<number> {
  return request("/api/system/currentTime", {})
}

/**
 * 重新加载 UI
 * v3.7.0+ 适配：/api/system/reloadUI → /api/ui/reloadUI
 */
export async function reloadUI(): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/ui/reloadUI`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("重新加载 UI 失败:", error)
    throw error
  }
}

/**
 * 重载文件树
 */
export async function reloadFiletree(): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/ui/reloadFiletree`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
  } catch (error) {
    console.error("重载文件树失败:", error)
    throw error
  }
}

/**
 * 重载标签树
 */
export async function reloadTag(): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/ui/reloadTag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
  } catch (error) {
    console.error("重载标签树失败:", error)
    throw error
  }
}

/**
 * 重载属性面板（需传入块 ID）
 * @param blockId 块 ID
 */
export async function reloadAttributeView(blockId: string): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/ui/reloadAttributeView`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: blockId }),
    })
  } catch (error) {
    console.error("重载属性面板失败:", error)
    throw error
  }
}

/**
 * 重载 Protyle 编辑器（需传入文档 ID 或块 ID）
 * @param blockId 文档 ID 或块 ID
 */
export async function reloadProtyle(blockId: string): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/ui/reloadProtyle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: blockId }),
    })
  } catch (error) {
    console.error("重载 Protyle 编辑器失败:", error)
    throw error
  }
}
