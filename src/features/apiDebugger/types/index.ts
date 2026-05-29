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
    label: "lsNotebooks",
    path: "/api/notebook/lsNotebooks",
    defaultBody: "{}",
  },
  {
    category: "Notebook",
    label: "openNotebook",
    path: "/api/notebook/openNotebook",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "closeNotebook",
    path: "/api/notebook/closeNotebook",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "renameNotebook",
    path: "/api/notebook/renameNotebook",
    defaultBody: '{"notebook": "", "name": ""}',
  },
  {
    category: "Notebook",
    label: "createNotebook",
    path: "/api/notebook/createNotebook",
    defaultBody: '{"name": ""}',
  },
  {
    category: "Notebook",
    label: "removeNotebook",
    path: "/api/notebook/removeNotebook",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "getNotebookConf",
    path: "/api/notebook/getNotebookConf",
    defaultBody: '{"notebook": ""}',
  },
  {
    category: "Notebook",
    label: "setNotebookConf",
    path: "/api/notebook/setNotebookConf",
    defaultBody: '{"notebook": "", "conf": {}}',
  },
  // File Tree
  {
    category: "FileTree",
    label: "createDocWithMd",
    path: "/api/filetree/createDocWithMd",
    defaultBody: '{"notebook": "", "path": "", "markdown": ""}',
  },
  {
    category: "FileTree",
    label: "renameDoc",
    path: "/api/filetree/renameDoc",
    defaultBody: '{"id": "", "title": ""}',
  },
  {
    category: "FileTree",
    label: "removeDoc",
    path: "/api/filetree/removeDoc",
    defaultBody: '{"id": ""}',
  },
  {
    category: "FileTree",
    label: "moveDocs",
    path: "/api/filetree/moveDocs",
    defaultBody: '{"fromIDs": [], "toID": ""}',
  },
  {
    category: "FileTree",
    label: "getHPathByPath",
    path: "/api/filetree/getHPathByPath",
    defaultBody: '{"notebook": "", "path": ""}',
  },
  {
    category: "FileTree",
    label: "getHPathByID",
    path: "/api/filetree/getHPathByID",
    defaultBody: '{"id": ""}',
  },
  {
    category: "FileTree",
    label: "listDocsByPath",
    path: "/api/filetree/listDocsByPath",
    defaultBody: '{"notebook": "", "path": "/", "sort": 256, "maxListCount": 0}',
  },
  {
    category: "FileTree",
    label: "getPathByID",
    path: "/api/filetree/getPathByID",
    defaultBody: '{"id": ""}',
  },
  // Block
  {
    category: "Block",
    label: "insertBlock",
    path: "/api/block/insertBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "prependBlock",
    path: "/api/block/prependBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "appendBlock",
    path: "/api/block/appendBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "updateBlock",
    path: "/api/block/updateBlock",
    defaultBody: '{"dataType": "markdown", "data": "", "id": ""}',
  },
  {
    category: "Block",
    label: "deleteBlock",
    path: "/api/block/deleteBlock",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Block",
    label: "moveBlock",
    path: "/api/block/moveBlock",
    defaultBody: '{"id": "", "previousID": "", "parentID": ""}',
  },
  {
    category: "Block",
    label: "getBlockKramdown",
    path: "/api/block/getBlockKramdown",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Block",
    label: "getChildBlocks",
    path: "/api/block/getChildBlocks",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Block",
    label: "transferBlockRef",
    path: "/api/block/transferBlockRef",
    defaultBody: '{"fromID": "", "toID": "", "refIDs": []}',
  },
  // Attributes
  {
    category: "Attributes",
    label: "setBlockAttrs",
    path: "/api/attr/setBlockAttrs",
    defaultBody: '{"id": "", "attrs": {}}',
  },
  {
    category: "Attributes",
    label: "getBlockAttrs",
    path: "/api/attr/getBlockAttrs",
    defaultBody: '{"id": ""}',
  },
  // Query
  {
    category: "Query",
    label: "sql",
    path: "/api/query/sql",
    defaultBody: '{"stmt": "SELECT * FROM blocks LIMIT 10"}',
  },
  // Template
  {
    category: "Template",
    label: "render",
    path: "/api/template/render",
    defaultBody: '{"id": "", "path": ""}',
  },
  {
    category: "Template",
    label: "renderSprig",
    path: "/api/template/renderSprig",
    defaultBody: '{"template": ""}',
  },
  // File
  {
    category: "File",
    label: "readDir",
    path: "/api/file/readDir",
    defaultBody: '{"path": ""}',
  },
  {
    category: "File",
    label: "removeFile",
    path: "/api/file/removeFile",
    defaultBody: '{"path": ""}',
  },
  {
    category: "File",
    label: "renameFile",
    path: "/api/file/renameFile",
    defaultBody: '{"path": "", "newPath": ""}',
  },
  // Asset
  {
    category: "Asset",
    label: "getDocAssets",
    path: "/api/asset/getDocAssets",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Asset",
    label: "getDocImageAssets",
    path: "/api/asset/getDocImageAssets",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Asset",
    label: "getMissingAssets",
    path: "/api/asset/getMissingAssets",
    defaultBody: "{}",
  },
  {
    category: "Asset",
    label: "getUnusedAssets",
    path: "/api/asset/getUnusedAssets",
    defaultBody: "{}",
  },
  {
    category: "Asset",
    label: "resolveAssetPath",
    path: "/api/asset/resolveAssetPath",
    defaultBody: '{"path": ""}',
  },
  // Export
  {
    category: "Export",
    label: "exportMdContent",
    path: "/api/export/exportMdContent",
    defaultBody: '{"id": ""}',
  },
  {
    category: "Export",
    label: "exportResources",
    path: "/api/export/exportResources",
    defaultBody: '{"paths": [], "name": ""}',
  },
  // Convert
  {
    category: "Convert",
    label: "pandoc",
    path: "/api/convert/pandoc",
    defaultBody: '{"args": []}',
  },
  // Notification
  {
    category: "Notification",
    label: "pushMsg",
    path: "/api/notification/pushMsg",
    defaultBody: '{"msg": "test", "timeout": 7000}',
  },
  {
    category: "Notification",
    label: "pushErrMsg",
    path: "/api/notification/pushErrMsg",
    defaultBody: '{"msg": "error test", "timeout": 7000}',
  },
  // Network
  {
    category: "Network",
    label: "forwardProxy",
    path: "/api/network/forwardProxy",
    defaultBody: '{"url": "", "method": "GET", "timeout": 7000, "contentType": "text/html", "headers": [], "payload": ""}',
  },
  // System
  {
    category: "System",
    label: "version",
    path: "/api/system/version",
    defaultBody: "{}",
  },
  {
    category: "System",
    label: "bootProgress",
    path: "/api/system/bootProgress",
    defaultBody: "{}",
  },
  {
    category: "System",
    label: "currentTime",
    path: "/api/system/currentTime",
    defaultBody: "{}",
  },
  // UI
  {
    category: "UI",
    label: "reloadUI",
    path: "/api/ui/reloadUI",
    defaultBody: "{}",
  },
  {
    category: "UI",
    label: "reloadFiletree",
    path: "/api/ui/reloadFiletree",
    defaultBody: "{}",
  },
  {
    category: "UI",
    label: "reloadTag",
    path: "/api/ui/reloadTag",
    defaultBody: "{}",
  },
]
