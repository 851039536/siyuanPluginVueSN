import { describe, expect, it } from "vitest"
import type { ResolvedPushProfile } from "../types/pushProfile"
import {
  buildPushProfileEnv,
  buildSshCommand,
  gitCommandName,
  isNetworkGitCommand,
  normalizePathKey,
  normalizePushHost,
} from "./pushProfile"

function profile(patch: Partial<ResolvedPushProfile> = {}): ResolvedPushProfile {
  return {
    id: "p1",
    label: "工作账号",
    gitName: "",
    gitEmail: "",
    sshKeyPath: "",
    credentials: [],
    ...patch,
  }
}

const supported = { configEnvSupported: true }
const unsupported = { configEnvSupported: false }

describe("gitCommandName", () => {
  it("跳过 -c / -C 参数对与无值前导选项", () => {
    expect(gitCommandName(["push", "origin", "main"])).toBe("push")
    expect(gitCommandName(["-c", "core.quotepath=false", "commit", "-m", "x"])).toBe("commit")
    expect(gitCommandName(["--no-pager", "log", "-n", "1"])).toBe("log")
    expect(gitCommandName(["-c", "a=b", "-C", "dir", "fetch"])).toBe("fetch")
    expect(gitCommandName([])).toBe("")
  })
})

describe("isNetworkGitCommand", () => {
  it("识别网络命令（含前导 -c）", () => {
    expect(isNetworkGitCommand(["push"])).toBe(true)
    expect(isNetworkGitCommand(["ls-remote", "origin"])).toBe(true)
    expect(isNetworkGitCommand(["-c", "x=y", "pull", "origin", "main"])).toBe(true)
  })

  it("本地命令不算网络命令", () => {
    expect(isNetworkGitCommand(["status", "--porcelain"])).toBe(false)
    expect(isNetworkGitCommand(["commit", "-m", "x"])).toBe(false)
    expect(isNetworkGitCommand(["remote", "-v"])).toBe(false)
  })
})

describe("normalizePushHost", () => {
  it("归一化协议 / 路径 / 大小写", () => {
    expect(normalizePushHost("https://GitHub.com/foo/bar")).toBe("github.com")
    expect(normalizePushHost("  gitea.example.com:3000/ ")).toBe("gitea.example.com:3000")
    expect(normalizePushHost("localhost:8080")).toBe("localhost:8080")
    expect(normalizePushHost("gitea.local")).toBe("gitea.local")
  })

  it("拒绝空值与非法字符", () => {
    expect(normalizePushHost("")).toBe("")
    expect(normalizePushHost("https://")).toBe("")
    expect(normalizePushHost("foo bar.com")).toBe("")
    expect(normalizePushHost("github.com:port")).toBe("")
    expect(normalizePushHost("[::1]:8080")).toBe("")
  })
})

describe("normalizePathKey", () => {
  it("统一斜杠并去尾斜杠", () => {
    expect(normalizePathKey("E:\\work\\repo\\")).toBe("e:/work/repo")
    expect(normalizePathKey("E:/work/repo")).toBe("e:/work/repo")
    expect(normalizePathKey("/home/me/repo/")).toBe("/home/me/repo")
  })

  it("Windows 盘符与 UNC 大小写不敏感，POSIX 保留大小写", () => {
    expect(normalizePathKey("C:\\Repo")).toBe(normalizePathKey("c:/repo"))
    expect(normalizePathKey("/Home/Repo")).not.toBe(normalizePathKey("/home/repo"))
    expect(normalizePathKey("")).toBe("")
  })
})

describe("buildSshCommand", () => {
  it("路径正斜杠化并加引号，强制 BatchMode", () => {
    const cmd = buildSshCommand("C:\\Users\\me\\.ssh\\id_ed25519")
    expect(cmd).toContain('-i "C:/Users/me/.ssh/id_ed25519"')
    expect(cmd).toContain("IdentitiesOnly=yes")
    expect(cmd).toContain("BatchMode=yes")
  })

  it("转义引号与 $，避免命令注入", () => {
    const cmd = buildSshCommand('/tmp/a"$b')
    expect(cmd).toContain('/tmp/a\\"\\$b')
  })
})

