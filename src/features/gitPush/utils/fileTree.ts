// gitPush 变更文件目录树构建（VS Code 源代码管理面板风格：目录分组折叠，供「变更目录树」弹窗使用）
//
// 输入为工作区 FileChange[]（路径以 / 分隔，git 输出跨平台统一），
// 输出为「目录行 + 文件行」交替的拉平行列表，模板单循环渲染，无需递归组件。
// 目录行可折叠：折叠时整棵子树不输出（子目录行也隐藏）。
import type { FileChange } from "../types"

/** 拉平后的目录行（type 判别联合的 dir 分支，模板 v-if 自动收窄） */
export interface FileTreeDirRow {
  type: "dir"
  /** 行唯一键 = 目录完整路径 */
  key: string
  /** 显示名：目录 basename */
  name: string
  /** 目录完整相对路径 */
  path: string
  /** 缩进层级（根 = 0） */
  depth: number
  /** 子树内变更文件总数 */
  count: number
}

/** 拉平后的文件行（type 判别联合的 file 分支，模板 v-else 自动收窄） */
export interface FileTreeFileRow {
  type: "file"
  /** 行唯一键 = 文件完整路径（同一工作区内唯一） */
  key: string
  /** 显示名：文件 basename */
  name: string
  /** 文件完整相对路径 */
  path: string
  /** 缩进层级（与其所在目录同层） */
  depth: number
  /** 恒 1（目录行计数的最小单元） */
  count: 1
  /** 原始变更条目 */
  file: FileChange
}

/** 树分区标识（已暂存 / 未暂存两个顶级分区，VS Code 源代码管理同构） */
export type FileTreeSectionId = "staged" | "unstaged"

/** 拉平后的分区行（顶级分组标题，可折叠；文案由视图层传入，模块层零文案） */
export interface FileTreeSectionRow {
  type: "section"
  /** 唯一键："section:staged" / "section:unstaged"（前缀避免与目录路径冲突） */
  key: string
  /** 分区标识 */
  section: FileTreeSectionId
  /** 显示名（视图层 i18n 文案，如「已暂存」） */
  name: string
  /** 分区行无路径语义，与 key 同值 */
  path: string
  /** 缩进层级（分区恒为顶级） */
  depth: 0
  /** 分区内变更文件数 */
  count: number
}

/** 拉平后的树行（分区行/目录行/文件行的判别联合） */
export type FileTreeRow = FileTreeSectionRow | FileTreeDirRow | FileTreeFileRow

/**
 * 目录中间节点（构建期内部形状，不对外导出）。
 * 文件项类型由调用方决定：变更树是 `FileChange`，工作区树是纯路径串 `string`。
 */
interface DirNode<T> {
  path: string
  name: string
  depth: number
  /** 子目录（key = 目录段名，同层唯一） */
  dirs: Map<string, DirNode<T>>
  /** 直接挂在目录下的文件项（保持插入顺序） */
  files: T[]
  /** 子树内文件总数（构建后填充） */
  count: number
}

/** 路径分隔符（git 输出统一为 /，含 Windows） */
const SEP = "/"

function makeDir<T>(path: string, name: string, depth: number): DirNode<T> {
  return { path, name, depth, dirs: new Map(), files: [], count: 0 }
}

/** 把单个文件项按目录前缀插入目录树（顶层目录 depth = 0，逐层 +1） */
function insertFile<T>(root: DirNode<T>, entry: T, pathOf: (entry: T) => string): void {
  const segs = pathOf(entry).split(SEP)
  let dir = root
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]
    let next = dir.dirs.get(seg)
    if (!next) {
      // 目录路径 = 前缀段重新拼接（不缓存增量前缀，段数少，直接拼可读性更好）
      next = makeDir(segs.slice(0, i + 1).join(SEP), seg, i)
      dir.dirs.set(seg, next)
    }
    dir = next
  }
  dir.files.push(entry)
}

/** 后序遍历填充各目录的子树文件总数 */
function computeCounts<T>(dir: DirNode<T>): number {
  let n = dir.files.length
  for (const child of dir.dirs.values()) n += computeCounts(child)
  dir.count = n
  return n
}

/** 取路径的 basename（最后一段；以最后一个 / 为准） */
function basename(path: string): string {
  const idx = path.lastIndexOf(SEP)
  return idx === -1 ? path : path.slice(idx + 1)
}

