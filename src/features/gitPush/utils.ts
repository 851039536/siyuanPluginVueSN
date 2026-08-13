// gitPush 工具函数与多路径解析
import type { Ref } from "vue"
import type { CommitAnalysisEntry, CommitAnalysisType, FileChange, GitOpLogEntry, GitProject, GitRemoteInfo, PlatformKey, RemotePushStatus } from "./types"
import { COMMIT_ANALYSIS_TYPE_META, FILE_STATUS_META, HEAT_LEVEL_THRESHOLDS, PLATFORM_META } from "./types"
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

/**
 * 解析远程对应的平台元数据（按 GitRemoteInfo 检测标志匹配）。
 * 命中时返回 PLATFORM_META 条目（含统一 label/icon），用于让远程列表与仓库链接列表显示一致；
 * origin/upstream 等未识别为平台的自定义远程返回 undefined，由调用方回退显示原始远程名。
 */
export function resolveRemotePlatform(remote: GitRemoteInfo): typeof PLATFORM_META[number] | undefined {
  return PLATFORM_META.find((pm) => remote[PLATFORM_FLAG_BY_KEY[pm.key]])
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

/**
 * 解析 Conventional Commits 提交信息前缀类型（feat/fix/docs 等），无前缀或未知前缀返回 other。
 * 提交内容分析用；与 storage.ts 的 COMMIT_TYPE_VALUES（提交模板类型）各自独立。
 */
export function parseCommitAnalysisType(message: string): CommitAnalysisType {
  const match = /^([a-z]+)(?:\([^)]*\))?!?:\s/.exec(message || "")
  if (match) {
    const t = match[1] as CommitAnalysisType
    if (t in COMMIT_ANALYSIS_TYPE_META) return t
  }
  return "other"
}

/** ISO 日期 → YYYY-MM-DD（git %aI 为 UTC ISO，切前 10 位即可；无值返回 —；报告视图文件详情/活跃范围共用） */
export function formatIsoDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "—"
}

/** 本地日期格式化：Date → YYYY-MM-DD（日聚合/热力图共用，避免 UTC 解析在西半球时区跨日偏移） */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * 按本地日期（YYYY-MM-DD）聚合提交条目到最近 days 天的每日桶（缺天补 0），
 * 时间分析：返回从最早到今天的正序桶，供条形图直接渲染。
 */
export function buildDailyCommitBuckets(entries: CommitAnalysisEntry[], days = 30): { label: string, count: number }[] {
  const countByDay = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatLocalDate(d)
    countByDay.set(key, (countByDay.get(key) || 0) + 1)
  }
  const buckets: { label: string, count: number }[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const label = formatLocalDate(d)
    buckets.push({ label, count: countByDay.get(label) || 0 })
  }
  return buckets
}

/** 按本地日期（YYYY-MM-DD）聚合提交条目为日计数映射（热力图/日历视图共用，缺天不补 0） */
export function buildDayCountMap(entries: CommitAnalysisEntry[]): Map<string, number> {
  const countByDay = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatLocalDate(d)
    countByDay.set(key, (countByDay.get(key) || 0) + 1)
  }
  return countByDay
}

/** 热力等级：按 HEAT_LEVEL_THRESHOLDS 将日提交数映射为 0~4 级（0 次 → 0，≥12 次 → 4） */
export function heatLevel(count: number): number {
  let level = 0
  for (let i = HEAT_LEVEL_THRESHOLDS.length - 1; i > 0; i--) {
    if (count >= HEAT_LEVEL_THRESHOLDS[i]) { level = i; break }
  }
  return level
}

/** 解析热力图/日历显示范围：最近一年 = 今天−364 天 ~ 今天；年份 N = N-01-01 ~ 今年今天 / N-12-31 */
export function resolveAnalysisRange(range: "lastYear" | number): { start: Date, end: Date } {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  if (range === "lastYear") {
    const start = new Date(end)
    start.setDate(start.getDate() - 364)
    return { start, end }
  }
  const start = new Date(range, 0, 1)
  if (range < end.getFullYear()) end.setMonth(11, 31)
  return { start, end }
}

