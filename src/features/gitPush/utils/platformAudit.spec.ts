// 平台矩阵行合并与审计计数回归测试
//
// 锁住两件历史缺陷：
//   A. 四平台齐全但链接不一致的项目必须进入矩阵行并计数（原实现只看「缺配置」项目）；
//   B. 审计指纹必须包含 *Url，否则改链接不会触发重审。
import type { GitProject } from "../types/storage"
import type { PlatformStatusItem, RepoLinkAuditRow } from "../types/meta"
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  buildPlatformAuditRows,
  buildRepoAuditKey,
} from "./platformAudit"

function makeProject(id: string, patch: Partial<GitProject> = {}): GitProject {
  return {
    id,
    name: id,
    path: `E:/repos/${id}`,
    categoryId: "c1",
    addedAt: 0,
    ...patch,
  } as GitProject
}

function makeAudit(
  id: string,
  opts: { error?: boolean, states?: Partial<Record<"github" | "gitee" | "gitea" | "cnb", RepoLinkAuditRow["cells"][number]["state"]>> } = {},
): RepoLinkAuditRow {
  const states = opts.states ?? {}
  const cells = (["github", "gitee", "gitea", "cnb"] as const).map((key) => ({
    key,
    state: states[key] ?? "match" as const,
    link: "https://example.com/a/b",
    remoteUrl: "git@example.com:a/b.git",
  }))
  return {
    id,
    name: id,
    path: `E:/repos/${id}`,
    error: !!opts.error,
    cells,
    hasIssue: !!opts.error || cells.some((c) => c.state !== "match" && c.state !== "none"),
  }
}

function statusItem(id: string, configured: Partial<Record<"github" | "gitee" | "gitea" | "cnb", boolean>> = {}): PlatformStatusItem {
  const flags = {
    github: configured.github ?? false,
    gitee: configured.gitee ?? false,
    gitea: configured.gitea ?? false,
    cnb: configured.cnb ?? false,
  }
  const missingCount = Object.values(flags).filter((v) => !v).length
  return {
    project: { id, name: id, path: `E:/repos/${id}` },
    ...flags,
    missingCount,
  }
}

describe("buildRepoAuditKey", () => {
  it("手动仓库链接变化必须改变指纹（否则改链接不会重审）", () => {
    const before = buildRepoAuditKey([makeProject("p1")])
    const after = buildRepoAuditKey([makeProject("p1", { githubUrl: "https://github.com/me/repo" })])
    expect(after).not.toBe(before)
  })

  it("远程名与路径变化也必须改变指纹", () => {
    const base = buildRepoAuditKey([makeProject("p1")])
    expect(buildRepoAuditKey([makeProject("p1", { githubRemote: "origin" })])).not.toBe(base)
    expect(buildRepoAuditKey([makeProject("p1", { path: "E:/repos/moved" })])).not.toBe(base)
  })
})

describe("buildPlatformAuditRows", () => {
  it("配置缺失项目保持原有行，并带出对应审计结果", () => {
    const audit = makeAudit("p1", { states: { gitee: "linkOnly" } })
    const result = buildPlatformAuditRows({
      platformStatusProjects: [statusItem("p1", { github: true })],
      auditRows: { p1: audit },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].configured).toEqual({ github: true, gitee: false, gitea: false, cnb: false })
    expect(result.issueCount).toBe(1)
    expect(result.counts.linkOnly).toBe(1)
  })

  it("四平台齐全但链接不一致的项目必须补进行并计数（历史缺陷）", () => {
    const audit = makeAudit("p2", { states: { github: "mismatch" } })
    const result = buildPlatformAuditRows({
      platformStatusProjects: [],
      auditRows: { p2: audit },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe("p2")
    expect(result.rows[0].configured).toEqual({ github: true, gitee: true, gitea: true, cnb: true })
    expect(result.issueCount).toBe(1)
    expect(result.counts.mismatch).toBe(1)
  })

  it("检测失败的项目计为 error，且不重复计数", () => {
    const result = buildPlatformAuditRows({
      platformStatusProjects: [statusItem("p3", {})],
      auditRows: { p3: makeAudit("p3", { error: true }) },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.issueCount).toBe(1)
    expect(result.counts.error).toBe(1)
    expect(result.counts.mismatch).toBe(0)
  })

  it("配置齐全但只有 remoteOnly 的项目不补进行（未填手动链接属常见状态，避免全量噪音）", () => {
    const audit: RepoLinkAuditRow = {
      id: "p6",
      name: "p6",
      path: "E:/repos/p6",
      error: false,
      cells: [
        { key: "github", state: "remoteOnly", link: "", remoteUrl: "git@github.com:a/b.git" },
        { key: "gitee", state: "remoteOnly", link: "", remoteUrl: "git@gitee.com:a/b.git" },
        { key: "gitea", state: "match", link: "https://gitea.example/a/b", remoteUrl: "https://gitea.example/a/b.git" },
        { key: "cnb", state: "match", link: "https://cnb.cool/a/b", remoteUrl: "https://cnb.cool/a/b.git" },
      ],
      hasIssue: true,
    }
    const result = buildPlatformAuditRows({
      platformStatusProjects: [],
      auditRows: { p6: audit },
    })

    expect(result.rows).toHaveLength(0)
    expect(result.issueCount).toBe(0)
  })

  it("同一项目同时出现在两个来源时只保留一行（配置缺失优先）", () => {
    const result = buildPlatformAuditRows({
      platformStatusProjects: [statusItem("p4", { github: true })],
      auditRows: { p4: makeAudit("p4", { states: { gitee: "remoteOnly" } }) },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].configured.github).toBe(true)
    expect(result.rows[0].configured.gitee).toBe(false)
  })

  it("无问题时不产生 issueCount/chips", () => {
    const result = buildPlatformAuditRows({
      platformStatusProjects: [statusItem("p5", { github: true, gitee: true, gitea: true, cnb: true })],
      auditRows: { p5: makeAudit("p5") },
    })

    expect(result.issueCount).toBe(0)
    expect(result.counts).toEqual({ mismatch: 0, linkOnly: 0, remoteOnly: 0, error: 0 })
  })
})
