// gitPush 工具函数与多路径解析
import type { Ref } from "vue"
import type { FileChange, GitProject, GitRemoteInfo, PlatformKey, RemotePushStatus } from "./types"
import { FILE_STATUS_META, PLATFORM_META } from "./types"
import type { IconKey } from "@/config/icons"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 按 ID 查找项目（消除散落在各处的 projects.value.find 重复） */
export function findProject(projects: Ref<GitProject[]>, id: string): GitProject | undefined {
  return projects.value.find((p) => p.id === id)
}

/** 规范化路径用于去重比较（统一斜杠 + 去除末尾斜杠 + 小写） */
export function normalizePathForDedup(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
}

/** 收集项目的全部路径（主路径 + 多设备备选路径），已做去重规范化 */
export function getAllProjectPathsForDedup(project: GitProject): string[] {
  return [project.path, ...(project.localPaths || [])].map(normalizePathForDedup)
}

/** 限制 Record 缓存条目数，超过上限时删除最早的条目 */
export function pruneRecordCache(record: Record<string, any>, max = 30) {
  const keys = Object.keys(record)
  if (keys.length <= max) return
  for (const k of keys.slice(0, keys.length - max)) {
    delete record[k]
  }
}

/** 批次化并发处理：避免所有项目同时涌入 git 信号量导致排队拥堵 */
export async function batchProcess<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
  }
}

/** 搜索高亮片段：命中(hit=true)片段供模板包裹 <span class="gp-hl">，避免 v-html 带来的 XSS 风险 */
export interface HighlightSegment { text: string, hit: boolean }

/** 将文本按查询词（大小写不敏感）切分为命中/非命中片段序列 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const q = (query || "").trim()
  if (!q || !text) { return [{ text, hit: false }] }
  const lowerText = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  const segments: HighlightSegment[] = []
  let idx = 0
  let found = lowerText.indexOf(lowerQ, idx)
  while (found !== -1) {
    if (found > idx) { segments.push({ text: text.slice(idx, found), hit: false }) }
    segments.push({ text: text.slice(found, found + q.length), hit: true })
    idx = found + q.length
    found = lowerText.indexOf(lowerQ, idx)
  }
  if (idx < text.length) { segments.push({ text: text.slice(idx), hit: false }) }
  return segments
}

/** 平台 key → GitRemoteInfo 检测标志属性名映射 */
const PLATFORM_FLAG_BY_KEY: Record<PlatformKey, "isGithub" | "isGitee" | "isGitea" | "isCnb"> = {
  github: "isGithub",
  gitee: "isGitee",
  gitea: "isGitea",
  cnb: "isCnb",
}

/** 判断指定平台是否已存在于远程列表（远程名等于平台 key，或平台检测标志命中） */
export function hasPlatformRemote(remotes: GitRemoteInfo[], key: PlatformKey): boolean {
  const flagProp = PLATFORM_FLAG_BY_KEY[key]
  return remotes.some((r) => r.name === key || r[flagProp])
}

/** 向则项目是否配置了任何远程仓库 */
export function hasAnyRemote(project: GitProject): boolean {
  return PLATFORM_META.some((pm) => !!project[pm.remoteProp])
}

// ── 文件状态标记渲染辅助（WorkingTreePanel / StashSection 共用）──

/** 取文件状态的标记（字符或图标名，来自 FILE_STATUS_META） */
export function fileStatusIcon(file: FileChange): string {
  return FILE_STATUS_META[file.status]?.icon || "·"
}

/** renamed/unmerged 状态用 IconWrapper 渲染，其余为字符标记 */
export function isIconFileStatus(file: FileChange): boolean {
  return file.status === "renamed" || file.status === "unmerged"
}

/** isIconFileStatus 守卫下取图标键（forward/warning 均为已注册 IconKey） */
export function fileStatusIconKey(file: FileChange): IconKey {
  return fileStatusIcon(file) as IconKey
}

/** 文件状态悬停标题（重命名时附带旧路径） */
export function fileStatusTitle(file: FileChange): string {
  const title = FILE_STATUS_META[file.status]?.title || file.status
  return file.oldPath ? `${title}: ${file.oldPath} -> ${file.path}` : title
}

