// gitPush 本地提交索引 — 内存态 + 追加写 + 增量读
//
// 数据模型（每个项目**独立一组文件**，按「提交序号 = 本项目 commits 文件行号」关联）：
//   <项目>.commits.ndjson   {h,a,d,m}                 一个提交一行
//   <项目>.files.ndjson     {c,p,a,d}                 一个「提交×文件」一行（c = 提交序号）
//   <项目>.filelines.ndjson {r,f,n}                   已跟踪文件存量行数（r = rootHash 判据）
//   meta.json               {version, projects:[...]} 每项目 rootHash / 截断游标 / 覆盖范围
//
// 为什么三份 NDJSON 必须按项目分文件（而非共用一个文件名）：
// meta.json 按项目数组存多条，且 INDEX_MAX_PROJECT_SEGMENTS 设计了「淘汰最旧项目」，
// 语义上明确支持多项目共存；若三份数据文件共用，第二个项目写入即覆盖第一个项目，
// 叠加全量分析的并发抓取（Promise.allSettled），各项目数据会互相串号 ——
// 表现为行数排行里几十个项目的「新增/删除/净增/总行数」大量相同。文件名见 projectIndexFile。
//
// 追加而非重建的原因：git log 是拓扑序，rebase 后重写的旧提交会带上较新的日期，
// 因此「按时间追加」始终安全；重写过的旧提交 hash 必然变化，增量扫描不会漏掉它。
import type { NumstatCommit } from "../reportMetrics"
// 刻意从 indexCache 直接导入而非 "../types" 桶：该桶经 storage.ts 拉入运行时的 siyuan 包，
// 会使本模块无法在纯 Node 环境（单测）中加载。indexCache.ts 为类型/常量单一数据源。
import type {
  IndexedCommit,
  IndexedFileDelta,
  IndexedFileLines,
  IndexMeta,
  ProjectIndexMeta,
} from "../types/indexCache"
import type { IndexFileIO } from "./indexIo"
import { INDEX_META_VERSION } from "../types/indexCache"
import {
  FsIndexIO,
  INDEX_FILE,
  projectIndexFile,

} from "./indexIo"

/** 单次索引查询的过滤条件 */
export interface IndexQuery {
  /** 起始时间（ms 时间戳；0/undefined = 全部历史）。按与 recencyBonus 同源的「相对天数」判定 */
  sinceMs?: number
  /** 最多返回条数（从最新提交往前取，与 git log -<n> 语义一致；<=0 = 不限制） */
  maxCount?: number
}

/** 单项目索引的内存态 */
interface ProjectSegment {
  commits: IndexedCommit[]
  /** 与 commits 下标对齐的文件变更（缺失表示该提交无文件变更行） */
  files: IndexedFileDelta[][]
  /** 短 hash → commits 下标 */
  hashIndex: Map<string, number>
}

/** 索引不可用（Node/fs 缺失、目录不可写）时抛出，由调用方降级到直接跑 git */
export class IndexUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IndexUnavailableError"
  }
}

/** 空 hash 查询表（未索引项目的共享常量，避免每次调用新建对象） */
const EMPTY_HASH_INDEX: ReadonlyMap<string, number> = new Map<string, number>()

/** 把 ISO 时间戳解析为毫秒（无法解析返回 0） */
function parseIsoMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** 折叠提交主题中的换行（保证「一个提交一行」的 NDJSON 前提） */
export function foldMessage(message: string): string {
  return message.replace(/\s*\n\s*/g, " ").trim()
}

/** 构造 rootHash（仓库身份 + HEAD，`: ` 前的 oid 与 gitdir 都无法混淆） */
export function buildRootHash(headOid: string, gitDir: string): string {
  return `${headOid}:${gitDir}`
}

/** 从 rootHash 中取出 HEAD oid（格式异常返回空串） */
export function rootHashOid(rootHash: string): string {
  const idx = rootHash.indexOf(":")
  return idx > 0 ? rootHash.slice(0, idx) : ""
}

