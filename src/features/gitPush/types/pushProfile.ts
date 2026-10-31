// 推送账号（多账号认证 + 提交身份覆盖）的类型定义与常量

/**
 * 项目绑定值：强制使用系统 Git 配置（不套用任何账号，也不跟随全局默认）。
 * 空串 / undefined 表示跟随全局默认账号。
 */
export const PUSH_PROFILE_SYSTEM_ID = "__system__"

/** 令牌凭据的默认用户名（GitHub 对「任意用户名 + PAT」均可；Gitee/CNB 应填账号用户名） */
export const DEFAULT_TOKEN_USERNAME = "x-access-token"

/** GIT_CONFIG_COUNT 环境变量注入配置的最低 Git 版本（2.31 起支持，低于此版本令牌无法生效） */
export const GIT_CONFIG_ENV_MIN_MAJOR = 2
export const GIT_CONFIG_ENV_MIN_MINOR = 31

/** 单个主机的 HTTPS 令牌（令牌仅发送到该主机，避免跨站泄露） */
export interface PushProfileCredential {
  /** 主机名（小写域名或 IP，可带端口，如 github.com / gitea.example.com:3000） */
  host: string
  /** HTTPS Basic 用户名 */
  username: string
  /** 加密后的令牌（enc: 前缀；空串 = 未配置） */
  tokenCipher: string
}

/** 推送账号（持久化形态：令牌密文落盘，明文只存在于运行时） */
export interface PushProfile {
  id: string
  /** 账号显示名（如「GitHub 工作账号」） */
  label: string
  /** 提交作者名（空 = 不覆盖系统配置） */
  gitName: string
  /** 提交作者邮箱（空 = 不覆盖系统配置） */
  gitEmail: string
  /** SSH 私钥路径（空 = 使用系统默认密钥；仅对 SSH 远程生效） */
  sshKeyPath: string
  /** 各主机的 HTTPS 令牌 */
  credentials: PushProfileCredential[]
}

/** 运行时解析后的凭据（令牌已解密，只在内存中流转，绝不回写） */
export interface ResolvedPushCredential {
  host: string
  username: string
  token: string
}

/** 运行时解析后的账号（GitExecutor 环境构建的输入） */
export interface ResolvedPushProfile {
  id: string
  label: string
  gitName: string
  gitEmail: string
  sshKeyPath: string
  credentials: ResolvedPushCredential[]
}

/** 设置面板展示用的账号视图（令牌只暴露「是否已配置」，不外泄明文） */
export interface PushProfileCredentialView {
  host: string
  username: string
  hasToken: boolean
}

/** 设置面板展示用的账号视图 */
export interface PushProfileView {
  id: string
  label: string
  gitName: string
  gitEmail: string
  sshKeyPath: string
  credentials: PushProfileCredentialView[]
}

/** 设置面板提交的账号表单（token 留空 = 保留原密文；新增主机必须填令牌） */
export interface PushProfileInput {
  /** 空 = 新建 */
  id?: string
  label: string
  gitName: string
  gitEmail: string
  sshKeyPath: string
  credentials: { host: string, username: string, token?: string }[]
}
