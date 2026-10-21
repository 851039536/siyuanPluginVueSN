// gitPush 项目脚本识别：package.json scripts / .NET 命令 / 独立脚本文件扫描与命令构建
import type {
  PackageManager,
  ProjectScript,
  ScriptGroup,
  ScriptKind,
  ScriptScanResult,
} from "../types/scripts"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 识别到的 package.json 文件（相对路径 + 内容） */
export interface PackageJsonEntry {
  /** 相对项目根，POSIX 分隔符 */
  file: string
  content: string
}

/** 喂给 buildScriptGroups 的原始识别文件集合（纯数据，便于单测） */
export interface ScriptFileSet {
  /** 根目录文件名列表（仅文件名，用于锁文件判定包管理器） */
  rootFiles: string[]
  packages: PackageJsonEntry[]
  /** sln / csproj 相对路径 */
  dotnet: string[]
  /** 独立脚本文件（ps1/bat/cmd/sh）相对路径 */
  scriptFiles: string[]
  /** 执行环境平台（os.platform()，影响 ps1/bat 的解释器选择） */
  platform: string
}

/** 深度上限（防病态目录树；monorepo 包布局通常 ≤3 层） */
const MAX_DEPTH = 5
/** 遍历条目上限（超出即停止收集，防超大仓库卡死 UI） */
const MAX_ENTRIES = 3000
/** 独立脚本文件只收集到该目录深度（0=根目录，1=一级子目录，如 scripts/） */
const SCRIPT_FILE_MAX_DIR_DEPTH = 1
/** 遍历时跳过的目录（依赖/构建产物/IDE 配置） */
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".vs", ".idea", ".vscode",
  "bin", "obj", "dist", "out", "build", "coverage", "vendor", ".nuget",
])
/** 独立脚本文件扩展名 */
const SCRIPT_FILE_EXTS = new Set([".ps1", ".bat", ".cmd", ".sh"])

