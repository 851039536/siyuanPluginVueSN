// gitDiffArgs.spec.ts — 补丁命令参数构造
import { describe, expect, it } from "vitest"
import {
  buildLogPatchArgs,
  buildNoIndexDiffArgs,
  buildShowPatchArgs,
  buildWorktreeDiffArgs,
  DIFF_SAFE_ARGS,
} from "./gitDiffArgs"

describe("gitDiffArgs", () => {
  it("所有带补丁输出的命令都注入防污染开关，且不再使用 --text", () => {
    const all = [
      buildWorktreeDiffArgs(),
      buildNoIndexDiffArgs("a.ts"),
      buildShowPatchArgs({ hash: "abc123" }),
      buildLogPatchArgs(),
    ]
    for (const args of all) {
      for (const flag of DIFF_SAFE_ARGS) expect(args).toContain(flag)
      expect(args).not.toContain("--text")
    }
  })

  it("工作区 diff：-U / --cached / --stat / 路径顺序稳定", () => {
    expect(buildWorktreeDiffArgs({
      staged: true,
      context: 20,
      paths: ["a b.ts"],
    })).toEqual([
      "diff",
      ...DIFF_SAFE_ARGS,
      "-U20",
      "--cached",
      "--",
      "a b.ts",
    ])
    expect(buildWorktreeDiffArgs({ statWidth: 200 })).toContain("--stat=200")
    expect(buildWorktreeDiffArgs({ context: 0 })).not.toContain("-U0")
  })

  it("未跟踪文件：--no-index 与 /dev/null 比较", () => {
    const args = buildNoIndexDiffArgs("new.txt")
    expect(args).toContain("--no-index")
    expect(args.slice(-2)).toEqual(["/dev/null", "new.txt"])
  })

  it("提交补丁：默认不出信息头，可指定 format 与单文件", () => {
    expect(buildShowPatchArgs({ hash: "abc" })).toContain("--format=")
    const args = buildShowPatchArgs({
      hash: "abc",
      filePath: "a.ts",
      format: "--format=%B",
    })
    expect(args).toContain("--format=%B")
    expect(args.slice(-2)).toEqual(["--", "a.ts"])
  })

  it("历史补丁：-p + max-count/since/路径", () => {
    const args = buildLogPatchArgs({
      maxCount: 5,
      since: "30 days ago",
      paths: ["a.ts"],
    })
    expect(args.slice(0, 2)).toEqual(["log", "-p"])
    expect(args).toContain("--max-count=5")
    expect(args).toContain("--since=30 days ago")
    expect(args.slice(-2)).toEqual(["--", "a.ts"])
  })
})
