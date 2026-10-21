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

/** 拉平后的树行（目录行与文件行的判别联合） */
export type FileTreeRow = FileTreeDirRow | FileTreeFileRow

/** 目录中间节点（构建期内部形状，不对外导出） */
interface DirNode {
  path: string
  name: string
  depth: number
  /** 子目录（key = 目录段名，同层唯一） */
  dirs: Map<string, DirNode>
  /** 直接挂在目录下的文件（保持插入顺序） */
  files: FileChange[]
  /** 子树内变更文件总数（构建后填充） */
  count: number
}

/** 路径分隔符（git 输出统一为 /，含 Windows） */
const SEP = "/"

function makeDir(path: string, name: string, depth: number): DirNode {
  return { path, name, depth, dirs: new Map(), files: [], count: 0 }
}

/** 把单个变更文件按目录前缀插入目录树 */
function insertFile(root: DirNode, file: FileChange): void {
  const segs = file.path.split(SEP)
  let dir = root
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]
    let next = dir.dirs.get(seg)
    if (!next) {
      // 目录路径 = 前缀段重新拼接（不缓存增量前缀，段数少，直接拼可读性更好）
      next = makeDir(segs.slice(0, i + 1).join(SEP), seg, i + 1)
      dir.dirs.set(seg, next)
    }
    dir = next
  }
  dir.files.push(file)
}

/** 后序遍历填充各目录的子树文件总数 */
function computeCounts(dir: DirNode): number {
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
 *   「暂存优先 → 路径」排序的列表时，目录内文件即保持同序）。
 */
function emitRows(dir: DirNode, collapsed: ReadonlySet<string>, out: FileTreeRow[]): void {
  const children = [...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))
  for (const child of children) {
    out.push({
      type: "dir",
      key: child.path,
      name: child.name,
      path: child.path,
      depth: child.depth,
      count: child.count,
    })
    if (!collapsed.has(child.path)) emitRows(child, collapsed, out)
  }
  for (const file of dir.files) {
    out.push({
      type: "file",
      key: file.path,
      name: basename(file.path),
      path: file.path,
      depth: dir.depth,
      count: 1,
      file,
    } satisfies FileTreeFileRow)
  }
}

/**
 * 变更文件 → 拉平目录树行列表。
 * @param files 变更文件列表（建议传「暂存优先 → 路径」排序后的列表，目录内文件序与传入序一致）
 * @param collapsedDirs 已折叠目录的完整路径集合（命中即整棵子树不输出；目录行自身仍输出）
 */
export function buildFileTreeRows(files: FileChange[], collapsedDirs: ReadonlySet<string> = new Set()): FileTreeRow[] {
  const root = makeDir("", "", 0)
  for (const f of files) insertFile(root, f)
  computeCounts(root)
  const rows: FileTreeRow[] = []
  emitRows(root, collapsedDirs, rows)
  return rows
}

/** 收集顶层目录路径集合（「全部收起」用：收起顶层目录即可折叠整棵树） */
export function topLevelDirPaths(files: FileChange[]): string[] {
  const top = new Set<string>()
  for (const f of files) {
    const idx = f.path.indexOf(SEP)
    // idx > 0：排除 ".gitignore" 这类首字符为点的根级文件（indexOf 返回 -1）
    if (idx > 0) top.add(f.path.slice(0, idx))
  }
  return [...top]
}

/** 按关键词过滤变更文件（大小写不敏感的路径子串匹配；空词原样返回） */
export function filterFilesByQuery(files: FileChange[], query: string): FileChange[] {
  const q = query.trim().toLowerCase()
  if (!q) return files
  return files.filter((f) => f.path.toLowerCase().includes(q))
}
