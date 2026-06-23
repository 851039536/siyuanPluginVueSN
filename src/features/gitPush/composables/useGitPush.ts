import type {
  BranchInfo,
  CommitLogEntry,
  CommitTemplate,
  ConflictFile,
  GitProject,
  GitPushManager,
  PlatformKey,
  ProjectCategory,
  PushStatusInfo,
  ScannedGitRepo,
  StashEntry,
  TagInfo,
  WorkingTreeInfo,

} from "../types"

import {
  computed,
  ref,
} from "vue"
import { PLATFORM_META } from "../types"

export function useGitPush(manager: GitPushManager) {
  const projects = ref<GitProject[]>([])
  const categories = ref<ProjectCategory[]>([])
  const loading = ref(false)
  /** 正在推送的项目 id → platformKey|"all" */
  const pushingRemote = ref<Record<string, string>>({})
  const pushOutputs = ref<Record<string, string>>({})
  /** 正在拉取的项目 id → platformKey|"all" */
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

  /** 全局标签缓存（所有项目 tags 去重并集，用于筛选条与输入建议） */
  const allTags = ref<string[]>([])

  /** Stash 条目缓存 id → StashEntry[] */
  const stashEntries = ref<Record<string, StashEntry[]>>({})
  /** Stash 操作加载中 id → true */
  const stashLoading = ref<Record<string, boolean>>({})
  /** Tag 列表缓存 id → TagInfo[] */
  const tagsCache = ref<Record<string, TagInfo[]>>({})
  /** Tag 操作加载中 id → true */
  const tagLoading = ref<Record<string, boolean>>({})
  /** 冲突状态 id → ConflictFile[] */
  const conflicts = ref<Record<string, ConflictFile[]>>({})
  /** 提交信息模板 */
  const commitTemplates = ref<CommitTemplate[]>([])

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => {
    const map = new Map<string, { category: ProjectCategory, projects: GitProject[] }>()
    // 初始化所有分类
    for (const cat of categories.value) {
      map.set(cat.id, {
        category: cat,
        projects: [],
      })
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
      .filter((g) => g.projects.length > 0)
      .sort((a, b) => a.category.order - b.category.order)
  })

  // ── 统计视图 computed ──

  /** 项目总数 */
  const projectCount = computed(() => projects.value.length)

  /** 远程仓库覆盖率统计 */
  const remoteCoverage = computed(() => {
    const total = projects.value.length
    if (total === 0) { return {
      total: 0,
      github: 0,
      gitee: 0,
      gitea: 0,
      cnb: 0,
      hasRemote: 0,
      noRemote: 0,
      multiple: 0,
    }
    }
    let github = 0; let gitee = 0; let gitea = 0; let cnb = 0; let hasRemote = 0; let multiple = 0
    for (const p of projects.value) {
      const remotes = [p.githubUrl, p.giteeUrl, p.giteaUrl, p.cnbUrl].filter(Boolean).length
      if (p.githubUrl) github++
      if (p.giteeUrl) gitee++
      if (p.giteaUrl) gitea++
      if (p.cnbUrl) cnb++
      if (remotes > 0) hasRemote++
      if (remotes >= 2) multiple++
    }
    return {
      total,
      github,
      gitee,
      gitea,
      cnb,
      hasRemote,
      noRemote: total - hasRemote,
      multiple,
    }
  })

  /** 推送状态分布统计 */
  const pushStatusStats = computed(() => {
    const total = projects.value.length
    if (total === 0) { return {
      total: 0,
      ahead: 0,
      behind: 0,
      synced: 0,
      noRemote: 0,
    }
    }
    let ahead = 0; let behind = 0; let synced = 0; let noRemote = 0
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status || Object.keys(status.remotes).length === 0) {
        noRemote++
        continue
      }
      const remotes = Object.values(status.remotes)
      if (remotes.some((r) => r.ahead > 0)) {
        ahead++
      } else if (remotes.some((r) => r.behind > 0)) {
        behind++
      } else {
        synced++
      }
    }
    return {
      total,
      ahead,
      behind,
      synced,
      noRemote,
    }
  })

  /** 需要推送的项目列表（按 ahead 降序） */
  const needsPushProjects = computed(() => {
    const result: { project: GitProject, aheadByRemote: { key: string, ahead: number }[], totalAhead: number }[] = []
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status) continue
      const aheadByRemote: { key: string, ahead: number }[] = []
      for (const pm of PLATFORM_META) {
        const rs = status.remotes[pm.key]
        if (rs && rs.ahead > 0) {
          aheadByRemote.push({
            key: pm.key,
            ahead: rs.ahead,
          })
        }
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
      .filter((p) => workingTrees.value[p.id]?.hasChanges)
      .map((p) => ({
        project: p,
        staged: workingTrees.value[p.id]!.stagedCount,
        unstaged: workingTrees.value[p.id]!.unstagedCount,
        untracked: workingTrees.value[p.id]!.untrackedCount,
      }))
  })

  /**
   * 平台配置状态明细（每个项目的各平台是否已配置）
   *  包含所有「至少缺失一个平台」的项目，按 missingCount 降序排列
   */
  interface PlatformStatusItem {
    project: GitProject
    github: boolean
    gitee: boolean
    gitea: boolean
    cnb: boolean
    missingCount: number
  }
  const platformStatusProjects = computed<PlatformStatusItem[]>(() => {
    const result: PlatformStatusItem[] = []
    for (const p of projects.value) {
      const github = !!p.githubUrl
      const gitee = !!p.giteeUrl
      const gitea = !!p.giteaUrl
      const cnb = !!p.cnbUrl
      const missingCount = (github ? 0 : 1) + (gitee ? 0 : 1) + (gitea ? 0 : 1) + (cnb ? 0 : 1)
      if (missingCount > 0) {
        result.push({
          project: p,
          github,
          gitee,
          gitea,
          cnb,
          missingCount,
        })
      }
    }
    return result.sort((a, b) => b.missingCount - a.missingCount)
  })

  /** @deprecated 使用 platformStatusProjects 替代 */
  const noPlatformProjects = computed(() => {
    return platformStatusProjects.value
      .filter((item) => item.missingCount === PLATFORM_META.length)
      .map((item) => item.project)
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

  /** 收藏项目列表 */
  const starredProjects = computed(() => projects.value.filter((p) => p.starred))

  /** 归档项目列表 */
  const archivedProjects = computed(() => projects.value.filter((p) => p.archived))

  /** 标签使用统计：tag → 项目数（按计数降序） */
  const tagStats = computed<{ tag: string, count: number }[]>(() => {
    const map = new Map<string, number>()
    for (const p of projects.value) {
      if (!p.archived && p.tags) {
        for (const t of p.tags) { if (t) map.set(t, (map.get(t) || 0) + 1)
        }
      }
    }
    return [...map.entries()].map(([tag, count]) => ({
      tag,
      count,
    })).sort((a, b) => b.count - a.count)
  })

  /** 状态分布统计：status → 项目数 */
  const statusStats = computed(() => {
    const result = {
      active: 0,
      maintenance: 0,
      paused: 0,
    }
    for (const p of projects.value) {
      if (p.archived) continue
      const s = p.status || "active"
      if (s === "maintenance") result.maintenance++
      else if (s === "paused") result.paused++
      else result.active++
    }
    return result
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
      allTags.value = await manager.getAllTags()
    } finally {
      loading.value = false
    }
  }

  /** 规范化路径用于去重比较（统一斜杠 + 去除末尾斜杠 + 小写） */
  function normalizePathForDedup(p: string): string {
    return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
  }

  async function addProject(name: string, path: string, categoryId = "__ungrouped__", tags?: string[]) {
    // 检查重复：按规范化路径比对
    const normalized = normalizePathForDedup(path)
    const dup = projects.value.find((p) => normalizePathForDedup(p.path) === normalized)
    if (dup) {
      throw new Error(`项目路径已存在："${dup.name}"（${dup.path}）`)
    }
    const project = await manager.addProject(name, path, categoryId, tags)
    projects.value = [...projects.value, project]
    if (tags && tags.length > 0) allTags.value = await manager.getAllTags()
    return project
  }

  async function removeProject(id: string) {
    await manager.removeProject(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    allTags.value = await manager.getAllTags()
  }

  async function refreshRemotes(id: string) {
    const updated = await manager.refreshRemotes(id)
    if (updated) {
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        projects.value[idx] = updated
        projects.value = [...projects.value]
      }
    }
    return updated
  }

  /** 本地更新单个项目并触发响应式 */
  function patchProject(id: string, patch: Partial<GitProject>) {
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx === -1) return
    projects.value[idx] = {
      ...projects.value[idx],
      ...patch,
    }
    projects.value = [...projects.value]
  }

  /** 更新项目元信息（名称/标签/状态/收藏/归档/备注） */
  async function updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "name" | "tags" | "starred" | "status" | "archived" | "note" | "githubUrl" | "giteeUrl" | "giteaUrl">>) {
    const updated = await manager.updateProjectMeta(id, patch)
    if (updated) {
      patchProject(id, patch)
      if (patch.tags !== undefined) allTags.value = await manager.getAllTags()
    }
    return updated
  }

  /** 切换收藏（高频操作，即时反馈） */
  async function toggleStar(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    // 乐观更新：先改本地再持久化
    patchProject(id, { starred: !project.starred })
    await manager.toggleStar(id)
  }

  /** 设置项目状态徽章 */
  async function setProjectStatus(id: string, status: GitProject["status"]) {
    if (!status) return
    patchProject(id, { status })
    await manager.setProjectStatus(id, status)
  }

  /** 添加标签 */
  async function appendTag(id: string, tag: string) {
    const updated = await manager.appendTag(id, tag)
    if (updated) {
      patchProject(id, { tags: updated.tags })
      allTags.value = await manager.getAllTags()
    }
    return updated
  }

  /** 移除标签 */
  async function removeTag(id: string, tag: string) {
    const updated = await manager.removeTag(id, tag)
    if (updated) {
      patchProject(id, { tags: updated.tags })
      allTags.value = await manager.getAllTags()
    }
    return updated
  }

  /** 格式化 Git 操作输出文本（推送/拉取共用） */
  function formatGitOutput(
    target: Record<string, string>,
    id: string,
    opName: string,
    entries: { label: string, ok: boolean, stdout: string, stderr: string }[],
  ) {
    const lines: string[] = []
    for (const e of entries) {
      lines.push(`[${e.label}] ${e.ok ? `${opName}成功` : `${opName}失败`}`)
      if (e.stdout) lines.push(e.stdout)
      if (e.stderr) lines.push(`错误: ${e.stderr}`)
    }
    target[id] = lines.join("\n")
  }

  /** 从 target 字符串获取平台标签 */
  function platformLabel(target: string): string {
    return PLATFORM_META.find((pm) => pm.key === target)?.label ?? "Gitea"
  }

  /** 将 pushToAll/pullToAll 返回的 result 对象转为格式化 entries 数组（过滤跳过项） */
  function resultToEntries(result: { [key: string]: any }) {
    return PLATFORM_META
      .filter((pm) => (result[pm.key] as any)?.skipped !== true)
      .map((pm) => ({
        label: pm.label,
        ok: result[pm.key]?.ok ?? false,
        stdout: result[pm.key]?.stdout ?? "",
        stderr: result[pm.key]?.stderr ?? "",
      }))
  }

  async function pushToAll(id: string) {
    pushingRemote.value[id] = "all"
    try {
      const result = await manager.pushToAll(id)
      formatGitOutput(pushOutputs.value, id, "推送", resultToEntries(result))
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pushSingle(id: string, target: PlatformKey) {
    pushingRemote.value[id] = target
    try {
      const result = await manager.pushSingle(id, target)
      formatGitOutput(pushOutputs.value, id, "推送", [{
        label: platformLabel(target),
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
      }])
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pullToAll(id: string) {
    pullingRemote.value[id] = "all"
    try {
      const result = await manager.pullToAll(id)
      formatGitOutput(pullOutputs.value, id, "拉取", resultToEntries(result))
      loadPushStatus(id)
      checkConflicts(id) // 异步检测冲突
      return result
    } finally {
      delete pullingRemote.value[id]
    }
  }

  async function pullSingle(id: string, target: PlatformKey) {
    pullingRemote.value[id] = target
    try {
      const result = await manager.pullSingle(id, target)
      formatGitOutput(pullOutputs.value, id, "拉取", [{
        label: platformLabel(target),
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
      }])
      loadPushStatus(id)
      checkConflicts(id) // 异步检测冲突
      return result
    } finally {
      delete pullingRemote.value[id]
    }
  }

  /**
   * 加载推送状态
   * @param opts.branch 当前分支名，传入后节省一次 rev-parse（批量统计场景复用）
   */
  async function loadPushStatus(id: string, opts?: { branch?: string }) {
    pushStatuses.value[id] = await manager.checkPushStatus(id, opts ? { branch: opts.branch } : undefined)
  }

  /**
   * 加载工作区状态
   *  @param skipRefresh 跳过 update-index --refresh（首屏/批量探测时传 true 提速；
   *                    stage/commit 等改写 index 的操作后刷新走默认 false，确保读准）
   *  @param branch 当前分支名，传入后节省一次 rev-parse
   */
  async function loadWorkingTree(id: string, skipRefresh = false, branch?: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    workingTrees.value[id] = await manager.getWorkingTreeStatus(project.path, {
      skipRefresh,
      branch,
    })
  }

  /**
   * 加载统计视图所需数据（pushStatus + workingTree）。
   * 共用一次 rev-parse 获取分支名，避免 loadPushStatus 和 loadWorkingTree 各调一次。
   * 专供统计视图批量探测使用。
   */
  async function loadStatsData(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return

    const branch = await manager.getBranch(project.path)
    if (!branch) return

    await Promise.all([
      pushStatuses.value[id] ? Promise.resolve() : loadPushStatus(id, { branch }),
      workingTrees.value[id] ? Promise.resolve() : loadWorkingTree(id, true, branch),
    ])
  }

  /** 加载单个文件差异 */
  async function loadFileDiff(id: string, file: string, staged: boolean) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return ""
    const key = `${id}::${staged ? "s" : "u"}::${file}`
    const diff = await manager.getFileDiff(project.path, file, staged)
    fileDiffs.value[key] = diff
    return diff
  }

  /** 加载分支提交日志；同时把最近提交时间持久化为 lastActivity（首屏可直接读取展示） */
  async function loadCommitLog(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    const entries = await manager.getCommitLog(project.path)
    commitLogs.value[id] = entries
    // 最近提交时间变化时异步持久化（不阻塞、不 await），更新本地缓存即时反映
    const latest = entries[0]?.date
    if (latest && project.lastActivity !== latest) {
      project.lastActivity = latest
      projects.value = [...projects.value]
      manager.recordLastActivity(id, latest).catch(() => {})
    }
  }

  /** 加载分支列表 */
  async function loadBranches(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    branches.value[id] = await manager.getBranches(project.path)
  }

  /** 切换分支 */
  async function switchBranch(id: string, branch: string) {
    const project = projects.value.find((p) => p.id === id)
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
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    await fn(project.path)
    await loadWorkingTree(id)
  }

  /** 暂存单个文件 */
  async function stageItem(id: string, file: string) {
    console.log(`[gitPush:stageItem] id=${id} file=${file}`)
    await withProjectPath(id, (path) => manager.stageFile(path, file))
    console.log(`[gitPush:stageItem] 完成, files=`, workingTrees.value[id]?.files.map((f) => `${f.path}(${f.staged ? "S" : "U"})`))
  }

  /** 暂存全部 */
  async function stageAllItems(id: string) {
    await withProjectPath(id, (path) => manager.stageAll(path))
  }

  /** 取消暂存单个文件 */
  async function unstageItem(id: string, file: string) {
    console.log(`[gitPush:unstageItem] id=${id} file=${file}`)
    await withProjectPath(id, (path) => manager.unstageFile(path, file))
    console.log(`[gitPush:unstageItem] 完成, files=`, workingTrees.value[id]?.files.map((f) => `${f.path}(${f.staged ? "S" : "U"})`))
  }

  /** 取消全部暂存 */
  async function unstageAllItems(id: string) {
    await withProjectPath(id, (path) => manager.unstageAll(path))
  }

  /** 丢弃单个文件的更改 */
  async function discardFile(id: string, file: string, staged: boolean, status: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.discardFile(project.path, file, staged, status)
  }

  /** 提交 */
  async function doCommit(id: string, message: string): Promise<string> {
    const project = projects.value.find((p) => p.id === id)
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
  async function generateCommitMsg(id: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    const project = projects.value.find((p) => p.id === id)
    if (!project) { return {
      message: "chore: update files",
      source: "heuristic",
    }
    }
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

  async function updateCategory(id: string, data: { name?: string, color?: string }) {
    await manager.updateCategory(id, data)
    categories.value = categories.value.map((c) => c.id === id
      ? {
          ...c,
          ...data,
        }
      : c)
  }

  async function deleteCategory(id: string) {
    await manager.deleteCategory(id)
    categories.value = categories.value.filter((c) => c.id !== id)
    // 受影响的项目 categoryId 已由 Manager 更新，重载项目
    projects.value = await manager.getProjects()
  }

  async function moveProject(projectId: string, categoryId: string) {
    await manager.moveProject(projectId, categoryId)
    projects.value = projects.value.map((p) => p.id === projectId
      ? {
          ...p,
          categoryId,
        }
      : p)
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
      const project = projects.value.find((p) => p.id === id)
      if (!project) return
      await fn(project.path)
      await loadStashList(id)
      await loadWorkingTree(id)
    } finally {
      delete stashLoading.value[id]
    }
  }

  async function loadStashList(id: string) {
    const project = projects.value.find((p) => p.id === id)
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
    const project = projects.value.find((p) => p.id === id)
    if (!project) return ""
    return manager.generateStashDescription(project.path)
  }

  // ── Tag 管理 ──

  /** 加载 Tag 列表 */
  async function loadTags(id: string): Promise<TagInfo[]> {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return []
    const list = await manager.getTags(project.path)
    tagsCache.value = {
      ...tagsCache.value,
      [id]: list,
    }
    return list
  }

  /** 创建 Tag */
  async function createTagOp(id: string, name: string, message?: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.createTag(project.path, name, message)
  }

  /** 删除 Tag */
  async function deleteTagOp(id: string, name: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.deleteTag(project.path, name)
  }

  /** 推送 Tag 到远程 */
  async function pushTagOp(id: string, remoteName: string, tag: string): Promise<string> {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    return manager.pushTag(project.path, remoteName, tag)
  }

  // ── 冲突检测 ──

  /** 检查项目是否有冲突 */
  async function checkConflicts(id: string): Promise<ConflictFile[]> {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return []
    const files = await manager.getConflictFiles(project.path)
    conflicts.value = {
      ...conflicts.value,
      [id]: files,
    }
    return files
  }

  /** 中止合并 */
  async function abortMergeOp(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.abortMerge(project.path)
    delete conflicts.value[id]
    conflicts.value = { ...conflicts.value }
  }

  /** 解决单个冲突文件 */
  async function resolveConflictOp(id: string, file: string, strategy: "theirs" | "ours") {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.resolveConflictFile(project.path, file, strategy)
  }

  // ── 提交信息模板 ──

  /** 加载提交信息模板 */
  async function loadCommitTemplates() {
    commitTemplates.value = await manager.getCommitTemplates()
  }

  /** 保存提交信息模板 */
  async function saveCommitTemplates(templates: CommitTemplate[]) {
    await manager.saveCommitTemplates(templates)
    commitTemplates.value = templates
  }

  /**
   * 根据模板填充提交信息
   * @param template 模板（pattern 支持 {branch}/files 占位符）
   * @param branch 当前分支名
   * @param fileCount 变更文件数
   */
  function fillTemplate(template: CommitTemplate, branch: string, fileCount: number): string {
    return template.pattern
      .replace(/\{branch\}/g, branch)
      .replace(/\{files\}/g, String(fileCount))
  }

  /** 添加远程仓库并刷新状态 */
  async function addRemoteOp(id: string, name: string, url: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.addRemote(project.path, name, url)
    await refreshRemotes(id)
    await loadPushStatus(id)
  }

  /** 删除远程仓库并刷新状态 */
  async function removeRemoteOp(id: string, name: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.removeRemote(project.path, name)
    await refreshRemotes(id)
    await loadPushStatus(id)
  }

  /** 编辑远程仓库 URL 并刷新状态 */
  async function editRemoteOp(id: string, name: string, url: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) throw new Error("项目未找到")
    await manager.setRemoteUrl(project.path, name, url)
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
        projects.value.map((p) => p.path.replace(/\\/g, "/").replace(/\/+$/, "")),
      )
      scanResults.value = repos.map((repo) => ({
        ...repo,
        alreadyImported: existingPaths.has(
          repo.path.replace(/\\/g, "/").replace(/\/+$/, ""),
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
      try {
        await addProject(repo.name, repo.path, categoryId)
      } catch (e: any) {
        console.warn(`[gitPush] 跳过重复项目: ${repo.path} — ${e?.message || e}`)
      }
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
    loadStatsData,
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
    editRemoteOp,
    // Tag 管理
    tagsCache,
    tagLoading,
    loadTags,
    createTagOp,
    deleteTagOp,
    pushTagOp,
    // 冲突检测
    conflicts,
    checkConflicts,
    abortMergeOp,
    resolveConflictOp,
    // 提交信息模板
    commitTemplates,
    loadCommitTemplates,
    saveCommitTemplates,
    fillTemplate,
    // 统计视图数据
    projectCount,
    remoteCoverage,
    pushStatusStats,
    needsPushProjects,
    uncommittedProjects,
    noPlatformProjects,
    platformStatusProjects,
    recentCommits,
    // 项目聚合管理
    allTags,
    starredProjects,
    archivedProjects,
    tagStats,
    statusStats,
    updateProjectMeta,
    toggleStar,
    setProjectStatus,
    appendTag,
    removeTag,
  }
}
