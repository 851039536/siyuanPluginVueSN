// matchProjectQuery 行为断言：跨字段命中、大小写不敏感、空查询放行
import { describe, expect, it } from "vitest"
import { matchProjectQuery, normalizeSearchQuery, projectSearchFields } from "./projectSearch"
import type { GitProject } from "../types/storage"

function makeProject(patch: Partial<GitProject> = {}): GitProject {
  return {
    id: "p1",
    name: "siyuanPluginVueSN",
    path: "E:/project/siyuanPluginVueSN",
    categoryId: "c1",
    addedAt: 0,
    ...patch,
  }
}

describe("normalizeSearchQuery", () => {
  it("去首尾空白并小写", () => {
    expect(normalizeSearchQuery("  Vue SN  ")).toBe("vue sn")
  })
})

describe("matchProjectQuery", () => {
  it("空查询视为全部命中", () => {
    expect(matchProjectQuery(makeProject(), "")).toBe(true)
    expect(matchProjectQuery(makeProject(), "   ")).toBe(true)
  })

  it("名称与路径命中且大小写不敏感", () => {
    const project = makeProject()
    expect(matchProjectQuery(project, "vue")).toBe(true)
    expect(matchProjectQuery(project, "E:/PROJECT")).toBe(true)
    expect(matchProjectQuery(project, "not-exist")).toBe(false)
  })

  it("覆盖备选路径、标签、备注与设备名（原实现搜不到的字段）", () => {
    const project = makeProject({
      localPaths: ["D:/work/repo-alt"],
      tags: ["frontend"],
      note: "插件主仓",
      pathDevices: { "E:/project/siyuanPluginVueSN": "办公台式机" },
    })
    expect(matchProjectQuery(project, "repo-alt")).toBe(true)
    expect(matchProjectQuery(project, "FRONTEND")).toBe(true)
    expect(matchProjectQuery(project, "插件主仓")).toBe(true)
    expect(matchProjectQuery(project, "办公台式机")).toBe(true)
  })

  it("覆盖各平台远程 URL（按仓库名搜索）", () => {
    expect(matchProjectQuery(makeProject({ githubUrl: "https://github.com/kai/siyuan-plugin" }), "kai/siyuan-plugin")).toBe(true)
    expect(matchProjectQuery(makeProject({ giteeUrl: "https://gitee.com/kai/repo-gitee" }), "repo-gitee")).toBe(true)
    expect(matchProjectQuery(makeProject({ giteaUrl: "https://git.example.com/kai/repo-gitea" }), "repo-gitea")).toBe(true)
    expect(matchProjectQuery(makeProject({ cnbUrl: "https://cnb.cool/kai/repo-cnb" }), "repo-cnb")).toBe(true)
  })

  it("分类名参与匹配（全局搜索时由分组提供）", () => {
    const project = makeProject()
    expect(matchProjectQuery(project, "工作", "工作项目")).toBe(true)
    expect(matchProjectQuery(project, "不存在的分类", "工作项目")).toBe(false)
  })
})

describe("projectSearchFields", () => {
  it("过滤空字段并统一小写", () => {
    const fields = projectSearchFields(makeProject({ note: "Note" }))
    expect(fields).toContain("note")
    expect(fields).not.toContain("")
  })
})
