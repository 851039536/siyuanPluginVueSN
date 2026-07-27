/**
 * S3 备份功能纯工具函数
 *
 * 不依赖 Vue 响应式的纯函数：数字补零、备份时间戳生成、
 * S3 对象 key 构建、主机名获取（模块级缓存）。
 */
import { getNodeProcessModules } from "@/utils/nodeModules"
import { DEFAULT_S3_PREFIX, DEFAULT_BACKUP_DIR } from "./types"

/** 数字补零（如 padNum(3) → "03"） */
export function padNum(n: number): string {
  return n.toString().padStart(2, "0")
}

/** 生成备份时间戳（格式 YYYYMMDD-HHmmss） */
export function makeBackupTimestamp(d: Date = new Date()): string {
  return `${d.getFullYear()}${padNum(d.getMonth() + 1)}${padNum(d.getDate())}-${padNum(d.getHours())}${padNum(d.getMinutes())}${padNum(d.getSeconds())}`
}

/**
 * 构建 S3 对象 key
 * 将 prefix/sub/datePath/relativePath 多段拼接为规范 S3 key，
 * 自动 strip 首尾斜杠、过滤空段，避免产生 // 等无效前缀。
 * prefix/sub 为空时回退默认值（与历史行为一致）。
 */
export function buildS3Key(prefix: string, sub: string, relativePath: string, datePath = ""): string {
  const parts: string[] = [
    (prefix || DEFAULT_S3_PREFIX).replace(/\/+$/, ""),
    (sub || DEFAULT_BACKUP_DIR).replace(/\/+$/, ""),
  ].filter(Boolean)
  if (datePath) { parts.push(datePath.replace(/\/+$/, "")) }
  parts.push(relativePath.replace(/^\/+/, ""))
  return parts.join("/")
}

/** 缓存的主机名（进程生命周期内不变，避免重复 require os 模块） */
let _hostname: string | null = null

/** 获取本机主机名（非 Node 环境返回空串） */
export function getHostname(): string {
  if (_hostname === null) {
    _hostname = getNodeProcessModules()?.os?.hostname() || ""
  }
  return _hostname
}