/** 从 rootHash 中取出 gitdir（格式异常返回空串） */
export function rootHashGitDir(rootHash: string): string {
  const idx = rootHash.indexOf(":")
  return idx > 0 ? rootHash.slice(idx + 1) : ""
}

export class CommitIndex {
  private io: IndexFileIO
  private meta: IndexMeta
  private segments = new Map<string, ProjectSegment>()
  /** 已从磁盘加载过段数据的项目 id（区分「未加载」与「已加载但为空」） */
  private loaded = new Set<string>()
  /** 索引整体可用性（目录不可写等致命错误后置 false，本次会话不再重试） */
  private available = true

  /**
   * @param io 索引磁盘 IO（生产传 FsIndexIO，测试可注入内存实现）
   * @param meta 已由 storage 载入的索引元数据（构造函数不再读盘，避免构造期异步）
   */
  constructor(io: IndexFileIO, meta: IndexMeta) {
    this.io = io
    this.meta = meta.version === INDEX_META_VERSION
      ? meta
      : {
          version: INDEX_META_VERSION,
          projects: [],
        }
  }

  /** 索引是否可用（不可用时调用方应走「直接跑 git」的旧路径） */
  isAvailable(): boolean {
    return this.available
  }

  /** 索引目录绝对路径（不可用时为空串；供设置面板展示与打开目录） */
  getDir(): string {
    return this.io instanceof FsIndexIO ? this.io.getDir() : ""
  }

  /** 全部已索引项目元数据（只读视图） */
  getProjectMetas(): ProjectIndexMeta[] {
    return this.meta.projects
  }

  /** 取单项目元数据（未索引返回 undefined） */
  getProjectMeta(projectId: string): ProjectIndexMeta | undefined {
    return this.meta.projects.find((p) => p.projectId === projectId)
  }

  /** 是否已索引且 HEAD 判据一致（命中即可完全跳过 git 扫描） */
  isHit(projectId: string, rootHash: string): boolean {
    return this.getProjectMeta(projectId)?.rootHash === rootHash
  }

  /**
   * 确保项目段已从磁盘载入内存（幂等）。
   *
   * 崩溃自愈：两个 NDJSON 分开追加，进程被 kill 时可能出现「提交行完整、其文件行只写了一半」，
   * 也可能出现「提交行写坏、其文件行完好」（残骸引用不存在的提交序号）。此处统一按
   * 「丢弃损坏行 + 丢弃孤儿文件行」自愈——代价仅是下次增量扫描会重新抓取这些尾部提交
   * （hash 不在已知集合中），远优于整份索引作废重建。
   */
  async ensureLoaded(projectId: string): Promise<void> {
    if (!this.available) throw new IndexUnavailableError("索引不可用")
    if (this.loaded.has(projectId)) return
    // 按项目分文件读取：项目之间物理隔离，并发加载互不覆盖
    const [commitLines, fileLines] = await Promise.all([
      this.io.readLines(projectIndexFile("commits", projectId)),
      this.io.readLines(projectIndexFile("files", projectId)),
    ])
    const segment: ProjectSegment = {
      commits: [],
      files: [],
      hashIndex: new Map(),
    }
    // commits.ndjson（本项目专属文件）只含本项目行，段内不做项目过滤
    const commitRows = parseRows<IndexedCommit>(commitLines)
    for (const row of commitRows) {
      segment.hashIndex.set(row.h, segment.commits.length)
      segment.commits.push(row)
    }
    // 孤儿文件行（序号 >= 提交数）来自被截断的提交行：丢尾而非报错，索引保持可用
    const fileRows = parseRows<IndexedFileDelta>(fileLines)
    let maxOrphan = -1
    for (const row of fileRows) {
      if (!Number.isInteger(row.c) || row.c < 0) continue
      if (row.c >= segment.commits.length) {
        if (row.c > maxOrphan) maxOrphan = row.c
        continue
      }
      const bucket = segment.files[row.c] ?? (segment.files[row.c] = [])
      bucket.push(row)
    }
    // 存在孤儿即说明尾部有过截断：把磁盘上已不再被引用的尾部裁掉，
    // 使「提交序号 = 行号」的不变量在后续追加时继续成立
    await this.trimOrphanTail(projectId, segment, maxOrphan)
    this.segments.set(projectId, segment)
    this.loaded.add(projectId)
  }

