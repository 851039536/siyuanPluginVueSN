// fast-import 流式历史重建执行器：cat-file --batch 单进程批量查询 tree 顶层条目，
// 以「deleteall + 全量 M 指令」的完整 tree 模型构造导入流（内容不变语义，永不产生合并冲突），
// 单进程 fast-import 导入到临时 ref（全程只建对象、不碰工作区），成功后返回新顶端 hash
// 供调用方 CAS 切回原分支；无论成败 finally 删除临时 ref，失败时原分支引用不被触碰。
import type { GitExecutor } from "./GitExecutor"
import type { RewriteEntry, RewritePlan } from "./historyRewritePlan"

/** fast-import / cat-file 导入超时（长历史大仓库放宽，与 BFG 清理同量级） */
const IMPORT_TIMEOUT_MS = 600000

/** tree 顶层条目（cat-file --batch 二进制解析产物） */
interface TreeEntry {
  /** 八进制模式串（git 内部形式："100644"/"100755"/"40000"/"120000"/"160000"） */
  mode: string
  /** 条目名原始字节（不经过 UTF-8 解码，无损处理非 UTF-8 文件名） */
  nameBytes: Buffer
  /** 条目对象 hash（blob/tree/commit 40-hex，直接引用已有对象） */
  sha: string
}

