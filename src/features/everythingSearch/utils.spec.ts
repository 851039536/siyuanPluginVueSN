// everythingSearch 纯函数单测：查询表达式组装、Windows 路径防护判定、日期解析、体积聚合
import {
  buildSearchQuery,
  getFullPath,
  hasPathFilter,
  isPathInside,
  isProtectedPath,
  normalizeWinPath,
  parseEverythingDate,
  sizeSeverity,
  summarizeSize,
} from "./utils"
import {
  describe,
  expect,
  it,
} from "vitest"

describe("buildSearchQuery（Everything 表达式组装）", () => {
  it("仅关键词时原样返回，且首尾空白被裁剪", () => {
    expect(buildSearchQuery({ query: "  report.pdf  " })).toBe("report.pdf")
  })

  it("大小过滤按单位小写追加，且 0 视为不启用", () => {
    expect(buildSearchQuery({ query: "a", minSize: 100, minSizeUnit: "MB" }))
      .toBe("a size:>100mb")
    expect(buildSearchQuery({ query: "a", maxSize: 2, maxSizeUnit: "GB" }))
      .toBe("a size:<2gb")
    expect(buildSearchQuery({ query: "a", minSize: 0, maxSize: 0 })).toBe("a")
  })

  it("空文件夹模式追加 empty: 且跳过大小过滤（empty 的 size 恒为 0）", () => {
    expect(buildSearchQuery({ emptyFolders: true, minSize: 10, maxSize: 20 }))
      .toBe("empty:")
    expect(buildSearchQuery({ query: "docs", emptyFolders: true, minSize: 10 }))
      .toBe("docs empty:")
  })

  it("路径过滤仅在开关开启时生效，开关关闭时保留配置也不拼入", () => {
    const paths = ["D:\\A", "D:\\B"]
    expect(buildSearchQuery({ query: "x", includePaths: paths, includePathsEnabled: false }))
      .toBe("x")
    expect(buildSearchQuery({ query: "x", includePaths: paths, includePathsEnabled: true }))
      .toBe('x path:"D:\\A" path:"D:\\B"')
  })

  it("排除路径加 ! 前缀，空行被丢弃", () => {
    expect(buildSearchQuery({
      query: "x",
      excludePathsEnabled: true,
      excludePaths: ["  ", "D:\\tmp"],
    })).toBe('x !path:"D:\\tmp"')
  })

  it("路径中的引号被剔除，避免提前截断表达式", () => {
    expect(buildSearchQuery({
      includePathsEnabled: true,
      includePaths: ['D:\\a"b'],
    })).toBe('path:"D:\\ab"')
  })

  it("无任何条件时返回空串", () => {
    expect(buildSearchQuery({})).toBe("")
    expect(buildSearchQuery({ query: "   " })).toBe("")
  })
})

describe("hasPathFilter（路径过滤是否生效）", () => {
  it("开关开启且存在非空路径才算生效", () => {
    expect(hasPathFilter({ includePathsEnabled: true, includePaths: ["D:\\a"] })).toBe(true)
    expect(hasPathFilter({ includePathsEnabled: true, includePaths: ["  "] })).toBe(false)
    expect(hasPathFilter({ includePathsEnabled: false, includePaths: ["D:\\a"] })).toBe(false)
    expect(hasPathFilter({ excludePathsEnabled: true, excludePaths: ["D:\\b"] })).toBe(true)
  })
})

describe("normalizeWinPath（仅用于比较）", () => {
  it("统一分隔符与盘符大小写并去掉末尾分隔符", () => {
    expect(normalizeWinPath("c:/Windows/System32/")).toBe("C:\\Windows\\System32")
  })

  it("保留盘符根的分隔符", () => {
    expect(normalizeWinPath("d:\\")).toBe("D:\\")
  })

  it("剥离长路径前缀，UNC 前缀单独处理", () => {
    expect(normalizeWinPath("\\\\?\\C:\\temp")).toBe("C:\\temp")
    expect(normalizeWinPath("\\\\?\\UNC\\server\\share")).toBe("\\\\server\\share")
  })

  it("折叠重复分隔符但保留 UNC 开头双斜杠", () => {
    expect(normalizeWinPath("C:\\\\a\\\\b")).toBe("C:\\a\\b")
    expect(normalizeWinPath("\\\\server\\\\share")).toBe("\\\\server\\share")
  })
})

