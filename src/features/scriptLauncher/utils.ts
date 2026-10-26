/**
 * 脚本启动器 - 纯工具函数
 *
 * 仅含类型依赖（`import type`），无任何运行时导入，
 * 保证可被 vitest（src 下的 spec 测试）在 node 环境直接测试，不拖入 .vue / siyuan 链。
 */
import type { ScriptLanguage } from "./types"

/** Windows 保留的非法文件名字符（含控制字符） */
const ILLEGAL_FILE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/

/**
 * 检测脚本名称是否含非法文件名字符。
 * 脚本名直接用作磁盘文件名（`${name}${extension}`），需在保存前拦截。
 */
export function hasIllegalFileNameChars(name: string): boolean {
  return ILLEGAL_FILE_NAME_CHARS.test(name)
}

/**
 * 从文件名识别脚本语言。
 * 注意：此映射覆盖 SCRIPT_LANGUAGE_CONFIG.extension 之外的别名扩展名
 * （.pyw / .bash / .mjs / .cmd），无法直接从单一 extension 字段派生，
 * 因此单独维护完整映射。
 */
export function detectLanguage(fileName: string): ScriptLanguage {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, ScriptLanguage> = {
    py: "python",
    pyw: "python",
    sh: "bash",
    bash: "bash",
    ps1: "powershell",
    js: "nodejs",
    mjs: "nodejs",
    bat: "batch",
    cmd: "batch",
  }
  return map[ext] || "other"
}

/** 生成脚本元数据 id（随机 UUID，避免同毫秒碰撞） */
export function createScriptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `script-${crypto.randomUUID()}`
  }
  // 兜底：极老环境无 randomUUID，退化为时间戳 + 随机后缀
  return `script-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
