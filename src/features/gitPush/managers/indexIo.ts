// gitPush 本地提交索引 — 磁盘 IO 层（NDJSON 追加日志 + 小体积 meta.json）
//
// 为什么不是 sqlite：思源桌面端为 Electron 33（内置 Node 20，无 node:sqlite），
// better-sqlite3 需原生编译且随思源升级易失效，sql.js 需把全库载入内存（大仓库比 git log 更慢）。
// 本层只依赖 fs，接口注入使纯逻辑可单测（见 __tests__/commitIndex.test.ts）。
import { getNodeModules } from "@/utils/nodeModules"

/**
 * 索引目录下的文件名（三份 NDJSON + 一份小体积元数据）：
 * 注意：三份 NDJSON 是**按项目分文件**的（文件名见 projectIndexFile），
 * 此处的常量是「后缀」而非完整文件名。历史教训：早期版本三份文件全项目共用一个文件名，
 * 而 meta.json 按项目数组存多条且设计了「淘汰最旧项目」（INDEX_MAX_PROJECT_SEGMENTS），
 * 两者语义直接冲突 —— 第二个项目一写入就覆盖掉第一个项目的段，
 * 且全量分析是并发抓取（Promise.allSettled），并发覆盖后各项目数据互相串号，
 * 表现为行数排行里几十个项目的增删净/总行数大量相同。故必须按项目隔离文件。
 */
export const INDEX_FILE = {
  commits: "commits.ndjson",
  files: "files.ndjson",
  fileLines: "filelines.ndjson",
  meta: "meta.json",
} as const

/** 文件名安全的字符集合（字母/数字/点/下划线/连字符；其余一律转义） */
const SAFE_SLUG_CHAR = /^[\w.-]$/

/**
 * 按项目 id 生成安全的文件名片段（项目 id 可能含 / \ : * ? " < > | 等非法/越目录字符）。
 * 非 SAFE_SLUG_CHAR 一律转义为 `_<hex>`，保证：① 不越出索引目录 ② 不同 id 不碰撞
 * （逐字符转义而非简单替换，避免 "a/b" 与 "a_b" 撞成同一文件名而互相覆盖）。
 */
function safeProjectSlug(projectId: string): string {
  let out = ""
  for (const ch of projectId) {
    out += SAFE_SLUG_CHAR.test(ch)
      ? ch
      : `_${ch.codePointAt(0)!.toString(16)}`
  }
  // 空 id 或全非法字符导致空串时兜底，避免生成 ".commits.ndjson" 这类隐藏文件
  return out.length > 0 ? out : "project"
}

/**
 * 单项目索引文件的完整文件名（`<项目 slug>.<后缀>`）。
 * 三份 NDJSON 都走此命名，保证项目之间物理隔离、并发写互不覆盖。
 */
export function projectIndexFile(kind: "commits" | "files" | "fileLines", projectId: string): string {
  return `${safeProjectSlug(projectId)}.${INDEX_FILE[kind]}`
}

/** 索引磁盘 IO 抽象（生产实现走 fs，测试可注入内存实现） */
export interface IndexFileIO {
  /** 追加一行（自动补 \n；目录/文件不存在时创建） */
  appendLine: (file: string, line: string) => Promise<void>
  /** 批量追加多行（一次调用减少 fs 往返；空数组为无操作） */
  appendLines: (file: string, lines: string[]) => Promise<void>
  /** 读取全部行（文件不存在返回空数组；不解析 JSON） */
  readLines: (file: string) => Promise<string[]>
  /** 写入整个文件（覆盖） */
  writeText: (file: string, text: string) => Promise<void>
  /** 读取整个文件（不存在返回 null） */
  readText: (file: string) => Promise<string | null>
  /** 删除文件（不存在时静默成功） */
  remove: (file: string) => Promise<void>
}

/** 默认索引目录名（位于插件数据目录内：{dataDir}/storage/petal/{pluginName}/git-push-index） */
export const INDEX_DIR_NAME = "git-push-index"

/**
 * 基于 Node fs 的索引 IO。
 * 全部方法在失败时抛出，由 CommitIndex 统一降级（索引不可用不影响任何功能）。
 */
export class FsIndexIO implements IndexFileIO {
  private dir: string
  private ready = false

  constructor(dir: string) {
    this.dir = dir
  }

  /** 索引目录绝对路径 */
  getDir(): string {
    return this.dir
  }

  private node() {
    const modules = getNodeModules()
    if (!modules) throw new Error("Node 环境不可用，本地提交索引无法启用")
    return modules
  }

  /** 确保目录存在（幂等，首次调用创建） */
  private ensureDir(): void {
    if (this.ready) return
    const { fs } = this.node()
    fs.mkdirSync(this.dir, { recursive: true })
    this.ready = true
  }

  private abs(file: string): string {
    const { path } = this.node()
    return path.join(this.dir, file)
  }

  async appendLine(file: string, line: string): Promise<void> {
    await this.appendLines(file, [line])
  }

  async appendLines(file: string, lines: string[]): Promise<void> {
    if (lines.length === 0) return
    const { fs } = this.node()
    this.ensureDir()
    await fs.promises.appendFile(this.abs(file), `${lines.join("\n")}\n`, "utf8")
  }

  async readLines(file: string): Promise<string[]> {
    const { fs } = this.node()
    const abs = this.abs(file)
    try {
      if (!fs.existsSync(abs)) return []
      const raw = await fs.promises.readFile(abs, "utf8")
      return splitLines(raw)
    } catch {
      return []
    }
  }

  async writeText(file: string, text: string): Promise<void> {
    const { fs } = this.node()
    this.ensureDir()
    // 先写临时文件再改名：崩溃不会留下半截 meta.json（读取侧仍做 JSON 容错）
    const abs = this.abs(file)
    const tmp = `${abs}.tmp`
    await fs.promises.writeFile(tmp, text, "utf8")
    await fs.promises.rename(tmp, abs)
  }

  async readText(file: string): Promise<string | null> {
    const { fs } = this.node()
    const abs = this.abs(file)
    try {
      if (!fs.existsSync(abs)) return null
      return await fs.promises.readFile(abs, "utf8")
    } catch {
      return null
    }
  }

  async remove(file: string): Promise<void> {
    const { fs } = this.node()
    try {
      await fs.promises.rm(this.abs(file), { force: true })
    } catch {
      // 删除失败不阻塞（下次写入覆盖即可）
    }
  }
}

/**
 * 按行切分文本。
 * 末尾缺少换行的最后一行（进程崩溃写入一半）由调用方按 JSON 解析失败丢弃，此处原样返回。
 */
export function splitLines(raw: string): string[] {
  if (!raw) return []
  return raw.split("\n").filter((line) => line.trim().length > 0)
}
