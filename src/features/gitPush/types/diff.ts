// gitPush 差异取数结果类型（把「无差异」与「二进制 / 超限 / 失败」分开，避免静默空态）

/**
 * 单文件差异的取数状态：
 * - ok：正常补丁
 * - empty：确实没有差异
 * - binary：二进制文件（git 未输出补丁）
 * - tooLarge：输出超过缓冲区上限
 * - error：git 执行失败
 */
export type DiffStatus = "ok" | "empty" | "binary" | "tooLarge" | "error"

export interface FileDiffResult {
  status: DiffStatus
  text: string
}
