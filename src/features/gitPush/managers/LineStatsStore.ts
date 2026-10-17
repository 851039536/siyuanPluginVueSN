// gitPush 行数统计持久层（SQLite）——存量行数 + 仓库生命周期时间的唯一数据源
//
// 为什么改 SQLite（原实现是 NDJSON 追加日志 + 每次分析全量重算）：
// 1. 原「当前总行数」每次分析都对每个已跟踪文件 readFileSync 全文（只为了数 '\n'），
//    几十个项目 × 数千文件时是几十万次全文件读取，这是行数排行「重新分析」慢的唯一根因；
// 2. 原判据是 rootHash（HEAD 一变就整体作废），于是一次提交就导致全部文件重读。
//
// 本层把逐文件行数连同 (mtime, size) 一起落库，于是重新分析只需逐文件 statSync
// （元数据查询，不读文件内容），仅对 mtime/size 变化的文件重读内容——正确性不变，I/O 量降两个数量级。
//
// 遵循 AGENTS.md §SQLite 存储规范：统一单库 plugin.db、表名带功能前缀（gp_）、
// 运行时只 CREATE TABLE IF NOT EXISTS 不做数据迁移、全部走 prepared statement 传参。
import type { Plugin } from "siyuan"
import type { PluginDatabase } from "@/utils/sqliteDb"
import {
  featureTables,
  openWithRetry,

} from "@/utils/sqliteDb"

/** 日志前缀（便于在多功能日志中区分） */
const LOG_TAG = "[gitPush][行数统计]"

/**
 * 表命名空间：行数统计 → gp。
 * gp_project_stats 每项目一行（汇总 + 生命周期时间）
 * gp_file_lines    逐文件存量行数（含 mtime/size 失效判据）
 */
const TABLE = featureTables("gp", ["project_stats", "file_lines"] as const)

/** 单项目行数统计汇总行 */
export interface ProjectStatsRecord {
  /** 项目 id */
  projectId: string
  /** 项目名（分析时快照，展示以 GitProject.name 为准，此处仅兜底） */
  name: string
  /** 当前总行数（存量口径，已按扩展名过滤） */
  totalLines: number
  /** 纳入统计的已跟踪文件数 */
  fileCount: number
  /** 仓库首次提交 ISO（%aI，历史根；空串 = 空仓库/未取到） */
  firstCommit: string
  /** 最后一次提交 ISO（%aI，numstat 首条；空串 = 无提交） */
  lastCommit: string
  /** HEAD oid（缓存失效判据之一） */
  headOid: string
  /**
   * 仓库身份标识（`.git` 目录的规范化绝对路径，零 git 调用即可获得）。
   *
   * 为什么需要：只用 `headOid` 无法区分「同一个 commit 出现在两个不同仓库里」——
   * 而 clone / 模板复制极常见。此时把项目路径改指向另一份克隆，
   * `headOid` 相同会命中缓存，返回**旧仓库的行数**（文件集合与行数都可能不同）。
   *
   * 为什么选 `.git` 路径而非 gitdir 原值：判定只需要「是不是同一个仓库」，
   * 而 `.git` 的规范化绝对路径可由 `fs` 直接得到（`path.resolve` + 处理
   * worktree 的 `commondir`），**不需要任何 git 子进程**——
   * 这正是原实现（`rev-parse --absolute-git-dir`，每项目多一次 ~300ms 调用）被去掉的原因。
   *
   * 空串 = 旧数据行（升级前写入，未记录身份）→ 视为不匹配，触发一次重算并补写。
   */
  repoId: string
  /**
   * 生命周期时间的「已尝试」标记（如 `"1"`）。
   *
   * 为什么需要：`firstCommit`/`lastCommit` 在空仓库或 git 异常时会取到空串。
   * 若只用「缓存值为空」判断是否需要重取，这些项目**每次分析都会再跑一次
   * rev-list / log**，几十个项目时又变成几十次进程启动。
   * 记下标记后，空值也算「已知结果」，不再重试。
   *
   * 该列历史上是 `git_dir`（仓库身份判据），因判据已收敛为 `headOid` 而闲置，
   * 故复用它存标记，无需 schema 迁移（旧行里是路径字符串 → 非 "1"，会被当作
   * 「未尝试」，只是让老数据多取一次，随后写回标记）。
   */
  timesProbed: string
  /** 本次统计完成时间（ISO） */
  analyzedAt: string
}

/**
 * 「生命周期时间已尝试获取」的标记值。
 *
 * 存放在 `gp_project_stats.git_dir` 列（该列在判据收敛为 headOid 后闲置，
 * 复用它可避免 schema 迁移）。语义：**该列的精确值等于本常量**才算「已尝试」。
 *
 * 为什么必须用精确比较而非真值判断：旧版本该列存的是 git 目录**路径字符串**
 * （同样 truthy），若按真值判断会把所有老数据误认成「已尝试」，
 * 使其中的空 firstCommit 永不被修复。
 */