/**
 * 前序遍历输出拉平行列表：
 * - 每个目录先输出自身行（含子树计数），折叠命中则整棵子树跳过；
 * - 同层子目录按名排序且先于文件输出，文件保持插入顺序（调用方传入已按
 *   「暂存优先 → 路径」排序的列表时，目录内文件即保持同序）；
 * - 深度语义：文件行比其父目录行深一层（文件挂在目录内容下），
 *   dir.depthOffset = 目录自身缩进，file.depth = 父目录深度 + 1；
 * - depthOffset：分区结构下整体缩进偏移（分区行 depth 0，其下目录从 1 起）。
 *
 * @param contentDepth 本目录直属文件所在深度（= 目录深度 + 1；链式压缩后取最外层目录的深度 + 1）
 * @param compact 是否把「只有单个子目录且自身无文件」的链条合并成一行（`src/features/gitPush`）
 * @param toFileRow 文件项 → 文件行（变更树带 file 字段，工作区树不带，其余字段同形）
 */
function emitRows<T, F extends PathTreeFileRow>(
  dir: DirNode<T>,
  collapsed: ReadonlySet<string>,
  depthOffset: number,
  fileKeyPrefix: string,
  out: (FileTreeDirRow | F)[],
  contentDepth: number,
  compact: boolean,
  pathOf: (entry: T) => string,
  toFileRow: (entry: T, depth: number, key: string, path: string) => F,
): void {
  const children = [...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))
  for (const child of children) {
    // 链式压缩：沿唯一子目录一路下探，把中间层折叠进一行（VS Code 资源管理器同款行为）。
    // 深度取最外层目录的层级，键取最深路径（折叠这一行即折叠整条链）。
    let name = child.name
    let node = child
    if (compact) {
      while (node.files.length === 0 && node.dirs.size === 1) {
        const only = [...node.dirs.values()][0]
        name = `${name}/${only.name}`
        node = only
      }
    }
    out.push({
      type: "dir",
      key: node.path,
      name,
      path: node.path,
      depth: contentDepth + depthOffset,
      count: node.count,
    })
    if (!collapsed.has(node.path)) {
      emitRows(node, collapsed, depthOffset, fileKeyPrefix, out, contentDepth + 1, compact, pathOf, toFileRow)
    }
  }
  for (const entry of dir.files) {
    const path = pathOf(entry)
    // 键带分区前缀：部分暂存文件同路径在两个分区各出现一次，v-for 键必须唯一
    out.push(toFileRow(entry, contentDepth + depthOffset, `${fileKeyPrefix}${path}`, path))
  }
}

/** 通用树构建：任意「带路径的文件项」→ 拉平行列表（变更树 / 工作区树共用） */
function buildRows<T, F extends PathTreeFileRow>(
  entries: readonly T[],
  pathOf: (entry: T) => string,
  collapsedDirs: ReadonlySet<string>,
  depthOffset: number,
  fileKeyPrefix: string,
  compact: boolean,
  toFileRow: (entry: T, depth: number, key: string, path: string) => F,
): (FileTreeDirRow | F)[] {
  // 根为虚拟层（depth -1）：顶层目录 = 0、根级直属文件 = 0，文件恒比父目录深一层
  const root = makeDir<T>("", "", -1)
  for (const entry of entries) insertFile(root, entry, pathOf)
  computeCounts(root)
  const rows: (FileTreeDirRow | F)[] = []
  emitRows(root, collapsedDirs, depthOffset, fileKeyPrefix, rows, 0, compact, pathOf, toFileRow)
  return rows
}

/**
 * 变更文件 → 拉平目录树行列表。
 * @param files 变更文件列表（建议传「暂存优先 → 路径」排序后的列表，目录内文件序与传入序一致）
 * @param collapsedDirs 已折叠目录的完整路径集合（命中即整棵子树不输出；目录行自身仍输出）
 * @param depthOffset 整体缩进偏移（分区结构下传 1：分区行占 depth 0）
 * @param fileKeyPrefix 文件行键前缀（分区结构下传分区标识，保证跨分区键唯一；目录键不加前缀以共享折叠记忆）
 * @param compact 是否压缩单子目录链（窄侧栏里省下大量缩进；默认关闭以保持既有调用方行为）
 */
export function buildFileTreeRows(
  files: FileChange[],
  collapsedDirs: ReadonlySet<string> = new Set(),
  depthOffset = 0,
  fileKeyPrefix = "",
  compact = false,
): FileTreeRow[] {
  return buildRows<FileChange, FileTreeFileRow>(
    files,
    (file) => file.path,
    collapsedDirs,
    depthOffset,
    fileKeyPrefix,
    compact,
    (file, depth, key, path) => ({
      type: "file",
      key,
      name: basename(path),
      path,
      depth,
      count: 1,
      file,
    }),
  )
}

