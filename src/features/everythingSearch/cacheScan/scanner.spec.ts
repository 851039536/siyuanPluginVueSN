// 缓存扫描/清理执行器单测：体积统计、条目上限、年龄门槛、取消、以及删除守卫的全部拒绝路径
import type {
  CacheEntry,
  CacheRootDef,
  ResolvedCacheRoot,
} from "../types"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import {
  tmpdir,
} from "node:os"
import {
  join,
} from "node:path"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import {
  cleanCacheEntries,
  DEFAULT_MAX_ENTRIES,
  flattenCacheEntries,
  isAllowedCachePath,
  scanCacheRoots,
} from "./scanner"

/** 每个用例独立的临时根目录 */
let sandbox = ""

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "es-cache-spec-"))
})

afterEach(() => {
  try {
    rmSync(sandbox, { recursive: true, force: true })
  } catch {
    // 清理失败不掩盖断言结果
  }
})

/** 构造一个指向临时目录的根定义（`absolute` 解析，便于精确控制） */
function makeRootDef(dirPath: string, id: CacheRootDef["id"] = "userTemp"): CacheRootDef {
  return {
    id,
    labelKey: `cacheRoot${id}`,
    resolve: { kind: "absolute", path: dirPath },
    risk: "safe",
    icon: "eraser",
    defaultEnabled: true,
  }
}

/** 在沙箱里建文件并写入指定字节数 */
function writeSizedFile(relativePath: string, bytes: number): string {
  const target = join(sandbox, relativePath)
  mkdirSync(join(target, ".."), { recursive: true })
  writeFileSync(target, Buffer.alloc(bytes, 0x61))
  return target
}

/** 构造删除守卫用条目 */
function makeEntry(path: string, size = 100): CacheEntry {
  return {
    path,
    name: path.split("\\").pop() ?? "",
    isDirectory: false,
    size,
    modifiedTime: 0,
    rootId: "userTemp",
  }
}

/** 构造已解析根（供纯判定的守卫测试使用，无需真实目录） */
function makeResolvedRoot(dirPath: string): ResolvedCacheRoot {
  return { def: makeRootDef(dirPath), path: dirPath }
}