/** 热力格子背景色：level 0 用主题表面灰；level 1~4 用主色按 20%/40%/60%/85% 透明度（hex+alpha 后缀，深浅主题通用） */
export function heatCellColor(level: number, main: string): string {
  if (level <= 0) return "rgba(var(--b3-theme-on-surface-rgb), 0.05)"
  return `${main}${["33", "66", "99", "D9"][Math.min(level, 4) - 1]}`
}

/** 通用计数排行：按 keyFn 分组计数，降序取前 limit 条（项目/作者/类型排行共用） */
export function rankByCount<T>(items: T[], keyFn: (item: T) => string, limit: number): { key: string, count: number }[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
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

/** 条形宽度百分比（相对最大值，消除 CommitAnalysisPanel 中 4 个 computed 内的重复计算） */
export function barPct(count: number, max: number): string {
  return `${Math.round((count / max) * 100)}%`
}

/**
 * 为排行条目预计算条形宽度百分比。
 * max 取所有行中的最大值（兼容已排序降序的排行数据以及未排序的时间序列如 dailyCommits）。
 * zeroAsEmpty 为 true 时 count=0 的项返回 "0%"（如 dailyRows 留空柱）。
 */
export function withBarPct<T extends { count: number }>(
  rows: T[],
  opts?: { zeroAsEmpty?: boolean },
): (T & { pct: string })[] {
  const max = Math.max(...rows.map((r) => r.count), 1)
  return rows.map((r) => ({
    ...r,
    pct: opts?.zeroAsEmpty && r.count === 0 ? "0%" : barPct(r.count, max),
  }))
}

/** 净增行语义 class：正→`<prefix>--pos` / 负→`<prefix>--neg` / 零→`<prefix>--zero`（zeroSuffix 传空串时零值返回空串，不追加 class） */
export function netClass(net: number, prefix: string, zeroSuffix = "--zero"): string {
  if (net > 0) return `${prefix}--pos`
  if (net < 0) return `${prefix}--neg`
  return zeroSuffix === "" ? "" : `${prefix}${zeroSuffix}`
}

/** 行数排行条形/占比预计算：pct=相对最大新增行，share=新增行占总新增百分比（total=0 兜底防除零） */
export function withLineBarPct<T extends { added: number }>(rows: T[]): (T & { pct: string, share: string })[] {
  const max = Math.max(...rows.map((r) => r.added), 1)
  const total = rows.reduce((s, r) => s + r.added, 0) || 1
  return rows.map((r) => ({
    ...r,
    pct: `${Math.round((r.added / max) * 100)}%`,
    share: `${((r.added / total) * 100).toFixed(1)}%`,
  }))
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

/**
 * 从候选路径列表中解析当前设备上实际存在的首个路径（供编辑弹窗基于实时表单行重新检测远程）。
 * 与 resolveValidPath 不同：它不依赖已持久化的 GitProject，而是直接反映实时编辑中的路径。
 * 皆不存在时降级返回首个非空路径；均为空返回空串。
 */
export function resolveValidPathFromPaths(paths: string[]): string {
  const candidates = paths.map((p) => p.trim()).filter(Boolean)
  if (candidates.length === 0) { return "" }
  const fs = getNodeFsPathOs()?.fs
  if (fs) {
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) { return p }
      } catch { /* skip */ }
    }
  }
  return candidates[0]
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

// ── 操作日志工具函数（LogPanel / LogDetailDialog 共用）──

/** 判断操作日志条目是否包含平台明细（push/pull 且有 platforms 数据） */
export function hasLogPlatforms(entry: GitOpLogEntry): boolean {
  return (entry.action === "push" || entry.action === "pull") && !!entry.platforms?.length
}

/** 操作类型 → 中文标签（i18n 驱动，无匹配时降级返回原始 action） */
export function logActionLabel(action: string, i18n: Record<string, any>): string {
  const map: Record<string, string> = {
    push: i18n.opPush,
    pull: i18n.opPull,
    commit: i18n.opCommit,
  }
  return map[action] ?? action
}

/** ISO 时间 → YYYY-MM-DD HH:mm（无法解析时降级返回原值） */
export function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}
