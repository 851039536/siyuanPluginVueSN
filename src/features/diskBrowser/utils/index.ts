// 磁盘浏览器纯工具函数 — 磁盘枚举、卷标读取、目录读取、日期格式化
import type { Dirent } from "node:fs"
import type {
  DiskBrowserI18n,
  DiskInfo,
  FolderInfo,
} from "../types"
import {
  getNodeModules,
  getNodeProcessModules,
} from "@/utils/nodeModules"
import { isSystemEntry } from "./fileKind"

export * from "./fileKind"

/** 卷标查询超时（ms）——卷标是装饰性数据，超时即放弃，不拖慢面板 */
const VOLUME_LABEL_TIMEOUT = 2000

/** 探测的盘符：跳过 A: / B:（软驱保留位） */
const DRIVE_LETTERS = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("")

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * 枚举本机磁盘及其容量。
 *
 * 走 `fs.statfsSync` 逐盘符探测（本机实测 0ms 扫完 26 个盘符），
 * 不再依赖 wmic —— 该命令自 Windows 11 24H2 起已从系统中移除，
 * 旧实现因此恒失败并静默回退到伪造的盘符列表。
 *
 * @returns 磁盘列表；无 Node 环境或文件系统无 `statfsSync`（旧内核）时返回 `null`
 */
export function listDrives(): DiskInfo[] | null {
  const node = getNodeModules()
  if (!node || typeof node.fs.statfsSync !== "function") return null

  const drives: DiskInfo[] = []
  for (const letter of DRIVE_LETTERS) {
    const drive = `${letter}:`
    let total = 0
    let free = 0
    try {
      const stat = node.fs.statfsSync(`${drive}\\`)
      const blockSize = Number(stat.bsize)
      total = Number(stat.blocks) * blockSize
      free = Number(stat.bfree) * blockSize
    } catch {
      // 未挂载 / 无介质（空光驱）/ 无权限 → 跳过该盘符，不影响其余磁盘
      continue
    }
    // 总量为 0 或非有限值（空读卡器等）不构成可用磁盘
    if (!Number.isFinite(total) || total <= 0) continue

    const used = Math.max(0, total - (Number.isFinite(free) ? free : 0))
    drives.push({
      drive,
      label: readVolumeLabel(drive),
      total,
      used,
      usagePercent: Math.round((used / total) * 100),
    })
  }
  return drives
}

/**
 * 读取卷标（如「项目盘」）。
 *
 * 只用 `cmd` 的 `vol`：普通权限下 `fsutil` 被拒（实测 Access denied），
 * 注册表 `VolumeInfoCache` 可能含陈旧项。`vol` 的文案与编码随系统语言变化，
 * 故解析采取**容忍策略**，任何不确定一律返回空串 —— 卷标缺失不影响磁盘可用性。
 */
export function readVolumeLabel(drive: string): string {
  const node = getNodeProcessModules()
  if (!node) return ""
  try {
    // 前置 chcp 65001，让中文卷标以 UTF-8 输出而非跟随系统代码页
    const stdout = node.child_process.execSync(
      `cmd /c chcp 65001 >nul && vol ${drive}`,
      {
        timeout: VOLUME_LABEL_TIMEOUT,
        encoding: "utf8",
      },
    ) as string
    return parseVolumeLabel(stdout)
  } catch {
    return ""
  }
}

/**
 * 从 `vol` 输出解析卷标。
 *
 * ⚠️ `vol` 的输出编码随控制台代码页变化，且代码页状态可能被外部进程污染 ——
 * 实测同一台机器上不同调用可分别产出 UTF-8 与 GBK 字节。因此这里采取**宁缺勿滥**：
 * 只要解出的文本含替换字符（U+FFFD，即解码失败的痕迹）就判定不可信并返回空串，
 * 宁可少显示一个卷标，也绝不把乱码呈现给用户。
 */
function parseVolumeLabel(stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (/no label|没有标签|无标签/i.test(line)) return ""
    // 序列号行形如 "Volume Serial Number is XXXX-XXXX" / 「卷的序列号是 XXXX-XXXX」
    if (/serial|序列号/i.test(line)) continue
    const matched = line.match(/(?:\bis\b|是)\s+(.+?)[.。]?\s*$/)
    if (!matched) continue
    const label = matched[1].trim()
    // 解码失败留下的替换字符 ⇒ 整条不可信（见上方说明）
    if (!label || label.includes("\uFFFD")) return ""
    return label
  }
  return ""
}

/**
 * 解析当前用户的桌面目录绝对路径。
 *
 * 优先读注册表 `User Shell Folders\Desktop` —— 桌面可能被重定向到 OneDrive 或自定义位置
 * （`os.homedir()/Desktop` 在这种机器上会指向不存在或误导的路径）。
 * 注册表不可用（非 Windows / 被拒）时回退到 `homedir()/Desktop`，最后校验存在性。
 *
 * @returns 可用的桌面绝对路径；均不可用时返回 `null`
 */