describe("scanCacheRoots（只读统计）", () => {
  it("递归统计目录体积与条目数，结果按体积降序", async () => {
    writeSizedFile("small.txt", 10)
    writeSizedFile("big.bin", 500)
    mkdirSync(join(sandbox, "nested", "deep"), { recursive: true })
    writeFileSync(join(sandbox, "nested", "deep", "x.dat"), Buffer.alloc(300, 0x62))

    const result = await scanCacheRoots({ roots: [makeRootDef(sandbox)] })
    const root = result.roots[0]

    // 根下 3 个一级条目：small.txt(10) / big.bin(500) / nested 目录(300)
    expect(root.files).toBe(3)
    expect(root.size).toBe(810)
    expect(root.entries.map(entry => entry.name)).toEqual(["big.bin", "nested", "small.txt"])
    expect(root.entries[0].size).toBe(500)
    expect(root.entries[1].isDirectory).toBe(true)
    expect(result.size).toBe(810)
    expect(result.files).toBe(3)
    expect(result.cancelled).toBe(false)
  })

  it("目录不存在时给出 missing 标记的空结果，不抛错", async () => {
    const missing = join(sandbox, "not-created")
    const result = await scanCacheRoots({ roots: [makeRootDef(missing)] })
    const root = result.roots[0]
    expect(root.files).toBe(0)
    expect(root.size).toBe(0)
    expect(root.message).toBe("missing")
  })

  it("条目上限生效并标记 truncated，且合计只统计保留的条目", async () => {
    for (let i = 0; i < 6; i++) writeSizedFile(`f${i}.bin`, 100 * (i + 1))

    const result = await scanCacheRoots({
      roots: [makeRootDef(sandbox)],
      maxEntries: 3,
    })
    const root = result.roots[0]

    expect(root.entries.length).toBe(3)
    expect(root.truncated).toBe(true)
    // 保留体积最大的 3 个：600 + 500 + 400
    expect(root.size).toBe(1500)
    expect(result.size).toBe(1500)
  })

  it("默认上限为 DEFAULT_MAX_ENTRIES（正数）", () => {
    expect(DEFAULT_MAX_ENTRIES).toBeGreaterThan(0)
  })

  it("未扫描到的根也出现在结果里，保持结构完整", async () => {
    writeSizedFile("a.txt", 1)
    const defs: CacheRootDef[] = [
      makeRootDef(sandbox, "userTemp"),
      makeRootDef(join(sandbox, "ghost"), "windowsTemp"),
    ]
    const result = await scanCacheRoots({ roots: defs })
    expect(result.roots.map(root => root.rootId).sort()).toEqual(["userTemp", "windowsTemp"])
  })

  it("onProgress 逐根回调，done 单调递增到 total", async () => {
    writeSizedFile("a.txt", 1)
    const seen: Array<{ done: number, total: number }> = []
    await scanCacheRoots({
      roots: [makeRootDef(sandbox)],
      onProgress: (progress) => {
        seen.push({ done: progress.done, total: progress.total })
      },
    })
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen[seen.length - 1]).toEqual({ done: 1, total: 1 })
  })

  it("已取消的 signal 使扫描立即返回并标记 cancelled", async () => {
    writeSizedFile("a.txt", 1)
    const controller = new AbortController()
    controller.abort()

    const result = await scanCacheRoots({
      roots: [makeRootDef(sandbox)],
      signal: controller.signal,
    })
    expect(result.cancelled).toBe(true)
    expect(result.size).toBe(0)
  })
})

describe("isAllowedCachePath（删除守卫）", () => {
  const rootPath = "C:\\Users\\me\\AppData\\Local\\Temp"
  const roots = [makeResolvedRoot(rootPath)]

  it("白名单根内的条目允许删除", () => {
    expect(isAllowedCachePath(`${rootPath}\\a.tmp`, roots)).toEqual({ allowed: true, reason: "" })
    expect(isAllowedCachePath(`${rootPath}\\sub\\b.tmp`, roots)).toEqual({ allowed: true, reason: "" })
  })

  it("根之外一律拒绝（outside）", () => {
    expect(isAllowedCachePath("C:\\Users\\me\\Documents\\a.txt", roots))
      .toEqual({ allowed: false, reason: "outside" })
    // 前缀相似但不是同一目录边界
    expect(isAllowedCachePath("C:\\Users\\me\\AppData\\Local\\TempX\\a.tmp", roots))
      .toEqual({ allowed: false, reason: "outside" })
  })

  it("等于根自身一律拒绝（不能把整个缓存根删掉）", () => {
    expect(isAllowedCachePath(rootPath, roots)).toEqual({ allowed: false, reason: "root" })
    expect(isAllowedCachePath(`${rootPath}\\`, roots)).toEqual({ allowed: false, reason: "root" })
    expect(isAllowedCachePath(rootPath.toLowerCase(), roots))
      .toEqual({ allowed: false, reason: "root" })
  })

  it("命中系统保护路径时优先拒绝（protected），即使它在白名单根内", () => {
    // 把一个系统区域伪装成白名单根，验证闸 1 先于闸 2
    const fakeRoot = "C:\\Windows"
    const fakeRoots = [makeResolvedRoot(fakeRoot)]
    expect(isAllowedCachePath("C:\\Windows\\System32\\kernel32.dll", fakeRoots))
      .toEqual({ allowed: false, reason: "protected" })
    expect(isAllowedCachePath("C:\\Windows\\Temp\\a.tmp", fakeRoots))
      .toEqual({ allowed: false, reason: "protected" })
  })

  it("空路径拒绝", () => {
    expect(isAllowedCachePath("", roots)).toEqual({ allowed: false, reason: "outside" })
    expect(isAllowedCachePath("   ", roots)).toEqual({ allowed: false, reason: "outside" })
  })

  it("大小写与分隔符差异不影响判定", () => {
    expect(isAllowedCachePath("c:/users/me/appdata/local/temp/中文 文件.tmp", roots))
      .toEqual({ allowed: true, reason: "" })
  })
})

