/**
 * gitPush 行数统计持久层（JSON 槽 `git-push-line-stats-store`）
 * 存量行数 + 仓库生命周期时间的唯一数据源。
 *
 * 为什么需要持久层：逐文件行数连同 (mtime, size) 一起落盘，重新分析时只需逐文件
 * statSync（元数据查询，不读文件内容），仅对 mtime/size 变化的文件重读内容，
 * I/O 量比每次全量 readFileSync 低两个数量级。
 *
 * 为什么不用 SQLite：`plugin.db` 位于思源同步目录，Windows 下 SQLite 连接持有文件句柄
 * 会让同步引擎的 rename 覆盖失败（表现为「读写文件或访问网络权限不足」）。本层改为
 * 单个 JSON 槽 + 内存态 + 串行合并写盘：写入由 `plugin.saveData` 完成，不持有文件句柄。
 *
 * 代价：整份 JSON 重写。行数分析是低频手动操作，且数据只在分析结束时写一次，可接受。
 */
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 日志前缀（便于在多功能日志中区分） */
const LOG_TAG = "[gitPush][行数统计]"

/** 存储键（与 src/config/storage/jsonSlots.ts 注册表一致） */
const STORAGE_KEY = "git-push-line-stats-store"

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
   * 空串 = 旧数据行（升级前写入，未记录身份）→ 视为不匹配，触发一次重算并补写。
   */
  repoId: string
  /** 本次统计完成时间（ISO） */
  analyzedAt: string
}

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

/** 落盘的单项目结构（files 用紧凑元组减小体积） */
interface StoredProject extends ProjectStatsRecord {
  /** [path, lines, mtimeMs, size] */
  files: Array<[string, number | null, number, number]>
}

/** 落盘结构 */
interface LineStatsStoreData {
  version: 1
  projects: Record<string, StoredProject>
}

/** 新建存储时的默认值 */
function emptyData(): LineStatsStoreData {
  return {
    version: 1,
    projects: {},
  }
}

/** 把不可信的持久化数据收敛为合法结构（逐项校验，坏项丢弃） */
function normalizeData(raw: LineStatsStoreData): LineStatsStoreData {
  const out = emptyData()
  const projects = raw?.projects
  if (!projects || typeof projects !== "object" || Array.isArray(projects)) return out

  for (const [projectId, value] of Object.entries(projects)) {
    if (!value || typeof value !== "object") continue
    const item = value as Partial<StoredProject>
    const files: StoredProject["files"] = []
    if (Array.isArray(item.files)) {
      for (const entry of item.files) {
        if (!Array.isArray(entry) || entry.length < 4) continue
        const [filePath, lines, mtimeMs, size] = entry
        if (typeof filePath !== "string") continue
        files.push([
          filePath,
          typeof lines === "number" ? lines : null,
          Number(mtimeMs) || 0,
          Number(size) || 0,
        ])
      }
    }
    out.projects[projectId] = {
      projectId,
      name: typeof item.name === "string" ? item.name : "",
      totalLines: Number(item.totalLines) || 0,
      fileCount: Number(item.fileCount) || 0,
      firstCommit: typeof item.firstCommit === "string" ? item.firstCommit : "",
      lastCommit: typeof item.lastCommit === "string" ? item.lastCommit : "",
      headOid: typeof item.headOid === "string" ? item.headOid : "",
      repoId: typeof item.repoId === "string" ? item.repoId : "",
      analyzedAt: typeof item.analyzedAt === "string" ? item.analyzedAt : "",
      files,
    }
  }
  return out
}

/**
 * 行数统计 JSON 存储。
 *
 * 单例由 GitPushManager 持有（与 CommitIndex 并列），构造走 {@link openLineStatsStore}。
 * 内存态为唯一读源；写操作合并后串行落盘，避免多个项目并发分析时互相覆盖。
 */
export class LineStatsStore {
  private readonly storage: TypedStorage<LineStatsStoreData>
  private data: LineStatsStoreData
  /** 合并写盘：多个并发修改只触发尽可能少次整份写入 */
  private savePending: Promise<boolean> | null = null
  private dirty = false

  constructor(storage: TypedStorage<LineStatsStoreData>, data: LineStatsStoreData) {
    this.storage = storage
    this.data = data
  }

