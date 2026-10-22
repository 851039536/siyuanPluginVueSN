// gitPush 脚本输出解码：Windows 中文 GBK/UTF-8 码制自动识别 + ANSI 转义清理
/** 输出解码器：push 喂入原始字节返回文本（码制未决时暂扣），flush 收尾冲刷 */
export interface ScriptOutputDecoder {
  push: (bytes: Uint8Array) => string
  flush: () => string
}

/** 码制未决时攒够该数量的高位字节才判定（防单字符字节巧合误判 UTF-8） */
const HIGH_BYTES_TO_DECIDE = 4

/** ANSI 转义（CSI / OSC / 裸转义）：管道输出偶发彩色控制符，预览区是纯文本须清掉 */
const ANSI_RE = /\x1B(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\)|[@-Z\\-_])/g

function cleanAnsi(text: string): string {
  return text.replace(ANSI_RE, "")
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function countHighBytes(buf: Uint8Array): number {
  let n = 0
  for (const b of buf) {
    if (b >= 0x80) n++
  }
  return n
}

/** 严格 UTF-8 解码尝试；区分「非法」与「结尾多字节字符未传完」两种失败 */
function tryStrictUtf8(buf: Uint8Array): { ok: true } | { ok: false, tailIncomplete: boolean } {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf)
    return { ok: true }
  } catch {
    // 尾部 1~3 字节可能是被 chunk 边界截断的多字节字符前缀
    for (let k = 1; k <= 3 && k <= buf.length; k++) {
      if (!isUtf8Prefix(buf.subarray(buf.length - k))) continue
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, buf.length - k))
        return { ok: false, tailIncomplete: true }
      } catch { /* 去掉尾部仍非法，继续试更长尾部 */ }
    }
    return { ok: false, tailIncomplete: false }
  }
}

/** 是否为「未传完的 UTF-8 多字节字符」前缀（完整序列不算） */
function isUtf8Prefix(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false
  const b0 = bytes[0]
  if (b0 < 0xC2 || b0 > 0xF4) return false
  const need = b0 >= 0xF0 ? 4 : b0 >= 0xE0 ? 3 : 2
  if (bytes.length >= need) return false
  for (let i = 1; i < bytes.length; i++) {
    if (bytes[i] < 0x80 || bytes[i] > 0xBF) return false
  }
  return true
}

/**
 * 构建流式输出解码器。
 * 背景：Windows 中文系统里 cmd/bat/ps1/dotnet 的管道输出多为系统 GBK 代码页，
 * 而 Node 工具链（npm/vite/eslint）输出 UTF-8——统一 toString("utf8") 必然乱码。
 * 策略：高位字节未达判定阈值前暂扣（纯 ASCII 直接放行，两码制一致），
 * 首段高位字节用严格 UTF-8 试探：通过→UTF-8 流；非法→GBK 流。
 */
export function createScriptOutputDecoder(): ScriptOutputDecoder {
  let mode: "undecided" | "utf8" | "gbk" = "undecided"
  let pending: Uint8Array = new Uint8Array(0)
  const utf8Stream = new TextDecoder("utf-8", { fatal: false })
  const gbkStream = new TextDecoder("gbk")

  return {
    push(bytes: Uint8Array): string {
      if (mode === "utf8") return cleanAnsi(utf8Stream.decode(bytes, { stream: true }))
      if (mode === "gbk") return cleanAnsi(gbkStream.decode(bytes, { stream: true }))

      pending = concatBytes(pending, bytes)
      // 全 ASCII：两码制解码一致，直接放行，避免小输出滞留到 flush
      if (countHighBytes(pending) === 0) {
        const text = new TextDecoder("utf-8").decode(pending)
        pending = new Uint8Array(0)
        return cleanAnsi(text)
      }
      const verdict = tryStrictUtf8(pending)
      if (verdict.ok && countHighBytes(pending) >= HIGH_BYTES_TO_DECIDE) {
        mode = "utf8"
        const text = utf8Stream.decode(pending, { stream: true })
        pending = new Uint8Array(0)
        return cleanAnsi(text)
      }
      if (!verdict.ok && !verdict.tailIncomplete) {
        mode = "gbk"
        const text = gbkStream.decode(pending, { stream: true })
        pending = new Uint8Array(0)
        return cleanAnsi(text)
      }
      return ""
    },
    flush(): string {
      if (mode === "utf8") return cleanAnsi(utf8Stream.decode())
      if (mode === "gbk") return cleanAnsi(gbkStream.decode())
      if (pending.length === 0) return ""
      const verdict = tryStrictUtf8(pending)
      const text = verdict.ok
        ? new TextDecoder("utf-8", { fatal: false }).decode(pending)
        : gbkStream.decode(pending, { stream: true })
      pending = new Uint8Array(0)
      return cleanAnsi(text)
    },
  }
}
