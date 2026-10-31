// 推送账号持久化与运行时解析：令牌密文落盘，明文仅在内存中供 git 子进程环境使用
import type { GitProject } from "../types/storage"
import type { PushProfile, PushProfileInput, PushProfileView, ResolvedPushProfile } from "../types/pushProfile"
import { DEFAULT_TOKEN_USERNAME, PUSH_PROFILE_SYSTEM_ID } from "../types/pushProfile"
import type { GitPushStorage } from "../types/storage"
import { decryptSetting, encryptSettingStrict } from "@/utils/settingsCrypto"
import { normalizePushHost } from "../utils/pushProfile"

/** 保存/校验失败原因（组件按 code 映射 i18n，避免把中文文案写进存储层） */
export type PushProfileErrorCode =
  | "needLabel"
  | "needAuth"
  | "needHost"
  | "needToken"
  | "duplicateHost"
  | "saveFailed"

/** 推送账号操作错误（code 供 UI 翻译） */
export class PushProfileError extends Error {
  readonly code: PushProfileErrorCode

  constructor(code: PushProfileErrorCode) {
    super(code)
    this.code = code
  }
}

/** 模块级 ID 计数器（与时间戳组合，避免同毫秒新建碰撞） */
let idCounter = 0

/** 令牌不得含换行（会破坏 HTTP Authorization 头） */
function isHeaderSafe(value: string): boolean {
  return value.length > 0 && !/[\r\n\0]/.test(value)
}

export class PushProfileStore {
  private storage: GitPushStorage
  /** 持久化形态（令牌密文） */
  private raw: PushProfile[] = []
  /** 运行时形态（令牌明文，仅内存） */
  private resolved = new Map<string, ResolvedPushProfile>()
  private defaultId = ""
  private loaded = false
  private loading: Promise<void> | null = null
  /** 解密失败只告警一次（避免每次 git 调用刷日志） */
  private warnedDecrypt = false

  constructor(storage: GitPushStorage) {
    this.storage = storage
  }

  /** 加载账号（幂等；并发调用共享同一次加载） */
  async load(): Promise<void> {
    if (this.loaded) return
    if (this.loading) return this.loading
    const run = (async () => {
      const [raw, defaultId] = await Promise.all([
        this.storage.pushProfiles.loadOrDefault(),
        this.storage.defaultPushProfileId.loadOrDefault(),
      ])
      this.raw = Array.isArray(raw) ? raw : []
      this.resolved = new Map()
      for (const p of this.raw) {
        this.resolved.set(p.id, await this.resolveStored(p))
      }
      this.defaultId = this.resolved.has(defaultId) ? defaultId : ""
      this.loaded = true
    })()
    this.loading = run
    try {
      await run
    } finally {
      this.loading = null
    }
  }

  /** 是否存在可套用的账号（无账号时执行器解析直接短路） */
  hasAny(): boolean {
    return this.raw.length > 0
  }

  /** 账号视图列表（按保存顺序，不含令牌明文） */
  getViews(): PushProfileView[] {
    return this.raw.map((p) => this.toView(p))
  }

  /** 全局默认账号 ID（空串 = 不套用） */
  getDefaultId(): string {
    return this.defaultId
  }

  /** 默认账号显示名（空串 = 系统 Git 配置） */
  getDefaultLabel(): string {
    const p = this.resolved.get(this.defaultId)
    return p?.label ?? ""
  }

  /**
   * 解析项目实际使用的账号。
   * - 未绑定 → 全局默认（未设默认则返回 null = 系统配置）
   * - __system__ → 强制系统配置
   * - 绑定账号已删除 → 回退全局默认（不阻断推送）
   */
  resolveForProject(project: Pick<GitProject, "pushProfileId">): ResolvedPushProfile | null {
    const bound = project.pushProfileId ?? ""
    if (bound === PUSH_PROFILE_SYSTEM_ID) return null
    if (bound) return this.resolved.get(bound) ?? this.resolved.get(this.defaultId) ?? null
    return this.defaultId ? this.resolved.get(this.defaultId) ?? null : null
  }

