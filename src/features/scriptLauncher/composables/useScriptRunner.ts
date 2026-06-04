/**
 * 脚本启动器 - 脚本执行组合式函数
 */
import type { Script } from "../types"

function getNodeModules(): { child_process: any, os: any } | null {
  try {
    const child_process = require("node:child_process")
    const os = require("node:os")
    return { child_process, os }
  } catch {
    return null
  }
}

/**
 * 用系统默认程序打开脚本文件（类似双击本地文件）
 */
export function useScriptLauncher() {
  const launchScript = (script: Script, filePath: string): boolean => {
    const node = getNodeModules()
    if (!node) return false

    const platform = node.os.platform()
    let command: string

    if (platform === "win32") {
      command = `start "" "${filePath}"`
    } else if (platform === "darwin") {
      command = `open "${filePath}"`
    } else {
      command = `xdg-open "${filePath}"`
    }

    try {
      node.child_process.exec(command, { shell: true })
      return true
    } catch {
      return false
    }
  }

  return { launchScript }
}
