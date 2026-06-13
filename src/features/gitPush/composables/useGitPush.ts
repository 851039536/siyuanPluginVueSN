import type { GitProject, PushStatusInfo, WorkingTreeInfo, ProjectCategory, CommitLogEntry, BranchInfo, ScannedGitRepo, StashEntry } from "../types"
import type { GitPushManager } from "../types"
import { ref, computed } from "vue"

export function useGitPush(manager: GitPushManager) {
  const projects = ref<GitProject[]>([])
  const categories = ref<ProjectCategory[]>([])
  const loading = ref(false)
  /** 正在推送的项目 id → "github"|"gitee"|"all" */
  const pushingRemote = ref<Record<string, string>>({})
  const pushOutputs = ref<Record<string, string>>({})
  /** 正在拉取的项目 id → "github"|"gitee"|"all" */
  const pullingRemote = ref<Record<string, string>>({})
  const pullOutputs = ref<Record<string, string>>({})
  /** 项目推送状态缓存 id → PushStatusInfo */
  const pushStatuses = ref<Record<string, PushStatusInfo>>({})
  /** 工作区状态缓存 id → WorkingTreeInfo */
  const workingTrees = ref<Record<string, WorkingTreeInfo>>({})
  /** 文件差异缓存 key="${id}::${staged}::${path}" → diff 文本 */
  const fileDiffs = ref<Record<string, string>>({})
  /** 正在提交的项目 id → true */
  const committing = ref<Record<string, boolean>>({})
  /** 提交日志缓存 id → CommitLogEntry[] */
  const commitLogs = ref<Record<string, CommitLogEntry[]>>({})
  /** 分支列表缓存 id → BranchInfo[] */
  const branches = ref<Record<string, BranchInfo[]>>({})

  /** 扫描导入相关状态 */
  const scanning = ref(false)
  const scanResults = ref<(ScannedGitRepo & { alreadyImported: boolean })[]>([])
  const scanDirInput = ref("")

  /** git 并发配置 */
  const gitConcurrency = ref(3)

  /** Stash 条目缓存 id → StashEntry[] */
  const stashEntries = ref<Record<string, StashEntry[]>>({})
  /** Stash 操作加载中 id → true */
  const stashLoading = ref<Record<string, boolean>>({})

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => {
    const map = new Map<string, { category: ProjectCategory; projects: GitProject[] }>()
    // 初始化所有分类
    for (const cat of categories.value) {
      map.set(cat.id, { category: cat, projects: [] })
    }
    // 分配项目
    for (const p of projects.value) {
      const group = map.get(p.categoryId)
      if (group) {
        group.projects.push(p)
      } else {
        // 分类不存在，回退到未分组
        const ungrouped = map.get("__ungrouped__")
        if (ungrouped) ungrouped.projects.push(p)
      }
    }
    // 排序并过滤空分组
    return [...map.values()]
      .filter(g => g.projects.length > 0)
      .sort((a, b) => a.category.order - b.category.order)
  })

  // ── 统计视图 computed ──

  /** 项目总数 */
  const projectCount = computed(() => projects.value.length)

  /** 远程仓库覆盖率统计 */
  const remoteCoverage = computed(() => {
    const total = projects.value.length
    if (total === 0) return { total: 0, github: 0, gitee: 0, gitea: 0, hasRemote: 0, noRemote: 0, multiple: 0 }
    let github = 0, gitee = 0, gitea = 0, hasRemote = 0, multiple = 0
    for (const p of projects.value) {
      const remotes = [p.githubUrl, p.giteeUrl, p.giteaUrl].filter(Boolean).length
      if (p.githubUrl) github++
      if (p.giteeUrl) gitee++
      if (p.giteaUrl) gitea++
      if (remotes > 0) hasRemote++
      if (remotes >= 2) multiple++
    }
    return { total, github, gitee, gitea, hasRemote, noRemote: total - hasRemote, multiple }
  })

  /** 推送状态分布统计 */
  const pushStatusStats = computed(() => {
    const total = projects.value.length
    if (total === 0) return { total: 0, ahead: 0, behind: 0, synced: 0, noRemote: 0 }
    let ahead = 0, behind = 0, synced = 0, noRemote = 0
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status || Object.keys(status.remotes).length === 0) {
        noRemote++
        continue
      }
      const remotes = Object.values(status.remotes)
      if (remotes.some(r => r.ahead > 0)) {
        ahead++
      } else if (remotes.some(r => r.behind > 0)) {
        behind++
      } else {
        synced++
      }
    }
    return { total, ahead, behind, synced, noRemote }
  })

  /** 需要推送的项目列表（按 ahead 降序） */
  const needsPushProjects = computed(() => {
    const result: { project: GitProject; aheadByRemote: { key: string; ahead: number }[]; totalAhead: number }[] = []
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status) continue
      const aheadByRemote: { key: string; ahead: number }[] = []
      if (status.remotes.github && status.remotes.github.ahead > 0) {
        aheadByRemote.push({ key: "github", ahead: status.remotes.github.ahead! })
      }
      if (status.remotes.gitee && status.remotes.gitee.ahead > 0) {
        aheadByRemote.push({ key: "gitee", ahead: status.remotes.gitee.ahead! })
      }
      if (status.remotes.gitea && status.remotes.gitea.ahead > 0) {
        aheadByRemote.push({ key: "gitea", ahead: status.remotes.gitea.ahead! })
      }
      if (aheadByRemote.length > 0) {
        result.push({
          project: p,
          aheadByRemote,
          totalAhead: aheadByRemote.reduce((s, r) => s + r.ahead, 0),
        })
      }
    }
    return result.sort((a, b) => b.totalAhead - a.totalAhead)
  })

  /** 有未提交变更的项目列表 */
  const uncommittedProjects = computed(() => {
    return projects.value
      .filter(p => workingTrees.value[p.id]?.hasChanges)
      .map(p => ({
        project: p,
        staged: workingTrees.value[p.id]!.stagedCount,
        unstaged: workingTrees.value[p.id]!.unstagedCount,
        untracked: workingTrees.value[p.id]!.untrackedCount,
      }))
  })

  /** 最近提交摘要（跨所有项目，含相对时间 + 文件差异信息） */
  interface RecentCommitEntry {
    projectId: string
    projectName: string
    entry: CommitLogEntry
  }
  const recentCommits = computed(() => {
    const allEntries: RecentCommitEntry[] = []
    for (const p of projects.value) {
      const logs = commitLogs.value[p.id]
      if (logs && logs.length > 0) {
        allEntries.push({
          projectId: p.id,
          projectName: p.name,
          entry: logs[0],
        })
      }
    }
    return allEntries.sort((a, b) => {
      // 优先按绝对日期降序，回退到保持原顺序
      return (b.entry.date || "").localeCompare(a.entry.date || "")
    })
  })

  function isPushing(projectId: string, target?: string): boolean {
    const v = pushingRemote.value[projectId]
    if (!v) return false
    if (target) return v === target
    return true
  }

  function isPulling(projectId: string, target?: string): boolean {
    const v = pullingRemote.value[projectId]
    if (!v) return false
    if (target) return v === target
    return true
  }

  async function loadProjects() {
    loading.value = true
    try {
      categories.value = await manager.getCategories()
      projects.value = await manager.getProjects()
    } finally {
      loading.value = false
    }
  }

  async function addProject(name: string, path: string, categoryId = "__ungrouped__") {
    const project = await manager.addProject(name, path, categoryId)
    projects.value = [...projects.value, project]
    return project
  }

  async function removeProject(id: string) {
    await manager.removeProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  async function refreshRemotes(id: string) {
    const updated = await manager.refreshRemotes(id)
    if (updated) {
      const idx = projects.value.findIndex(p => p.id === id)
      if (idx !== -1) {
        projects.value[idx] = updated
        projects.value = [...projects.value]
      }
    }
    return updated
  }

  /** 格式化推送输出文本 */
  function formatPushOutput(id: string, entries: { label: string; ok: boolean; stdout: string; stderr: string }[]) {
    const lines: string[] = []
    for (const e of entries) {
      lines.push(`[${e.label}] ${e.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (e.stdout) lines.push(e.stdout)
      if (e.stderr) lines.push(`错误: ${e.stderr}`)
    }
    pushOutputs.value[id] = lines.join("\n")
  }

  async function pushToAll(id: string) {
    pushingRemote.value[id] = "all"
    try {
      const result = await manager.pushToAll(id)
      formatPushOutput(id, [
        { label: "GitHub", ok: result.github.ok, stdout: result.github.stdout, stderr: result.github.stderr },
        { label: "Gitee", ok: result.gitee.ok, stdout: result.gitee.stdout, stderr: result.gitee.stderr },
        { label: "Gitea", ok: result.gitea.ok, stdout: result.gitea.stdout, stderr: result.gitea.stderr },
      ])
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pushSingle(id: string, target: "github" | "gitee" | "gitea") {
    pushingRemote.value[id] = target
    try {
      const result = await manager.pushSingle(id, target)
      const label = target === "github" ? "GitHub" : target === "gitee" ? "Gitee" : "Gitea"
      formatPushOutput(id, [{ label, ok: result.ok, stdout: result.stdout, stderr: result.stderr }])
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  /** 格式化拉取输出文本 */
  function formatPullOutput(id: string, entries: { label: string; ok: boolean; stdout: string; stderr: string }[]) {
    const lines: string[] = []
    for (const e of entries) {
      lines.push(`[${e.label}] ${e.ok ? "✅ 拉取成功" : "❌ 拉取失败"}`)
      if (e.stdout) lines.push(e.stdout)
      if (e.stderr) lines.push(`错误: ${e.stderr}`)
    }
    pullOutputs.value[id] = lines.join("\n")
  }

  async function pullToAll(id: string) {
    pullingRemote.value[id] = "all"
    try {
      const result = await manager.pullToAll(id)
      formatPullOutput(id, [
        { label: "GitHub", ok: result.github.ok, stdout: result.github.stdout, stderr: result.github.stderr },
        { label: "Gitee", ok: result.gitee.ok, stdout: result.gitee.stdout, stderr: result.gitee.stderr },
        { label: "Gitea", ok: result.gitea.ok, stdout: result.gitea.stdout, stderr: result.gitea.stderr },
      ])
      loadPushStatus(id)
      return result
    } finally {
      delete pullingRemote.value[id]
    }
  }

  async function pullSingle(id: string, target: "github" | "gitee" | "gitea") {
    pullingRemote.value[id] = target
    try {
      const result = await manager.pullSingle(id, target)
      const label = target === "github" ? "GitHub" : target === "gitee" ? "Gitee" : "Gitea"
      formatPullOutput(id, [{ label, ok: result.ok, stdout: result.stdout, stderr: result.stderr }])
      loadPushStatus(id)
      return result
    } finally {
      delete pullingRemote.value[id]
    }
  }

  async function loadPushStatus(id: string) {
    pushStatuses.value[id] = await manager.checkPushStatus(id)
  }

  /** 加载工作区状态 */
  async function loadWorkingTree(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    workingTrees.value[id] = await manager.getWorkingTreeStatus(project.path)
  }

  /** 加载单个文件差异 */
  async function loadFileDiff(id: string, file: string, staged: boolean) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return ""
    const key = `${id}::${staged ? "s" : "u"}::${file}`
    const diff = await manager.getFileDiff(project.path, file, staged)
    fileDiffs.value[key] = diff
    return diff
  }

  /** 加载分支提交日志 */
  async function loadCommitLog(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    commitLogs.value[id] = await manager.getCommitLog(project.path)
  }

  /** 加载分支列表 */
  async function loadBranches(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    branches.value[id] = await manager.getBranches(project.path)
  }

  /** 切换分支 */
  async function switchBranch(id: string, branch: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) throw new Error("项目未找到")
    // 有变更时 Manager 层已抛异常，此处直接执行
    await manager.switchBranch(project.path, branch)
    // 切换后刷新全部状态
    await loadWorkingTree(id)
    await loadPushStatus(id)
    await loadCommitLog(id)
    await loadBranches(id)
  }

  /** 通过项目路径执行 git 操作的通用包装 */
  async function withProjectPath(id: string, fn: (path: string) => Promise<void>) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    await fn(project.path)
    await loadWorkingTree(id)
  }

  /** 暂存单个文件 */
  async function stageItem(id: string, file: string) {
    console.log(`[gitPush:stageItem] id=${id} file=${file}`)
    await withProjectPath(id, (path) => manager.stageFile(path, file))
    console.log(`[gitPush:stageItem] 完成, files=`, workingTrees.value[id]?.files.map(f => `${f.path}(${f.staged ? "S" : "U"})`))
  }

  /** 暂存全部 */
  async function stageAllItems(id: string) {
    await withProjectPath(id, (path) => manager.stageAll(path))
  }

  /** 取消暂存单个文件 */
  async function unstageItem(id: string, file: string) {
    console.log(`[gitPush:unstageItem] id=${id} file=${file}`)
    await withProjectPath(id, (path) => manager.unstageFile(path, file))
    console.log(`[gitPush:unstageItem] 完成, files=`, workingTrees.value[id]?.files.map(f => `${f.path}(${f.staged ? "S" : "U"})`))
  }

  /** 取消全部暂存 */
  async function unstageAllItems(id: string) {
    await withProjectPath(id, (path) => manager.unstageAll(path))
  }

  /** 丢弃单个文件的更改 */
  async function discardFile(id: string, file: string, staged: boolean, status: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.discardFile(project.path, file, staged, status)
  }

  /** 提交 */
  async function doCommit(id: string, message: string): Promise<string> {
    const project = projects.value.find(p => p.id === id)
    if (!project) throw new Error("项目未找到")
    committing.value[id] = true
    try {
      const result = await manager.commit(project.path, message)
      // 提交后刷新工作区状态和推送状态
      await loadWorkingTree(id)
      await loadPushStatus(id)
      return result
    } finally {
      delete committing.value[id]
    }
  }

  /** 自动生成提交信息 */
  async function generateCommitMsg(id: string): Promise<{ message: string; source: "ai" | "heuristic" }> {
    const project = projects.value.find(p => p.id === id)
    if (!project) return { message: "chore: update files", source: "heuristic" }
    return manager.generateCommitMessage(project.path)
  }

  /** 分类操作 */
  async function loadCategories() {
    categories.value = await manager.getCategories()
  }

  async function addCategory(name: string, color?: string) {
    const cat = await manager.addCategory(name, color)
    categories.value = [...categories.value, cat]
    return cat
  }

  async function updateCategory(id: string, data: { name?: string; color?: string }) {
    await manager.updateCategory(id, data)
    categories.value = categories.value.map(c => c.id === id ? { ...c, ...data } : c)
  }

  async function deleteCategory(id: string) {
    await manager.deleteCategory(id)
    categories.value = categories.value.filter(c => c.id !== id)
    // 受影响的项目 categoryId 已由 Manager 更新，重载项目
    projects.value = await manager.getProjects()
  }

  async function moveProject(projectId: string, categoryId: string) {
    await manager.moveProject(projectId, categoryId)
    projects.value = projects.value.map(p => p.id === projectId ? { ...p, categoryId } : p)
  }

  async function checkIsGitRepo(path: string) {
    return manager.checkIsGitRepo(path)
  }

  /** 加载保存的 git 并发配置 */
  function loadGitConcurrency() {
    gitConcurrency.value = manager.getGitConcurrency()
  }

  /** 设置并持久化 git 并发上限 */
  async function setGitConcurrency(n: number) {
    await manager.setGitConcurrency(n)
    gitConcurrency.value = n
  }

  async function withProjectPathStash(id: string, fn: (path: string) => Promise<void>) {
    stashLoading.value[id] = true
    try {
      const project = projects.value.find(p => p.id === id)
      if (!project) return
      await fn(project.path)
      await loadStashList(id)
      await loadWorkingTree(id)
    } finally {
      delete stashLoading.value[id]
    }
  }

  async function loadStashList(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    stashEntries.value[id] = await manager.stashList(project.path)
  }

  async function doStashSave(id: string, message?: string) {
    await withProjectPathStash(id, (path) => manager.stashSave(path, message))
  }

  async function doStashPop(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashPop(path, index))
  }

  async function doStashApply(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashApply(path, index))
  }

  async function doStashDrop(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashDrop(path, index))
  }

  async function generateStashDesc(id: string): Promise<string> {
    const project = projects.value.find(p => p.id === id)
    if (!project) return ""
    return manager.generateStashDescription(project.path)
  }

  /** 添加远程仓库并刷新状态 */
  async function addRemoteOp(id: string, name: string, url: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.addRemote(project.path, name, url)
    await refreshRemotes(id)
    await loadPushStatus(id)
  }

  /** 删除远程仓库并刷新状态 */
  async function removeRemoteOp(id: string, name: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.removeRemote(project.path, name)
    await refreshRemotes(id)
    await loadPushStatus(id)
  }

  /** 扫描指定目录下的所有 Git 仓库 */
  async function startScan(dirPath: string) {
    scanning.value = true
    scanResults.value = []
    try {
      const repos = await manager.scanForGitRepos(dirPath)
      const existingPaths = new Set(
        projects.value.map(p => p.path.replace(/\\/g, "/").replace(/\/+$/, ""))
      )
      scanResults.value = repos.map(repo => ({
        ...repo,
        alreadyImported: existingPaths.has(
          repo.path.replace(/\\/g, "/").replace(/\/+$/, "")
        ),
      }))
    } finally {
      scanning.value = false
    }
  }

  /** 导入选中的扫描结果 */
  async function importScanResults(selectedPaths: string[], categoryId: string) {
    for (const repo of scanResults.value) {
      if (!selectedPaths.includes(repo.path) || repo.alreadyImported) continue
      await addProject(repo.name, repo.path, categoryId)
    }
  }

  return {
    projects,
    categories,
    groupedProjects,
    loading,
    pushingRemote,
    isPushing,
    pushOutputs,
    pullingRemote,
    isPulling,
    pullOutputs,
    pushStatuses,
    workingTrees,
    fileDiffs,
    committing,
    commitLogs,
    branches,
    loadProjects,
    loadPushStatus,
    loadWorkingTree,
    loadFileDiff,
    loadCommitLog,
    loadBranches,
    switchBranch,
    stageItem,
    stageAllItems,
    unstageItem,
    unstageAllItems,
    discardFile,
    doCommit,
    generateCommitMsg,
    addProject,
    removeProject,
    refreshRemotes,
    pushToAll,
    pushSingle,
    pullToAll,
    pullSingle,
    checkIsGitRepo,
    startScan,
    importScanResults,
    scanning,
    scanResults,
    scanDirInput,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    moveProject,
    gitConcurrency,
    loadGitConcurrency,
    setGitConcurrency,
    stashEntries,
    stashLoading,
    loadStashList,
    doStashSave,
    doStashPop,
    doStashApply,
    doStashDrop,
    generateStashDesc,
    addRemoteOp,
    removeRemoteOp,
    // 统计视图数据
    projectCount,
    remoteCoverage,
    pushStatusStats,
    needsPushProjects,
    uncommittedProjects,
    recentCommits,
  }
}