/**
 * 变更文件 → 「已暂存 / 未暂存」两分区的拉平树行（VS Code 源代码管理同构）。
 * - 部分暂存文件（staged && unstaged）**两侧分区都出现**（勾选态分别呈现，
 *   与 git 的两份差异语义一致）；仅工作区改动的文件只出现在未暂存区；
 * - 空分区整段省略（无已暂存文件时不渲染该分区标题）；
 * - 目录折叠键跨分区共享（同一路径在两区中折叠状态一致，记忆不翻倍）。
 * @param sections 分区标识与文件列表的配对（name 由视图层 i18n 填充，模块层零文案）
 * @param compact 是否压缩单子目录链（窄侧栏场景传 true）
 */
export function buildSectionedTreeRows(
  sections: { section: FileTreeSectionId, name: string, files: FileChange[] }[],
  collapsedDirs: ReadonlySet<string> = new Set(),
  compact = false,
): FileTreeRow[] {
  const rows: FileTreeRow[] = []
  for (const { section, name, files } of sections) {
    if (files.length === 0) continue
    rows.push({
      type: "section",
      key: `section:${section}`,
      section,
      name,
      path: `section:${section}`,
      depth: 0,
      count: files.length,
    })
    // 分区折叠时其下整棵树省略（分区行自身保留，折叠语义与目录行一致）
    if (collapsedDirs.has(`section:${section}`)) continue
    rows.push(...buildFileTreeRows(files, collapsedDirs, 1, `${section}:`, compact))
  }
  return rows
}

/** 按关键词过滤变更文件（大小写不敏感的路径子串匹配；空词原样返回） */
export function filterFilesByQuery(files: FileChange[], query: string): FileChange[] {
  const q = query.trim().toLowerCase()
  if (!q) return files
  return files.filter((f) => f.path.toLowerCase().includes(q))
}

// ── 整库文件树（工作区文件浏览器）：与变更文件共用同一套分组/折叠算法 ──

/** 工作区文件树的目录行（与变更树目录行同形，无变更语义） */
export interface PathTreeDirRow {
  type: "dir"
  key: string
  name: string
  path: string
  depth: number
  /** 子树内文件总数 */
  count: number
}

/** 工作区文件树的文件行 */
export interface PathTreeFileRow {
  type: "file"
  key: string
  name: string
  path: string
  depth: number
  count: 1
}

export type PathTreeRow = PathTreeDirRow | PathTreeFileRow

/** 收集路径列表涉及的**全部目录**（含各层父目录），供「未展开目录」补集计算使用 */
export function collectDirectoryPaths(paths: readonly string[]): string[] {
  const dirs = new Set<string>()
  for (const p of paths) {
    const segs = p.split(SEP)
    let prefix = ""
    for (let i = 0; i < segs.length - 1; i++) {
      prefix = i === 0 ? segs[0] : `${prefix}${SEP}${segs[i]}`
      dirs.add(prefix)
    }
  }
  return [...dirs]
}

/** 按关键词过滤路径（大小写不敏感的子串匹配；空词原样返回同一引用，避免大仓库无谓复制） */
export function filterPathsByQuery(paths: readonly string[], query: string): readonly string[] {
  const q = query.trim().toLowerCase()
  if (!q) return paths
  return paths.filter((p) => p.toLowerCase().includes(q))
}

/**
 * 工作区可见文件路径 → 拉平目录树行（VS Code Explorer 同构：目录展开才输出子树）。
 *
 * 复用变更树的构建算法（`buildFileTreeRows`），差别只在：
 * - 入参是纯路径（无暂存/变更元数据），输出行不带 `file` 字段；
 * - 折叠集由「已展开目录集」反推（`全部目录 - expandedDirs`），默认空集 = 全部收起，
 *   只渲染根层目录与根级文件（`collectDirectoryPaths` 由调用方一次算好传入更省）。
 * @param paths 可见文件路径（`/` 分隔，相对仓库根）
 * @param expandedDirs 已展开目录的完整路径集合（空集 = 全部收起）
 * @param depthOffset 整体缩进偏移（与变更树同义）
 */
export function buildPathTreeRows(
  paths: readonly string[],
  expandedDirs: ReadonlySet<string>,
  depthOffset = 0,
): PathTreeRow[] {
  const collapsed = collectDirectoryPaths(paths).filter((dir) => !expandedDirs.has(dir))
  // 直接以路径串为树项（不再为每条路径造一个一次性 FileChange：2 万文件会白扔 2 万个对象）
  return buildRows<string, PathTreeFileRow>(
    paths,
    (path) => path,
    new Set(collapsed),
    depthOffset,
    "",
    false,
    (_path, depth, key, path) => ({
      type: "file",
      // 文件键加类型前缀：已跟踪文件被目录替换时（git 仍列旧文件 `foo`，磁盘上 `foo/bar` 是未跟踪），
      // 目录行与文件行会同时出现在根层且路径同为 `foo`，不加前缀会导致 v-for 重复 key
      key: `f:${key}`,
      name: basename(path),
      path,
      depth,
      count: 1,
    }),
  )
}
