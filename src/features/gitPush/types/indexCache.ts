// gitPush 本地提交索引：磁盘记录形状 + 与思源 loadData 解耦的小体积元数据槽位类型
//
// 设计要点（详见 README「提交索引」）：
// - 大体积提交数据走插件数据目录下的 NDJSON 追加日志（不经 loadData，避免撑大思源数据文件）；
// - meta.json 只存每项目的「仓库身份 + HEAD」判据与截断游标，体积恒定；
// - 所有记录均为单行 JSON（message 中的换行已在解析时折叠），因此天然支持追加与崩溃后丢尾行。

/** 磁盘索引中的一个提交记录（commits.ndjson 一行） */
export interface IndexedCommit {
  /** 短 hash（7 位，与 CommitAnalysisEntry.hash 同口径） */
  h: string
  /** 作者名 */
  a: string
  /** ISO 时间戳（git %aI 原样，含时区偏移） */
  d: string
  /** 提交主题（换行已折叠为空格，保证单行 JSON） */
  m: string
}

/** 磁盘索引中的一条文件变更（files.ndjson 一行；提交序号为提交在 commits.ndjson 中的行号） */
export interface IndexedFileDelta {
  /** 提交序号（commits.ndjson 行号，0 基） */
  c: number
  /** 文件路径（相对仓库根，已去 git 引号转义） */
  p: string
  /** 新增行数 */
  a: number
  /** 删除行数 */
  d: number
}

/** 磁盘索引中的一条已跟踪文件存量行数（filelines.ndjson 一行） */
export interface IndexedFileLines {
  /** 记录所属仓库根（HEAD oid + gitdir 绝对路径，与项目 meta.rootHash 比较判定是否可复用） */
  r: string
  /** 文件路径（相对仓库根） */
  f: string
  /** 文件行数（null = 2MB/二进制/读失败，与 countFileLines 口径一致） */
  n: number | null
}

/** 单项目索引元数据（meta.json 中一项） */
export interface ProjectIndexMeta {
  /** 项目 id */
  projectId: string
  /**
   * 仓库身份 + HEAD 判据，格式 `<HEAD oid>:<gitdir 绝对路径>`。
   * gitdir 参与判据使「换机器 / 换仓库指向同一路径」自然失效重建，避免误用他仓库数据。
   */
  rootHash: string
  /** 索引最后完成时间（ISO） */
  analyzedAt: string
  /** 最近一次扫描是否到达历史根（false = 受 indexMaxCommitsPerProject 截断或扫描未完成） */
  complete: boolean
  /**
   * 已索引提交的最新 ISO 时间，格式 "oid|author|date"（用于「切换回已索引分支」的短路判据）。
   */
  lastCommit: string
  /**
   * 已确认完整覆盖的时间范围起点（相对天数，如 365 表示「已确知一年前至今的全部提交」）。
   * 0 = 无覆盖保证（例如被截断）。用于判断所选时间范围是否需要重建索引。
   */
  sinceCoveredDays: number
}

/** 索引目录元数据（git-push-index-meta 槽位持久化） */
export interface IndexMeta {
  version: number
  projects: ProjectIndexMeta[]
}

/**
 * 索引元数据存储版本（结构变更时递增，加载时版本不符即丢弃重建）。
 *
 * v2：项目索引文件名转义前缀由 `_` 改为 `~`（原方案不满足单射性：id `a/b` 与字面 id
 * `a_2fb` 会生成同名文件互相覆盖）。文件名规则变更后旧文件无法按新规则定位，
 * 故递增版本号，由 ensureVersionReset 删除旧命名的 NDJSON 后按新规则重建
 * （代价仅是下次统计重新扫一遍，换取消除索引串号风险）。
 */
export const INDEX_META_VERSION = 2

/** 索引元数据默认值（无任何项目已索引） */
export const DEFAULT_INDEX_META: IndexMeta = {
  version: INDEX_META_VERSION,
  projects: [],
}

/** 单项目索引上限（提交条数）允许范围：过低会频繁重建，过高会让首次导入过慢 */
export const INDEX_MAX_COMMITS_MIN = 1000
export const INDEX_MAX_COMMITS_MAX = 100000

/** 单项目索引提交条数默认上限（约覆盖中小仓库全历史；超出即标记截断并提示重建） */
export const DEFAULT_INDEX_MAX_COMMITS = 20000

/** 索引保留的项目段上限（超出按 analyzedAt 淘汰最旧项目，防索引目录无界增长） */
export const INDEX_MAX_PROJECT_SEGMENTS = 40

/** 将单项目索引提交上限整数化并钳位到允许范围 */
export function clampIndexMaxCommits(n: number): number {
  const num = Math.round(Number(n) || DEFAULT_INDEX_MAX_COMMITS)
  return Math.max(INDEX_MAX_COMMITS_MIN, Math.min(INDEX_MAX_COMMITS_MAX, num))
}
