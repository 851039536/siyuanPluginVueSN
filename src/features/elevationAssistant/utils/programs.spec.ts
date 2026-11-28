import {
  describe,
  expect,
  it,
} from "vitest"
import {
  MAX_SCANNED_PROGRAMS,
  mergeProgramCandidates,
  normalizeProgramScanPayload,
  planProgramAdditions,
  sanitizeProgramCandidate,
  suggestProgramName,
} from "./programs"

function makeCandidate(path: string, source = "startMenu", name = ""): Record<string, unknown> {
  return {
    name,
    path,
    source,
  }
}

describe("sanitizeProgramCandidate", () => {
  it("只接受绝对路径的 .exe 与白名单来源", () => {
    expect(sanitizeProgramCandidate(makeCandidate("C:\\Tools\\a.exe"))).not.toBeNull()
    expect(sanitizeProgramCandidate(makeCandidate("relative\\a.exe"))).toBeNull()
    expect(sanitizeProgramCandidate(makeCandidate("C:\\Tools\\a.txt"))).toBeNull()
    expect(sanitizeProgramCandidate(makeCandidate("C:\\Tools\\a.exe", "unknown"))).toBeNull()
    expect(sanitizeProgramCandidate(null)).toBeNull()
    expect(sanitizeProgramCandidate([])).toBeNull()
  })

  it("名称去掉“ - 快捷方式”后缀并清洗非法字符", () => {
    expect(sanitizeProgramCandidate(makeCandidate("C:\\Tools\\a.exe", "startMenu", "记事本 - 快捷方式"))?.name)
      .toBe("记事本")
    expect(sanitizeProgramCandidate(makeCandidate("C:\\Tools\\a.exe", "startMenu", "a/b:c"))?.name)
      .toBe("abc")
  })

  it("名称缺失时回退到 exe 文件名", () => {
    expect(sanitizeProgramCandidate(makeCandidate("D:/Soft/某工具.exe"))?.name).toBe("某工具")
  })

  it("路径正斜杠统一为反斜杠", () => {
    expect(sanitizeProgramCandidate(makeCandidate("C:/Tools/a.exe"))?.path).toBe("C:\\Tools\\a.exe")
  })
})

describe("mergeProgramCandidates", () => {
  it("按路径去重并保留优先级更高的来源", () => {
    const merged = mergeProgramCandidates([
      {
        name: "a",
        path: "C:\\A.exe",
        source: "process",
      },
      {
        name: "a",
        path: "c:\\a.EXE",
        source: "startMenu",
      },
      {
        name: "b",
        path: "C:\\B.exe",
        source: "desktop",
      },
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0].source).toBe("startMenu")
    expect(merged[1].source).toBe("desktop")
  })
})

describe("normalizeProgramScanPayload", () => {
  it("兼容数组输出并过滤脏数据", () => {
    const outcome = normalizeProgramScanPayload([
      makeCandidate("C:\\Tools\\a.exe"),
      makeCandidate("relative\\b.exe"),
      makeCandidate("C:\\Tools\\b.txt"),
      null,
    ])
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.programs).toHaveLength(1)
    expect(outcome.programs[0].path).toBe("C:\\Tools\\a.exe")
  })

  it("兼容对象输出并保留 truncated / warnings", () => {
    const outcome = normalizeProgramScanPayload({
      programs: [makeCandidate("C:\\Tools\\a.exe"), makeCandidate("c:\\tools\\A.exe")],
      truncated: true,
      warnings: ["com", 42, "appPaths"],
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.programs).toHaveLength(1)
    expect(outcome.truncated).toBe(true)
    expect(outcome.warnings).toEqual(["com", "appPaths"])
  })

  it("非法载荷返回空结果而不是抛错", () => {
    const outcome = normalizeProgramScanPayload("nope")
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.programs).toEqual([])
  })

  it("超过上限时截断并标记 truncated", () => {
    const list = Array.from({ length: MAX_SCANNED_PROGRAMS + 5 }, (_, i) =>
      makeCandidate(`C:\\Tools\\a${i}.exe`))
    const outcome = normalizeProgramScanPayload({ programs: list })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.programs).toHaveLength(MAX_SCANNED_PROGRAMS)
    expect(outcome.truncated).toBe(true)
  })
})

describe("planProgramAdditions", () => {
  it("跳过已存在路径并按上限裁剪", () => {
    const candidates = [
      {
        name: "a",
        path: "C:\\Tools\\a.exe",
        source: "startMenu" as const,
      },
      {
        name: "b",
        path: "C:\\Tools\\b.exe",
        source: "desktop" as const,
      },
      {
        name: "c",
        path: "C:\\Tools\\c.exe",
        source: "process" as const,
      },
    ]
    const plan = planProgramAdditions(["c:\\tools\\a.exe"], candidates, 3)
    expect(plan.duplicateCount).toBe(1)
    expect(plan.accepted.map((item) => item.path)).toEqual(["C:\\Tools\\b.exe", "C:\\Tools\\c.exe"])
    expect(plan.overflowCount).toBe(0)
  })

  it("工具数量已达上限时全部计为 overflow", () => {
    const plan = planProgramAdditions(
      ["C:\\Tools\\a.exe"],
      [{
        name: "b",
        path: "C:\\Tools\\b.exe",
        source: "desktop",
      }],
      1,
    )
    expect(plan.accepted).toEqual([])
    expect(plan.overflowCount).toBe(1)
  })
})

describe("suggestProgramName", () => {
  it("优先扫描名称，其次由路径推导", () => {
    expect(suggestProgramName({
      name: "记事本",
      path: "C:\\Tools\\notepad.exe",
      source: "startMenu",
    })).toBe("记事本")
    expect(suggestProgramName({
      name: "",
      path: "C:\\Tools\\notepad.exe",
      source: "startMenu",
    }, "快捷方式")).toBe("notepad")
  })
})
