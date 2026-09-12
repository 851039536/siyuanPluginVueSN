/**
 * 备份目录与数据目录扫描实现
 *
 * 从 BackupManager 拆出的纯扫描逻辑：本地备份归档扫描（scanBackupDir）
 * 与数据目录递归扫描（scanDirectory），以 fs/path 依赖注入方式供 BackupManager 委托调用。
 */
import { getErrorMessage } from "@/utils/stringUtils"
import { isArchiveFile } from "../utils"
import { BackupError } from "../types"
import type { LocalBackupInfo, IncrementalFileEntry } from "../types"

/**
 * 扫描时始终跳过的目录（思源临时目录/回收站/内核健康检查目录）
 * filesys_status_check：思源内核周期性写入又删除 check_consistency 探测文件，
 * 扫描时存在、压缩时已消失会导致惰性读流 ENOENT 使整次备份失败，且无备份价值
 */
export const SKIP_DIRS = ["temp", ".recycle", "filesys_status_check"] as const

/** 插件生成的日期子文件夹命名规则（useDateFolder 开启时的 data-YYYYMMDD 目录） */
export const DATE_DIR_RE = /^data-\d{8}$/

/** 扫描依赖：Node fs.promises 与 path 模块（由 BackupManager 注入） */
export interface ScannerDeps {
  fs: any
  path: any
}

/**
 * 扫描本地备份目录，收集归档文件
 * - 顶层归档 + 插件日期子文件夹（data-YYYYMMDD）内一层归档（useDateFolder 场景）
 * - 子目录条目 name 为 "子目录/文件名" 相对形式
 * - 按修改时间倒序（新的在前），供列表展示与保留数清理使用
 */
export async function scanBackupDir(deps: ScannerDeps, backupDir: string): Promise<LocalBackupInfo[]> {
  const { fs, path } = deps
  const collected: { name: string; path: string; mtimeMs: number; size: number }[] = []

  /** 收集单个归档文件的元信息（无法读取的文件静默跳过） */
  const collect = async (name: string, filePath: string): Promise<void> => {
    try {
      const stats = await fs.stat(filePath)
      collected.push({ name, path: filePath, mtimeMs: stats.mtime.getTime(), size: stats.size })
    } catch {
      // 跳过无法读取的文件
    }
  }

  let entries
  try {
    entries = await fs.readdir(backupDir, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (entry.isFile() && isArchiveFile(entry.name)) {
      await collect(entry.name, path.join(backupDir, entry.name))
    } else if (entry.isDirectory() && DATE_DIR_RE.test(entry.name)) {
      // 仅递归插件自建的日期子文件夹一层，避免把用户嵌套目录卷入列表与清理
      const subDir = path.join(backupDir, entry.name)
      let subFiles: string[] = []
      try {
        subFiles = await fs.readdir(subDir)
      } catch {
        continue
      }
      for (const f of subFiles) {
        if (isArchiveFile(f)) {
          await collect(`${entry.name}/${f}`, path.join(subDir, f))
        }
      }
    }
  }

  // 按 mtime 倒序（原文件名排序在混合命名下不保证时间顺序）
  collected.sort((a, b) => b.mtimeMs - a.mtimeMs)

  return collected.map((f) => ({
    name: f.name,
    path: f.path,
    time: new Date(f.mtimeMs).toLocaleString(),
    size: f.size,
    timestamp: f.mtimeMs,
  }))
}

/**
 * 统一递归扫描目录
 * - 跳过 skipDirs 中指定的目录
 * - 收集所有文件的完整路径和相对路径（含 mtime/size）
 */
export async function scanDirectory(
  deps: ScannerDeps,
  dirPath: string,
  zipPath: string,
  skipDirs: Set<string>,
  result: IncrementalFileEntry[],
): Promise<void> {
  const { fs, path } = deps
  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch (err: unknown) {
    // 目录不可读会导致整个子树被静默遗漏：
    // 全量备份会产出不完整 ZIP，增量备份则会把“本地不存在”的远端文件误判为已删除。
    // 因此这里不再吞错，由调用方决定中止还是降级。
    throw new BackupError("scanDirFailed", `${dirPath} → ${getErrorMessage(err)}`)
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = zipPath ? `${zipPath}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) { continue }
      await scanDirectory(deps, fullPath, relativePath, skipDirs, result)
    } else if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath)
        result.push({
          fullPath,
          relativePath,
          mtime: stats.mtime.getTime(),
          size: stats.size,
        })
      } catch (err: unknown) {
        // 单个文件 stat 失败仍继续（与 performFullBackup 的可跳过语义一致），
        // 但至少把问题暴露给上层调用方。
        throw new BackupError("scanFileFailed", `${fullPath} → ${getErrorMessage(err)}`)
      }
    }
  }
}