/** 含 shell 元字符/空白的参数加引号（拼命令行预览与 shell:true 的 spawn 共用） */
export function shellQuote(arg: string): string {
  if (!/[\s"&|<>^()%!]/.test(arg)) return arg
  return `"${arg.replace(/"/g, '\\"')}"`
}

/** 拼命令行预览字符串 */
export function formatCommandLine(command: string, args: string[]): string {
  return [command, ...args.map(shellQuote)].join(" ")
}

/** 按根目录锁文件判定包管理器（pnpm-lock > yarn.lock > npm 缺省） */
export function detectPackageManager(rootFiles: string[]): PackageManager {
  const names = new Set(rootFiles.map((f) => f.toLowerCase()))
  if (names.has("pnpm-lock.yaml")) return "pnpm"
  if (names.has("yarn.lock")) return "yarn"
  return "npm"
}

/** 解析 package.json 的 name 与 scripts（非 JSON / 无 scripts 返回 null） */
export function parsePackageJsonScripts(content: string): { name: string, scripts: Record<string, string> } | null {
  try {
    const data = JSON.parse(content) as { name?: unknown, scripts?: unknown }
    if (!data || typeof data !== "object" || !data.scripts || typeof data.scripts !== "object") return null
    const scripts: Record<string, string> = {}
    for (const [k, v] of Object.entries(data.scripts as Record<string, unknown>)) {
      if (typeof v === "string") scripts[k] = v
    }
    if (Object.keys(scripts).length === 0) return null
    return { name: typeof data.name === "string" ? data.name : "", scripts }
  } catch {
    return null
  }
}

function makeScript(partial: Omit<ProjectScript, "preview" | "id">): ProjectScript {
  return {
    ...partial,
    id: `${partial.kind}:${partial.source}:${partial.label}`,
    preview: formatCommandLine(partial.command, partial.args),
  }
}

/** 由 package.json scripts 构建前端命令分组 */
export function buildPackageGroup(
  root: string,
  file: string,
  pkgName: string,
  scripts: Record<string, string>,
  pm: PackageManager,
): ScriptGroup {
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ""
  const items = Object.entries(scripts).map(([name, detail]) =>
    makeScript({
      kind: "package",
      label: name,
      command: pm,
      args: ["run", name],
      cwd: root,
      source: file,
      detail,
    }),
  )
  return {
    kind: "package",
    source: dir ? `${dir} · ${pkgName || "package.json"}` : (pkgName || "package.json"),
    scripts: items,
  }
}

/**
 * 由 .sln / .csproj 构建 .NET 命令分组：
 * sln → restore/build/test/publish；csproj 额外含 run（dotnet run 仅支持项目级）
 */
export function buildDotnetGroup(root: string, file: string): ScriptGroup {
  const isProj = file.toLowerCase().endsWith(".csproj")
  const verbs: { verb: string, args: string[] }[] = [
    { verb: "restore", args: ["restore", file] },
    { verb: "build", args: ["build", file] },
    { verb: "test", args: ["test", file] },
    { verb: "publish", args: ["publish", file] },
  ]
  if (isProj) {
    verbs.splice(2, 0, { verb: "run", args: ["run", "--project", file] })
  }
  return {
    kind: "dotnet",
    source: file,
    scripts: verbs.map((v) =>
      makeScript({
        kind: "dotnet",
        label: v.verb,
        command: "dotnet",
        args: v.args,
        cwd: root,
        source: file,
        detail: "",
      }),
    ),
  }
}

/** 由独立脚本文件构建分组（按平台选解释器：ps1→powershell/pwsh，bat·cmd→cmd，sh→bash/sh） */
export function buildScriptFileGroup(root: string, files: string[], platform: string): ScriptGroup {
  const isWin = platform === "win32"
  const items = files.map((file) => {
    const lower = file.toLowerCase()
    let command: string
    let args: string[]
    if (lower.endsWith(".ps1")) {
      command = isWin ? "powershell" : "pwsh"
      args = isWin
        ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file]
        : ["-File", file]
    } else if (lower.endsWith(".bat") || lower.endsWith(".cmd")) {
      command = isWin ? "cmd" : "sh"
      args = isWin ? ["/c", file] : [file]
    } else {
      command = isWin ? "bash" : "sh"
      args = [file]
    }
    return makeScript({
      kind: "scriptFile",
      label: file.slice(file.lastIndexOf("/") + 1),
      command,
      args,
      cwd: root,
      source: file,
      detail: "",
    })
  })
  return {
    kind: "scriptFile",
    source: files.length > 0 && files[0].includes("/")
      ? files[0].slice(0, files[0].lastIndexOf("/"))
      : ".",
    scripts: items,
  }
}

/**
 * 按文件名相对路径归类脚本相关文件（纯函数，输入为遍历所得相对路径 + 根文件名）。
 * 过滤规则：跳过 SKIP_DIRS 中任意段；package.json / sln·csproj 全深度，独立脚本文件限 2 层。
 */
export function classifyScriptFiles(relPaths: string[]): Pick<ScriptFileSet, "packages" | "dotnet" | "scriptFiles"> {
  const packages: string[] = []
  const dotnet: string[] = []
  const scriptFiles: string[] = []
  for (const rel of relPaths) {
    const parts = rel.split("/")
    const depth = parts.length - 1
    if (parts.slice(0, -1).some((seg) => SKIP_DIRS.has(seg.toLowerCase()))) continue
    const name = parts[parts.length - 1]
    const lower = name.toLowerCase()
    if (lower === "package.json") {
      packages.push(rel)
    } else if (lower.endsWith(".sln") || lower.endsWith(".csproj")) {
      dotnet.push(rel)
    } else if (SCRIPT_FILE_EXTS.has(lower.slice(lower.lastIndexOf("."))) && depth <= SCRIPT_FILE_MAX_DIR_DEPTH) {
      scriptFiles.push(rel)
    }
  }
  return {
    packages: packages.map((file) => ({ file, content: "" })),
    dotnet,
    scriptFiles,
  }
}

/** 由识别文件集合构建全部脚本分组（纯聚合，IO 层与单测共用） */
export function buildScriptGroups(root: string, files: ScriptFileSet): ScriptScanResult {
  const pm = detectPackageManager(files.rootFiles)
  const groups: ScriptGroup[] = []
  for (const pkg of files.packages) {
    const parsed = parsePackageJsonScripts(pkg.content)
    if (parsed) groups.push(buildPackageGroup(root, pkg.file, parsed.name, parsed.scripts, pm))
  }
  for (const file of files.dotnet) {
    groups.push(buildDotnetGroup(root, file))
  }
  if (files.scriptFiles.length > 0) {
    groups.push(buildScriptFileGroup(root, files.scriptFiles, files.platform))
  }
  return { root, groups }
}

/** 目录项最小结构（fs.Dirent 子集） */
interface DirentLike {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
}

/** 深度优先遍历项目目录，收集脚本相关文件相对路径（POSIX 分隔符） */
function walkRelPaths(
  fsMod: { readdirSync: (path: string, opts: { withFileTypes: true }) => DirentLike[] },
  root: string,
): { relPaths: string[], rootFiles: string[] } {
  const relPaths: string[] = []
  const rootFiles: string[] = []
  let entries = 0
  const stack: { dir: string, rel: string, depth: number }[] = [{ dir: root, rel: "", depth: 0 }]
  while (stack.length > 0 && entries < MAX_ENTRIES) {
    const { dir, rel, depth } = stack.pop()!
    let dirents: DirentLike[]
    try {
      dirents = fsMod.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const d of dirents) {
      if (entries >= MAX_ENTRIES) break
      entries++
      const childRel = rel ? `${rel}/${d.name}` : d.name
      if (d.isDirectory()) {
        if (depth >= MAX_DEPTH) continue
        if (SKIP_DIRS.has(d.name.toLowerCase())) continue
        stack.push({ dir: `${dir}/${d.name}`, rel: childRel, depth: depth + 1 })
      } else if (d.isFile()) {
        if (rel === "") rootFiles.push(d.name)
        relPaths.push(childRel)
      }
    }
  }
  return { relPaths, rootFiles }
}

/**
 * 扫描项目根，识别前端 scripts / .NET 命令 / 独立脚本文件（IO 层）。
 * 无 Node fs 能力时返回空结果；单个文件读取失败仅跳过该文件。
 */
export function scanProjectScripts(root: string): ScriptScanResult {
  const empty: ScriptScanResult = { root, groups: [] }
  const mods = getNodeFsPathOs()
  if (!mods?.fs || !root) return empty
  const { fs } = mods
  let relPaths: string[]
  let rootFiles: string[]
  try {
    const walked = walkRelPaths(fs as unknown as { readdirSync: (p: string, o: { withFileTypes: true }) => DirentLike[] }, root)
    relPaths = walked.relPaths
    rootFiles = walked.rootFiles
  } catch {
    return empty
  }
  const classified = classifyScriptFiles(relPaths)
  const packages = classified.packages.map(({ file }) => {
    try {
      return { file, content: fs.readFileSync(`${root}/${file}`, "utf-8") as string }
    } catch {
      return null
    }
  }).filter((p): p is PackageJsonEntry => p !== null)
  return buildScriptGroups(root, {
    rootFiles,
    packages,
    dotnet: classified.dotnet,
    scriptFiles: classified.scriptFiles,
    platform: mods.os.platform(),
  })
}

/** 分组类别展示顺序（弹窗按此排序） */
export const SCRIPT_KIND_ORDER: ScriptKind[] = ["package", "dotnet", "scriptFile"]
