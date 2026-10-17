// gitPush 行数扫描（增量、按 mtime/size 复用已有行数）——行数排行刷新的性能核心
//
// 背景：原实现对每个已跟踪文件 readFileSync 全文只为数 '\n'，且判据是 rootHash
// （HEAD 一变全部作废）⇒ 一次提交就让整仓库重读。本模块改为：
//   逐文件 statSync 与已缓存记录比对 (mtimeMs, size)，
//   一致 → 直接复用缓存行数（不读文件内容）；不一致 → 才 readFileSync 计数。
//
// 正确性论证：(mtimeMs, size) 相同即视为文件未变。
// 这是 git 自身（index 的 stat 信息）与 rsync/make 等工具采用的同一判据；
// 唯一已知例外是「内容变了但 mtime 与大小都被刻意还原」，在正常的开发/构建流程中不会出现。
//
// 本模块刻意不 import 任何思源运行时模块，纯函数 + 注入 fs，便于在 Node 单测中直接验证。
import type { FileLinesRecord } from "./LineStatsStore"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 超过 2MB 的文件不读内容（压缩包/二进制/锁文件），与 reportMetrics.countFileLines 同口径 */
export const FILE_LINES_MAX_BYTES = 2 * 1024 * 1024

/** 单文件扫描结果（file 记录 + 是否复用了缓存的行数） */
export interface ScannedFile extends FileLinesRecord {
  /** true = 命中缓存（mtime/size 未变），未读文件内容 */
  reused: boolean
}

/** 单项目扫描结果 */
export interface ProjectScanResult {
  /** 全部已跟踪文件的行数记录（含 null，表示不可读/二进制） */
  files: ScannedFile[]
  /** 命中缓存复用的文件数 */
  reusedCount: number
  /** 实际读取内容的文件数 */
  readCount: number
}

/**
 * 扫描单项目已跟踪文件的存量行数（增量）。
 *
 * @param projectPath 仓库根绝对路径
 * @param trackedFiles 已跟踪文件相对路径清单（git ls-files 结果，应按扩展名过滤**之前**传入）
 * @param cached 上次落库的文件记录（Map<path, record>）；空 Map = 首次全量
 * @note 扩展名过滤**不在本函数内生效**：被过滤掉的文件同样扫描并缓存，
 *   否则用户切换过滤条件时未缓存的文件必须重读一遍，过滤开关就成了性能陷阱。
 *   过滤只影响 {@link sumScannedLines} 的合计，不影响缓存内容。
 * @returns 扫描结果（files 为**全部**已跟踪文件的记录）
 */
export function scanProjectFileLines(
  projectPath: string,
  trackedFiles: string[],
  cached: Map<string, FileLinesRecord>,
): ProjectScanResult {
  const modules = getNodeFsPathOs()
  const {
    fs,
    path,
  } = modules || {}
  const files: ScannedFile[] = []
  let reusedCount = 0
  let readCount = 0

  for (const file of trackedFiles) {
    const abs = fs && path ? path.join(projectPath, file) : ""
    const prev = cached.get(file)

    // 无 fs 能力（纯浏览器）：一律 null，且不伪装成复用
    if (!fs || !abs) {
      files.push({
        path: file,
        lines: null,
        mtimeMs: 0,
        size: 0,
        reused: false,
      })
      readCount++
      continue
    }

    let mtimeMs = 0
    let size = 0
    let isFile = false
    try {
      // 先用 lstat 判断链接身份，再 stat 取靶文件尺寸：
      // statSync 会**跟随**符号链接，若仓库里跟踪的路径是个指向 /dev/zero 或
      // 巨大文件的链接，会把靶文件内容当成源码行数读进来（可能是数百万行）。
      // 与 reportMetrics.countFileLines 的口径差异：那里用 statSync 跟随链接并读内容，
      // 这里对链接一律记 null（不读靶文件），避免大文件/特殊设备造成的统计噪音与卡顿。
      const lstat = fs.lstatSync(abs)
      if (lstat.isSymbolicLink()) {
        files.push({
          path: file,
          lines: null,
          mtimeMs: Math.round(lstat.mtimeMs),
          size: lstat.size,
          reused: false,
        })
        readCount++
        continue
      }
      const stat = fs.statSync(abs)
      isFile = stat.isFile()
      mtimeMs = Math.round(stat.mtimeMs)
      size = stat.size
    } catch {
      // 文件在 ls-files 之后被删除/移动：记 null 并清空判据，下次必然重扫
      files.push({
        path: file,
        lines: null,
        mtimeMs: 0,
        size: 0,
        reused: false,
      })
      readCount++
      continue
    }

    if (!isFile) {
      files.push({
        path: file,
        lines: null,
        mtimeMs,
        size,
        reused: false,
      })
      readCount++
      continue
    }

    // 命中缓存：mtime 与 size 都未变 ⇒ 行数不变，跳过读内容
    if (prev && prev.mtimeMs === mtimeMs && prev.size === size) {
      files.push({
        path: file,
        lines: prev.lines,
        mtimeMs,
        size,
        reused: true,
      })
      reusedCount++
      continue
    }

    // 未命中：读内容计数（超 2MB 直接 null，不读）
    let lines: number | null = null
    if (size <= FILE_LINES_MAX_BYTES) {
      try {
        const content = fs.readFileSync(abs, "utf8") as string
        const parts = content.split("\n")
        lines = parts.length - (parts[parts.length - 1] === "" ? 1 : 0)
      } catch {
        lines = null
      }
    }
    files.push({
      path: file,
      lines,
      mtimeMs,
      size,
      reused: false,
    })
    readCount++
  }

  return {
    files,
    reusedCount,
    readCount,
  }
}

/** 由扫描结果合计总行数（仅计入可读且通过扩展名过滤的文件；null 与已过滤文件不计） */
export function sumScannedLines(
  files: ScannedFile[],
  shouldInclude: (path: string) => boolean,
): number {
  let total = 0
  for (const f of files) {
    if (f.lines === null) continue
    if (!shouldInclude(f.path)) continue
    total += f.lines
  }
  return total
}