export class FastImportRewriter {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
  }

  /**
   * 执行流式重建：批量查 tree → 构造导入流 → fast-import 导入临时 ref → 返回新顶端 hash。
   * 进度在逐条生成 commit 指令时推进（periodic yield 让 UI 渲染进度）；total = entries.length，
   * 与旧 commit-tree 逐条方案的进度分母语义一致。
   */
  async rewrite(projectPath: string, plan: RewritePlan, onProgress?: (current: number, total: number) => void): Promise<string> {
    const treeEntries = await this.loadTreeEntries(projectPath, plan.entries.map((e) => e.tree))
    const stream = await this.buildImportStream(plan, treeEntries, onProgress)
    try {
      await this.executor.execGitStreaming(
        projectPath,
        ["fast-import", "--force", "--quiet", "--done"],
        stream,
        { timeoutMs: IMPORT_TIMEOUT_MS },
      )
      const newTip = (await this.executor.execGit(projectPath, ["rev-parse", "--verify", plan.tempRef])).trim()
      if (!newTip) throw new Error("重写失败：无法解析导入结果 hash")
      return newTip
    } catch (e: unknown) {
      // stderr 摘要已由 execGitStreaming 附在错误消息中（不回显导入流，避免日志爆炸）
      throw e instanceof Error ? e : new Error(String(e))
    } finally {
      // 无论成败删除临时 ref：成功后调用方已拿到 newTip 做 CAS 切回；失败时保持仓库原状（孤儿对象交由 gc 回收）
      await this.executor.execGit(projectPath, ["update-ref", "-d", plan.tempRef]).catch(() => { /* 清理失败不掩盖主错误 */ })
    }
  }

  /** 批量查询 tree 顶层条目（cat-file --batch 单进程；相同 tree hash 内存去重，空提交链零重复开销） */
  private async loadTreeEntries(projectPath: string, treeHashes: string[]): Promise<Map<string, TreeEntry[]>> {
    const unique = [...new Set(treeHashes)]
    const map = new Map<string, TreeEntry[]>()
    if (unique.length === 0) return map

    const request = unique.map((h) => `${h}\n`).join("")
    const output = await this.executor.execGitStreaming(
      projectPath,
      ["cat-file", "--batch"],
      request,
      { timeoutMs: IMPORT_TIMEOUT_MS },
    )
    // 响应协议：<hash> <type> <size>\n<content>\n 逐条排列；missing 行无 content
    let offset = 0
    for (const hash of unique) {
      const headerEnd = output.indexOf(0x0a, offset)
      if (headerEnd < 0) throw new Error("cat-file --batch 响应解析失败：响应不完整")
      const header = output.slice(offset, headerEnd).toString("utf8")
      offset = headerEnd + 1
      const parts = header.split(" ")
      if (parts.length < 3 || parts[1] !== "tree") {
        throw new Error(`重写失败：tree 对象查询异常（${header.slice(0, 80)}）`)
      }
      const size = Number.parseInt(parts[2] || "0", 10)
      if (!Number.isFinite(size) || offset + size > output.length) {
        throw new Error("cat-file --batch 响应解析失败：内容长度越界")
      }
      const content = output.slice(offset, offset + size)
      offset += size + 1 // 内容后跟一个 LF
      map.set(hash, parseTreeBinary(content))
    }
    return map
  }

  /**
   * 构造 fast-import 导入流（Buffer 拼接）：提交元数据（hash/作者/消息）为 UTF-8 文本，
   * tree 条目名保持 cat-file 返回的原始字节（无损处理非 UTF-8 文件名）。
   * 每条 commit 块：deleteall 清空 from 继承状态 + 全量 M 指令重建 root tree，
   * 保证重建结果与原 tree 的条目集合完全一致（同条目 → 同 tree hash）。
   */
  private async buildImportStream(
    plan: RewritePlan,
    treeEntries: Map<string, TreeEntry[]>,
    onProgress?: (current: number, total: number) => void,
  ): Promise<Buffer> {
    const chunks: Buffer[] = []
    const push = (s: string) => { chunks.push(Buffer.from(s, "utf8")) }
    const nowEpoch = Math.floor(Date.now() / 1000)
    const nowTz = localTimezoneRaw()
    const total = plan.entries.length
    let done = 0

    for (const entry of plan.entries) {
      push(`commit ${plan.tempRef}\n`)
      push(`mark :${entry.mark}\n`)
      // 作者三件套恒保留（与旧 commit-tree 方案一致）；姓名经换行清洗防破坏行结构
      push(`author ${sanitizeIdent(entry.an)} <${sanitizeIdent(entry.ae)}> ${entry.at} ${isoTzToRaw(entry.aI)}\n`)
      // preserveDate=false 时显式输出当前时间（对齐旧方案不设 GIT_COMMITTER_DATE 的"提交者时间刷新"语义）
      push(`committer ${sanitizeIdent(entry.cn)} <${sanitizeIdent(entry.ce)}> ${plan.preserveDate ? entry.ct : nowEpoch} ${plan.preserveDate ? isoTzToRaw(entry.cI) : nowTz}\n`)
      const msgBuf = Buffer.from(entry.message, "utf8")
      push(`data ${msgBuf.length}\n`)
      chunks.push(msgBuf)
      push("\n")
      // 父引用：首父走 from、其余走 merge（mark 引用已重建父，原 hash 引用未变的侧链/祖先）
      if (entry.parents.length > 0) {
        push(`from ${entry.parents[0]}\n`)
        for (let i = 1; i < entry.parents.length; i++) {
          push(`merge ${entry.parents[i]}\n`)
        }
      }
      const entries = treeEntries.get(entry.tree)
      if (!entries) throw new Error(`重写失败：tree 顶层条目缺失（${entry.tree}）`)
      push("deleteall\n")
      for (const t of entries) {
        push(`M ${normalizeFastImportMode(t.mode)} ${t.sha} `)
        chunks.push(quoteFastImportPathBytes(t.nameBytes))
        push("\n")
      }
      push("\n")

      done++
      // 每条回调保持旧版进度密度（同步回调成本低，渲染由 Vue 批量合并）；
      // 周期性让出事件循环供 UI 渲染（同步连续生成会阻塞进度条刷新）
      onProgress?.(done, total)
      if (done % 100 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
    push("done\n")
    return Buffer.concat(chunks)
  }
}

/** 解析 git tree 对象二进制内容：<mode> <name>\0<20字节二进制sha> 的连续序列 */
function parseTreeBinary(content: Buffer): TreeEntry[] {
  const entries: TreeEntry[] = []
  let off = 0
  while (off < content.length) {
    const sp = content.indexOf(0x20, off)
    const nul = content.indexOf(0x00, sp + 1)
    if (sp < 0 || nul < 0 || nul + 21 > content.length) {
      throw new Error("tree 对象内容解析失败：格式异常")
    }
    entries.push({
      mode: content.slice(off, sp).toString("utf8"),
      nameBytes: content.slice(sp + 1, nul),
      sha: content.slice(nul + 1, nul + 21).toString("hex"),
    })
    off = nul + 21
  }
  return entries
}

/** git tree 内部目录 mode 为 "40000"（无前导 0），归一化为 fast-import 规范形式 "040000"，其余模式原样 */
function normalizeFastImportMode(mode: string): string {
  return mode === "40000" ? "040000" : mode
}

/**
 * 提交者/作者姓名邮箱防御性清洗：换行与尖括号会破坏 fast-import 的
 * "author NAME <EMAIL>" 行结构（正常 git 数据不含这些字符，等价替换零影响；
 * 旧 commit-tree 经 env 传参路径对此免疫，流式协议路径需显式防御）
 */
function sanitizeIdent(s: string): string {
  return s.replace(/[\r\n<>]+/g, " ")
}

/** ISO 8601 时区（"+08:00"/"-0530"）→ fast-import raw 格式（"+0800"）；无时区兜底 UTC */
function isoTzToRaw(iso: string): string {
  const m = iso.match(/([+-]\d{2}):?(\d{2})$/)
  return m ? `${m[1]}${m[2]}` : "+0000"
}

/** 本地时区 raw 格式（committer 时间刷新为当前时间时使用）：getTimezoneOffset 分钟 → ±HHMM */
function localTimezoneRaw(): string {
  const offset = -new Date().getTimezoneOffset() // UTC+8 → 480
  const sign = offset >= 0 ? "+" : "-"
  const abs = Math.abs(offset)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`
}

/**
 * fast-import 路径编码：无特殊字节（引号/反斜杠/控制字符）时原样直出——不带引号的 path
 * 以行尾（LF）为界，空格与 UTF-8 多字节字节均安全；含特殊字节时用 C 风格引号包裹并转义
 */
function quoteFastImportPathBytes(name: Buffer): Buffer {
  let needsQuote = false
  for (const b of name) {
    if (b === 0x22 || b === 0x5c || b < 0x20 || b === 0x7f) {
      needsQuote = true
      break
    }
  }
  if (!needsQuote) return name
  let out = ""
  for (const b of name) {
    if (b === 0x22) out += '\\"'
    else if (b === 0x5c) out += "\\\\"
    else if (b === 0x0a) out += "\\n"
    else if (b === 0x0d) out += "\\r"
    else if (b === 0x09) out += "\\t"
    else if (b < 0x20 || b === 0x7f) out += `\\${b.toString(8).padStart(3, "0")}`
    else out += String.fromCharCode(b)
  }
  return Buffer.from(`"${out}"`, "latin1")
}
