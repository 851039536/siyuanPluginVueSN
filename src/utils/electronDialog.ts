// Electron 原生对话框与文件操作工具（目录选择 + 文件多选 + 文件夹打开）
import { getElectronModules, getNodeModules } from "@/utils/nodeModules"

/** 获取 Electron remote 模块（兼容新旧 Electron：先 @electron/remote 再回退 electron.remote） */
function getRemote(): any {
  if (typeof window.require !== "function") { return null }
  try {
    try {
      return window.require("@electron/remote")
    } catch {
      return window.require("electron").remote
    }
  } catch {
    return null
  }
}

/** 使用 Electron 原生对话框选择目录 */
export async function pickDirectory(title: string): Promise<string | null> {
  // 优先使用 Electron 原生目录选择对话框（路径可靠）
  if (typeof window.require === "function") {
    try {
      const remote = getRemote()
      if (remote?.dialog?.showOpenDialog) {
        const result = await remote.dialog.showOpenDialog({
          properties: ["openDirectory"],
          title,
        })
        if (!result.canceled && result.filePaths[0]) {
          return result.filePaths[0]
        }
      }
    } catch {
      // 降级到 webkitdirectory 方案
    }
  }
  // 降级方案：浏览器环境使用 input[webkitdirectory]
  return new Promise((resolve) => {
    try {
      const input = document.createElement("input")
      input.type = "file"
      input.setAttribute("webkitdirectory", "")
      input.setAttribute("directory", "")

      let settled = false
      const done = (val: string | null) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timeoutId)
        resolve(val)
      }
      // 兜底超时：防止部分环境不触发 cancel 事件导致 Promise 悬挂
      const timeoutId = setTimeout(() => done(null), 60000)

      input.onchange = (e: Event) => {
        const files = (e.target as HTMLInputElement).files
        if (files && files.length > 0) {
          // File.path 为 Electron 私有扩展（Electron 32+ 已移除），仅旧内核可用
          const first = files[0] as File & { path?: string }
          const relativePath = first.webkitRelativePath
          const dirName = relativePath.split("/")[0]
          if (first.path) {
            // 用相对路径长度从末尾反推目录根路径（分隔符 \ 与 / 等长，无需归一化）
            const fullPath = first.path
            const dirPath = fullPath.slice(0, fullPath.length - relativePath.length + dirName.length)
            done(dirPath)
            return
          }
        }
        done(null)
      }
      input.addEventListener("cancel", () => done(null))
      input.click()
    } catch {
      resolve(null)
    }
  })
}

/**
 * 使用 Electron 原生对话框多选文件，返回绝对路径列表（取消或不可用返回 null）
 * 降级方案依赖 File.path（Electron 私有扩展，Electron 32+ 已移除），无路径时视为失败
 */
export async function pickFiles(title: string): Promise<string[] | null> {
  // 优先 Electron 原生文件选择对话框
  try {
    const remote = getRemote()
    if (remote?.dialog?.showOpenDialog) {
      const result = await remote.dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        title,
      })
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths
      }
      return null
    }
  } catch {
    // 降级到 input[multiple] 方案
  }
  // 降级方案：浏览器 input 多选（仅旧 Electron 内核的 File.path 可用）
  return new Promise((resolve) => {
    try {
      const input = document.createElement("input")
      input.type = "file"
      input.multiple = true

      let settled = false
      const done = (val: string[] | null) => {
        if (settled) { return }
        settled = true
        clearTimeout(timeoutId)
        resolve(val)
      }
      // 兜底超时：防止部分环境不触发 cancel 事件导致 Promise 悬挂
      const timeoutId = setTimeout(() => done(null), 60000)

      input.onchange = (e: Event) => {
        const files = (e.target as HTMLInputElement).files
        if (files && files.length > 0) {
          const paths = Array.from(files)
            .map((f) => (f as File & { path?: string }).path)
            .filter((p): p is string => !!p)
          done(paths.length > 0 ? paths : null)
          return
        }
        done(null)
      }
      input.addEventListener("cancel", () => done(null))
      input.click()
    } catch {
      resolve(null)
    }
  })
}

/** 获取 Electron webUtils 模块（Electron 32+ 用 getPathForFile 取拖入文件磁盘路径） */
function getWebUtils(): any {
  if (typeof window.require !== "function") { return null }
  try {
    return window.require("electron").webUtils
  } catch {
    return null
  }
}

/**
 * 从拖入的 File 列表解析绝对磁盘路径（取消/不可用返回空数组）
 * 先取 File.path（旧内核私有扩展），为空则用 webUtils.getPathForFile（Electron 32+）
 */
export function getPathsFromFiles(files: File[]): string[] {
  const webUtils = getWebUtils()
  const paths: string[] = []
  for (const f of files) {
    const legacyPath = (f as File & { path?: string }).path
    if (legacyPath) {
      paths.push(legacyPath)
      continue
    }
    try {
      const resolved = webUtils?.getPathForFile?.(f)
      if (resolved) { paths.push(resolved) }
    } catch {
      // 单个文件路径解析失败则跳过
    }
  }
  return paths
}

/** 在文件管理器中打开指定文件夹（Electron shell.openPath 或降级到 fs 验证） */
export async function openFolderInExplorer(folderPath: string): Promise<boolean> {
  // 先验证路径存在
  const node = getNodeModules()
  if (node) {
    try {
      await node.fs.promises.access(folderPath)
    } catch {
      return false
    }
  }
  // 尝试 Electron shell.openPath（成功返回空串，失败返回错误描述字符串）
  const shell = getElectronModules()?.shell
  if (shell?.openPath) {
    try {
      const result = await shell.openPath(folderPath)
      return !result
    } catch {
      // shell 调用异常
    }
  }
  return false
}
