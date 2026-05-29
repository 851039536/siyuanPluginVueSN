export type HttpMethod = "POST" | "GET" | "PUT" | "DELETE"

export interface ApiEndpointPreset {
  category: string
  label: string
  path: string
  defaultBody: string
}

export interface CustomHeader {
  key: string
  value: string
}

export interface ApiRequestRecord {
  id: number
  timestamp: number
  method: HttpMethod
  url: string
  path: string
  requestBody: string
  headers: CustomHeader[]
  statusCode: number
  responseBody: string
  responseTime: number
  success: boolean
  errorMessage?: string
}

export interface ApiDebuggerSettings {
  history: ApiRequestRecord[]
  maxHistory: number
}

export const STORAGE_KEY = "api-debugger-settings"
export const DEFAULT_MAX_HISTORY = 50

export const API_ENDPOINT_PRESETS: ApiEndpointPreset[] = [
  // Notebook
  {
    category: "Notebook",
    label: "lsNotebooks — 列出所有笔记本",
    path: "/api/notebook/lsNotebooks",
    defaultBody: "{}",
  },
  {
    category: "Notebook",
    label: "openNotebook — 打开笔记本",
    path: "/api/notebook/openNotebook",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "closeNotebook — 关闭笔记本",
    path: "/api/notebook/closeNotebook",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "renameNotebook — 重命名笔记本",
    path: "/api/notebook/renameNotebook",
    defaultBody: '{"notebook": "", "name": ""}',
  },
  {
    category: "Notebook",
    label: "createNotebook — 创建笔记本",
    path: "/api/notebook/createNotebook",
    defaultBody: '{"name": ""}',
  },
  {
    category: "Notebook",
    label: "removeNotebook — 删除笔记本",
    path: "/api/notebook/removeNotebook",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "getNotebookConf — 获取笔记本配置",
    path: "/api/notebook/getNotebookConf",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "setNotebookConf — 设置笔记本配置",
    path: "/api/notebook/setNotebookConf",
    defaultBody: '{"notebook": "", "conf": {}}',
  },
  // File Tree
  {
    category: "FileTree",
    label: "createDocWithMd — 用Markdown创建文档",
    path: "/api/filetree/createDocWithMd",
    defaultBody: '{"notebook": "", "path": "", "markdown": ""}',
  },
  {
    category: "FileTree",
    label: "renameDoc — 重命名文档",
    path: "/api/filetree/renameDoc",
    defaultBody: '{"id": "", "title": ""}',
  },
  {
    category: "FileTree",
    label: "removeDoc — 删除文档",
    path: "/api/filetree/removeDoc",
    defaultBody: '{"id": ""}',
  },
  {
    category: "FileTree",
    label: "moveDocs — 移动文档",
    path: "/api/filetree/moveDocs",
    defaultBody: '{"fromIDs": [], "toID": ""}',
  },
  {
    category: "FileTree",
    label: "getHPathByPath — 路径反查可读路径",
    path: "/api/filetree/getHPathByPath",
    defaultBody: '{"notebook": "", "path": ""}',
  },
  {
    category: "FileTree",
    label: "getHPathByID — ID反查可读路径",
    path: "/api/filetree/getHPathByID",
    defaultBody: '{"id": ""}',
  },
  {
    category: "FileTree",
    label: "listDocsByPath — 列出指定路径下的文档",
    path: "/api/filetree/listDocsByPath",
    defaultBody: '{"notebook": "", "path": "/", "sort": 256, "maxListCount": 0}',
  },
  {
    category: "FileTree",
    label: "getPathByID — ID反查存储路径",
    path: "/api/filetree/getPathByID",
    defaultBody: '{"id": ""}',
  },
  // Block
  {
    category: "Block",
    label: "insertBlock — 在指定位置插入块",
    path: "/api/block/insertBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "prependBlock — 在父级前部添加块",
    path: "/api/block/prependBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "appendBlock — 在父级末尾添加块",
    path: "/api/block/appendBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "updateBlock — 更新块内容",
    path: "/api/block/updateBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "id": ""}',
  },
  {
    category: "Block",
    label: "deleteBlock — 删除块",
    path: "/api/block/deleteBlock",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Block",
    label: "moveBlock — 移动块位置",
    path: "/api/block/moveBlock",
    defaultBody: '{"id": "", "previousID": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "getBlockKramdown — 获取块Kramdown内容",
    path: "/api/block/getBlockKramdown",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Block",
    label: "getChildBlocks — 获取子块列表",
    path: "/api/block/getChildBlocks",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Block",
    label: "transferBlockRef — 转移块引用",
    path: "/api/block/transferBlockRef",
    defaultBody: '{"fromID": "", "toID": "", "refIDs": []}',
  },
  // Attributes
  {
    category: "Attributes",
    label: "setBlockAttrs — 设置块属性",
    path: "/api/attr/setBlockAttrs",
    defaultBody: '{"id": "", "attrs": {}}',
  },
  {
    category: "Attributes",
    label: "getBlockAttrs — 获取块属性",
    path: "/api/attr/getBlockAttrs",
    defaultBody: '{"id": ""}',
  },
  // Query
  {
    category: "Query",
    label: "sql — 执行SQL查询",
    path: "/api/query/sql",
    defaultBody: '{"stmt": "SELECT * FROM blocks LIMIT 10"}',
  },
  // Template
  {
    category: "Template",
    label: "render — 渲染模板",
    path: "/api/template/render",
    defaultBody: '{"id": "", "path": ""}',
  },
  {
    category: "Template",
    label: "renderSprig — 渲染Sprig模板",
    path: "/api/template/renderSprig",
    defaultBody: '{"template": ""}',
  },
  // File
  {
    category: "File",
    label: "readDir — 读取目录内容",
    path: "/api/file/readDir",
    defaultBody: '{"path": ""}',
  },
  {
    category: "File",
    label: "removeFile — 删除文件",
    path: "/api/file/removeFile",
    defaultBody: '{"path": ""}',
  },
  {
    category: "File",
    label: "renameFile — 重命名/移动文件",
    path: "/api/file/renameFile",
    defaultBody: '{"path": "", "newPath": ""}',
  },
  // Asset
  {
    category: "Asset",
    label: "getDocAssets — 获取文档引用的资源",
    path: "/api/asset/getDocAssets",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Asset",
    label: "getDocImageAssets — 获取文档引用的图片",
    path: "/api/asset/getDocImageAssets",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Asset",
    label: "getMissingAssets — 获取丢失的资源列表",
    path: "/api/asset/getMissingAssets",
    defaultBody: "{}",
  },
  {
    category: "Asset",
    label: "getUnusedAssets — 获取未使用的资源",
    path: "/api/asset/getUnusedAssets",
    defaultBody: "{}",
  },
  {
    category: "Asset",
    label: "resolveAssetPath — 解析资源绝对路径",
    path: "/api/asset/resolveAssetPath",
    defaultBody: '{"path": ""}',
  },
  // Export
  {
    category: "Export",
    label: "exportMdContent — 导出Markdown内容",
    path: "/api/export/exportMdContent",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Export",
    label: "exportResources — 导出资源文件",
    path: "/api/export/exportResources",
    defaultBody: '{"paths": [], "name": ""}',
  },
  // Convert
  {
    category: "Convert",
    label: "pandoc — Pandoc文档转换",
    path: "/api/convert/pandoc",
    defaultBody: '{"args": []}',
  },
  // Notification
  {
    category: "Notification",
    label: "pushMsg — 推送普通通知",
    path: "/api/notification/pushMsg",
    defaultBody: '{"msg": "test", "timeout": 7000}',
  },
  {
    category: "Notification",
    label: "pushErrMsg — 推送错误通知",
    path: "/api/notification/pushErrMsg",
    defaultBody: '{"msg": "error test", "timeout": 7000}',
  },
  // Network
  {
    category: "Network",
    label: "forwardProxy — 正向代理请求",
    path: "/api/network/forwardProxy",
    defaultBody: '{"url": "", "method": "GET", "timeout": 7000, "contentType": "text/html", "headers": [], "payload": ""}',
  },
  // System
  {
    category: "System",
    label: "version — 获取思源版本号",
    path: "/api/system/version",
    defaultBody: "{}",
  },
  {
    category: "System",
    label: "bootProgress — 获取启动进度",
    path: "/api/system/bootProgress",
    defaultBody: "{}",
  },
  {
    category: "System",
    label: "currentTime — 获取服务端当前时间",
    path: "/api/system/currentTime",
    defaultBody: "{}",
  },
  // UI
  {
    category: "UI",
    label: "reloadUI — 重新加载UI界面",
    path: "/api/ui/reloadUI",
    defaultBody: "{}",
  },
  {
    category: "UI",
    label: "reloadFiletree — 重载文件树",
    path: "/api/ui/reloadFiletree",
    defaultBody: "{}",
  },
  {
    category: "UI",
    label: "reloadTag — 重载标签树",
    path: "/api/ui/reloadTag",
    defaultBody: "{}",
  },
]