  /**
   * 裁掉磁盘上引用不到的尾部（提交行不完整时留下的文件行），并同步修正 meta 游标。
   * 仅在检测到孤儿行时触发一次整体重写（正常路径零开销）。
   */
  private async trimOrphanTail(projectId: string, segment: ProjectSegment, maxOrphan: number): Promise<void> {
    if (maxOrphan < 0) return
    // 只重写本项目文件（不再触碰其他项目的段，修复原先「任一项目截断即整体重写」的跨项目破坏）
    const commitRows: string[] = segment.commits.map((c) => JSON.stringify(c))
    await this.io.writeText(projectIndexFile("commits", projectId), commitRows.length > 0 ? `${commitRows.join("\n")}\n` : "")
    const fileRows: string[] = []
    for (let i = 0; i < segment.commits.length; i++) {
      for (const f of segment.files[i] ?? []) fileRows.push(JSON.stringify(f))
    }
    await this.io.writeText(projectIndexFile("files", projectId), fileRows.length > 0 ? `${fileRows.join("\n")}\n` : "")
    // 截断后末条提交已变，meta 的 lastCommit 判据随之失效（置空 → 下次走完整扫描校验）
    const meta = this.getProjectMeta(projectId)
    if (meta) {
      this.setProjectMeta({
        ...meta,
        lastCommit: "",
        analyzedAt: new Date().toISOString(),
      })
      await this.persistMeta()
    }
  }

  /** 已索引的提交条数（未加载时返回元数据中的值不准确，故调用前应先 ensureLoaded） */
  getCommitCount(projectId: string): number {
    return this.segments.get(projectId)?.commits.length ?? 0
  }

  /**
   * 已知 hash 查询表（增量扫描用于判断「提交是否已索引」；未加载时返回空 Map = 等价于全量）。
   * 直接返回内部 Map 而非复制成 Set：调用方只用 has()，而每次扫描复制一份 Set 在
   * 数万提交规模下是纯浪费。
   */
  getKnownHashes(projectId: string): ReadonlyMap<string, number> {
    return this.segments.get(projectId)?.hashIndex ?? EMPTY_HASH_INDEX
  }

  /** 索引中最新一条提交（未索引返回 null；供「末条提交判据」短路） */
  getLastCommit(projectId: string): IndexedCommit | null {
    const segment = this.segments.get(projectId)
    return segment && segment.commits.length > 0 ? segment.commits[segment.commits.length - 1] : null
  }

  /**
   * 按条件查询提交日志（映射为 NumstatCommit，与 parseNumstatBlocks 输出形状一致）。
   * - sinceMs：过滤下界（提交时间 < 下界即排除），用「相对天数」口径避免月长差异；
   * - maxCount：从最新提交往前取，与 git log -<n> 语义严格对齐；
   * - 文件变更已应用扩展名/黑名单过滤由调用方决定，此处只回原始 numstat。
   */
  getLog(projectId: string, query?: IndexQuery): NumstatCommit[] {
    const segment = this.segments.get(projectId)
    if (!segment) return []
    const slice = this.selectRange(segment, query)
    return slice.map(({
      commit,
      files,
    }) => ({
      hash: commit.h,
      message: commit.m,
      author: commit.a,
      date: commit.d,
      files: files.map((f) => ({
        path: f.p,
        added: f.a,
        deleted: f.d,
      })),
    }))
  }

  /** 已索引提交的早期时间下界（最早一条提交的毫秒时间戳；无提交返回 0；供「全部历史」范围标签） */
  getFirstCommitDate(projectId: string): string {
    const segment = this.segments.get(projectId)
    return segment && segment.commits.length > 0 ? segment.commits[0].d : ""
  }

