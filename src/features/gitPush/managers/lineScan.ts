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
 * 走 `git status` 变更集判据的文件数阈值（方案 B 的盈亏平衡点）。
 *
 * ⚠️ **当前生产路径不使用变更集模式**（`GitPushManager` 一律走逐文件 statSync）：
 * 该模式在「HEAD 已变化」时不可靠——`git status` 只比较工作区与 index，
 * 看不见切分支 / git add / reset 造成的 index 自身变化，会漏报变更并沿用旧行数。
 * 详见 lineScan 的 `changedPaths` 参数说明。
 *
 * 此常量与变更集分支保留，供将来在「确认 index 未动」的场景复用（例如
 * 仅刷新某项目的详情弹窗时）。实测盈亏平衡：
 * - `git status --porcelain -uno` 固定成本 ≈ 220 ms（几乎全是进程启动）
 * - 逐文件 `statSync` 边际成本 ≈ 93 µs/文件
 * ⇒ 平衡点 ≈ 2400 文件，留余量取 2500。
 */
export const GIT_STATUS_CHANGE_THRESHOLD = 2500

/**
 * 计算仓库身份标识（零 git 调用，仅 fs 探测）。
 *
 * 为什么需要：缓存失效判据原先只有 `HEAD oid`。但 clone / 模板复制出的两个仓库
 * 初始 commit 完全相同，此时把项目路径改指向另一份克隆，`headOid` 一致会命中缓存，
 * 返回**旧仓库的行数**（文件集合与行数都可能不同）—— 一个静默的数据错误。
 *
 * 为什么不用 `git rev-parse --absolute-git-dir`：那需要每项目多一次 ~300ms 的
 * git 进程启动，正是本轮优化专门去掉的开销。而「是不是同一个仓库」只需比较
 * `.git` 的规范化绝对路径即可，纯 fs 即可获得。
 *
 * 处理三种布局：
 * - 普通仓库：`<root>/.git` 是目录
 * - worktree / submodule：`<root>/.git` 是**文件**，内容形如 `gitdir: <path>`，
 *   真实库在 `<主仓库>/.git/worktrees/<name>`。worktree 之间共享对象库但工作区不同，
 *   行数统计对象是工作区，故**必须按 worktree 路径区分**（用其 gitdir 路径本身）。
 * - 无 `.git`（非仓库/尚未 init）：回退到工作区根路径，仍能区分不同目录。
 *
 * @returns 规范化的身份字符串（比较用）；无法解析时返回空串（调用方据此保守失效）
 */
export function resolveRepoIdentity(projectPath: string): string {
  const modules = getNodeFsPathOs()
  const { fs, path } = modules || {}
  if (!fs || !path || !projectPath) return ""
  try {
    // 先规范化根路径（统一分隔符与大小写不敏感平台的差异交给 resolve/normalize）
    const root = path.resolve(projectPath)
    const gitEntry = path.join(root, ".git")
    let stat: import("node:fs").Stats
    try {
      stat = fs.lstatSync(gitEntry)
    } catch {
      // 没有 .git：非仓库或尚未 init，用根目录本身作身份
      return `dir:${path.normalize(root)}`
    }
    if (stat.isDirectory()) {
      return `git:${path.normalize(gitEntry)}`
    }
    // .git 是文件（worktree / submodule）：解析 `gitdir: <abs path>`
    try {
      const content = fs.readFileSync(gitEntry, "utf8") as string
      const m = /^gitdir:\s*(.+)$/m.exec(content)
      if (m?.[1]) {
        const target = m[1].trim()
        // gitdir 可能是相对路径（相对于工作区根解析）
        const abs = path.isAbsolute(target) ? target : path.resolve(root, target)
        return `git:${path.normalize(abs)}`
      }
    } catch {
      // 读取失败：退化为 .git 文件路径本身（仍能区分不同工作区）
    }
    return `git:${path.normalize(gitEntry)}`
  } catch {
    return ""
  }
}

/**
 * 扫描单项目已跟踪文件的存量行数（增量）。
 *
 * @param projectPath 仓库根绝对路径
 * @param trackedFiles 已跟踪文件相对路径清单（git ls-files 结果，应按扩展名过滤**之前**传入）
 * @param cached 上次落库的文件记录（Map<path, record>）；空 Map = 首次全量
 * @param changedPaths 可选的「已知变更文件」集合（来自 `git status --porcelain -z`）。
 *   传入时：集合内文件强制重读、集合外文件**直接复用缓存**（不再逐文件 statSync）。
 *   不传时（**生产默认**）：逐文件 statSync 比对 (mtime, size)。
 *
 *   ⚠️ 变更集模式的三条已知局限，使用前必须确认场景安全：
 *   1. **看不见 index 自身变化**：切分支（checkout/switch/restore）、`git add`、
 *      `git reset --hard` 都会让工作区与 index 同步更新，`git status` 报「干净」，
 *      但文件内容其实变了 → 漏报 → 沿用旧行数。这正是生产路径不用它的原因。
 *   2. **assume-unchanged / skip-worktree** 的文件被 git 刻意忽略，永不出现在集合中。
 *   3. **文件类型变化**（符号链接 ↔ 普通文件）只被报为内容变化，缓存里的
 *      `lines: null`（链接/二进制）需要一次真实 stat 才能刷新。
 *      故调用方可对 `prev.lines === null` 的条目自行兜底 stat。
 * @note 扩展名过滤**不在本函数内生效**：被过滤掉的文件同样扫描并缓存，
 *   否则用户切换过滤条件时未缓存的文件必须重读一遍，过滤开关就成了性能陷阱。
 *   过滤只影响 {@link sumScannedLines} 的合计，不影响缓存内容。
 * @returns 扫描结果（files 为**全部**已跟踪文件的记录）
 */
export function scanProjectFileLines(
  projectPath: string,
  trackedFiles: string[],
  cached: Map<string, FileLinesRecord>,
  changedPaths?: ReadonlySet<string>,
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

    // ── 分支 A（方案 B）：已知变更集，未变更且已缓存 → 直接复用，**不 statSync** ──
    // 这在超大仓库上把「N 次系统调用」降成「集合查找」，是本分支的全部收益。
    // 只有 git 报告为变更的文件才继续往下走（statSync + 必要时读内容）。
    if (changedPaths && prev && !changedPaths.has(file)) {
      files.push({
        path: file,
        lines: prev.lines,
        mtimeMs: prev.mtimeMs,
        size: prev.size,
        reused: true,
      })
      reusedCount++
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
