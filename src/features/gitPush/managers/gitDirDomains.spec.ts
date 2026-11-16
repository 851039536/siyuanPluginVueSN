// src/features/gitPush/managers/gitDirDomains.spec.ts — .git 变化路径 → 查询域映射（P1-1）
//
// 这些规则直接决定「一次 git 操作要跑几个进程」：分类过粗（全标脏）会让一次 fetch
// 触发每张卡 3 个查询；分类过细（漏标）会让徽章停在旧值直到下一轮轮询。
// 纯函数，无 fs / 无 git，故用表驱动断言把每条规则钉住。
//
// 路径样本全部取自 2026-11-16 在 Windows/git 2.53 上实测的真实事件（含目录事件不带结尾斜杠、
// 临时 .lock 文件、objects 与 logs 噪音）。
import { describe, expect, it } from "vitest"
import { classifyGitDirChanges } from "./gitDirDomains"

describe("classifyGitDirChanges", () => {
  it("首次 fetch 的一整批事件只映射到 pushStatus（不牵动日志/分支/stash）", () => {
    const paths = [
      "FETCH_HEAD",
      "objects/5b",
      "objects",
      "objects/5b/tmp_obj_7LTshO",
      "refs/remotes",
      "refs",
      "refs/remotes/origin",
      "refs/remotes/origin/main.lock",
      "logs/refs/remotes/origin/main",
      "refs/remotes/origin/main",
      "refs/remotes/origin/HEAD",
      "objects/maintenance.lock",
    ]
    expect(classifyGitDirChanges(paths)).toEqual(["pushStatus"])
  })

  it("commit 的一整批事件映射到本地引用域（含 workingTree 与 pushStatus）", () => {
    const kinds = classifyGitDirChanges([
      "index",
      "HEAD",
      "refs/heads/main",
      "logs/HEAD",
      "logs/refs/heads/main",
      "COMMIT_EDITMSG",
      "objects/ab/cdef",
    ])
    expect(new Set(kinds)).toEqual(new Set(["pushStatus", "workingTree", "log", "branches", "stash"]))
  })

  it("仅 index 变化（git add）只标 workingTree", () => {
    expect(classifyGitDirChanges(["index"])).toEqual(["workingTree"])
    expect(classifyGitDirChanges(["index.lock", "index"])).toEqual(["workingTree"])
  })

  it("远程跟踪引用只标 pushStatus，本地分支只标本地域", () => {
    expect(classifyGitDirChanges(["refs/remotes/origin/main"])).toEqual(["pushStatus"])
    expect(classifyGitDirChanges(["refs/heads/feature/login"])).toContain("branches")
    expect(classifyGitDirChanges(["refs/heads/feature/login"])).toContain("log")
  })

  it("stash / tag 各自只影响自己的域", () => {
    expect(new Set(classifyGitDirChanges(["refs/stash"]))).toEqual(new Set(["stash", "workingTree"]))
    expect(classifyGitDirChanges(["refs/tags/v1.0.0"])).toEqual(["tags"])
  })

  it("合并/rebase 痕迹映射到冲突 + 工作区 + 推送状态", () => {
    for (const path of ["MERGE_HEAD", "ORIG_HEAD", "rebase-merge", "rebase-merge/git-rebase-todo", "CHERRY_PICK_HEAD"]) {
      const kinds = classifyGitDirChanges([path])
      expect(kinds).toContain("conflicts")
      expect(kinds).toContain("workingTree")
      expect(kinds).toContain("pushStatus")
    }
  })

  it("packed-refs（gc / pack-refs 后）本地与远程都算变化", () => {
    const kinds = classifyGitDirChanges(["packed-refs"])
    expect(kinds).toContain("log")
    expect(kinds).toContain("pushStatus")
  })

  it("噪音路径被忽略，未识别路径保守全标", () => {
    // 纯噪音：不产生任何域
    expect(classifyGitDirChanges(["objects/pack/pack-1.idx", "hooks/pre-commit.sample", "logs/HEAD"])).toEqual([])
    // 未识别（如 git 新版本新增文件、config 改动）：全标，宁可多查不可漏报
    expect(classifyGitDirChanges(["config"]).length).toBe(7)
    // 平台未给 filename（null → 空串）：同样保守全标
    expect(classifyGitDirChanges([""]).length).toBe(7)
    expect(classifyGitDirChanges([]).length).toBe(7)
  })

  it("反斜杠与 ./ 前缀被归一（Windows 事件路径）", () => {
    expect(classifyGitDirChanges([".\\refs\\remotes\\origin\\main"])).toEqual(["pushStatus"])
    expect(classifyGitDirChanges(["./index"])).toEqual(["workingTree"])
  })
})
