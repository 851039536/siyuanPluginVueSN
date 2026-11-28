/**
 * 提权助手 - .lnk 文件读取与删除
 *
 * 只处理已记录/明确传入的 .lnk 路径；删除优先走回收站，避免永久删除用户文件。
 * 检测结果区分「未检测 / 存在 / 已丢失 / 文件无效 / 无法检测」，避免把无权限读取误报为已丢失。
 */
import type { ShortcutStatus } from "../types"
import {
  getElectronModules,
  getElectronRemoteShell,
  getNodeModules,
} from "@/utils/nodeModules"
import {
  hasLnkExtension,
  hasRunAsAdminFlag,
  isShortcutHeader,
} from "../utils/shortcut"
import { isAbsoluteWindowsPath } from "../utils/validation"

const SHORTCUT_INSPECT_BYTES = 0x16

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingError(message: string): boolean {
  return /ENOENT|not exist|cannot find/i.test(message)
}

function unknownStatus(error: string): ShortcutStatus {
  return {
    state: "unknown",
    valid: false,
    runAsAdmin: false,
    error,
  }
}

/** 读取 .lnk 的存在性、头部有效性与 RunAsUser 标记 */
export async function inspectShortcut(shortcutPath: string): Promise<ShortcutStatus> {
  const node = getNodeModules()
  if (!node) return unknownStatus("Node.js fs modules are unavailable")

  let stat: Awaited<ReturnType<typeof node.fs.promises.stat>>
  try {
    stat = await node.fs.promises.stat(shortcutPath)
  } catch (error) {
    const message = errorMessage(error)
    if (isMissingError(message)) {
      return {
        state: "missing",
        valid: false,
        runAsAdmin: false,
      }
    }
    // EACCES / EPERM 等不是「文件不存在」，单独标记为无法检测
    return {
      state: "error",
      valid: false,
      runAsAdmin: false,
      error: message,
    }
  }

  if (!stat.isFile()) {
    return {
      state: "invalid",
      valid: false,
      runAsAdmin: false,
      error: "Target is not a file",
    }
  }

  try {
    const handle = await node.fs.promises.open(shortcutPath, "r")
    try {
      const buffer = Buffer.alloc(SHORTCUT_INSPECT_BYTES)
      const result = await handle.read(buffer, 0, SHORTCUT_INSPECT_BYTES, 0)
      const bytes = buffer.subarray(0, result.bytesRead)
      if (!isShortcutHeader(bytes)) {
        return {
          state: "invalid",
          valid: false,
          runAsAdmin: false,
        }
      }
      return {
        state: "exists",
        valid: true,
        runAsAdmin: hasRunAsAdminFlag(bytes),
      }
    } finally {
      await handle.close().catch(() => undefined)
    }
  } catch (error) {
    return {
      state: "error",
      valid: false,
      runAsAdmin: false,
      error: errorMessage(error),
    }
  }
}

/**
 * 删除快捷方式。按「remote 回收站 → 渲染进程回收站 → 严格校验后 unlink」回退，
 * 任一环节成功即返回；全部失败时把各环节错误合并返回，便于定位。
 */
export async function deleteShortcutFile(shortcutPath: string): Promise<{ ok: boolean, error?: string }> {
  if (!isAbsoluteWindowsPath(shortcutPath) || !hasLnkExtension(shortcutPath)) {
    return {
      ok: false,
      error: "Refusing to delete a non-.lnk path",
    }
  }

  const errors: string[] = []
  const remoteShell = getElectronRemoteShell()
  if (remoteShell?.trashItem) {
    try {
      await remoteShell.trashItem(shortcutPath)
      return { ok: true }
    } catch (error) {
      errors.push(errorMessage(error))
    }
  }

  const electronShell = getElectronModules()?.shell
  if (electronShell?.trashItem) {
    try {
      await electronShell.trashItem(shortcutPath)
      return { ok: true }
    } catch (error) {
      errors.push(errorMessage(error))
    }
  }

  const node = getNodeModules()
  if (!node) {
    errors.push("Node.js fs modules are unavailable")
    return {
      ok: false,
      error: errors.join("; "),
    }
  }
  try {
    await node.fs.promises.unlink(shortcutPath)
    return { ok: true }
  } catch (error) {
    const message = errorMessage(error)
    if (isMissingError(message)) return { ok: true }
    errors.push(message)
    return {
      ok: false,
      error: errors.join("; "),
    }
  }
}
