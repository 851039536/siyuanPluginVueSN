// Git 标签与提交模板冲突管理
import type { Ref } from "vue"
import type {
  CommitTemplate,
  ConflictFile,
  GitProject,
  GitPushManager,
  ScannedGitRepo,
  TagInfo,
} from "../types"
import { ref } from "vue"
import { findProject, normalizePathForDedup } from "../utils"
import { resolveValidPath } from "../utils"

export function useGitTagsConflicts(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** Tag 列表缓存 */
  const tagsCache = ref<Record<string, TagInfo[]>>({})
  /** Tag 操作加载中 */
  const tagLoading = ref<Record<string, boolean>>({})
  /** 冲突状态 */
  const conflicts = ref<Record<string, ConflictFile[]>>({})
  /** 提交信息模板 */
  const commitTemplates = ref<CommitTemplate[]>([])

  /** 扫描导入相关状态 */
  const scanning = ref(false)
  const scanResults = ref<(ScannedGitRepo & { alreadyImported: boolean })[]>([])
  const scanDirInput = ref("")

  // ── Tag 管理 ──
  async function loadTags(id: string): Promise<TagInfo[]> {
    const project = findProject(projects, id)
    if (!project) return []
    const list = await manager.getTags(resolveValidPath(project))
    tagsCache.value = { ...tagsCache.value, [id]: list }
    return list
  }

  async function createTagOp(id: string, name: string, message?: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.createTag(resolveValidPath(project), name, message)
  }

  async function deleteTagOp(id: string, name: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.deleteTag(resolveValidPath(project), name)
  }

  async function pushTagOp(id: string, remoteName: string, tag: string): Promise<string> {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    return manager.pushTag(resolveValidPath(project), remoteName, tag)
  }

  // ── 冲突检测 ──
  async function checkConflicts(id: string): Promise<ConflictFile[]> {
    const project = findProject(projects, id)
    if (!project) return []
    const files = await manager.getConflictFiles(resolveValidPath(project))
    conflicts.value = { ...conflicts.value, [id]: files }
    return files
  }

  async function abortMergeOp(id: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.abortMerge(resolveValidPath(project))
    const { [id]: _, ...rest } = conflicts.value
    conflicts.value = rest
  }

  async function resolveConflictOp(id: string, file: string, strategy: "theirs" | "ours") {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.resolveConflictFile(resolveValidPath(project), file, strategy)
  }

  // ── 提交信息模板 ──
  async function loadCommitTemplates() {
    commitTemplates.value = await manager.getCommitTemplates()
  }

  async function saveCommitTemplates(templates: CommitTemplate[]) {
    await manager.saveCommitTemplates(templates)
    commitTemplates.value = templates
  }

  function fillTemplate(template: CommitTemplate, branch: string, fileCount: number): string {
    return template.pattern.replace(/\{branch\}/g, branch).replace(/\{files\}/g, String(fileCount))
  }

  // ── 扫描导入 ──
  async function checkIsGitRepo(path: string) {
    return manager.checkIsGitRepo(path)
  }

  async function startScan(dirPath: string) {
    scanning.value = true
    scanResults.value = []
    try {
      const repos = await manager.scanForGitRepos(dirPath)
      const existingPaths = new Set(
        projects.value.map((p) => normalizePathForDedup(p.path)),
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
    for (const repo of scanResults.value) {
      if (!selectedPaths.includes(repo.path) || repo.alreadyImported) continue
      try {
        await manager.addProject(repo.name, repo.path, categoryId)
        imported++
      } catch (e: any) {
        skipped++
        console.warn(`[gitPush] 跳过重复项目: ${repo.path} — ${e?.message || e}`)
      }
    }
    return { imported, skipped }
  }

  return {
    tagsCache,
    tagLoading,
    loadTags,
    createTagOp,
    deleteTagOp,
    pushTagOp,
    conflicts,
    checkConflicts,
    abortMergeOp,
    resolveConflictOp,
    commitTemplates,
    loadCommitTemplates,
    saveCommitTemplates,
    fillTemplate,
    scanning,
    scanResults,
    scanDirInput,
    checkIsGitRepo,
    startScan,
    importScanResults,
  }
}
