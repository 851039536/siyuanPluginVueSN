/**
 * 目录索引插件 - 类型定义
 */

/** 索引类型枚举 */
export type IndexType = "index" | "subdocs-ref" | "subdocs-outline"

/** 简单子文档描述，listDocsByPath 返回值的精简版 */
export interface SubDocInfo {
  id: string
  name: string
}
