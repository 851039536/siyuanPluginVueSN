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

/** 项目已配置的远程（平台 key + git 远程名）——供 orderRemotesForPullCheck 等复用同一形状 */
export interface ProjectRemoteName {
  key: PlatformKey
  name: string
}

/** 获取项目已配置的远程名称列表（消除 4 处 for PLATFORM_META + project[pm.remoteProp] 重复模式） */
export function getProjectRemoteNames(project: GitProject): ProjectRemoteName[] {
  const result: ProjectRemoteName[] = []
  for (const pm of PLATFORM_META) {
    const name = project[pm.remoteProp] as string | undefined
    if (name) { result.push({ key: pm.key, name }) }
  }
  return result
}

/**
 * 「需拉取」检查用的远程优先级（数字越小越先尝试）。
 *
 * ⚠️ 用 `Record<PlatformKey, number>` 而非数组：新增平台时 TypeScript 会强制补上优先级，
 * 避免「漏配 → 静默排到最后」的隐性行为变化。
 */
const PULL_CHECK_RANK: Record<PlatformKey, number> = {
  gitee: 0,
  cnb: 1,
  github: 2,
  gitea: 3,
}

/** 平台优先级列表（由 PULL_CHECK_RANK 派生，保证与平台集合同步） */
export const PULL_CHECK_REMOTE_ORDER: PlatformKey[] = (Object.keys(PULL_CHECK_RANK) as PlatformKey[])
  .sort((a, b) => PULL_CHECK_RANK[a] - PULL_CHECK_RANK[b])

/**
 * 按 `PULL_CHECK_REMOTE_ORDER` 排序项目已配置的远程。
 *
 * 短路语义（用户明确定义，勿按直觉改）：
 *   - 某平台确认「**需拉取**」(behind > 0) ⇒ **继续**检查后续平台（镜像可能有独有提交，不能停）；
 *   - 某平台确认「**无需拉取**」(behind === 0) ⇒ **跳过**后续平台（已是最新，省网络往返）；
 *   - fetch 失败 ⇒ 视为「未知」，继续下一个平台（不能因 gitea 失效就放弃 github 的判定）。
 *
 * 顺序依据：gitee（国内直连/SSH 快）→ cnb → github → gitea（自建域名最易失效）。
 * ⚠️ 与 PLATFORM_META 的顺序无关：后者是 UI 展示顺序，这里是网络探测顺序。
 */
export function orderRemotesForPullCheck(project: GitProject): ProjectRemoteName[] {
  const rank = (key: PlatformKey): number => PULL_CHECK_RANK[key] ?? PULL_CHECK_REMOTE_ORDER.length
  return getProjectRemoteNames(project).sort((a, b) => rank(a.key) - rank(b.key))
}

/** 平台 key → 展示名（缺失/未识别时回落为 key 原文）。
 * 消除 ProjectCard / useRemoteProgress / PendingProjectsSection 等多处
 * `PLATFORM_META.find(pm => pm.key === key)?.label ?? key` 的重复写法。 */
export function platformLabel(key: string): string {
  return PLATFORM_META.find((pm) => pm.key === key)?.label ?? key
}

/** 是否存在待推送的本地提交（noUpstream 场景下 ahead 已由 checkPushStatus 填为本地提交总数） */
export function hasUnpushedCommits(rs: RemotePushStatus): boolean {
  return rs.ahead > 0
}

/**
 * 是否可能仍有内容需要推送：远程分支尚未建立时也放行尝试。
 * ⚠️ 与 hasUnpushedCommits 的分工：本判据用于「允许尝试 / 是否跳过」，空仓库（ahead=0 且 noUpstream）
 * 仍可能因 ahead 计数失败而需要一次真实尝试，故不能只看 ahead；计数展示一律用 hasUnpushedCommits。
 */
export function mayAttemptPush(rs: RemotePushStatus): boolean {
  return rs.noUpstream || hasUnpushedCommits(rs)
}
