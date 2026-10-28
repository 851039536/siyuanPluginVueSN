// src/features/gitPush/utils/platform.spec.ts — 平台远程顺序 / 短路检查的纯函数回归
//
// 背景：同一项目常配置多个平台远程（gitee/cnb/github/gitea）互为镜像。
// 「需拉取」检查按固定优先级逐个 fetch，**确认某远程有更新即停**，
// 避免为镜像平台重复付网络往返（实测单项目 12.3s → 2.3s）。
import type { GitProject, RemotePushStatus } from "../types/storage"
import { describe, expect, it } from "vitest"
import {
  buildCompareUrl,
  getProjectRemoteNames,
  hasUnpushedCommits,
  mayAttemptPush,
  orderRemotesForPullCheck,
  PULL_CHECK_REMOTE_ORDER,
} from "./platform"

function makeProject(overrides: Partial<GitProject> = {}): GitProject {
  return {
    id: "p1",
    name: "p1",
    path: "E:/repos/p1",
    categoryId: "c1",
    addedAt: 0,
    ...overrides,
  } as GitProject
}

describe("orderRemotesForPullCheck —— 短路 fetch 的平台优先级", () => {
  it("全部平台都配置时，按 gitee → cnb → github → gitea 排序", () => {
    const project = makeProject({
      githubRemote: "github",
      giteeRemote: "gitee",
      giteaRemote: "gitea",
      cnbRemote: "cnb",
    })
    expect(orderRemotesForPullCheck(project).map((r) => r.key)).toEqual(["gitee", "cnb", "github", "gitea"])
  })

  it("只配置部分平台时，按优先级子集排序（未配置的不出现）", () => {
    const project = makeProject({
      githubRemote: "github",
      giteeRemote: "gitee",
    })
    expect(orderRemotesForPullCheck(project).map((r) => r.key)).toEqual(["gitee", "github"])
  })

  it("gitee 未配置时，cnb 排第一（不影响短路起点）", () => {
    const project = makeProject({
      cnbRemote: "cnb",
      githubRemote: "github",
    })
    expect(orderRemotesForPullCheck(project).map((r) => r.key)).toEqual(["cnb", "github"])
  })

  it("无任何平台远程时返回空数组（调用方据此跳过 fetch）", () => {
    expect(orderRemotesForPullCheck(makeProject())).toEqual([])
  })

  it("顺序表包含全部四个平台 key，且无重复", () => {
    expect(PULL_CHECK_REMOTE_ORDER).toHaveLength(4)
    expect(new Set(PULL_CHECK_REMOTE_ORDER).size).toBe(4)
    expect([...PULL_CHECK_REMOTE_ORDER].sort()).toEqual(["cnb", "gitea", "gitee", "github"])
  })
})

describe("getProjectRemoteNames —— 与短路顺序解耦", () => {
  it("仍按 PLATFORM_META 固定顺序返回（UI 展示顺序不变，避免改动影响卡片）", () => {
    const project = makeProject({
      githubRemote: "github",
      giteeRemote: "gitee",
      giteaRemote: "gitea",
      cnbRemote: "cnb",
    })
    // PLATFORM_META 顺序：github → gitee → gitea → cnb
    expect(getProjectRemoteNames(project).map((r) => r.key)).toEqual(["github", "gitee", "gitea", "cnb"])
  })
})

describe("推送判据拆分 —— 计数口径 vs 尝试口径", () => {
  const synced: RemotePushStatus = { ahead: 0, behind: 0, noUpstream: false }
  const ahead: RemotePushStatus = { ahead: 2, behind: 0, noUpstream: false }
  const behind: RemotePushStatus = { ahead: 0, behind: 3, noUpstream: false }
  const diverged: RemotePushStatus = { ahead: 2, behind: 3, noUpstream: false }
  const newBranch: RemotePushStatus = { ahead: 5, behind: 0, noUpstream: true }
  const emptyRepo: RemotePushStatus = { ahead: 0, behind: 0, noUpstream: true }
  const errored: RemotePushStatus = { ahead: 0, behind: 0, noUpstream: false, error: "boom" }

  it("hasUnpushedCommits 只看 ahead，空仓库与错误状态均为 false", () => {
    expect(hasUnpushedCommits(ahead)).toBe(true)
    expect(hasUnpushedCommits(diverged)).toBe(true)
    expect(hasUnpushedCommits(newBranch)).toBe(true)
    expect(hasUnpushedCommits(synced)).toBe(false)
    expect(hasUnpushedCommits(behind)).toBe(false)
    expect(hasUnpushedCommits(emptyRepo)).toBe(false)
    expect(hasUnpushedCommits(errored)).toBe(false)
  })

  it("mayAttemptPush 对 noUpstream 保持放行（空仓库也可尝试建上游）", () => {
    expect(mayAttemptPush(ahead)).toBe(true)
    expect(mayAttemptPush(newBranch)).toBe(true)
    expect(mayAttemptPush(emptyRepo)).toBe(true)
    expect(mayAttemptPush(synced)).toBe(false)
    expect(mayAttemptPush(behind)).toBe(false)
    // error 由调用方叠加 !error 守卫，本判据本身不看 error
    expect(mayAttemptPush(errored)).toBe(false)
  })
})

describe("buildCompareUrl —— Compare / 创建 PR 深链", () => {
  it("GitHub：https 地址去 .git，并附加 expand=1", () => {
    expect(buildCompareUrl("github", "https://github.com/o/r.git", "main", "feat/x"))
      .toBe("https://github.com/o/r/compare/main...feat/x?expand=1")
  })

  it("Gitee / Gitea：支持 scp 短形式地址", () => {
    expect(buildCompareUrl("gitee", "git@gitee.com:o/r.git", "master", "dev"))
      .toBe("https://gitee.com/o/r/compare/master...dev")
    expect(buildCompareUrl("gitea", "git@gitea.example.com:o/r.git", "main", "dev"))
      .toBe("https://gitea.example.com/o/r/compare/main...dev")
  })

  it("分支名保留斜杠，其余特殊字符编码", () => {
    expect(buildCompareUrl("github", "https://github.com/o/r", "main", "fix/#12"))
      .toBe("https://github.com/o/r/compare/main...fix/%2312?expand=1")
  })

  it("仓库地址带尾部斜杠时不产生双斜杠", () => {
    expect(buildCompareUrl("gitee", "https://gitee.com/o/r/", "main", "dev"))
      .toBe("https://gitee.com/o/r/compare/main...dev")
  })

  it("ssh:// 形式地址归一化为 https（含端口与 .git）", () => {
    expect(buildCompareUrl("github", "ssh://git@github.com:22/o/r.git", "main", "feat/x"))
      .toBe("https://github.com/o/r/compare/main...feat/x?expand=1")
  })

  it("不支持的平台或缺失参数返回 null", () => {
    expect(buildCompareUrl("cnb", "https://cnb.cool/o/r", "main", "dev")).toBeNull()
    expect(buildCompareUrl("github", undefined, "main", "dev")).toBeNull()
    expect(buildCompareUrl("github", "", "main", "dev")).toBeNull()
    expect(buildCompareUrl("github", "git://github.com/o/r.git", "main", "dev")).toBeNull()
    expect(buildCompareUrl("github", "https://github.com/o/r", "", "dev")).toBeNull()
    expect(buildCompareUrl("github", "https://github.com/o/r", "main", "  ")).toBeNull()
  })
})
