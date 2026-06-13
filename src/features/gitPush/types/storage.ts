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
  /** GitHub 远程名称（自动检测） */
  githubRemote?: string
  /** Gitee 远程名称（自动检测） */
  giteeRemote?: string
  /** Gitea 远程名称（自建实例，自动检测） */
  giteaRemote?: string
  /** 添加时间 */
  addedAt: number
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

const DEFAULT_PROJECTS: GitProject[] = []

export class GitPushStorage {
  readonly projects: TypedStorage<GitProject[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.projects = new TypedStorage(storage, "git-push-projects", DEFAULT_PROJECTS)
  }

  async init(): Promise<void> {
    // loadOrDefault() 内置：数据缺失 → 回退默认值；非数组 → 打印警告并回退
    await this.projects.loadOrDefault()
  }
}
