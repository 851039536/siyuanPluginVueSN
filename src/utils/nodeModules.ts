/**
 * Node.js 模块加载工具
 *
 * 在 Electron（思源笔记）环境中延迟加载 Node.js 模块，
 * 统一处理 try/catch 容错，避免在纯浏览器环境中报错。
 */

/** Node.js fs 模块类型 */
type NodeFS = typeof import("node:fs")
/** Node.js path 模块类型 */
type NodePath = typeof import("node:path")
/** Node.js os 模块类型 */
type NodeOS = typeof import("node:os")
/** Node.js child_process 模块类型 */
type NodeChildProcess = typeof import("node:child_process")
/** Node.js util 模块类型 */
type NodeUtil = typeof import("node:util")

/** Electron shell 最小接口（仅声明本项目用到的方法） */
interface ElectronShell {
  openPath: (path: string) => Promise<string>
  openExternal: (url: string) => Promise<void>
  trashItem?: (path: string) => Promise<void>
  moveItemToTrash?: (path: string) => boolean
}

/** 获取 Node.js 文件系统模块 */
export function getNodeModules(): { fs: NodeFS, path: NodePath } | null {
  try {
    const fs = require("node:fs") as NodeFS
    const path = require("node:path") as NodePath
    return {
      fs,
      path,
    }
  } catch {
    return null
  }
}

/** 获取 Node.js 子进程、操作系统和 util 模块 */
export function getNodeProcessModules(): { child_process: NodeChildProcess, os: NodeOS, util: NodeUtil } | null {
  try {
    const child_process = require("node:child_process") as NodeChildProcess
    const os = require("node:os") as NodeOS
    const util = require("node:util") as NodeUtil
    return {
      child_process,
      os,
      util,
    }
  } catch {
    return null
  }
}

/** 获取 Node.js fs、path 和 os 模块 */
export function getNodeFsPathOs(): { fs: NodeFS, path: NodePath, os: NodeOS } | null {
  try {
    const fs = require("node:fs") as NodeFS
    const os = require("node:os") as NodeOS
    const path = require("node:path") as NodePath
    return {
      fs,
      path,
      os,
    }
  } catch {
    return null
  }
}

/** 获取 Electron 模块（shell） */
export function getElectronModules(): { shell: ElectronShell } | null {
  try {
    const { shell } = (window as any).require("electron") as { shell: ElectronShell }
    return { shell }
  } catch {
    return null
  }
}