export const TIMES_PROBED_MARK = "1"

/** 单文件存量行数记录 */
export interface FileLinesRecord {
  /** 文件路径（相对仓库根） */
  path: string
  /** 行数（null = 二进制/超 2MB/读失败，与 countFileLines 口径一致） */
  lines: number | null
  /** 文件修改时间（ms，statSync 结果；失效判据之一） */
  mtimeMs: number
  /** 文件字节数（失效判据之二） */
  size: number
}

/** gp_project_stats 行形状（列名 ↔ ProjectStatsRecord 一一对应） */
interface ProjectStatsRow {
  project_id: string
  name: string
  total_lines: number
  file_count: number
  first_commit: string
  last_commit: string
  head_oid: string
  /** 「时间已尝试」标记（历史上是 gitdir，现复用；详见 timesProbed） */
  git_dir: string
  /** 仓库身份（.git 规范化路径）；旧库经 ALTER 补列后为空串 */
  repo_id?: string
  analyzed_at: string
}

/** gp_file_lines 行形状 */
interface FileLinesRow {
  path: string
  lines: number | null
  mtime_ms: number
  size: number
}

/** ProjectStatsRow → ProjectStatsRecord */
function toProjectStats(row: ProjectStatsRow): ProjectStatsRecord {
  return {
    projectId: row.project_id,
    name: row.name,
    totalLines: Number(row.total_lines) || 0,
    fileCount: Number(row.file_count) || 0,
    firstCommit: row.first_commit ?? "",
    lastCommit: row.last_commit ?? "",
    headOid: row.head_oid ?? "",
    // 旧库（ALTER 前写入）无此列 → 空串 → 视为不匹配，触发一次重算并补写
    repoId: row.repo_id ?? "",
    // 复用闲置的 git_dir 列存「时间已尝试」标记（详见 ProjectStatsRecord.timesProbed）
    timesProbed: row.git_dir ?? "",
    analyzedAt: row.analyzed_at ?? "",
  }
}

/**
 * 行数统计 SQLite 存储。
 *
 * 单例由 GitPushManager 持有（与 CommitIndex 并列），构造走 {@link openLineStatsStore}。
 * 数据库不可用时返回 null，调用方据此降级到「每次全量重算」的原路径——功能不中断，只是变慢。
 */
export class LineStatsStore {
  private readonly db: PluginDatabase

  constructor(db: PluginDatabase) {
    this.db = db
  }

