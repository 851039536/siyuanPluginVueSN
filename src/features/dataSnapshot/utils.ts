/**
 * dataSnapshot 快照信息格式化纯函数（不依赖 Vue 响应式）
 */
import { formatFileSize, formatTime } from "@/utils/format"
import type { SnapshotInfo } from "./types"

/**
 * 格式化快照时间：优先使用 API 预格式化字段，数值/字符串时间委托共享 formatTime
 * @param s 快照信息
 */
export function formatSnapshotTime(s: SnapshotInfo): string {
  if (s.hCreated) return s.hCreated
  if (s.hCreateTime) return s.hCreateTime
  if (s.created) return formatTime(s.created)
  if (s.createTime) {
    const num = Number(s.createTime)
    // createTime 可能是 unix 秒级时间戳
    return formatTime(num > 1000000000 ? num * 1000 : s.createTime)
  }
  return ""
}

/**
 * 格式化快照大小：优先使用 API 预格式化字段，字节数委托共享 formatFileSize
 * @param s 快照信息
 */
export function formatSnapshotSize(s: SnapshotInfo): string {
  if (s.hSize) return s.hSize
  if (!s.size) return ""
  return formatFileSize(s.size)
}