export function resolveDesktopPath(): string | null {
  const node = getNodeModules()
  if (!node) return null

  const candidates: string[] = []

  // ① 注册表真实位置（可含环境变量，如 %USERPROFILE%）
  const proc = getNodeProcessModules()
  if (proc) {
    try {
      const stdout = proc.child_process.execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Desktop',
        { timeout: VOLUME_LABEL_TIMEOUT, encoding: "utf8" },
      ) as string
      // 形如：    Desktop    REG_EXPAND_SZ    C:\Users\xxx\Desktop
      const matched = stdout.match(/REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/m)
      if (matched) {
        candidates.push(expandEnvVars(matched[1].trim(), proc.os))
      }
    } catch {
      // 注册表不可用 → 走回退
    }
  }

  // ② 回退：家目录下的 Desktop（多数默认安装即此路径）
  if (proc) {
    try {
      candidates.push(node.path.join(proc.os.homedir(), "Desktop"))
    } catch {
      // homedir 不可用
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      if (node.fs.statSync(candidate).isDirectory()) return candidate
    } catch {
      // 该候选不存在 → 试下一个
    }
  }
  return null
}

/** 展开 `%VAR%` 环境变量（注册表 `REG_EXPAND_SZ` 常见形态） */
function expandEnvVars(value: string, os: { homedir: () => string }): string {
  return value.replace(/%([^%]+)%/g, (whole, name: string) => {
    if (/^users?profile$/i.test(name)) {
      try {
        return os.homedir()
      } catch {
        return whole
      }
    }
    // 其余变量交给 process.env（Node 在 Electron 渲染进程可用）
    return process.env[name] ?? whole
  })
}

/**
 * 使用 Node.js fs 模块读取目录内容。
 *
 * @returns 条目列表；返回 **`null` 表示读取失败**（无 Node 环境 / 目录不存在 / 无权限），
 *          与返回 `[]`（目录确实为空）区分开 —— 否则权限拒绝会被误报为「此文件夹为空」
 */
export function readDirectoryContents(dirPath: string): FolderInfo[] | null {
  const node = getNodeModules()
  if (!node) return null

  let entries: Dirent[]
  try {
    entries = node.fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return null
  }

  const separator = dirPath.endsWith("\\") ? "" : "\\"
  const items: FolderInfo[] = []

  for (const entry of entries) {
    // 系统文件（desktop.ini / thumbs.db 等）不展示：Windows 隐藏属性在 Node 下不可读，按名过滤
    if (isSystemEntry(entry.name)) continue

    const fullPath = `${dirPath}${separator}${entry.name}`

    if (entry.isDirectory()) {
      items.push({
        name: entry.name,
        path: fullPath,
      })
    } else if (entry.isFile()) {
      // 仅在文件时 stat，且失败时降级为无元数据项，避免一个坏文件拖垮整个目录
      try {
        const stat = node.fs.statSync(fullPath)
        items.push({
          name: entry.name,
          path: fullPath,
          isFile: true,
          size: stat.size,
          modifiedTime: stat.mtime.toISOString(),
        })
      } catch {
        items.push({
          name: entry.name,
          path: fullPath,
          isFile: true,
        })
      }
    }
  }

  items.sort((a, b) => {
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name, "zh-CN")
    return a.isFile ? 1 : -1
  })

  return items
}

function formatYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** 容量单位阶梯（1024 进制） */
const VOLUME_UNITS = ["B", "KB", "MB", "GB", "TB"]

/**
 * 磁盘容量紧凑格式化：**整数单位**（值 < 10 时保留 1 位小数）。
 *
 * 与共享 `@/utils/format` 的 `formatFileSize`（恒 2 位小数）区分：本函数专供
 * **窄侧栏**（`NavPane.scss` 的 `.db-nav`）单行展示 —— 完整精度放不下
 * （`274.66 GB` 单值即 9 字符），故取整为 `275 GB`。
 * 需要精确值时用 `formatFileSize`（本模块用于行 `title` 提示）。
 */
function formatVolume(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < VOLUME_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  // 小于 10 时取整会丢失有效精度（如 1.8 TB → 2 TB），故保留 1 位小数
  const text = unitIndex > 0 && value < 10 ? value.toFixed(1) : String(Math.round(value))
  return `${text} ${VOLUME_UNITS[unitIndex]}`
}

/**
 * 容量对的紧凑展示：**共用单位**，如 `275/290 GB`。
 *
 * 逐项调用 `formatVolume` 会得到 `275 GB / 290 GB`（16 字符），窄侧栏里必然折行；
 * 共用单位后为 `275/290 GB`（10 字符）。两者单位不一致时（极小分区）各自带单位，避免误读。
 */
export function formatVolumePair(used: number, total: number): string {
  const usedText = formatVolume(used)
  const totalText = formatVolume(total)
  const usedUnit = usedText.split(" ")[1]
  if (usedUnit !== totalText.split(" ")[1]) return `${usedText} / ${totalText}`
  return `${usedText.split(" ")[0]}/${totalText}`
}

/** 格式化修改时间：一周内用相对文案（今天 / 昨天 / N 天前），更早显示 YYYY-MM-DD */
export function formatDate(dateString: string, i18n: DiskBrowserI18n): string {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString

    // 未来日期（系统时间或文件时间异常）直接回退为日期字符串
    const diff = Date.now() - date.getTime()
    if (diff < 0) return formatYmd(date)

    const days = Math.floor(diff / DAY_MS)

    if (days === 0) return i18n.today ?? formatYmd(date)
    if (days === 1) return i18n.yesterday ?? formatYmd(date)
    if (days < 7) return i18n.daysAgo ? `${days} ${i18n.daysAgo}` : formatYmd(date)

    return formatYmd(date)
  } catch {
    return dateString
  }
}
