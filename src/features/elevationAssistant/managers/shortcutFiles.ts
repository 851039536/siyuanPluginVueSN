/**
 * 提权助手 - .lnk 文件读取与删除
 *
 * 只处理已记录/明确传入的 .lnk 路径；删除优先走回收站，避免永久删除用户文件。
 */
import { getElectronModules, getElectronRemoteShell, getNodeModules } from "@/utils/nodeModules"
import { hasLnkExtension, hasRunAsAdminFlag, isShortcutHeader } from "../utils/shortcut"
import { isAbsoluteWindowsPath } from "../utils/validation"

const SHORTCUT_INSPECT_BYTES = 0x16

export interface ShortcutInspection {
  exists: boolean
  valid: boolean
  runAsAdmin: boolean
  error?: string
}

/** 读取 .lnk 的存在性、头部有效性与 RunAsUser 标记 */
export async function inspectShortcut(shortcutPath: string): Promise<ShortcutInspection> {
  const node = getNodeModules()
  if (!node) {
    return {
      exists: false,
      valid: false,
      runAsAdmin: false,
      error: "Node.js fs modules are unavailable",
    }
  }
  try {
    const stat = await node.fs.promises.stat(shortcutPath)
    if (!stat.isFile()) {
      return {
        exists: true,
        valid: false,
        runAsAdmin: false,
        error: "Target is not a file",
      }
    }
    const handle = await node.fs.promises.open(shortcutPath, "r")
    try {
      const buffer = Buffer.alloc(SHORTCUT_INSPECT_BYTES)
      const result = await handle.read(buffer, 0, SHORTCUT_INSPECT_BYTES, 0)
      const bytes = buffer.subarray(0, result.bytesRead)
      const valid = isShortcutHeader(bytes)
      return {
        exists: true,
        valid,
        runAsAdmin: valid && hasRunAsAdminFlag(bytes),
      }
    } finally {
      await handle.close().catch(() => undefined)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const missing = /ENOENT|not exist|cannot find/i.test(message)
    return {
      exists: false,
      valid: false,
      runAsAdmin: false,
      error: missing ? undefined : message,
    }
  }
}

/** 删除快捷方式。优先回收站；无回收站能力时在严格校验后 unlink */
export async function deleteShortcutFile(shortcutPath: string): Promise<{ ok: boolean, error?: string }> {
  if (!isAbsoluteWindowsPath(shortcutPath) || !hasLnkExtension(shortcutPath)) {
    return {
      ok: false,
      error: "Refusing to delete a non-.lnk path",
    }
  }

  const remoteShell = getElectronRemoteShell()
  if (remoteShell?.trashItem) {
    try {
      await remoteShell.trashItem(shortcutPath)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const electronShell = getElectronModules()?.shell
  if (electronShell?.trashItem) {
    try {
      await electronShell.trashItem(shortcutPath)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const node = getNodeModules()
  if (!node) {
    return {
      ok: false,
      error: "Node.js fs modules are unavailable",
    }
  }
  try {
    await node.fs.promises.unlink(shortcutPath)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/ENOENT|not exist|cannot find/i.test(message)) return { ok: true }
    return { ok: false, error: message }
  }
}