/** 获取项目已配置的远程名称列表（消除 4 处 for PLATFORM_META + project[pm.remoteProp] 重复模式） */
export function getProjectRemoteNames(project: GitProject): { key: PlatformKey, name: string }[] {
  const result: { key: PlatformKey, name: string }[] = []
  for (const pm of PLATFORM_META) {
    const name = project[pm.remoteProp] as string | undefined
    if (name) { result.push({ key: pm.key, name }) }
  }
  return result
}

/** 判断远程是否需要推送（noUpstream 或 ahead > 0，消除多处 .noUpstream || .ahead > 0 重复） */
export function isAheadOfRemote(rs: RemotePushStatus): boolean {
  return rs.noUpstream || rs.ahead > 0
}

/** diff 文本行类型（meta = diff --git / index / --- / +++ 等文件头行） */
export type DiffLineType = "add" | "del" | "hunk" | "ctx" | "meta"

/** 带类型的 diff 行（用于着色渲染），oldNo/newNo 为旧/新文件行号 */
export interface DiffLine {
  text: string
  type: DiffLineType
  oldNo?: number
  newNo?: number
}

/** diff 文件头行前缀（渲染时淡化显示，不参与行号计算） */
const DIFF_META_PREFIXES = ["diff --git", "index ", "--- ", "+++ ", "new file", "deleted file", "old mode", "new mode", "rename ", "copy ", "similarity ", "dissimilarity ", "Binary files", "\\ No newline"]

/** 将 diff 文本解析为带类型与行号的行数组（剥离行首 +/-/空格标记，标记改由渲染层的符号列展示） */
export function parseDiffLines(diffText: string): DiffLine[] {
  if (!diffText) return []
  let oldNo = 0
  let newNo = 0
  const result: DiffLine[] = []
  for (const line of diffText.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      result.push({ text: line, type: "hunk" })
    } else if ((oldNo === 0 && newNo === 0) || DIFF_META_PREFIXES.some((p) => line.startsWith(p))) {
      // 首个 hunk 之前的所有行、以及多文件 diff 中间的文件头行均为 meta
      result.push({ text: line, type: "meta" })
    } else if (line.startsWith("+")) {
      result.push({ text: line.slice(1), type: "add", newNo: newNo++ })
    } else if (line.startsWith("-")) {
      result.push({ text: line.slice(1), type: "del", oldNo: oldNo++ })
    } else {
      result.push({ text: line.slice(1), type: "ctx", oldNo: oldNo++, newNo: newNo++ })
    }
  }
  // 去掉文本末尾换行符经 split 产生的空行
  const last = result[result.length - 1]
  if (last && (last.type === "ctx" || last.type === "meta") && last.text === "") result.pop()
  return result
}

/** 将 git URL 转为浏览器可访问的 web URL */
export function gitUrlToWebUrl(url: string): string {
  // https://github.com/user/repo.git → https://github.com/user/repo
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url.replace(/\.git$/, "")
  }
  // git@github.com:user/repo.git → https://github.com/user/repo
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`
  }
  return url
}

/** 获取当前设备电脑名（os.hostname），非 Electron 环境降级返回空串 */
export function getCurrentDeviceName(): string {
  try {
    return getNodeFsPathOs()?.os.hostname() || ""
  } catch {
    return ""
  }
}

/**
 * 解析项目的有效本地路径（跨电脑适配核心）
 * 按优先级依次检测：主路径 path → localPaths 列表
 * 返回当前设备上实际存在的第一个路径；若皆不可用则降级返回主路径
 */
export function resolveValidPath(project: GitProject): string {
  return resolveValidPathWithSource(project).path
}

/**
 * 获取当前项目使用的有效路径（带标记信息）
 * 返回 { path, source } 其中 source 指示路径来源
 */
export function resolveValidPathWithSource(project: GitProject): { path: string, source: "primary" | "alternate" | "fallback" } {
  const modules = getNodeFsPathOs()
  const { fs } = modules || {}
  if (fs) {
    // 优先检测主路径
    try {
      if (fs.existsSync(project.path)) {
        return {
          path: project.path,
          source: "primary",
        }
      }
    } catch { /* skip */ }
    // 逐一检测备选路径
    if (project.localPaths) {
      for (const p of project.localPaths) {
        try {
          if (fs.existsSync(p)) {
            return {
              path: p,
              source: "alternate",
            }
          }
        } catch { /* skip */ }
      }
    }
  }
  // 降级
  return {
    path: project.path,
    source: "fallback",
  }
}