  /** 建表（幂等；运行时只建表/补列，不做数据迁移） */
  static prepare(db: PluginDatabase): void {
    db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE.project_stats} (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      total_lines INTEGER NOT NULL DEFAULT 0,
      file_count INTEGER NOT NULL DEFAULT 0,
      first_commit TEXT NOT NULL DEFAULT '',
      last_commit TEXT NOT NULL DEFAULT '',
      head_oid TEXT NOT NULL DEFAULT '',
      git_dir TEXT NOT NULL DEFAULT '',
      repo_id TEXT NOT NULL DEFAULT '',
      analyzed_at TEXT NOT NULL DEFAULT ''
    )`)
    // 旧库补列：早期版本的 gp_project_stats 没有 repo_id。
    // PRAGMA table_info 判定后 ALTER，幂等且不破坏既有数据；
    // 补列后旧行 repo_id 为空串 → 判据视为不匹配 → 各自重算一次并回填。
    const cols = db.all<{ name: string }>(`PRAGMA table_info(${TABLE.project_stats})`)
    if (!cols.some((c) => c.name === "repo_id")) {
      db.exec(`ALTER TABLE ${TABLE.project_stats} ADD COLUMN repo_id TEXT NOT NULL DEFAULT ''`)
    }
    // (project_id, path) 复合主键即天然索引；无需额外建 project_id 单列索引
    db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE.file_lines} (
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      lines INTEGER,
      mtime_ms INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, path)
    )`)
  }

  /** 读取单项目汇总行（不存在返回 null） */
  getProjectStats(projectId: string): ProjectStatsRecord | null {
    const row = this.db.get<ProjectStatsRow>(
      `SELECT * FROM ${TABLE.project_stats} WHERE project_id = ?`,
      projectId,
    )
    return row ? toProjectStats(row) : null
  }

  /** 读取单项目全部文件行数（返回 Map<path, record>） */
  getFileLines(projectId: string): Map<string, FileLinesRecord> {
    const rows = this.db.all<FileLinesRow>(
      `SELECT path, lines, mtime_ms, size FROM ${TABLE.file_lines} WHERE project_id = ?`,
      projectId,
    )
    const out = new Map<string, FileLinesRecord>()
    for (const r of rows) {
      out.set(r.path, {
        path: r.path,
        lines: r.lines === null ? null : Number(r.lines),
        mtimeMs: Number(r.mtime_ms) || 0,
        size: Number(r.size) || 0,
      })
    }
    return out
  }

  /**
   * 整体覆盖写单项目统计（汇总 + 文件明细在**同一事务**内完成）。
   *
   * 为什么整体覆盖而非逐条 upsert：仓库文件集合可能删除文件，
   * 逐条 upsert 会让已删除文件的旧记录永久残留（下次读出来参与合计，数字虚高）。
   * 文件数通常在数百~数千，单事务整体重写仍是毫秒级，远快于原来的逐文件 readFileSync。
   */
  saveProjectStats(record: ProjectStatsRecord, files: FileLinesRecord[]): void {
    this.db.withTransaction(() => {
      this.db.run(
        `INSERT INTO ${TABLE.project_stats}
          (project_id, name, total_lines, file_count, first_commit, last_commit, head_oid, git_dir, repo_id, analyzed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           name = excluded.name,
           total_lines = excluded.total_lines,
           file_count = excluded.file_count,
           first_commit = excluded.first_commit,
           last_commit = excluded.last_commit,
           head_oid = excluded.head_oid,
           git_dir = excluded.git_dir,
           repo_id = excluded.repo_id,
           analyzed_at = excluded.analyzed_at`,
        record.projectId,
        record.name,
        record.totalLines,
        record.fileCount,
        record.firstCommit,
        record.lastCommit,
        record.headOid,
        // git_dir 列存「时间已尝试」标记（列名保留以免 schema 迁移）
        record.timesProbed,
        record.repoId,
        record.analyzedAt,
      )
      // 先清后写：保证文件集合与磁盘现状严格一致（不残留已删除文件）
      this.db.run(`DELETE FROM ${TABLE.file_lines} WHERE project_id = ?`, record.projectId)
      for (const f of files) {
        this.db.run(
          `INSERT INTO ${TABLE.file_lines} (project_id, path, lines, mtime_ms, size) VALUES (?, ?, ?, ?, ?)`,
          record.projectId,
          f.path,
          f.lines,
          f.mtimeMs,
          f.size,
        )
      }
    })
  }

  /**
   * 仅更新汇总行的生命周期字段（首/末次提交）+「已尝试」标记。
   * 供「HEAD 未变、只需补首末提交时间」的快路径使用，避免读一遍文件明细。
   * 标记一并写入，使「取到空值」也算已知结果，不再每次重试。
   */
  updateCommitTimes(projectId: string, firstCommit: string, lastCommit: string, analyzedAt: string): void {
    this.db.run(
      `UPDATE ${TABLE.project_stats} SET first_commit = ?, last_commit = ?, analyzed_at = ?, git_dir = ?
        WHERE project_id = ?`,
      firstCommit,
      lastCommit,
      analyzedAt,
      TIMES_PROBED_MARK,
      projectId,
    )
  }

  /**
   * 淘汰不在保留集合中的项目（项目列表变化后调用）。
   * 与 IndexMeta 的「淘汰最旧项目」同一目的：防止删除项目后数据无限堆积。
   * 单项目删除也走本方法（传不含该 id 的集合），故不再单独提供 removeProject。
   */
  pruneProjects(keepIds: string[]): number {
    const existing = this.db.all<{ project_id: string }>(
      `SELECT project_id FROM ${TABLE.project_stats}`,
    )
    const keep = new Set(keepIds)
    const stale = existing.map((r) => r.project_id).filter((id) => !keep.has(id))
    if (stale.length === 0) return 0
    this.db.withTransaction(() => {
      for (const id of stale) {
        this.db.run(`DELETE FROM ${TABLE.project_stats} WHERE project_id = ?`, id)
        this.db.run(`DELETE FROM ${TABLE.file_lines} WHERE project_id = ?`, id)
      }
    })
    return stale.length
  }
}

/**
 * 打开行数统计存储（含启动早期路径未就绪的重试与建表）。
 *
 * @returns 可用实例；数据库不可用（旧版思源 / 非 Electron / 打开失败）返回 null，
 *          调用方据此降级为企业原路径（每次全量重算），不影响功能可用性。
 */
export async function openLineStatsStore(plugin: Plugin): Promise<LineStatsStore | null> {
  const db = await openWithRetry(plugin, (d) => LineStatsStore.prepare(d), { logTag: LOG_TAG })
  return db ? new LineStatsStore(db) : null
}

/** 供单测/排障使用的表名导出（避免测试里硬编码字符串漂移） */
export const LINE_STATS_TABLES = TABLE
