// gitPush 工具函数与多路径解析
import type { Ref } from "vue"
import type { FileChange, GitProject, GitRemoteInfo, PlatformKey, RemotePushStatus } from "./types"
import { FILE_STATUS_META, PLATFORM_META } from "./types"
import type { IconKey } from "@/config/icons"
import { getElectronModules, getNodeFsPathOs } from "@/utils/nodeModules"

/** 按 ID 查找项目（消除散落在各处的 projects.value.find 重复） */
export function findProject(projects: Ref<GitProject[]>, id: string): GitProject | undefined {
  return projects.value.find((p) => p.id === id)
}

/** 按 ID 查找项目，未找到时抛错（错误文案经 handleGitOp/safeGitOp 展示给用户） */
export function requireProject(projects: Ref<GitProject[]>, id: string): GitProject {
  const project = findProject(projects, id)
  if (!project) throw new Error("项目未找到")
  return project
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
export async function batchProcess<T>(items: T[], batchSize: number, fn: (item: T, index: number) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map((item, j) => fn(item, i + j)))
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

/** 查找指定平台的首个命中远程（远程名等于平台 key，或平台检测标志命中） */
export function findPlatformRemote(remotes: GitRemoteInfo[], key: PlatformKey): GitRemoteInfo | undefined {
  const flagProp = PLATFORM_FLAG_BY_KEY[key]
  return remotes.find((r) => r.name === key || r[flagProp])
}

/** 判断指定平台是否已存在于远程列表（远程名等于平台 key，或平台检测标志命中） */
export function hasPlatformRemote(remotes: GitRemoteInfo[], key: PlatformKey): boolean {
  return !!findPlatformRemote(remotes, key)
}

/** 向则项目是否配置了任何远程仓库 */
export function hasAnyRemote(project: GitProject): boolean {
  return PLATFORM_META.some((pm) => !!project[pm.remoteProp])
}

/**
 * 归一化 git 仓库 URL（ssh/https/凭据/.git 后缀统一抹平为 host/path），
 * 两个 URL 归一化后相等即视为指向同一仓库（仓库链接一致性分析用）
 */
export function normalizeGitUrl(url: string): string {
  let s = url.trim().toLowerCase()
  if (!s) { return "" }
  // 剔除协议头（https:// / http:// / ssh:// / git://）
  s = s.replace(/^(?:https?|ssh|git):\/\//, "")
  // scp 短形式 git@host:path → host/path
  s = s.replace(/^([^/@]+@[^/:]+):/, "$1/")
  // 剔除凭据段 user(:pass)@
  s = s.replace(/^[^/@]+@/, "")
  // 去掉尾部 / 与 .git 后缀
  s = s.replace(/\/+$/, "").replace(/\.git$/, "")
  return s
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

/** 词级差异分段（changed=true 为行内真正变化的片段） */
export interface DiffSegment { text: string, changed: boolean }

/** 带类型的 diff 行（用于着色渲染），oldNo/newNo 为旧/新文件行号 */
export interface DiffLine {
  text: string
  type: DiffLineType
  oldNo?: number
  newNo?: number
  /** 词级差异分段（仅 add/del 行与对侧行配对成功时存在） */
  segments?: DiffSegment[]
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
  markInlineDiff(result)
  return result
}

// 行内变化占比阈值：中间变化片段超过此比例视为整行重写，不做词级高亮（高亮反而添噪）
const INLINE_DIFF_MAX_CHANGED_RATIO = 0.6

/** 对配对的 del/add 行做公共前缀/后缀裁剪，生成词级差异分段；变化过大或完全相同时返回 null */
function diffSegments(del: string, add: string): { del: DiffSegment[], add: DiffSegment[] } | null {
  const minLen = Math.min(del.length, add.length)
  let prefix = 0
  while (prefix < minLen && del[prefix] === add[prefix]) prefix++
  let suffix = 0
  while (suffix < minLen - prefix && del[del.length - 1 - suffix] === add[add.length - 1 - suffix]) suffix++
  const delMid = del.slice(prefix, del.length - suffix)
  const addMid = add.slice(prefix, add.length - suffix)
  if (!delMid && !addMid) return null
  const maxLen = Math.max(del.length, add.length)
  if (Math.max(delMid.length, addMid.length) / maxLen > INLINE_DIFF_MAX_CHANGED_RATIO) return null
  const build = (text: string, mid: string): DiffSegment[] => {
    const segs: DiffSegment[] = []
    if (prefix) segs.push({ text: text.slice(0, prefix), changed: false })
    if (mid) segs.push({ text: mid, changed: true })
    if (suffix) segs.push({ text: text.slice(text.length - suffix), changed: false })
    return segs
  }
  return { del: build(del, delMid), add: build(add, addMid) }
}

/** 后处理：将连续 del 块与紧随的 add 块按下标配对，为每对行生成词级差异分段 */
function markInlineDiff(lines: DiffLine[]): void {
  let i = 0
  while (i < lines.length) {
    if (lines[i].type !== "del") { i++; continue }
    const delStart = i
    while (i < lines.length && lines[i].type === "del") i++
    const addStart = i
    while (i < lines.length && lines[i].type === "add") i++
    const pairCount = Math.min(addStart - delStart, i - addStart)
    for (let k = 0; k < pairCount; k++) {
      const delLine = lines[delStart + k]
      const addLine = lines[addStart + k]
      const segs = diffSegments(delLine.text, addLine.text)
      if (segs) {
        delLine.segments = segs.del
        addLine.segments = segs.add
      }
    }
  }
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

/** 在文件管理器中打开本地路径（统一走 getElectronModules 入口，浏览器环境无能力打开本地文件夹） */
export async function openLocalPath(path: string): Promise<void> {
  await getElectronModules()?.shell?.openPath(path)
}

/** 在浏览器中打开远程仓库网页（Electron 用系统浏览器，降级 window.open） */
export async function openRepoWebUrl(url: string): Promise<void> {
  const webUrl = gitUrlToWebUrl(url)
  const shell = getElectronModules()?.shell
  if (shell?.openExternal) {
    await shell.openExternal(webUrl)
    return
  }
  window.open(webUrl, "_blank")
}

// ── 时间格式化与项目排序（纯函数，无 Vue 响应式依赖）──

/** 把 ISO 时间转为相对时间文案（i18n 驱动，含 {0} 数字占位），无法解析返回空 */
export function relativeTime(iso: string | undefined, i18n: Record<string, any>): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (isNaN(t)) return ""
  const diff = Date.now() - t
  const min = 60 * 1000; const hour = 60 * min; const day = 24 * hour
  if (diff < min) return i18n.timeJustNow
  if (diff < hour) return i18n.timeMinutesAgo.replace("{0}", String(Math.floor(diff / min)))
  if (diff < day) return i18n.timeHoursAgo.replace("{0}", String(Math.floor(diff / hour)))
  if (diff < 30 * day) return i18n.timeDaysAgo.replace("{0}", String(Math.floor(diff / day)))
  if (diff < 365 * day) return i18n.timeMonthsAgo.replace("{0}", String(Math.floor(diff / (30 * day))))
  return i18n.timeYearsAgo.replace("{0}", String(Math.floor(diff / (365 * day))))
}

/** 按活动时间分级（用于卡片颜色提示） */
export function activityLevel(iso?: string): "fresh" | "recent" | "stale" | "dead" {
  if (!iso) return "dead"
  const t = Date.parse(iso)
  if (isNaN(t)) return "dead"
  const day = 24 * 60 * 60 * 1000
  const diff = Date.now() - t
  if (diff < 7 * day) return "fresh"
  if (diff < 30 * day) return "recent"
  if (diff < 90 * day) return "stale"
  return "dead"
}

/** 全局排序：starred 优先 → lastActivity 降序 → name */
export function sortProjects(list: GitProject[]): GitProject[] {
  return [...list].sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1
    const ta = a.lastActivity ? Date.parse(a.lastActivity) : 0
    const tb = b.lastActivity ? Date.parse(b.lastActivity) : 0
    if (ta !== tb) return tb - ta
    return a.name.localeCompare(b.name)
  })
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
