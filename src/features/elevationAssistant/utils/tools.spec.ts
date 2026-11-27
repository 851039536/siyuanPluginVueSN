import { describe, expect, it } from "vitest"
import {
  MAX_SHORTCUTS_PER_TOOL,
  MAX_TOOLS,
  createToolId,
  findShortcutOwner,
  sanitizeTools,
} from "./tools"

function makeTool(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `tool-${index}`,
    name: `工具 ${index}`,
    path: `C:\\Tools\\tool${index}.exe`,
    args: "",
    workingDir: `C:\\Tools`,
    requireAdmin: false,
    shortcuts: [],
    createdAt: 1000 + index,
    updatedAt: 1000 + index,
    ...overrides,
  }
}

function makeShortcut(path: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    path,
    location: "desktop",
    runAsAdmin: true,
    createdAt: 1000,
    ...overrides,
  }
}

describe("sanitizeTools", () => {
  it("丢弃损坏条目与重复 id", () => {
    const result = sanitizeTools([
      makeTool(1),
      makeTool(1),
      { id: "x", name: "", path: "C:\\a.exe" },
      { id: "y", name: "n", path: "" },
      null,
      "text",
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("tool-1")
  })

  it("按 updatedAt 倒序并裁剪到上限", () => {
    const list = Array.from({ length: MAX_TOOLS + 5 }, (_, i) => makeTool(i))
    const result = sanitizeTools(list)
    expect(result).toHaveLength(MAX_TOOLS)
    expect(result[0].updatedAt).toBeGreaterThan(result[1].updatedAt)
  })

  it("快捷方式只保留绝对 .lnk 路径并按上限裁剪", () => {
    const shortcuts = Array.from({ length: MAX_SHORTCUTS_PER_TOOL + 3 }, (_, i) =>
      makeShortcut(`C:\\Links\\s${i}.lnk`, { createdAt: 1000 + i }))
    shortcuts.push(makeShortcut("relative\\a.lnk"))
    shortcuts.push(makeShortcut("C:\\Links\\b.exe"))
    shortcuts.push(makeShortcut("C:\\Links\\c.lnk", { location: "startup" }))
    // 重复路径（更新时间更晚，排在最前），清洗后只保留一条
    shortcuts.push(makeShortcut("C:\\Links\\s0.lnk", { createdAt: 9000 }))

    const result = sanitizeTools([makeTool(1, { shortcuts })])
    expect(result[0].shortcuts).toHaveLength(MAX_SHORTCUTS_PER_TOOL)
    expect(result[0].shortcuts[0].path).toBe("C:\\Links\\s0.lnk")
    expect(result[0].shortcuts.filter((s) => s.path === "C:\\Links\\s0.lnk")).toHaveLength(1)
  })

  it("字段类型兜底", () => {
    const result = sanitizeTools([
      makeTool(1, {
        args: 123,
        workingDir: null,
        requireAdmin: "true",
        shortcuts: "nope",
        lastRunAt: "bad",
      }),
    ])
    expect(result[0].args).toBe("")
    expect(result[0].workingDir).toBe("")
    expect(result[0].requireAdmin).toBe(false)
    expect(result[0].shortcuts).toEqual([])
    expect(result[0].lastRunAt).toBeUndefined()
  })

  it("非数组输入返回空数组", () => {
    expect(sanitizeTools(null)).toEqual([])
    expect(sanitizeTools({})).toEqual([])
    expect(sanitizeTools("x")).toEqual([])
  })
})

describe("createToolId", () => {
  it("带前缀且不重复", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createToolId()))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id.startsWith("elevation-")).toBe(true)
  })
})

describe("findShortcutOwner", () => {
  it("找到其它工具占用的快捷方式路径", () => {
    const tools = sanitizeTools([
      makeTool(1, { shortcuts: [makeShortcut("C:\\Links\\a.lnk")] }),
      makeTool(2),
    ])
    expect(findShortcutOwner(tools, "c:\\links\\a.lnk", "tool-2")?.id).toBe("tool-1")
    expect(findShortcutOwner(tools, "C:\\Links\\a.lnk", "tool-1")).toBeNull()
    expect(findShortcutOwner(tools, "C:\\Links\\b.lnk", "tool-2")).toBeNull()
  })
})
