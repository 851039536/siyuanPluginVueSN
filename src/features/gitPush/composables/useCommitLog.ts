// commitLog 状态管理与事件处理（懒加载 + 重载）
import type { Ref } from "vue"
import type { CommitLogEntry } from "../types"
import { ref } from "vue"

export function useCommitLog(deps: {
  commitLogs: Ref<Record<string, CommitLogEntry[]>>
  loadCommitLog: (id: string, count?: number) => Promise<void>
  loadBranches: (id: string) => Promise<void>
  loadStashList: (id: string) => Promise<void>
  loadTags: (id: string) => Promise<unknown>
}) {
  const { commitLogs, loadCommitLog, loadBranches, loadStashList, loadTags } = deps

  /** 提交日志加载状态 */
  const commitLogLoading = ref<Record<string, boolean>>({})

  /** 已展开过的项目集合（避免重复懒加载详情） */
  const expandedProjects = ref<Set<string>>(new Set())

  /** 提取指定项目相关的 commitLog */
  function commitLogForProject(projectId: string): CommitLogEntry[] {
    return commitLogs.value[projectId] || []
  }

  /**
   * 工作区面板首次展开时懒加载详情：commitLog + branches + stash + tags
   * 首屏只加载了 workingTree/pushStatus，这四项延后到用户真正展开时才请求
   */
  async function handleExpand(projectId: string) {
    if (expandedProjects.value.has(projectId)) return
    expandedProjects.value.add(projectId)
    commitLogLoading.value[projectId] = true
    try {
      await Promise.all([
        loadCommitLog(projectId),
        loadBranches(projectId),
        loadStashList(projectId),
        loadTags(projectId),
      ])
    } finally {
      delete commitLogLoading.value[projectId]
    }
  }

  /** 用户选择不同提交记录显示条数时重新加载 */
  async function handleReloadCommitLog(id: string, count: number) {
    commitLogLoading.value[id] = true
    try {
      await loadCommitLog(id, count)
    } finally {
      delete commitLogLoading.value[id]
    }
  }

  return {
    commitLogLoading,
    commitLogForProject,
    handleExpand,
    handleReloadCommitLog,
  }
}
