// 目录选择 composable（原生 Electron + webkitdirectory 降级）
export async function pickDirectory(title: string): Promise<string | null> {
  // 优先使用 Electron 原生目录选择对话框（路径可靠）
  if (typeof window.require === "function") {
    try {
      let remote: any
      // 兼容新旧 Electron：先尝试 @electron/remote（Electron 14+），再回退 electron.remote
      try {
        remote = window.require("@electron/remote")
      } catch {
        const electron = window.require("electron")
        remote = electron.remote || electron
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
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(val)
      }
      const timeoutId = setTimeout(() => done(null), 60000)

      input.onchange = (e: any) => {
        const files = e.target?.files
        if (files && files.length > 0) {
          const relativePath = files[0].webkitRelativePath
          const dirName = relativePath.split("/")[0]
          if (files[0].path) {
            const fullPath = files[0].path
            const dirPath = fullPath.substring(0, fullPath.lastIndexOf(dirName) + dirName.length)
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
