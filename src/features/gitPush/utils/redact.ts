// 敏感信息脱敏：git 错误可能回显带凭据的远程 URL，展示/复制前统一去掉 userinfo
const URL_USERINFO_RE = /([a-z][a-z0-9+.-]*:\/\/)([^/\s"'<>@]+)@/gi

/**
 * 把 `scheme://user[:password]@host` 的 userinfo 替换为 ***，保留主机与路径。
 * 只处理带 scheme 的 URL：scp 风格 `git@host:path` 与普通邮箱不受影响。
 */
export function redactUrlCredentials(text: string): string {
  return text.replace(URL_USERINFO_RE, "$1***@")
}
