/**
 * Node.js 模块加载工具
 *
 * 在 Electron（思源笔记）环境中延迟加载 Node.js 模块，
 * 统一处理 try/catch 容错，避免在纯浏览器环境中报错。
 */

/** 获取 Node.js 文件系统模块 */
export function getNodeModules(): { fs: any, path: any } | null {
  try {
    const fs = require("node:fs")
    const path = require("node:path")
    return {
      fs,
      path,
    }
  } catch {
    return null
  }
}

/** 获取 Node.js 子进程、操作系统和 util 模块 */
export function getNodeProcessModules(): { child_process: any, os: any, util: any } | null {
  try {
    const child_process = require("node:child_process")
    const os = require("node:os")
    const util = require("node:util")
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
export function getNodeFsPathOs(): { fs: any, path: any, os: any } | null {
  try {
    const fs = require("node:fs")
    const os = require("node:os")
    const path = require("node:path")
    return {
      fs,
      path,
      os,
    }
  } catch {
    return null
  }
}
