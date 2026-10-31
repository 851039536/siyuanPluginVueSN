// 推送账号环境构建（纯函数）：把账号解析为 git 子进程环境变量，不改写任何 .gitconfig
import type { ResolvedPushCredential, ResolvedPushProfile } from "../types/pushProfile"

/** 会访问网络的 git 子命令（认证相关环境只对它们注入，缩小令牌暴露面） */
export const NETWORK_GIT_COMMANDS = new Set(["fetch", "push", "pull", "clone", "ls-remote"])

/** 从 args 中提取实际命令名（跳过 -c/-C 全局参数对与无值前导选项，与 GitExecutor 同口径） */
export function gitCommandName(args: string[]): string {
  let i = 0
  while (i < args.length && (args[i] === "-c" || args[i] === "-C")) {
    i += 2
  }
  while (i < args.length && /^--[^=]+$/.test(args[i])) {
    i++
  }
  return args[i] || ""
}

/** 是否网络类 git 命令 */
export function isNetworkGitCommand(args: string[]): boolean {
  return NETWORK_GIT_COMMANDS.has(gitCommandName(args))
}

/** 主机名（支持单段内网主机与端口；IPv6 不在此列，返回空串表示不接受） */
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$/

/**
 * 归一化并校验令牌作用主机。
 * 接受 `https://github.com/`、`github.com:443`、`gitea.local` 等写法；
 * 去掉协议 / 路径 / 用户信息后校验字符集，非法返回空串（调用方据此提示，绝不生成坏配置键）。
 */
export function normalizePushHost(raw: string): string {
  let s = raw.trim().toLowerCase()
  if (!s) return ""
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
  const at = s.lastIndexOf("@")
  if (at >= 0) s = s.slice(at + 1)
  s = s.replace(/\/.*$/, "")
  return HOST_RE.test(s) ? s : ""
}

/**
 * 路径比较键：统一斜杠、去尾斜杠，Windows 盘符/UNC 路径转小写（大小写不敏感）。
 * 用于「git 子进程 cwd → 项目」的匹配，避免同一目录因写法不同而漏配账号。
 */
export function normalizePathKey(raw: string): string {
  const s = raw.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (!s) return ""
  return /^[a-zA-Z]:\//.test(s) || s.startsWith("//") ? s.toLowerCase() : s
}

/** 令牌 / 用户名不能含换行（会破坏 HTTP 头） */
function isHeaderSafe(value: string): boolean {
  return value.length > 0 && !/[\r\n\0]/.test(value)
}

/** UTF-8 → Base64（Electron 渲染进程无 Buffer，用 btoa 逐字节编码） */
function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/** SSH 命令参数加引号（路径统一正斜杠，Windows OpenSSH 同样接受） */
function quoteSshArg(value: string): string {
  return `"${value.replace(/\\/g, "/").replace(/(["$`])/g, "\\$1")}"`
}

/** 由私钥路径构造 GIT_SSH_COMMAND：禁用交互（无 agent 时快速失败而非挂起）且只用指定密钥 */
export function buildSshCommand(keyPath: string): string {
  return `ssh -i ${quoteSshArg(keyPath)} -o IdentitiesOnly=yes -o BatchMode=yes`
}

/** 按主机去重（后项覆盖前项）并过滤非法凭据 */
function mergeCredentials(credentials: ResolvedPushCredential[]): ResolvedPushCredential[] {
  const byHost = new Map<string, ResolvedPushCredential>()
  for (const c of credentials) {
    const host = normalizePushHost(c.host)
    if (!host || !isHeaderSafe(c.username) || !isHeaderSafe(c.token)) continue
    byHost.set(host, { host, username: c.username, token: c.token })
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host))
}

export interface PushEnvBuildOptions {
  /** Git ≥ 2.31（支持 GIT_CONFIG_COUNT）；false 时令牌凭据被跳过，仅保留提交身份 / SSH */
  configEnvSupported: boolean
}

export interface PushEnvBuildResult {
  env: Record<string, string>
  /** 因 Git 版本过低被跳过的令牌主机（供上层给出可读告警） */
  skippedCredentialHosts: string[]
}

/**
 * 构建 git 子进程的账号环境。
 *
 * 设计取舍：
 * - 提交身份走 GIT_AUTHOR_* / GIT_COMMITTER_*（所有 Git 版本可用，且不改仓库/全局配置）；
 * - HTTPS 令牌走 GIT_CONFIG_COUNT 注入 `http.https://<host>/.extraheader`（令牌只发往该主机，
 *   且**绝不进入 argv**，避免进程列表泄露）；
 * - SSH 私钥走 GIT_SSH_COMMAND（BatchMode 快速失败，IdentitiesOnly 避免误用其它密钥）；
 * - 认证相关变量只对网络命令注入，本地命令（status/log/diff）不携带令牌。
 */
export function buildPushProfileEnv(
  profile: ResolvedPushProfile | null | undefined,
  args: string[],
  options: PushEnvBuildOptions,
): PushEnvBuildResult {
  const env: Record<string, string> = {}
  const skippedCredentialHosts: string[] = []
  if (!profile) return { env, skippedCredentialHosts }

  if (profile.gitName) {
    env.GIT_AUTHOR_NAME = profile.gitName
    env.GIT_COMMITTER_NAME = profile.gitName
  }
  if (profile.gitEmail) {
    env.GIT_AUTHOR_EMAIL = profile.gitEmail
    env.GIT_COMMITTER_EMAIL = profile.gitEmail
  }

  if (!isNetworkGitCommand(args)) return { env, skippedCredentialHosts }

  const credentials = mergeCredentials(profile.credentials)
  if (profile.sshKeyPath.trim()) {
    env.GIT_SSH_COMMAND = buildSshCommand(profile.sshKeyPath.trim())
  }
  if (!profile.sshKeyPath.trim() && credentials.length === 0) {
    return { env, skippedCredentialHosts }
  }
  // 有账号认证时不等待终端输入：无人值守环境下挂起等待密码比直接失败更难排查
  env.GIT_TERMINAL_PROMPT = "0"

  if (credentials.length === 0) return { env, skippedCredentialHosts }
  if (!options.configEnvSupported) {
    skippedCredentialHosts.push(...credentials.map((c) => c.host))
    return { env, skippedCredentialHosts }
  }

  credentials.forEach((c, i) => {
    env[`GIT_CONFIG_KEY_${i}`] = `http.https://${c.host}/.extraheader`
    env[`GIT_CONFIG_VALUE_${i}`] = `Authorization: Basic ${base64Utf8(`${c.username}:${c.token}`)}`
  })
  env.GIT_CONFIG_COUNT = String(credentials.length)
  return { env, skippedCredentialHosts }
}
