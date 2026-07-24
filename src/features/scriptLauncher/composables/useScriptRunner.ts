/**
 * 脚本启动器 - 脚本执行组合式函数
 */
import type { Script } from "../types"
import { getNodeProcessModules } from "@/utils/nodeModules"

/**
 * 用系统默认程序打开脚本文件（类似双击本地文件）
 */
export function useScriptLauncher() {
  const launchScript = (script: Script, filePath: string): boolean => {
    const node = getNodeProcessModules()
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
      // exec 默认通过系统 shell 执行，无需额外 shell 选项
      node.child_process.exec(command)
      return true
    } catch {
      return false
    }
  }

  return { launchScript }
}
