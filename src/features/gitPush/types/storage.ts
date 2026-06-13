import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 项目映射条目 */
export interface GitProject {
  /** 唯一标识（时间戳生成） */
  id: string
  /** 项目名称 */
  name: string
  /** 项目绝对路径 */
  path: string
  /** 分类 ID（默认 "__ungrouped__"） */
  categoryId: string
  /** GitHub 远程名称（自动检测） */
  githubRemote?: string
  /** GitHub 远程 URL */
  githubUrl?: string
  /** Gitee 远程名称（自动检测） */
  giteeRemote?: string
  /** Gitee 远程 URL */
  giteeUrl?: string
  /** Gitea 远程名称（自建实例，自动检测） */
  giteaRemote?: string
  /** Gitea 远程 URL */
  giteaUrl?: string
  /** 添加时间 */
  addedAt: number
}

/** 项目分类 */
export interface ProjectCategory {
  id: string
  name: string
  color: string
  order: number
}

/** GitHub/Gitee/Gitea 远程信息 */
export interface GitRemoteInfo {
  /** 远程名称（如 origin, github, gitee） */
  name: string
  /** 远程 URL */
  url: string
  /** 是否是 GitHub */
  isGithub: boolean
  /** 是否是 Gitee */
  isGitee: boolean
  /** 是否是 Gitea（自建 Git 服务） */
  isGitea: boolean
}

/** 单个远程的推送状态 */
export interface RemotePushStatus {
  /** 本地超前远程的提交数（需要推送） */
  ahead: number
  /** 本地落后远程的提交数（需要拉取） */
  behind: number
  /** 远程分支是否不存在（尚未推送过） */
  noUpstream: boolean
  /** 错误信息（如命令执行失败） */
  error?: string
}

/** 项目推送状态汇总 */
export interface PushStatusInfo {
  /** 当前分支名 */
  branch: string
  /** 各远程推送状态（key 为远程名，如 github/gitee） */
  remotes: Record<string, RemotePushStatus>
  /** 是否有任何远程需要推送（ahead > 0 或 noUpstream） */
  needsPush: boolean
}

/** Conventional Commit 类型常量（单一数据源） */
export const COMMIT_TYPE_VALUES = ["feat", "fix", "chore", "docs", "style", "refactor", "test"] as const
export type CommitType = typeof COMMIT_TYPE_VALUES[number]

/** 文件变更状态 */
export type FileChangeStatus = "modified" | "added" | "deleted" | "renamed" | "untracked" | "copied" | "unmerged"

/** 工作区单个文件变更 */
export interface FileChange {
  /** 文件路径（相对仓库根目录） */
  path: string
  /** 变更类型 */
  status: FileChangeStatus
  /** 是否已在暂存区（index） */
  staged: boolean
  /** 重命名前的路径（仅 status=renamed 时） */
  oldPath?: string
}

/** 工作区状态汇总 */
export interface WorkingTreeInfo {
  /** 当前分支 */
  branch: string
  /** 全部变更文件列表 */
  files: FileChange[]
  /** 已暂存文件数 */
  stagedCount: number
  /** 未暂存文件数 */
  unstagedCount: number
  /** 未跟踪文件数 */
  untrackedCount: number
  /** 是否有任何变更 */
  hasChanges: boolean
}

/** 提交历史单条记录 */
export interface CommitLogEntry {
  /** 短 hash（7 位） */
  hash: string
  /** 提交信息 */
  message: string
  /** 作者 */
  author: string
  /** 相对时间（如 "3 hours ago"） */
  relativeDate: string
  /** 绝对时间（ISO 格式） */
  date: string
}

/** 分支信息 */
export interface BranchInfo {
  /** 分支名（短名称） */
  name: string
  /** 是否为当前分支 */
  current: boolean
}

/** 扫描到的 Git 仓库 */
export interface ScannedGitRepo {
  /** 目录名（用作项目名） */
  name: string
  /** 完整路径 */
  path: string
}

const DEFAULT_PROJECTS: GitProject[] = []

const DEFAULT_UNGROUPED: ProjectCategory = { id: "__ungrouped__", name: "未分组", color: "#888888", order: 0 }

export class GitPushStorage {
  readonly projects: TypedStorage<GitProject[]>
  readonly categories: TypedStorage<ProjectCategory[]>
  readonly gitConcurrency: TypedStorage<number>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.projects = new TypedStorage(storage, "git-push-projects", DEFAULT_PROJECTS)
    this.categories = new TypedStorage(storage, "git-push-categories", [DEFAULT_UNGROUPED])
    this.gitConcurrency = new TypedStorage(storage, "git-push-concurrency", 3)
  }

  async init(): Promise<void> {
    await this.projects.loadOrDefault()
    const cats = await this.categories.loadOrDefault()
    // 确保默认分类始终存在
    if (!cats.some(c => c.id === "__ungrouped__")) {
      cats.unshift(DEFAULT_UNGROUPED)
      await this.categories.save(cats)
    }
    // 将旧项目（无 categoryId）迁移到未分组
    const projs = await this.projects.loadOrDefault()
    let needsSave = false
    for (const p of projs) {
      if (!p.categoryId) {
        p.categoryId = "__ungrouped__"
        needsSave = true
      }
    }
    if (needsSave) await this.projects.save(projs)
  }
}
