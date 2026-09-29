// gitPush 本地提交索引 — 磁盘 IO 层（NDJSON 追加日志 + 小体积 meta.json）
//
// 为什么不是 sqlite：思源桌面端为 Electron 33（内置 Node 20，无 node:sqlite），
// better-sqlite3 需原生编译且随思源升级易失效，sql.js 需把全库载入内存（大仓库比 git log 更慢）。
// 本层只依赖 fs，接口注入使纯逻辑可单测（见 __tests__/commitIndex.test.ts）。
import { getNodeModules } from "@/utils/nodeModules"

/** 索引目录下的文件名（三份追加日志 + 一份小体积元数据） */
export const INDEX_FILE = {
  commits: "commits.ndjson",
  files: "files.ndjson",
  fileLines: "filelines.ndjson",
  meta: "meta.json",
} as const

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
