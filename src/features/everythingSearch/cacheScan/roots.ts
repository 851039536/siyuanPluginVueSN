// 缓存根目录白名单：哪些目录允许扫描与删除的唯一真源
//
// ⚠️ 本表是删除白名单的**唯一真源**。新增/调整一条前必须确认：
//   1. 删掉它不影响 Windows 启动、不影响已装软件运行
//   2. 不在 `isProtectedPath()` 的保护名单内（否则会在删除守卫处被拦下）
//   3. 同时在中英文 i18n 的 `cacheRoot<Id>` 键登记（roots.spec.ts 会断言）
//
// 命名约定：`labelKey` 直接写 i18n 键名（扁平键，位于 `everythingSearch` 命名空间下）。

import type {
  CacheRootDef,
  CacheRootResolver,
  ResolvedCacheRoot,
} from "../types"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { normalizeWinPath } from "../utils"

/**
 * 缓存根目录定义（顺序即 UI 展示顺序：用户最常清理的排前面）。
 *
 * 风险等级取向：
 * - `safe`：删掉后程序自动重建，无可见副作用
 * - `caution`：删掉不致命，但有副作用（需重下安装包 / 可能被系统进程占用），默认不勾
 */
export const CACHE_ROOTS: readonly CacheRootDef[] = [
  {
    id: "userTemp",
    labelKey: "cacheRootUserTemp",
    // %TEMP% 指向 `C:\Users\<user>\AppData\Local\Temp`，是用户态临时文件的家
    resolve: { kind: "env", variable: "TEMP" },
    risk: "safe",
    icon: "eraser",
    defaultEnabled: true,
  },
  {
    id: "windowsTemp",
    labelKey: "cacheRootWindowsTemp",
    // 系统级临时目录：个被系统进程占用的文件会删除失败（已容错跳过），但残留文件全是垃圾
    resolve: { kind: "absolute", path: "C:\\Windows\\Temp" },
    risk: "caution",
    icon: "folder",
    defaultEnabled: false,
  },
  {
    id: "crashDumps",
    labelKey: "cacheRootCrashDumps",
    // 崩溃转储：只影响事后排障，删除无副作用
    resolve: { kind: "env", variable: "LOCALAPPDATA", segments: ["CrashDumps"] },
    risk: "safe",
    icon: "warning",
    defaultEnabled: true,
  },
  {
    id: "npmCache",
    labelKey: "cacheRootNpmCache",
    // npm 内容寻址缓存：删掉后 `npm install` 重新下载依赖，不影响已装包
    resolve: {
      kind: "candidates",
      list: [
        { kind: "env", variable: "LOCALAPPDATA", segments: ["npm-cache"] },
        { kind: "home", segments: [".npm", "_cacache"] },
      ],
    },
    risk: "safe",
    icon: "download",
    defaultEnabled: true,
  },
  {
    id: "devCache",
    labelKey: "cacheRootDevCache",
    // 构建工具缓存：vite / pnpm 等重新构建时重建
    resolve: {
      kind: "candidates",
      list: [
        { kind: "env", variable: "LOCALAPPDATA", segments: ["vite"] },
        { kind: "env", variable: "LOCALAPPDATA", segments: ["pnpm-cache"] },
        { kind: "env", variable: "LOCALAPPDATA", segments: ["esbuild"] },
        { kind: "env", variable: "LOCALAPPDATA", segments: ["typescript"] },
      ],
    },
    risk: "safe",
    icon: "code",
    defaultEnabled: true,
  },
  {
    id: "browserCache",
    labelKey: "cacheRootBrowserCache",
    // 浏览器磁盘缓存：默认不勾（用户多半正开着浏览器，且首访会变慢）
    // 只取 `Default` 配置的 Cache 子目录，不碰书签/密码/Cookie 等数据目录
    resolve: {
      kind: "candidates",
      list: [
        {
          kind: "env",
          variable: "LOCALAPPDATA",
          segments: ["Microsoft", "Edge", "User Data", "Default", "Cache"],
        },
        {
          kind: "env",
          variable: "LOCALAPPDATA",
          segments: ["Google", "Chrome", "User Data", "Default", "Cache"],
        },
        {
          kind: "env",
          variable: "LOCALAPPDATA",
          segments: ["BraveSoftware", "Brave-Browser", "User Data", "Default", "Cache"],
        },
      ],
    },
    risk: "caution",
    icon: "browser",
    defaultEnabled: false,
  },
  {
    id: "packageCache",
    labelKey: "cacheRootPackageCache",
    // 安装包缓存：删掉后「修复/卸载」已装程序需重新下载安装包，故默认不勾
    resolve: { kind: "absolute", path: "C:\\ProgramData\\Package Cache" },
    risk: "caution",
    icon: "databaseRemoveOutline",
    defaultEnabled: false,
  },
]