describe("buildPushProfileEnv", () => {
  it("无账号时返回空环境", () => {
    expect(buildPushProfileEnv(null, ["push"], supported)).toEqual({ env: {}, skippedCredentialHosts: [] })
  })

  it("本地命令只覆盖提交身份，不携带令牌", () => {
    const r = buildPushProfileEnv(profile({
      gitName: "Kai",
      gitEmail: "kai@example.com",
      credentials: [{ host: "github.com", username: "x-access-token", token: "tok" }],
    }), ["commit", "-m", "x"], supported)
    expect(r.env).toEqual({
      GIT_AUTHOR_NAME: "Kai",
      GIT_COMMITTER_NAME: "Kai",
      GIT_AUTHOR_EMAIL: "kai@example.com",
      GIT_COMMITTER_EMAIL: "kai@example.com",
    })
    expect(r.env.GIT_CONFIG_COUNT).toBeUndefined()
  })

  it("网络命令注入主机级 extraheader，令牌不进 argv", () => {
    const r = buildPushProfileEnv(profile({
      credentials: [{ host: "GitHub.com", username: "x-access-token", token: "tok" }],
    }), ["push", "origin", "main"], supported)
    expect(r.env.GIT_TERMINAL_PROMPT).toBe("0")
    expect(r.env.GIT_CONFIG_COUNT).toBe("1")
    expect(r.env.GIT_CONFIG_KEY_0).toBe("http.https://github.com/.extraheader")
    const header = r.env.GIT_CONFIG_VALUE_0
    expect(header.startsWith("Authorization: Basic ")).toBe(true)
    const decoded = Buffer.from(header.slice("Authorization: Basic ".length), "base64").toString("utf8")
    expect(decoded).toBe("x-access-token:tok")
  })

  it("按主机去重并排序，计数与键下标一致", () => {
    const r = buildPushProfileEnv(profile({
      credentials: [
        { host: "gitee.com", username: "u", token: "t2" },
        { host: "github.com", username: "u", token: "t1" },
        { host: "https://gitee.com/", username: "u2", token: "t3" },
      ],
    }), ["fetch"], supported)
    expect(r.env.GIT_CONFIG_COUNT).toBe("2")
    expect(r.env.GIT_CONFIG_KEY_0).toBe("http.https://gitee.com/.extraheader")
    expect(r.env.GIT_CONFIG_KEY_1).toBe("http.https://github.com/.extraheader")
    const gitee = Buffer.from(r.env.GIT_CONFIG_VALUE_0.split(" ")[2], "base64").toString("utf8")
    expect(gitee).toBe("u2:t3")
  })

  it("Git 版本过低时跳过令牌并回报主机，SSH 仍生效", () => {
    const r = buildPushProfileEnv(profile({
      sshKeyPath: "/home/me/.ssh/id_ed25519",
      credentials: [{ host: "github.com", username: "u", token: "tok" }],
    }), ["push"], unsupported)
    expect(r.env.GIT_CONFIG_COUNT).toBeUndefined()
    expect(r.env.GIT_SSH_COMMAND).toContain("BatchMode=yes")
    expect(r.skippedCredentialHosts).toEqual(["github.com"])
  })

  it("过滤非法主机 / 含换行的令牌与用户名", () => {
    const r = buildPushProfileEnv(profile({
      credentials: [
        { host: "bad host", username: "u", token: "tok" },
        { host: "github.com", username: "u\n", token: "tok" },
        { host: "gitee.com", username: "u", token: "a\nb" },
        { host: "gitea.com", username: "u", token: "ok" },
      ],
    }), ["push"], supported)
    expect(r.env.GIT_CONFIG_COUNT).toBe("1")
    expect(r.env.GIT_CONFIG_KEY_0).toContain("gitea.com")
  })

  it("仅 SSH 私钥时禁用交互提示", () => {
    const r = buildPushProfileEnv(profile({ sshKeyPath: "C:\\keys\\id" }), ["push"], supported)
    expect(r.env.GIT_SSH_COMMAND).toContain("BatchMode=yes")
    expect(r.env.GIT_TERMINAL_PROMPT).toBe("0")
  })

  it("身份字段可部分覆盖", () => {
    const r = buildPushProfileEnv(profile({ gitName: "Kai" }), ["commit"], supported)
    expect(r.env.GIT_AUTHOR_NAME).toBe("Kai")
    expect(r.env.GIT_AUTHOR_EMAIL).toBeUndefined()
  })
})
