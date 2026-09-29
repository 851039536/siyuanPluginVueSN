// 本地提交索引 — 磁盘 IO 层测试替身（纯逻辑，不依赖 Electron/fs）
import type { IndexFileIO } from "./indexIo"
import { INDEX_FILE } from "./indexIo"

/** 内存版索引 IO（模拟 appendFile/readFile 语义，含"崩溃留下半行"与"文件缺失"两种情况） */
export class MemoryIndexIO implements IndexFileIO {
  files = new Map<string, string>()
  /** 置为 true 时下一次 appendLines 只写入半行且不补换行（模拟进程被 kill） */
  dropTail = false

  async appendLine(file: string, line: string): Promise<void> {
    await this.appendLines(file, [line])
  }

  async appendLines(file: string, lines: string[]): Promise<void> {
    if (lines.length === 0) return
    const text = `${lines.join("\n")}\n`
    if (this.dropTail) {
      this.dropTail = false
      this.files.set(file, (this.files.get(file) ?? "") + text.slice(0, Math.max(1, text.length - 5)))
      return
    }
    this.files.set(file, (this.files.get(file) ?? "") + text)
  }

  async readLines(file: string): Promise<string[]> {
    const raw = this.files.get(file) ?? ""
    if (!raw) return []
    return raw.split("\n").filter((l) => l.trim().length > 0)
  }

  async writeText(file: string, text: string): Promise<void> {
    this.files.set(file, text)
  }

  async readText(file: string): Promise<string | null> {
    return this.files.has(file) ? this.files.get(file)! : null
  }

  async remove(file: string): Promise<void> {
    this.files.delete(file)
  }

  /** 供断言使用：某文件的原始文本 */
  raw(file: string): string {
    return this.files.get(file) ?? ""
  }

  /** 清空全部文件 */
  reset(): void {
    this.files.clear()
  }

  /** 索引文件常量透传，便于测试引用 */
  static readonly FILE = INDEX_FILE
}