/** 拼接路径段（统一用 Windows 分隔符，末段不带分隔符） */
function joinSegments(base: string, segments: readonly string[]): string {
  let path = base.replace(/[\\/]+$/, "")
  for (const segment of segments) {
    const trimmed = segment.replace(/^[\\/]+|[\\/]+$/g, "")
    if (trimmed) path += `\\${trimmed}`
  }
  return path
}

/**
 * 把单个解析策略展开为候选绝对路径列表（已做环境变量/主目录展开，**不做存在性校验**）。
 * 环境变量或主目录不可用时返回空数组。
 */
function expandResolver(resolver: CacheRootResolver): string[] {
  switch (resolver.kind) {
    case "absolute":
      return [normalizeWinPath(resolver.path)]

    case "env": {
      const base = readEnv(resolver.variable)
      if (!base) return []
      return [normalizeWinPath(joinSegments(base, resolver.segments ?? []))]
    }

    case "home": {
      const fsPathOs = getNodeFsPathOs()
      if (!fsPathOs) return []
      let home = ""
      try {
        home = fsPathOs.os.homedir()
      } catch {
        return []
      }
      if (!home) return []
      return [normalizeWinPath(joinSegments(home, resolver.segments))]
    }

    case "candidates":
      return resolver.list.flatMap(item => expandResolver(item))

    default:
      return []
  }
}

/** 读取环境变量（Node 环境下 process.env 可用；纯浏览器返回空串） */
function readEnv(variable: string): string {
  try {
    const value = process.env[variable]
    return typeof value === "string" ? value.trim() : ""
  } catch {
    return ""
  }
}

/**
 * 判断候选路径是否为**真实目录**。
 * `statSync` 不跟随到「文件」上（同名文件不算缓存目录），异常一律视为不存在。
 */
function isExistingDirectory(target: string): boolean {
  const fsPathOs = getNodeFsPathOs()
  if (!fsPathOs) return false
  try {
    return fsPathOs.fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

/**
 * 解析缓存根目录：展开策略 → 过滤为真实存在的目录 → 去重。
 *
 * 解析失败（环境变量缺失 / 无 Node 环境 / 目录不存在）一律**静默跳过**，
 * 不抛异常 —— 缺几个根目录只是少扫几处，不该让整个面板失败。
 *
 * @param defs 根定义（默认 `CACHE_ROOTS`；测试可传入临时目录定义）
 * @returns 已解析的根（同一 id 可能对应多个目录）
 */
export function resolveCacheRoots(
  defs: readonly CacheRootDef[] = CACHE_ROOTS,
): ResolvedCacheRoot[] {
  const resolved: ResolvedCacheRoot[] = []
  const seen = new Set<string>()

  for (const def of defs) {
    for (const candidate of expandResolver(def.resolve)) {
      if (!candidate) continue
      const key = candidate.toLowerCase()
      if (seen.has(key)) continue
      if (!isExistingDirectory(candidate)) continue
      seen.add(key)
      resolved.push({ def, path: candidate })
    }
  }

  return resolved
}

/** 全部根目录的 i18n 标签键（供单测断言与 UI 兜底遍历） */
export const CACHE_ROOT_LABEL_KEYS: readonly string[] = CACHE_ROOTS.map(def => def.labelKey)

/** 按 id 取根定义（未知名返回 undefined） */
export function getCacheRootDef(id: string): CacheRootDef | undefined {
  return CACHE_ROOTS.find(def => def.id === id)
}
