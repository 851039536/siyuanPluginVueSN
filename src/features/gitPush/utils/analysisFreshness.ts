// 提交分析缓存新鲜度：比对缓存记录的 per-project HEAD 与当前 HEAD，找出需要局部重抓的项目（纯函数）。
// 只负责判定，不触发 git；探测失败（空串）与旧缓存缺记录一律视为「未知」，不触发重抓。

/** HEAD 探测结果：projectId → HEAD hash（空串 = 探测失败/空仓库，结果未知） */
export type ProjectHeads = Record<string, string>

/**
 * 找出 HEAD 与缓存不一致、需要局部重抓的项目。
 *
 * @param cachedHeads 缓存记录的 HEAD（旧缓存缺该字段时为 undefined）
 * @param currentHeads 本次探测的 HEAD（探测失败的项目为空串）
 * @param validProjectIds 当前仍存在的项目（已删除项目不参与）
 * @returns 需要重抓的项目 id；任一侧未知的项目不出现在结果里（保持现状，不误伤缓存展示）
 */
export function diffHeadProjects(
  cachedHeads: ProjectHeads | undefined,
  currentHeads: ProjectHeads,
  validProjectIds: Iterable<string>,
): string[] {
  const stale: string[] = []
  for (const id of validProjectIds) {
    const current = currentHeads[id]
    const cached = cachedHeads?.[id]
    // 探测失败不能当过期；旧缓存缺记录时无法判定，也不该触发整轮重抓
    if (!current || !cached) continue
    if (current !== cached) stale.push(id)
  }
  return stale
}
