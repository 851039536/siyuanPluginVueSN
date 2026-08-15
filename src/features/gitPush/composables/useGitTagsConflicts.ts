// Git 标签与提交模板冲突管理
import type { Ref } from "vue"
import type {
  CommitTemplate,
  GitProject,
  GitPushManager,
  ScannedGitRepo,
} from "../types"
import { ref } from "vue"
import { getAllProjectPathsForDedup, normalizePathForDedup, requireProject, resolveValidPath } from "../utils"

export function useGitTagsConflicts(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 提交信息模板 */
  const commitTemplates = ref<CommitTemplate[]>([])

  /** 扫描导入相关状态 */
  const scanning = ref(false)
  const scanResults = ref<(ScannedGitRepo & { alreadyImported: boolean })[]>([])

  // ── Tag 管理（列表数据已下沉卡片，此处仅保留写操作）──
  async function createTagOp(id: string, name: string, message?: string) {
    const project = requireProject(projects, id)
    await manager.createTag(resolveValidPath(project), name, message)
  }

  async function deleteTagOp(id: string, name: string) {
    const project = requireProject(projects, id)
    await manager.deleteTag(resolveValidPath(project), name)
  }

  async function pushTagOp(id: string, remoteName: string, tag: string): Promise<string> {
    const project = requireProject(projects, id)
    return manager.pushTag(resolveValidPath(project), remoteName, tag)
  }

  // ── 冲突操作（冲突文件列表已下沉卡片，此处仅保留写操作）──
  async function abortMergeOp(id: string) {
    const project = requireProject(projects, id)
    await manager.abortMerge(resolveValidPath(project))
  }

  async function resolveConflictOp(id: string, file: string, strategy: "theirs" | "ours") {
    const project = requireProject(projects, id)
    await manager.resolveConflictFile(resolveValidPath(project), file, strategy)
  }

  // ── 提交信息模板 ──
  async function loadCommitTemplates() {
    commitTemplates.value = await manager.getCommitTemplates()
  }

  // ── 扫描导入 ──

  async function startScan(dirPath: string) {
    scanning.value = true
    scanResults.value = []
    try {
      const repos = await manager.scanForGitRepos(dirPath)
      // 已导入判定覆盖主路径 + 多设备备选路径，避免跨设备副本被重复导入
      const existingPaths = new Set(
        projects.value.flatMap((p) => getAllProjectPathsForDedup(p)),
      )
      scanResults.value = repos.map((repo) => ({
        ...repo,
        alreadyImported: existingPaths.has(normalizePathForDedup(repo.path)),
      }))
    } finally {
      scanning.value = false
    }
  }

  async function importScanResults(selectedPaths: string[], categoryId: string) {
    let imported = 0
    let skipped = 0
    const pathSet = new Set(selectedPaths)
    for (const repo of scanResults.value) {
      if (!pathSet.has(repo.path) || repo.alreadyImported) continue
      try {
        await manager.addProject(repo.name, repo.path, categoryId)
        imported++
      } catch (e: unknown) {
        skipped++
        console.warn(`[gitPush] 跳过重复项目: ${repo.path} —`, e)
      }
    }
    return { imported, skipped }
  }

  return {
    createTagOp,
    deleteTagOp,
    pushTagOp,
    abortMergeOp,
    resolveConflictOp,
    commitTemplates,
    loadCommitTemplates,
    scanning,
    scanResults,
    startScan,
    importScanResults,
  }
}
