// gitPush 报告指标引擎 — 文件读取层：行数统计 + 仓库文件存在性索引（fs 侧效应，Node 环境）
// GitProject 属于纯类型（storage.ts），但从 "../types" 桶导入会把管理器等运行时模块一起拉进
// 模块图（进而 require 运行时 siyuan 包），使本纯函数模块无法在 Node 单测环境加载，故直连 types/storage。
import type { GitProject } from "../types/storage"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { resolveValidPath } from "../utils/project"

/**
 * 超过 2MB 的文件视为不可读（压缩包/锁文件/二进制，避免整读大文件）。
 * 口径差异（有意为之，勿强行统一）：managers/lineScan.ts 的 FILE_LINES_MAX_BYTES 值相同，
 * 但那里 stat 用 lstat 且符号链接一律记 null；本处 statSync 跟随符号链接并读内容。
 * 行数排行与报告弹窗对同一符号链接文件可给出不同数值——两处各自的注释已说明取舍。
 */
export const LOC_READ_MAX_BYTES = 2 * 1024 * 1024

/** 读取仓库内文件的代码行数（按行切分计数；超大/二进制/读失败返回 null） */
export function countFileLines(project: GitProject, filePath: string): number | null {
  try {
    const modules = getNodeFsPathOs()
    const { fs, path } = modules || {}
    if (!fs || !path) return null
    return readLineCountAt(fs, path.join(resolveValidPath(project), filePath))
  } catch {
    return null
  }
}

/** 从绝对路径读取行数（供 countFileLines 与 GhostFileIndex 复用；异常由调用方兜底） */
function readLineCountAt(fs: typeof import("node:fs"), abs: string): number | null {
  try {
    const stat = fs.statSync(abs)
    if (!stat.isFile() || stat.size > LOC_READ_MAX_BYTES) return null
    const content = fs.readFileSync(abs, "utf8") as string
    const lines = content.split("\n")
    return lines.length - (lines[lines.length - 1] === "" ? 1 : 0)
  } catch {
    return null
  }
}

/**
 * 批量统计已跟踪文件的总行数并按文件分别记录（Map<路径, 行数|null>，供项目详情弹窗按文件路径查存量）。
 * 复用 countFileLines 口径：2MB/二进制/读失败/工作区已删除 → null。
 * 不做扩展名过滤（过滤属调用方口径——详情弹窗文件明细随当前扩展名配置在渲染时过滤，避免分析后改过滤导致行数缺项）。
 */
export function countTrackedFileLinesMap(project: GitProject, files: string[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const f of files) map.set(f, countFileLines(project, f))
  return map
}

/**
 * 工作区内文件存在性索引（按目录一次性 readdir，取代逐文件 statSync）。
 *
 * 为什么需要：buildReportData 需过滤 git 历史中已删除的"幽灵文件"，
 * 原先对每个排名文件各做一次 statSync（大仓库「全部」范围下可达数千次系统调用），
 * 且每次调用还重复 getNodeFsPathOs + resolveValidPath（后者本身含 existsSync）。
 * 按目录 readdir 后，同一目录的 N 个文件只花 1 次系统调用。
 *
 * 命中判定：目录已读取且条目为文件（含符号链接指向文件）。目录读取失败的路径按"不存在"处理，
 * 与原先 statSync 抛错返回 false 的语义一致。
 */
class RepoFileIndex {
  private repoRoot: string
  private fsMod: typeof import("node:fs") | null
  private pathMod: typeof import("node:path") | null
  /** 目录（绝对路径）→ 该目录下的文件名集合；null 表示该目录读取失败 */
  private dirs = new Map<string, Set<string> | null>()

  constructor(repoRoot: string, fsMod: typeof import("node:fs") | null, pathMod: typeof import("node:path") | null) {
    this.repoRoot = repoRoot
    this.fsMod = fsMod
    this.pathMod = pathMod
  }

  /** 判断仓库内相对路径当前是否为工作区中的文件 */
  has(filePath: string): boolean {
    if (!this.fsMod || !this.pathMod) return false
    const parts = filePath.split("/")
    const name = parts.pop()
    if (!name) return false
    const dir = this.pathMod.join(this.repoRoot, ...parts)
    let entries = this.dirs.get(dir)
    if (entries === undefined) entries = this.readDir(dir)
    return entries !== null && entries.has(name)
  }

  /** 读取目录条目（失败/不存在记为 null，表示该目录下无可用文件） */
  private readDir(dir: string): Set<string> | null {
    let result: Set<string> | null = null
    try {
      const entries = this.fsMod!.readdirSync(dir, { withFileTypes: true })
      result = new Set<string>()
      for (const entry of entries) {
        // 目录条目自身排除；符号链接保守视为可能存在（readdir 不解析链接目标）
        if (entry.isDirectory()) continue
        result.add(entry.name)
      }
    } catch {
      result = null
    }
    this.dirs.set(dir, result)
    return result
  }
}

/** 创建仓库文件存在性索引（Node 不可用时返回 null，调用方退化为"全部保留"） */
export function createRepoFileIndex(project: GitProject): RepoFileIndex | null {
  const modules = getNodeFsPathOs()
  const { fs, path } = modules || {}
  if (!fs || !path) return null
  return new RepoFileIndex(resolveValidPath(project), fs, path)
}

/** 判断是否为代码文件（排除 .md 文档：Markdown 不属于代码，不计入债务/热点/分析文件统计） */
export function isCodeFile(filePath: string): boolean {
  return !filePath.toLowerCase().endsWith(".md")
}
