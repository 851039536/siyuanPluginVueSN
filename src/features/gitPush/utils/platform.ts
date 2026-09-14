// gitPush 平台与远程仓库辅助（平台标志映射、远程识别、URL 归一化、推送需求判定）
import type { GitProject, GitRemoteInfo, PlatformKey, RemotePushStatus } from "../types"
import { PLATFORM_META } from "../types"

/** 平台 key → GitRemoteInfo 检测标志属性名映射（供 ProjectStore.applyRemotesToProject 等按检测标志匹配复用） */
export const PLATFORM_FLAG_BY_KEY: Record<PlatformKey, "isGithub" | "isGitee" | "isGitea" | "isCnb"> = {
  github: "isGithub",
  gitee: "isGitee",
  gitea: "isGitea",
  cnb: "isCnb",
}

/** 查找指定平台的首个命中远程（远程名等于平台 key，或平台检测标志命中） */
export function findPlatformRemote(remotes: GitRemoteInfo[], key: PlatformKey): GitRemoteInfo | undefined {
  const flagProp = PLATFORM_FLAG_BY_KEY[key]
  return remotes.find((r) => r.name === key || r[flagProp])
}

/**
 * 解析远程对应的平台元数据（按 GitRemoteInfo 检测标志匹配）。
 * 命中时返回 PLATFORM_META 条目（含统一 label/icon），用于让远程列表与仓库链接列表显示一致；
 * origin/upstream 等未识别为平台的自定义远程返回 undefined，由调用方回退显示原始远程名。
 */
export function resolveRemotePlatform(remote: GitRemoteInfo): typeof PLATFORM_META[number] | undefined {
  return PLATFORM_META.find((pm) => remote[PLATFORM_FLAG_BY_KEY[pm.key]])
}

/** 判断指定平台是否已存在于远程列表（远程名等于平台 key，或平台检测标志命中） */
export function hasPlatformRemote(remotes: GitRemoteInfo[], key: PlatformKey): boolean {
  return !!findPlatformRemote(remotes, key)
}

/** 向则项目是否配置了任何远程仓库 */
export function hasAnyRemote(project: GitProject): boolean {
  return PLATFORM_META.some((pm) => !!project[pm.remoteProp])
}

/**
 * 归一化 git 仓库 URL（ssh/https/凭据/.git 后缀统一抹平为 host/path），
 * 两个 URL 归一化后相等即视为指向同一仓库（仓库链接一致性分析用）
 */
export function normalizeGitUrl(url: string): string {
  let s = url.trim().toLowerCase()
  if (!s) { return "" }
  // 剔除协议头（https:// / http:// / ssh:// / git://）
  s = s.replace(/^(?:https?|ssh|git):\/\//, "")
  // scp 短形式 git@host:path → host/path
  s = s.replace(/^([^/@]+@[^/:]+):/, "$1/")
  // 剔除凭据段 user(:pass)@
  s = s.replace(/^[^/@]+@/, "")
  // 去掉尾部 / 与 .git 后缀
  s = s.replace(/\/+$/, "").replace(/\.git$/, "")
  return s
}

/** 获取项目已配置的远程名称列表（消除 4 处 for PLATFORM_META + project[pm.remoteProp] 重复模式） */
export function getProjectRemoteNames(project: GitProject): { key: PlatformKey, name: string }[] {
  const result: { key: PlatformKey, name: string }[] = []
  for (const pm of PLATFORM_META) {
    const name = project[pm.remoteProp] as string | undefined
    if (name) { result.push({ key: pm.key, name }) }
  }
  return result
}

/** 判断远程是否需要推送（noUpstream 或 ahead > 0，消除多处 .noUpstream || .ahead > 0 重复） */
export function isAheadOfRemote(rs: RemotePushStatus): boolean {
  return rs.noUpstream || rs.ahead > 0
}
