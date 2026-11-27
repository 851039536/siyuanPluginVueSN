import { describe, expect, it } from "vitest"
import { redactUrlCredentials } from "./redact"

describe("redactUrlCredentials", () => {
  it("去掉 URL 中的用户名与令牌，保留主机与路径", () => {
    expect(redactUrlCredentials("fatal: unable to access 'https://user:token@github.com/a/b.git/'"))
      .toBe("fatal: unable to access 'https://***@github.com/a/b.git/'")
    expect(redactUrlCredentials("ssh://git@example.com:22/repo.git"))
      .toBe("ssh://***@example.com:22/repo.git")
  })

  it("不改动 scp 风格地址与普通邮箱", () => {
    expect(redactUrlCredentials("git@github.com:owner/repo.git")).toBe("git@github.com:owner/repo.git")
    expect(redactUrlCredentials("mailto:user@example.com")).toBe("mailto:user@example.com")
  })

  it("一次处理多条 URL 与多行文本", () => {
    const input = "To https://a:1@host/x\nTo https://b:2@host/y"
    expect(redactUrlCredentials(input)).toBe("To https://***@host/x\nTo https://***@host/y")
  })
})
