// gitPush 平台与远程仓库辅助（平台标志映射、远程识别、URL 归一化、推送需求判定）
import type { GitProject, GitRemoteInfo, RemotePushStatus } from "../types/storage"
// PlatformKey 与 PLATFORM_META 同属 meta.ts；直连纯模块（不经过 "../types" 桶）：
// 桶里的 `export { GitPushManager }` 是值导出，会把 "siyuan" 运行时依赖拉进 Node 单测环境
import type { PlatformKey } from "../types/meta"
import { PLATFORM_META } from "../types/meta"

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

/**
 * 「需拉取」检查用的远程尝试顺序（按国内可用性从高到低）。
 *
 * 为什么需要固定顺序：同一项目常配置 3~4 个远程，但**多数平台是镜像**（同一份提交推到多个平台），
 * 只需其中一个能看到新提交即可判定 behind。按此顺序逐个 fetch，一旦某个远程确认「远程有更新」
 * 就停止后续 fetch，可显著减少网络往返（实测本项目 github 8s、gitee 2.3s、cnb 1.2s、gitea 已失效）。
 *
 * 顺序依据：gitee（国内直连/SSH 快）→ cnb → github → gitea（自建域名最易失效）。
 * ⚠️ 与 PLATFORM_META 的顺序无关：后者是 UI 展示顺序，这里是网络探测顺序，两者用途不同。
 */
export const PULL_CHECK_REMOTE_ORDER: PlatformKey[] = ["gitee", "cnb", "github", "gitea"]

/**
 * 按 `PULL_CHECK_REMOTE_ORDER` 排序项目已配置的远程（未列入顺序表的平台排最后，保持稳定）。
 * 供「需拉取」检查做「短路 fetch」用。
 */
export function orderRemotesForPullCheck(project: GitProject): { key: PlatformKey, name: string }[] {
  const all = getProjectRemoteNames(project)
  const rank = (key: PlatformKey): number => {
    const i = PULL_CHECK_REMOTE_ORDER.indexOf(key)
    return i < 0 ? PULL_CHECK_REMOTE_ORDER.length : i
  }
  return [...all].sort((a, b) => rank(a.key) - rank(b.key))
}

/** 平台 key → 展示名（缺失/未识别时回落为 key 原文）。
 * 消除 ProjectCard / useRemoteProgress / PendingProjectsSection 等多处
 * `PLATFORM_META.find(pm => pm.key === key)?.label ?? key` 的重复写法。 */
export function platformLabel(key: string): string {
  return PLATFORM_META.find((pm) => pm.key === key)?.label ?? key
}

/** 判断远程是否需要推送（noUpstream 或 ahead > 0，消除多处 .noUpstream || .ahead > 0 重复） */
export function isAheadOfRemote(rs: RemotePushStatus): boolean {
  return rs.noUpstream || rs.ahead > 0
}