describe("cleanCacheEntries（三重守卫下的删除）", () => {
  it("越界条目与根自身条目一律不删，且记入 failed", async () => {
    writeSizedFile("inside.tmp", 100)

    const outside = join(sandbox, "..", "outside-marker.txt")
    const result = await cleanCacheEntries({
      // 三条都不该被删：在白名单外 / 等于根本身 / 空路径
      entries: [
        makeEntry(outside),
        makeEntry(sandbox),
        makeEntry(""),
      ],
      mode: "permanent",
      roots: [makeRootDef(sandbox)],
    })

    expect(result.deleted).toBe(0)
    expect(result.failed).toBe(3)
    expect(result.errors.length).toBe(3)
    // 沙箱目录本身必须还在
    expect(existsSync(sandbox)).toBe(true)
  })

  it("永久删除模式只删白名单内的条目，freed 累加其体积", async () => {
    const keep = writeSizedFile("keep.tmp", 50)
    const target = writeSizedFile("gone.tmp", 200)

    const result = await cleanCacheEntries({
      entries: [makeEntry(target, 200)],
      mode: "permanent",
      roots: [makeRootDef(sandbox)],
    })

    expect(result.deleted).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.freed).toBe(200)
    expect(existsSync(target)).toBe(false)
    expect(existsSync(keep)).toBe(true)
  })

  it("回收站模式在纯 Node 环境不可用：记 failed 而非降级为永久删除", async () => {
    const target = writeSizedFile("recycle.tmp", 10)

    const result = await cleanCacheEntries({
      entries: [makeEntry(target, 10)],
      mode: "recycle",
      roots: [makeRootDef(sandbox)],
    })

    expect(result.deleted).toBe(0)
    expect(result.failed).toBe(1)
    // 关键断言：文件必须仍然存在（绝不允许悄悄改成永久删除）
    expect(existsSync(target)).toBe(true)
  })

  it("取消后排队的条目不再处理，结果标记 cancelled", async () => {
    const first = writeSizedFile("a.tmp", 10)
    const second = writeSizedFile("b.tmp", 10)
    const controller = new AbortController()

    const result = await cleanCacheEntries({
      entries: [makeEntry(first, 10), makeEntry(second, 10)],
      mode: "permanent",
      roots: [makeRootDef(sandbox)],
      signal: controller.signal,
      onProgress: (done) => {
        if (done === 1) controller.abort()
      },
    })

    expect(result.cancelled).toBe(true)
    expect(result.deleted).toBe(1)
  })
})

describe("flattenCacheEntries（平铺）", () => {
  it("空结果为 []，多根结果按体积降序合并", () => {
    expect(flattenCacheEntries(null)).toEqual([])

    const flattened = flattenCacheEntries({
      roots: [
        {
          rootId: "userTemp",
          path: "C:\\A",
          message: "",
          size: 30,
          files: 2,
          truncated: false,
          entries: [makeEntry("C:\\A\\s.tmp", 10), makeEntry("C:\\A\\b.tmp", 20)],
        },
        {
          rootId: "npmCache",
          path: "C:\\B",
          message: "",
          size: 90,
          files: 1,
          truncated: false,
          entries: [makeEntry("C:\\B\\big", 90)],
        },
      ],
      size: 120,
      files: 3,
      elapsed: 5,
      cancelled: false,
    })

    expect(flattened.map(entry => entry.size)).toEqual([90, 20, 10])
  })
})
