/**
 * 密码文本自动解析工具
 * 从选中文本中智能拆分账号、密码、描述字段
 */

export interface ParsedPasswordEntry {
  /** 名称 / 描述（单字段时） */
  name: string
  /** 账号 */
  account: string
  /** 密码 */
  password: string
  /** 描述（仅 3+ 字段时填充） */
  description: string
}

/** 待预填条目数据（别名，对外暴露用） */
export type PendingEntryData = ParsedPasswordEntry

/** 候选分隔符：按优先级排列（1 字符分隔符优先于空格） */
const DELIMITERS = ["：", ":", "_", "-", "|", ",", "\t"] as const

/**
 * 自动检测分隔符并拆解密码文本
 *
 * 支持的格式（自动识别）:
 * - `名称:账号:密码`         (英文冒号，3 字段)
 * - `名称：账号：密码：描述`    (中文冒号，4 字段)
 * - `名称_账号_密码`         (下划线)
 * - `名称-账号-密码-描述`     (短横线)
 * - `名称|账号|密码`         (竖线)
 * - `名称,账号,密码,描述`     (逗号)
 * - `名称\t账号\t密码\t描述`  (Tab)
 * - `名称 账号 密码`         (空格，3 字段)
 * - `名称 账号 密码 描述`     (空格，4 字段)
 *
 * 字段映射：
 * - 1 字段 → name
 * - 2 字段 → account + password
 * - 3 字段 → name + account + password
 * - 4+ 字段 → name + account + password + description（第四项起合并）
 */
export function parsePasswordText(raw: string): ParsedPasswordEntry {
  const text = raw.trim()
  if (!text) {
    return { name: "", account: "", password: "", description: "" }
  }

  // 1. 尝试 1 字符分隔符（按优先级）
  for (const delim of DELIMITERS) {
    if (text.includes(delim)) {
      const parts = text.split(delim).map((s) => s.trim()).filter(Boolean)
      if (parts.length >= 2) {
        return mapParts(parts)
      }
    }
  }

  // 2. 尝试空格分隔（最后兜底）
  const spaceParts = text.split(/\s+/).filter(Boolean)
  if (spaceParts.length >= 2) {
    return mapParts(spaceParts)
  }

  // 3. 单字段 → 当作名称/描述存储
  return {
    name: text,
    account: "",
    password: "",
    description: "",
  }
}

function mapParts(parts: string[]): ParsedPasswordEntry {
  if (parts.length === 1) {
    return { name: parts[0], account: "", password: "", description: "" }
  }

  if (parts.length === 2) {
    // 账号 密码（无名称）
    return {
      name: parts[0],
      account: parts[0],
      password: parts[1],
      description: "",
    }
  }

  if (parts.length === 3) {
    // 名称 账号 密码
    return {
      name: parts[0],
      account: parts[1],
      password: parts[2],
      description: "",
    }
  }

  // 4+ 字段：名称 账号 密码 描述...
  return {
    name: parts[0],
    account: parts[1],
    password: parts[2],
    description: parts.slice(3).join(" "),
  }
}