  /** 从 rootHash 取已缓存的已跟踪文件存量行数（rootHash 不一致返回 null 表示需重抓） */
  getFileLines(projectId: string, rootHash: string): Map<string, number | null> | null {
    return this.fileLinesByProject.get(projectId)?.rootHash === rootHash
      ? this.fileLinesByProject.get(projectId)!.lines
      : null
  }

  /** 文件存量行数内存缓存（避免每次查询都读盘；map 值含其 rootHash 判据） */
  private fileLinesByProject = new Map<string, { rootHash: string, lines: Map<string, number | null> }>()

  /**
   * 追加一批已扫描到的提交（按时间升序传入）、其文件变更与新的项目元数据。
   * 追加写两个 NDJSON（顺序写保证提交序号与行号一致），最后整体重写 meta.json（体积恒定）。
   */
  async append(
    projectId: string,
    commits: NumstatCommit[],
    patch: Omit<ProjectIndexMeta, "projectId"> & { projectId?: string },
  ): Promise<void> {
    if (!this.available) throw new IndexUnavailableError("索引不可用")
    await this.ensureLoaded(projectId)
    const segment = this.segments.get(projectId)!
    // 追加提交行（文件行与提交行分开收集：先写提交再写文件，保证序号引用的提交已存在）
    const commitLines: string[] = []
    const fileLines: string[] = []
    for (const c of commits) {
      const index = segment.commits.length
      const hash = c.hash ?? ""
      // 空 hash 不入索引（无法参与增量去重，且多个空 hash 会互相覆盖）
      if (hash) segment.hashIndex.set(hash, index)
      segment.commits.push({
        h: hash,
        a: c.author,
        d: c.date,
        m: foldMessage(c.message ?? ""),
      })
      segment.files[index] = []
      for (const f of c.files) {
        const row: IndexedFileDelta = {
          c: index,
          p: f.path,
          a: f.added,
          d: f.deleted,
        }
        segment.files[index].push(row)
        fileLines.push(JSON.stringify(row))
      }
      commitLines.push(JSON.stringify(segment.commits[index]))
    }
    // 提交行必须先落盘：否则崩溃时文件行会引用尚不存在的提交序号（本项目专属文件，不与其他项目竞争）
    if (commitLines.length > 0) await this.io.appendLines(projectIndexFile("commits", projectId), commitLines)
    if (fileLines.length > 0) await this.io.appendLines(projectIndexFile("files", projectId), fileLines)
    this.loaded.add(projectId)
    this.setProjectMeta({
      ...patch,
      projectId,
    } as ProjectIndexMeta)
    await this.persistMeta()
  }

  /** 替换项目的文件存量行数缓存并落盘（本项目专属文件，整体重写；不影响其他项目） */
  async setFileLines(projectId: string, rootHash: string, lines: Map<string, number | null>): Promise<void> {
    if (!this.available) throw new IndexUnavailableError("索引不可用")
    this.fileLinesByProject.set(projectId, {
      rootHash,
      lines,
    })
    const rows: string[] = []
    for (const [f, n] of lines) {
      rows.push(JSON.stringify({
        r: rootHash,
        f,
        n,
      } satisfies IndexedFileLines))
    }
    await this.io.writeText(projectIndexFile("fileLines", projectId), rows.length > 0 ? `${rows.join("\n")}\n` : "")
  }

  /** 从磁盘载入文件存量行数（rootHash 一致才复用；不一致/损坏返回 null） */
  async loadFileLines(projectId: string, rootHash: string): Promise<Map<string, number | null> | null> {
    if (!this.available) return null
    const cached = this.fileLinesByProject.get(projectId)
    if (cached && cached.rootHash === rootHash) return cached.lines
    // 本项目专属文件：文件内只可能含本项目（或多代 rootHash）的行，无需跨项目过滤
    const rows = parseRows<IndexedFileLines>(await this.io.readLines(projectIndexFile("fileLines", projectId)))
    if (rows.length === 0) return null
    // rootHash 不一致（HEAD 变了）视为未缓存，交由调用方重抓
    if (!rows.some((r) => r.r === rootHash)) return null
    const lines = new Map<string, number | null>()
    for (const r of rows) {
      if (r.r === rootHash) lines.set(r.f, r.n)
    }
    this.fileLinesByProject.set(projectId, {
      rootHash,
      lines,
    })
    return lines
  }

