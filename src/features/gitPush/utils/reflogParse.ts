// reflog 输出解析（纯函数）：`git reflog show --date=iso --format=%H%x00%gs%x00%gD`
//
// 为什么不用 `git reflog` 的默认输出：默认是「短 hash + 半自由文本」，日期/选择器/说明
// 混在一行里，按列切分会被提交信息里的空格带偏。用 NUL 分隔三列后，解析只依赖分隔符。
import type { RefLogEntry } from "../types/reflog"

/** 单个 hash 列的合法形态（reflog %H 恒为完整 40 位，这里放宽到 7 位以容忍裁剪输出） */
const HASH_RE = /^[0-9a-f]{7,40}$/i

/**
 * 解析 reflog（按行，NUL 分隔 `hash\0subject\0selector`）。
 * 空行与格式不符的行直接跳过：reflog 可能被并发写入，宁可少一条也不要抛错。
 */
export function parseReflog(raw: string): RefLogEntry[] {
  const entries: RefLogEntry[] = []
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    const [hash = "", subject = "", selector = ""] = line.split("\0")
    const trimmedHash = hash.trim()
    if (!HASH_RE.test(trimmedHash) || !selector.trim()) continue
    entries.push({
      hash: trimmedHash,
      subject: subject.trim(),
      selector: selector.trim(),
    })
  }
  return entries
}
