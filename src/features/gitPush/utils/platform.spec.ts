// src/features/gitPush/utils/platform.spec.ts — 平台远程顺序 / 短路检查的纯函数回归
//
// 背景：同一项目常配置多个平台远程（gitee/cnb/github/gitea）互为镜像。
// 「需拉取」检查按固定优先级逐个 fetch，**确认某远程有更新即停**，
// 避免为镜像平台重复付网络往返（实测单项目 12.3s → 2.3s）。
import type { GitProject } from "../types/storage"
import { describe, expect, it } from "vitest"
import { getProjectRemoteNames, orderRemotesForPullCheck, PULL_CHECK_REMOTE_ORDER } from "./platform"

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