describe("isProtectedPath（删除前的系统路径守卫）", () => {
  it("盘符根下的一级系统目录全部受保护（含子路径）", () => {
    for (const p of [
      "C:\\Windows",
      "C:\\Windows\\System32\\drivers\\etc\\hosts",
      "C:\\Program Files\\App\\x.exe",
      "C:\\Program Files (x86)\\y",
      "C:\\ProgramData\\z",
      "D:\\$RECYCLE.BIN\\S-1-5-21",
      "E:\\System Volume Information",
      "C:\\boot",
    ]) {
      expect(isProtectedPath(p), p).toBe(true)
    }
  })

  it("盘符根下的关键系统文件受保护", () => {
    for (const p of ["C:\\pagefile.sys", "C:\\hiberfil.sys", "C:\\swapfile.sys", "C:\\bootmgr"]) {
      expect(isProtectedPath(p), p).toBe(true)
    }
  })

  it("任意层级出现系统区域片段时受保护", () => {
    for (const p of [
      "C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows\\Explorer",
      "C:\\Users\\me\\AppData\\Local\\Packages\\Foo\\Temp",
      "C:\\Windows\\System32",
    ]) {
      expect(isProtectedPath(p), p).toBe(true)
    }
  })

  it("纯盘符根不可删；普通缓存路径不受保护", () => {
    expect(isProtectedPath("C:")).toBe(true)
    expect(isProtectedPath("C:\\Users\\me\\AppData\\Local\\Temp\\a.tmp")).toBe(false)
    expect(isProtectedPath("D:\\Work\\node_modules\\.cache\\x")).toBe(false)
    // Windows 目录名但不在盘符根（磁盘上的普通同名目录）不受保护
    expect(isProtectedPath("D:\\Backup\\Windows\\note.txt")).toBe(false)
  })

  it("大小写与分隔符不影响判定，空路径判为不受保护", () => {
    expect(isProtectedPath("c:/windows/system32")).toBe(true)
    expect(isProtectedPath("")).toBe(false)
    expect(isProtectedPath("   ")).toBe(false)
  })

  it("仅按盘符根下一级目录名匹配，不误伤形似目录（Program FilesX 是独立目录）", () => {
    // `Program FilesX` 并非系统目录，但受保护表按完整一级段匹配，故此处应为 false
    expect(isProtectedPath("C:\\Program FilesX\\a")).toBe(false)
  })
})

describe("isPathInside（白名单包含性校验）", () => {
  it("自身与子路径为真，父路径与形似前缀为假", () => {
    expect(isPathInside("C:\\a\\b", "C:\\a")).toBe(true)
    expect(isPathInside("C:\\a", "C:\\a")).toBe(true)
    expect(isPathInside("C:\\a", "C:\\a\\b")).toBe(false)
    // `C:\ab` 不应被 `C:\a` 判定为内部（前缀必须落在分隔符边界）
    expect(isPathInside("C:\\ab", "C:\\a")).toBe(false)
  })

  it("大小写不敏感，路径分隔符差异可对齐", () => {
    expect(isPathInside("c:/users/me/appdata/local/temp", "C:\\Users\\me\\AppData\\Local\\Temp"))
      .toBe(true)
  })
})

describe("getFullPath（Everything 分段路径拼接）", () => {
  it("普通目录拼一个分隔符，盘符根不产生双分隔符", () => {
    expect(getFullPath({ path: "C:\\Users", name: "a.txt" })).toBe("C:\\Users\\a.txt")
    expect(getFullPath({ path: "C:\\", name: "a.txt" })).toBe("C:\\a.txt")
  })

  it("空路径时退化为纯文件名", () => {
    expect(getFullPath({ path: "", name: "a.txt" })).toBe("a.txt")
  })
})

describe("parseEverythingDate（多来源时间戳归一）", () => {
  it("Windows FILETIME 换算为毫秒时间戳", () => {
    // 2024-01-01T00:00:00Z ⇒ (1704067200000 + 11644473600000) * 10000 = 133485408000000000
    expect(parseEverythingDate(133485408000000000)).toBe(1704067200000)
  })

  it("毫秒与秒时间戳按量级区分", () => {
    expect(parseEverythingDate(1704067200000)).toBe(1704067200000)
    expect(parseEverythingDate(1704067200)).toBe(1704067200000)
  })

  it("字符串按 Date.parse 解析，无效值返回 null", () => {
    expect(parseEverythingDate("2024-01-01T00:00:00Z")).toBe(1704067200000)
    expect(parseEverythingDate("not-a-date")).toBeNull()
    expect(parseEverythingDate(0)).toBeNull()
    expect(parseEverythingDate(null)).toBeNull()
    expect(parseEverythingDate("")).toBeNull()
  })
})

describe("summarizeSize（体积与条目数聚合）", () => {
  it("累加合法尺寸，非法/负数按 0 计但条目数仍统计", () => {
    expect(summarizeSize([{ size: 10 }, { size: 0 }, { size: -5 }, { size: Number.NaN }, {}]))
      .toEqual({ size: 10, files: 5 })
    expect(summarizeSize([{ size: 1 }, { size: 2 }])).toEqual({ size: 3, files: 2 })
    expect(summarizeSize([])).toEqual({ size: 0, files: 0 })
  })
})

describe("sizeSeverity（用量配色分档）", () => {
  it("按 50% / 80% 分三档，非法比例按最低档", () => {
    expect(sizeSeverity(0.1)).toBe("primary")
    expect(sizeSeverity(0.5)).toBe("warning")
    expect(sizeSeverity(0.79)).toBe("warning")
    expect(sizeSeverity(0.8)).toBe("danger")
    expect(sizeSeverity(Number.NaN)).toBe("primary")
  })
})