  /**
   * 丢弃项目段（内存 + 磁盘）：用于重建、项目删除与索引淘汰。
   * 只删本项目文件 —— 其他项目的段必须完好（修复原先「任一项目失效即整体清空」的跨项目破坏）。
   */
  async invalidate(projectId: string): Promise<void> {
    this.segments.delete(projectId)
    this.loaded.delete(projectId)
    this.fileLinesByProject.delete(projectId)
    this.meta = {
      ...this.meta,
      projects: this.meta.projects.filter((p) => p.projectId !== projectId),
    }
    await this.io.remove(projectIndexFile("commits", projectId))
    await this.io.remove(projectIndexFile("files", projectId))
    await this.io.remove(projectIndexFile("fileLines", projectId))
    await this.persistMeta()
  }

  /**
   * 清空整个索引（设置面板「重建索引」/ 排障用）：
   * 按内存中已知的项目 id 逐个删除其文件，确保不残留其他项目的段。
   */
  async clearAll(): Promise<void> {
    // 先收集待删项目 id：内存段 + meta 记录（段可能尚未加载，meta 是唯一线索）
    const ids = new Set<string>([
      ...this.segments.keys(),
      ...this.loaded,
      ...this.fileLinesByProject.keys(),
      ...this.meta.projects.map((p) => p.projectId),
    ])
    this.segments.clear()
    this.loaded.clear()
    this.fileLinesByProject.clear()
    this.meta = {
      version: INDEX_META_VERSION,
      projects: [],
    }
    for (const id of ids) {
      await this.io.remove(projectIndexFile("commits", id))
      await this.io.remove(projectIndexFile("files", id))
      await this.io.remove(projectIndexFile("fileLines", id))
    }
    await this.persistMeta()
  }

  /** 标记索引不可用（目录不可写等致命错误后调用，本次会话降级到旧路径） */
  markUnavailable(): void {
    this.available = false
  }

  /** 写入/更新单项目元数据（保持数组顺序稳定，便于调试比对） */
  private setProjectMeta(meta: ProjectIndexMeta): void {
    const list = this.meta.projects.filter((p) => p.projectId !== meta.projectId)
    list.push(meta)
    this.meta = {
      ...this.meta,
      projects: list,
    }
  }

  /** 落盘元数据（体积恒定，故用覆盖写 + 临时文件改名） */
  private async persistMeta(): Promise<void> {
    await this.io.writeText(INDEX_FILE.meta, JSON.stringify(this.meta))
  }

  /** 按查询条件从段中切片（sinceMs 过滤 + maxCount 尾部截取） */
  private selectRange(segment: ProjectSegment, query?: IndexQuery): Array<{ commit: IndexedCommit, files: IndexedFileDelta[] }> {
    const all: Array<{ commit: IndexedCommit, files: IndexedFileDelta[] }> = []
    const since = query?.sinceMs ?? 0
    for (let i = 0; i < segment.commits.length; i++) {
      const commit = segment.commits[i]
      if (since > 0) {
        const ms = parseIsoMs(commit.d)
        if (ms > 0 && ms < since) continue
      }
      all.push({
        commit,
        files: segment.files[i] ?? [],
      })
    }
    const max = query?.maxCount ?? 0
    if (max > 0 && all.length > max) return all.slice(all.length - max)
    return all
  }
}

/** 逐行解析 JSON，跳过损坏行（崩溃写入的半行 / 外部篡改），不因单行失败丢弃整份索引 */
function parseRows<T>(lines: string[]): T[] {
  const rows: T[] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as T
      if (parsed && typeof parsed === "object") rows.push(parsed)
    } catch {
      // 丢尾行：崩溃时最后一行可能只写了一半
    }
  }
  return rows
}
