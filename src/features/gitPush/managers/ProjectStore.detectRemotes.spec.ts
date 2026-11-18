// detectRemotes 的失败语义回归
//
// 背景：统计页链接一致性校验需要区分「该平台没有远程」与「整个仓库读不出来」。
// detectRemotes 为兼容既有调用方会吞错返回 []；detectRemotesStrict 必须把失败抛出去，
// 否则路径失效会被误报成 linkOnly / remoteOnly。
import type { GitPushStorage } from "../types/storage"
import type { GitExecutor } from "./GitExecutor"
import {
  describe,
  expect,
  it,
} from "vitest"
import { ProjectStore } from "./ProjectStore"

function makeStore(execGit: (cwd: string, args: string[]) => Promise<string>): ProjectStore {
  const executor = { execGit } as unknown as GitExecutor
  return new ProjectStore({} as GitPushStorage, executor)
}

const REMOTE_OUTPUT = [
  "origin\thttps://github.com/me/repo.git (fetch)",
  "origin\thttps://github.com/me/repo.git (push)",
  "gitee\tgit@gitee.com:me/repo.git (fetch)",
  "gitee\tgit@gitee.com:me/repo.git (push)",
  "gitea\thttps://gitea.example/me/repo.git (fetch)",
  "gitea\thttps://gitea.example/me/repo.git (push)",
  "cnb\thttps://cnb.cool/me/repo.git (fetch)",
  "cnb\thttps://cnb.cool/me/repo.git (push)",
].join("\n")

describe("ProjectStore.detectRemotesStrict", () => {
  it("解析 fetch 行并识别四个平台（同一远程的 push 行不重复计数）", async () => {
    const store = makeStore(async () => REMOTE_OUTPUT)
    const remotes = await store.detectRemotesStrict("E:/repos/p1")

    expect(remotes).toHaveLength(4)
    expect(remotes.map((r) => r.name)).toEqual(["origin", "gitee", "gitea", "cnb"])
    expect(remotes.map((r) => [r.isGithub, r.isGitee, r.isGitea, r.isCnb])).toEqual([
      [true, false, false, false],
      [false, true, false, false],
      [false, false, true, false],
      [false, false, false, true],
    ])
  })

  it("命令失败必须抛错（供链接校验标记「路径无效/检测失败」）", async () => {
    const store = makeStore(async () => {
      throw new Error("fatal: not a git repository")
    })

    await expect(store.detectRemotesStrict("E:/missing")).rejects.toThrow("not a git repository")
  })

  it("detectRemotes 保持历史契约：同样失败时返回空数组而不是抛错", async () => {
    const store = makeStore(async () => {
      throw new Error("fatal: not a git repository")
    })

    await expect(store.detectRemotes("E:/missing")).resolves.toEqual([])
  })

  it("空输出（仓库存在但无远程）返回空数组且不抛错", async () => {
    const store = makeStore(async () => "")
    await expect(store.detectRemotesStrict("E:/empty")).resolves.toEqual([])
  })
})
