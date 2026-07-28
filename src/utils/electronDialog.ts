// Electron 原生对话框与文件操作工具（目录选择 + 文件夹打开）
import { getElectronModules, getNodeModules } from "@/utils/nodeModules"

/** 使用 Electron 原生对话框选择目录 */
export async function pickDirectory(title: string): Promise<string | null> {
  // 优先使用 Electron 原生目录选择对话框（路径可靠）
  if (typeof window.require === "function") {
    try {
      let remote: any
      // 兼容新旧 Electron：先尝试 @electron/remote（Electron 14+），再回退 electron.remote
      try {
        remote = window.require("@electron/remote")
      } catch {
        remote = window.require("electron").remote
      }
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
