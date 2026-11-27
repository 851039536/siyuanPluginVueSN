/**
 * 提权助手 - PowerShell 命令构建与输出解析（纯函数）
 *
 * 所有用户输入都经 JSON + Base64 传入 PowerShell，脚本模板本身不拼接用户路径，
 * 从根上避免引号/命令注入问题。
 */
import type { CreateShortcutParams } from "../types"
import { clampArguments, clampDescription } from "./validation"

export type IntegrityLevel =
  | "low"
  | "medium"
  | "mediumPlus"
  | "high"
  | "system"
  | "protected"
  | "unknown"

const POWERSHELL_HEADER = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  "$WarningPreference = 'SilentlyContinue'",
  "try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}",
].join("\n")

/** 字符串 → UTF-16LE 字节（不依赖 node:buffer） */
export function utf16leBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes[i * 2] = code & 0xFF
    bytes[i * 2 + 1] = (code >> 8) & 0xFF
  }
  return bytes
}

/** 字节 → Base64（浏览器/Node 均可用的 btoa；大字符串分块避免栈溢出） */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/** PowerShell -EncodedCommand 参数（UTF-16LE Base64） */
export function encodePowerShellCommand(script: string): string {
  return bytesToBase64(utf16leBytes(script))
}

/** UTF-8 字符串 → Base64（用于 JSON 参数） */
export function encodeUtf8Base64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}

/** 固定脚本头 + JSON 参数解码，返回可拼接 body 的脚本 */
export function buildPayloadScript(body: string, payload: unknown): string {
  const encoded = encodeUtf8Base64(JSON.stringify(payload))
  return [
    POWERSHELL_HEADER,
    `$payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))`,
    "$p = $payloadJson | ConvertFrom-Json",
    body,
  ].join("\n")
}

/** 创建快捷方式脚本 */
export function buildCreateShortcutScript(params: CreateShortcutParams): string {
  const payload = {
    ...params,
    args: clampArguments(params.args),
    description: clampDescription(params.description),
  }
  const body = [
    // 整个流程都在 try 内：EXISTS / INVALID_LOCATION 等业务错误也必须走统一的
    // JSON 返回通道，否则 PowerShell 以非零退出结束，调用方只能看到 stderr 文本
    "$temp = $null",
    "try {",
    "  $dir = switch ($p.location) {",
    "    'desktop' { [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory) }",
    "    'programs' { [Environment]::GetFolderPath([Environment+SpecialFolder]::Programs) }",
    "    'custom' { $p.customDir }",
    "    default { throw 'INVALID_LOCATION' }",
    "  }",
    "  if (-not $dir) { throw 'INVALID_LOCATION' }",
    "  New-Item -ItemType Directory -Force -Path $dir | Out-Null",
    "  $final = Join-Path $dir ($p.fileName + '.lnk')",
    "  if ((Test-Path -LiteralPath $final) -and (-not $p.overwrite)) { throw 'EXISTS' }",
    "  $temp = Join-Path $dir ('.dsh-' + [Guid]::NewGuid().ToString('N') + '.lnk')",
    "  $shell = New-Object -ComObject WScript.Shell",
    "  $shortcut = $shell.CreateShortcut($temp)",
    "  $shortcut.TargetPath = $p.targetPath",
    "  $shortcut.WorkingDirectory = $p.workingDir",
    "  $shortcut.Arguments = $p.args",
    "  if ($p.description) { $shortcut.Description = $p.description }",
    "  $shortcut.Save()",
    "  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut)",
    "  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)",
    "  $bytes = [IO.File]::ReadAllBytes($temp)",
    "  if ($bytes.Length -le 0x15) { throw 'INVALID_LNK' }",
    "  if ($p.runAsAdmin) { $bytes[0x15] = $bytes[0x15] -bor 0x20 } else { $bytes[0x15] = $bytes[0x15] -band 0xDF }",
    "  [IO.File]::WriteAllBytes($temp, $bytes)",
    "  Move-Item -LiteralPath $temp -Destination $final -Force",
    "  $actual = ([IO.File]::ReadAllBytes($final))[0x15] -band 0x20",
    "  [pscustomobject]@{ ok = $true; path = $final; runAsAdmin = [bool]$actual } | ConvertTo-Json -Compress",
    "} catch {",
    "  $message = $_.Exception.Message",
    "  $kind = if ($message -eq 'EXISTS') { 'exists' } elseif ($message -eq 'INVALID_LNK') { 'invalid' } elseif ($message -eq 'INVALID_LOCATION') { 'location' } else { 'powershell' }",
    "  [pscustomobject]@{ ok = $false; kind = $kind; message = $message } | ConvertTo-Json -Compress",
    "} finally {",
    "  if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }",
    "}",
  ].join("\n")
  return buildPayloadScript(body, payload)
}

/** 以管理员身份运行脚本 */
export function buildRunElevatedScript(targetPath: string, args: string, workingDir: string): string {
  const body = [
    "try {",
    "  $startArgs = @{ FilePath = $p.path; Verb = 'RunAs'; PassThru = $true }",
    "  if ($p.workingDir) { $startArgs.WorkingDirectory = $p.workingDir }",
    "  if ($p.args) { $startArgs.ArgumentList = $p.args }",
    "  $process = Start-Process @startArgs",
    "  [pscustomobject]@{ ok = $true; pid = $process.Id } | ConvertTo-Json -Compress",
    "} catch {",
    "  $code = 0",
    "  try { $code = $_.Exception.HResult } catch {}",
    "  [pscustomobject]@{ ok = $false; kind = 'powershell'; code = $code; message = $_.Exception.Message } | ConvertTo-Json -Compress",
    "}",
  ].join("\n")
  return buildPayloadScript(body, {
    path: targetPath,
    args: clampArguments(args),
    workingDir,
  })
}

/** 解析 PowerShell stdout 中的 JSON（去 BOM、容忍前后空白） */
export function parsePowerShellJson(stdout: string): unknown | null {
  const text = stdout.replace(/^\uFEFF/, "").trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // 少数环境会在 JSON 前后输出提示文本，取最后一个大括号对象兜底
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

/** 完整性 SID → 语义级别 */
export function mapIntegritySid(sid: string | null | undefined): IntegrityLevel {
  if (!sid) return "unknown"
  const match = /S-1-16-(\d+)/i.exec(sid)
  if (!match) return "unknown"
  switch (Number(match[1])) {
    case 4096:
      return "low"
    case 8192:
      return "medium"
    case 8448:
      return "mediumPlus"
    case 12288:
      return "high"
    case 16384:
      return "system"
    case 20480:
      return "protected"
    default:
      return "unknown"
  }
}

/** 从 whoami /groups 输出中解析完整性 SID */
export function parseWhoamiGroups(text: string): string | null {
  const match = /S-1-16-\d+/i.exec(text)
  return match?.[0]?.toUpperCase() ?? null
}

/** 是否 UAC 取消（1223 / 0x800704C7 / 本地化消息） */
export function isUacCanceled(input: { code?: number | string | null, message?: string | null }): boolean {
  const code = typeof input.code === "string" ? Number(input.code) : input.code
  if (typeof code === "number" && Number.isFinite(code)) {
    if (code === 1223) return true
    // eslint-disable-next-line no-bitwise
    if ((code & 0xFFFF) === 1223) return true
  }
  const message = (input.message || "").toLowerCase()
  return message.includes("canceled")
    || message.includes("cancelled")
    || message.includes("取消")
    || message.includes("1223")
}
