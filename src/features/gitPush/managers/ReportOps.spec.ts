// src/features/gitPush/managers/ReportOps.spec.ts — maxBuffer 错误识别单测
//
// 只测纯判定函数：真实触发 10MB 输出需要生成数万文件，成本远高于收益。
import { describe, expect, it } from "vitest"
import { isGitOutputOverflow } from "./ReportOps"

describe("isGitOutputOverflow", () => {
  it("识别 execGit 包装后的 maxBuffer 错误", () => {
    const wrapped = new Error(
      "git 命令执行失败（exit code: ERR_CHILD_PROCESS_STDIO_MAXBUFFER）: stdout maxBuffer length exceeded",
    )
    expect(isGitOutputOverflow(wrapped)).toBe(true)
  })

  it("普通 git 错误不误判", () => {
    expect(isGitOutputOverflow(new Error("git 命令执行失败（exit code: 128）"))).toBe(false)
    expect(isGitOutputOverflow(new Error("fatal: not a git repository"))).toBe(false)
    expect(isGitOutputOverflow(undefined)).toBe(false)
    expect(isGitOutputOverflow("boom")).toBe(false)
  })
})
