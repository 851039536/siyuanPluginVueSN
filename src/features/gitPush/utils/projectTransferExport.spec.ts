/**
 * 项目配置导出（给桌面端）单测
 *
 * 重点守三件事：载荷外壳与桌面端解析器对齐、槽位键与插件 JSON_SLOTS 注册表对齐、
 * 敏感字段不跨仓传递。
 */
import type { GitProject, ProjectCategory } from "../types/storage"
import { describe, expect, it } from "vitest"
import { JSON_SLOTS } from "@/config/storage"
import { UNGROUPED_ID } from "../types/storage"
import {
  buildDesktopTransferPayload,
  desktopTransferFileName,
  PROJECT_TRANSFER_SLOT_KEYS,
} from "./projectTransferExport"

function project(overrides: Partial<GitProject> = {}): GitProject {
  return {
    id: "p1",
    name: "Repo",
    path: "E:/code/repo",
    categoryId: UNGROUPED_ID,
    addedAt: 1_700_000_000_000,
    ...overrides,
  }
}

const CATEGORY: ProjectCategory = { id: "c1", name: "桌面端", color: "#4a9eff", order: 1 }

function build(overrides: Partial<Parameters<typeof buildDesktopTransferPayload>[0]> = {}) {
  return buildDesktopTransferPayload({
    projects: [project()],
    categories: [CATEGORY],
    tags: ["Electron"],
    templates: [{ id: "tpl", name: "功能", pattern: "feat: " }],
    exportedAt: 123,
    ...overrides,
  })
}

describe("buildDesktopTransferPayload", () => {
  it("外壳与桌面端解析器对齐（version/owners/tables/schemas）", () => {
    const payload = build()
    expect(payload.version).toBe(1)
    expect(payload.owners).toEqual(["gitPush"])
    expect(payload.exportedAt).toBe(123)
    expect(payload.tables).toEqual({})
    expect(payload.schemas).toEqual({})
  })

  it("只输出 4 个项目相关槽位", () => {
    const payload = build()
    expect(Object.keys(payload.slots).sort()).toEqual([...PROJECT_TRANSFER_SLOT_KEYS].sort())
  })

  it("槽位键全部已在插件 JSON_SLOTS 注册（否则插件自身导入会整份拒绝）", () => {
    const registered = new Set(JSON_SLOTS.map((slot) => slot.key))
    for (const key of PROJECT_TRANSFER_SLOT_KEYS) {
      expect(registered.has(key)).toBe(true)
    }
  })

  it("不导出 pushProfileId（账号槽位敏感，过去必然悬空）", () => {
    const payload = build({ projects: [project({ pushProfileId: "profile-1" })] })
    expect(payload.slots["git-push-projects"][0].pushProfileId).toBeUndefined()
  })

  it("缺未分组分类时自动补齐", () => {
    const payload = build({ categories: [CATEGORY] })
    expect(payload.slots["git-push-categories"][0].id).toBe(UNGROUPED_ID)
    expect(payload.slots["git-push-categories"]).toHaveLength(2)
  })

  it("已有未分组时不重复添加", () => {
    const payload = build({ categories: [{ id: UNGROUPED_ID, name: "未分组", color: "#888888", order: 0 }] })
    expect(payload.slots["git-push-categories"]).toHaveLength(1)
  })

  it("空列表也能生成合法载荷（用户可能还没有项目）", () => {
    const payload = build({ projects: [], categories: [], tags: [], templates: [] })
    expect(payload.slots["git-push-projects"]).toEqual([])
    expect(payload.slots["git-push-tags"]).toEqual([])
    expect(payload.slots["git-push-categories"]).toHaveLength(1)
  })

  it("项目字段原样保留（含手填仓库链接与多设备路径）", () => {
    const payload = build({
      projects: [project({
        githubUrl: "https://github.com/me/repo",
        localPaths: ["D:/work/repo"],
        pathDevices: { "D:/work/repo": "笔记本" },
        tags: ["a"],
        starred: true,
        note: "备注",
      })],
    })
    const saved = payload.slots["git-push-projects"][0]
    expect(saved.githubUrl).toBe("https://github.com/me/repo")
    expect(saved.localPaths).toEqual(["D:/work/repo"])
    expect(saved.pathDevices).toEqual({ "D:/work/repo": "笔记本" })
    expect(saved.starred).toBe(true)
    expect(saved.note).toBe("备注")
  })
})

describe("desktopTransferFileName", () => {
  it("按 gitdesk-projects-YYYYMMDD-HHmm.json 命名", () => {
    expect(desktopTransferFileName(new Date(2026, 10, 11, 9, 5))).toBe("gitdesk-projects-20261111-0905.json")
  })
})
