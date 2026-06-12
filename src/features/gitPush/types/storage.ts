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
  /** 添加时间 */
  addedAt: number
}

/** GitHub/Gitee 远程信息 */
export interface GitRemoteInfo {
  /** 远程名称（如 origin, github, gitee） */
  name: string
  /** 远程 URL */
  url: string
  /** 是否是 GitHub */
  isGithub: boolean
  /** 是否是 Gitee */
  isGitee: boolean
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
