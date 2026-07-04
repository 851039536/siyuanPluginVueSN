// gitPush 工具函数与多路径解析
import type { Ref } from "vue"
import type { GitProject, RemotePushStatus } from "./types"
import { PLATFORM_META } from "./types"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 按 ID 查找项目（消除散落在各处的 projects.value.find 重复） */
export function findProject(projects: Ref<GitProject[]>, id: string): GitProject | undefined {
  return projects.value.find((p) => p.id === id)
}

/** 规范化路径用于去重比较（统一斜杠 + 去除末尾斜杠 + 小写） */
export function normalizePathForDedup(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
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

/** 判断项目是否配置了任何远程仓库 */
export function hasAnyRemote(project: GitProject): boolean {
  return PLATFORM_META.some((pm) => !!project[pm.remoteProp])
}

/** 判断远程是否需要推送（noUpstream 或 ahead > 0，消除多处 .noUpstream || .ahead > 0 重复） */
export function isAheadOfRemote(rs: RemotePushStatus): boolean {
  return rs.noUpstream || rs.ahead > 0
}

/** diff 文本行类型 */
export type DiffLineType = "add" | "del" | "hunk" | "ctx"

/** 带类型的 diff 行（用于着色渲染） */
export interface DiffLine { text: string, type: DiffLineType }

/** 将 diff 文本解析为带类型的行数组（用于着色渲染） */
export function parseDiffLines(diffText: string): DiffLine[] {
  if (!diffText) return []
  return diffText.split("\n").map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) { return { text: line, type: "add" } }
    if (line.startsWith("-") && !line.startsWith("---")) { return { text: line, type: "del" } }
    if (line.startsWith("@@")) { return { text: line, type: "hunk" } }
    return { text: line, type: "ctx" }
  })
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
