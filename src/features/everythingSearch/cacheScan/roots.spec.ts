// 缓存根白名单单测：id 完整性、i18n 键对齐、图标已注册、风险等级与默认勾选的一致性
import type { CacheRootId } from "../types"
import {
  readFileSync,
} from "node:fs"
import {
  join,
} from "node:path"
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  CACHE_ROOTS,
  CACHE_ROOT_LABEL_KEYS,
  getCacheRootDef,
} from "./roots"

/** 类型层面要求覆盖的 id 全集（新增 id 未进白名单时，此数组与 CACHE_ROOTS 的差异会直接失败） */
const EXPECTED_ROOT_IDS: CacheRootId[] = [
  "userTemp",
  "windowsTemp",
  "crashDumps",
  "browserCache",
  "packageCache",
  "npmCache",
  "devCache",
]

const I18N_ZH = join(process.cwd(), "src", "i18n", "zh_CN", "everythingSearch.json")
const I18N_EN = join(process.cwd(), "src", "i18n", "en_US", "everythingSearch.json")

/** 读取 i18n 分片的 everythingSearch 命名空间键集合 */
function readI18nKeys(filePath: string): Set<string> {
  const json = JSON.parse(readFileSync(filePath, "utf-8")) as {
    everythingSearch?: Record<string, unknown>
  }
  return new Set(Object.keys(json.everythingSearch ?? {}))
}

describe("CACHE_ROOTS（缓存白名单）", () => {
  it("id 集合与类型定义完全一致，无遗漏无多余", () => {
    const actual = CACHE_ROOTS.map(def => def.id).sort()
    expect(actual).toEqual([...EXPECTED_ROOT_IDS].sort())
  })

  it("id 不重复", () => {
    const ids = CACHE_ROOTS.map(def => def.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("除 windowsTemp 外，risk === caution 的分类一律默认不勾选", () => {
    for (const def of CACHE_ROOTS) {
      if (def.risk === "caution") {
        expect(def.defaultEnabled, `${def.id} 为 caution 却默认勾选`).toBe(false)
      }
    }
  })

  it("每条定义都带非空的 labelKey 与 icon", () => {
    for (const def of CACHE_ROOTS) {
      expect(def.labelKey.trim(), def.id).not.toBe("")
      expect(def.icon.trim(), def.id).not.toBe("")
    }
  })

  it("CACHE_ROOT_LABEL_KEYS 与定义顺序一致", () => {
    expect(CACHE_ROOT_LABEL_KEYS).toEqual(CACHE_ROOTS.map(def => def.labelKey))
  })

  it("getCacheRootDef 按 id 取到定义，未知 id 返回 undefined", () => {
    expect(getCacheRootDef("userTemp")?.id).toBe("userTemp")
    expect(getCacheRootDef("nonexistent")).toBeUndefined()
  })
})

describe("CACHE_ROOTS 的 i18n 契约", () => {
  it("每个 labelKey 在中英文分片中都存在", () => {
    const zh = readI18nKeys(I18N_ZH)
    const en = readI18nKeys(I18N_EN)
    for (const def of CACHE_ROOTS) {
      expect(zh.has(def.labelKey), `zh_CN 缺少 ${def.labelKey}`).toBe(true)
      expect(en.has(def.labelKey), `en_US 缺少 ${def.labelKey}`).toBe(true)
    }
  })
})

describe("CACHE_ROOTS 的图标契约", () => {
  it("每个 icon 都能在 kit/icons.ts 中找到注册项", () => {
    const iconsSource = readFileSync(
      join(process.cwd(), "src", "components", "kit", "icons.ts"),
      "utf-8",
    )
    for (const def of CACHE_ROOTS) {
      const pattern = new RegExp(`^\\s{2}${def.icon}:\\s*\\{`, "m")
      expect(pattern.test(iconsSource), `图标 ${def.icon} 未注册`).toBe(true)
    }
  })
})

describe("CACHE_ROOTS 的路径安全边界", () => {
  it("不收录系统保护目录（Windows / Program Files / ProgramData 本体 / 回收站等）", () => {
    /** 展开 resolver 的字面路径片段（只取 absolute 与 env/home 的 segments 末尾判断） */
    const collectLiteralPaths = (def: (typeof CACHE_ROOTS)[number]): string[] => {
      const out: string[] = []
      const walk = (resolver: typeof def.resolve): void => {
        if (resolver.kind === "absolute") {
          out.push(resolver.path)
          return
        }
        if (resolver.kind === "candidates") {
          for (const item of resolver.list) walk(item)
          return
        }
        // env / home：把变量名当占位符，仅拼接 segments 便于断言
        out.push([`%${resolver.kind === "env" ? resolver.variable : "HOME"}%`, ...(resolver.segments ?? [])].join("\\"))
      }
      walk(def.resolve)
      return out
    }

    const forbiddenRoots = [
      "C:\\Windows",
      "C:\\Windows\\System32",
      "C:\\Program Files",
      "C:\\Program Files (x86)",
      "C:\\ProgramData",
      "C:\\$Recycle.Bin",
      "C:\\System Volume Information",
      "C:\\Recovery",
    ]

    for (const def of CACHE_ROOTS) {
      for (const literal of collectLiteralPaths(def)) {
        for (const forbidden of forbiddenRoots) {
          expect(
            literal.toLowerCase(),
            `${def.id} 收录了受保护目录 ${forbidden}`,
          ).not.toBe(forbidden.toLowerCase())
        }
      }
    }
  })

  it("除 Package Cache 外，不直接收录 ProgramData 下的其他目录", () => {
    const absoluteProgramData = CACHE_ROOTS
      .flatMap((def) => {
        const out: string[] = []
        const walk = (resolver: typeof def.resolve): void => {
          if (resolver.kind === "absolute") {
            out.push(resolver.path)
            return
          }
          if (resolver.kind === "candidates") {
            for (const item of resolver.list) walk(item)
          }
        }
        walk(def.resolve)
        return out
      })
      .filter(path => /^c:\\programdata\\/i.test(path))

    expect(absoluteProgramData).toEqual(["C:\\ProgramData\\Package Cache"])
  })
})