  /** 新建或更新账号（token 留空且主机已存在时保留原密文） */
  async saveProfile(input: PushProfileInput): Promise<PushProfileView> {
    await this.load()
    const label = input.label.trim()
    if (!label) throw new PushProfileError("needLabel")

    const id = input.id?.trim() || `pp-${Date.now().toString(36)}-${++idCounter}`
    const existing = this.raw.find((p) => p.id === id)
    const existingResolved = this.resolved.get(id)
    const credentials: PushProfile["credentials"] = []
    const resolvedCreds: ResolvedPushProfile["credentials"] = []
    const hosts = new Set<string>()

    for (const row of input.credentials) {
      const host = normalizePushHost(row.host)
      if (!host) throw new PushProfileError("needHost")
      if (hosts.has(host)) throw new PushProfileError("duplicateHost")
      hosts.add(host)
      const username = row.username.trim() || DEFAULT_TOKEN_USERNAME
      const tokenInput = (row.token ?? "").trim()
      const oldCipher = existing?.credentials.find((c) => c.host === host)
      const oldToken = existingResolved?.credentials.find((c) => c.host === host)?.token ?? ""
      let tokenCipher: string
      let token: string
      if (tokenInput) {
        if (!isHeaderSafe(tokenInput)) throw new PushProfileError("needToken")
        tokenCipher = await encryptSettingStrict(tokenInput)
        token = tokenInput
      } else if (oldCipher && oldToken) {
        // 留空 = 保留原令牌（UI 不回显明文）
        tokenCipher = oldCipher.tokenCipher
        token = oldToken
      } else {
        throw new PushProfileError("needToken")
      }
      credentials.push({ host, username, tokenCipher })
      resolvedCreds.push({ host, username, token })
    }

    const gitName = input.gitName.trim()
    const gitEmail = input.gitEmail.trim()
    const sshKeyPath = input.sshKeyPath.trim()
    if (!gitName && !gitEmail && !sshKeyPath && credentials.length === 0) {
      throw new PushProfileError("needAuth")
    }

    const profile: PushProfile = {
      id,
      label,
      gitName,
      gitEmail,
      sshKeyPath,
      credentials,
    }
    const previousRaw = this.raw
    this.raw = existing ? this.raw.map((p) => (p.id === id ? profile : p)) : [...this.raw, profile]
    const saved = await this.storage.pushProfiles.save(this.raw)
    if (!saved) {
      // 落盘失败要回滚内存，避免「界面上已保存、重启后消失」
      this.raw = previousRaw
      throw new PushProfileError("saveFailed")
    }
    this.resolved.set(id, { ...profile, credentials: resolvedCreds })
    return this.toView(profile)
  }

  /** 删除账号；删除默认账号时默认值清空（项目绑定由上层清理） */
  async deleteProfile(id: string): Promise<void> {
    await this.load()
    if (!this.raw.some((p) => p.id === id)) return
    const previousRaw = this.raw
    this.raw = this.raw.filter((p) => p.id !== id)
    const nextDefault = this.defaultId === id ? "" : this.defaultId
    const [savedProfiles, savedDefault] = await Promise.all([
      this.storage.pushProfiles.save(this.raw),
      nextDefault === this.defaultId
        ? Promise.resolve(true)
        : this.storage.defaultPushProfileId.save(nextDefault),
    ])
    if (!savedProfiles || !savedDefault) {
      this.raw = previousRaw
      throw new PushProfileError("saveFailed")
    }
    this.resolved.delete(id)
    this.defaultId = nextDefault
  }

  /** 设置全局默认账号（空串 = 不套用；不存在的 ID 直接拒绝） */
  async setDefaultId(id: string): Promise<void> {
    await this.load()
    const next = id && this.resolved.has(id) ? id : ""
    if (next === this.defaultId) return
    const saved = await this.storage.defaultPushProfileId.save(next)
    if (!saved) throw new PushProfileError("saveFailed")
    this.defaultId = next
  }

  /** 持久化形态 → 运行时形态（逐条解密令牌） */
  private async resolveStored(profile: PushProfile): Promise<ResolvedPushProfile> {
    const credentials: ResolvedPushProfile["credentials"] = []
    for (const c of profile.credentials ?? []) {
      const host = normalizePushHost(c.host)
      const token = c.tokenCipher ? await decryptSetting(c.tokenCipher) : ""
      // decryptSetting 失败时原样返回密文：以 enc: 开头视为不可用并告警
      if (token.startsWith("enc:")) {
        if (!this.warnedDecrypt) {
          this.warnedDecrypt = true
          console.warn("[gitPush] 推送账号令牌解密失败，相关账号将回退系统凭据")
        }
        continue
      }
      if (!host || !token) continue
      credentials.push({ host, username: c.username || DEFAULT_TOKEN_USERNAME, token })
    }
    return {
      id: profile.id,
      label: profile.label,
      gitName: profile.gitName ?? "",
      gitEmail: profile.gitEmail ?? "",
      sshKeyPath: profile.sshKeyPath ?? "",
      credentials,
    }
  }

  private toView(profile: PushProfile): PushProfileView {
    return {
      id: profile.id,
      label: profile.label,
      gitName: profile.gitName ?? "",
      gitEmail: profile.gitEmail ?? "",
      sshKeyPath: profile.sshKeyPath ?? "",
      credentials: (profile.credentials ?? []).map((c) => ({
        host: c.host,
        username: c.username,
        hasToken: !!c.tokenCipher,
      })),
    }
  }
}