  /** 读取单项目汇总行（不存在返回 null） */
  getProjectStats(projectId: string): ProjectStatsRecord | null {
    const item = this.data.projects[projectId]
    if (!item) return null
    return {
      projectId: item.projectId,
      name: item.name,
      totalLines: item.totalLines,
      fileCount: item.fileCount,
      firstCommit: item.firstCommit,
      lastCommit: item.lastCommit,
      headOid: item.headOid,
      repoId: item.repoId,
      analyzedAt: item.analyzedAt,
    }
  }

  /** 读取单项目全部文件行数（返回 Map<path, record>） */
  getFileLines(projectId: string): Map<string, FileLinesRecord> {
    const out = new Map<string, FileLinesRecord>()
    const item = this.data.projects[projectId]
    if (!item) return out
    for (const [path, lines, mtimeMs, size] of item.files) {
      out.set(path, {
        path,
        lines,
        mtimeMs,
        size,
      })
    }
    return out
  }

  /**
   * 整体覆盖写单项目统计（汇总 + 文件明细）。
   *
   * 为什么整体覆盖而非逐条 upsert：仓库文件集合可能删除文件，
   * 逐条 upsert 会让已删除文件的旧记录永久残留（下次读出来参与合计，数字虚高）。
   */
  async saveProjectStats(record: ProjectStatsRecord, files: FileLinesRecord[]): Promise<void> {
    // 不可变更新：写盘快照可能引用旧对象，替换而非原地修改
    this.data = {
      version: 1,
      projects: {
        ...this.data.projects,
        [record.projectId]: {
          ...record,
          files: files.map((f): [string, number | null, number, number] => [f.path, f.lines, f.mtimeMs, f.size]),
        },
      },
    }
    await this.scheduleSave()
  }

  /**
   * 仅更新汇总行的生命周期字段（首/末次提交时间）。
   * 供「HEAD 未变、只需补首末提交时间」的快路径使用，避免重建文件明细。
   */
  async updateCommitTimes(projectId: string, firstCommit: string, lastCommit: string, analyzedAt: string): Promise<void> {
    const item = this.data.projects[projectId]
    if (!item) return
    this.data = {
      version: 1,
      projects: {
        ...this.data.projects,
        [projectId]: {
          ...item,
          firstCommit,
          lastCommit,
          analyzedAt,
        },
      },
    }
    await this.scheduleSave()
  }

  /**
   * 淘汰不在保留集合中的项目（项目列表变化后调用）。
   * 与 IndexMeta 的「淘汰最旧项目」同一目的：防止删除项目后数据无限堆积。
   * 单项目删除也走本方法（传不含该 id 的集合），故不再单独提供 removeProject。
   */
  async pruneProjects(keepIds: string[]): Promise<number> {
    const keep = new Set(keepIds)
    const stale = Object.keys(this.data.projects).filter((id) => !keep.has(id))
    if (stale.length === 0) return 0

    const projects = { ...this.data.projects }
    for (const id of stale) delete projects[id]
    this.data = {
      version: 1,
      projects,
    }
    await this.scheduleSave()
    return stale.length
  }

  /** 合并调度：连续修改只写一次；写入失败保留内存态，下次修改重试 */
  private scheduleSave(): Promise<boolean> {
    this.dirty = true
    if (this.savePending) return this.savePending

    this.savePending = (async () => {
      let ok = true
      while (this.dirty) {
        this.dirty = false
        // data 为不可变结构：传给 saveData 的引用不会被后续修改
        const saved = await this.storage.save(this.data)
        if (!saved) {
          ok = false
          console.warn(`${LOG_TAG} 行数统计数据落盘失败（内存态仍可用，下次修改会重试）`)
        }
      }
      this.savePending = null
      return ok
    })()
    return this.savePending
  }
}

/**
 * 打开行数统计存储（读取 JSON 槽并收敛数据）。
 *
 * @returns 可用实例；读取/解析彻底失败返回 null，调用方据此降级为「每次全量重算」
 */
export async function openLineStatsStore(plugin: Plugin): Promise<LineStatsStore | null> {
  try {
    const storage = new TypedStorage<LineStatsStoreData>(
      new PluginStorage(plugin),
      STORAGE_KEY,
      emptyData(),
    )
    const loaded = await storage.loadOrDefault()
    return new LineStatsStore(storage, normalizeData(loaded))
  } catch (error) {
    console.warn(`${LOG_TAG} 行数统计存储初始化失败`, error)
    return null
  }
}
