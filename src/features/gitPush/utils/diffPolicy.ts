// diff 自动加载策略（纯函数）：变更集取数失败后，按 numstat 规模决定是否自动拉取单文件补丁

import type { NumstatEntry } from "./gitOutput"

/** 单文件自动加载的改动行数上限；超过后改为用户显式点击加载 */
export const DIFF_AUTO_MAX_CHANGED_LINES = 3000

/**
 * @param entry 该文件的 numstat 规模；undefined 表示规模未知（未跟踪 / overview 不可用），按可加载处理
 */
export function shouldAutoLoadDiff(entry: NumstatEntry | undefined): boolean {
  if (!entry) return true
  if (entry.binary) return false
  return entry.add + entry.del <= DIFF_AUTO_MAX_CHANGED_LINES
}
