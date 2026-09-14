// gitPush 项目查找/排序、多设备路径解析与本地·网页打开（纯函数，无响应式依赖）
import type { Ref } from "vue"
import type { GitProject } from "../types"
import { getElectronModules, getNodeFsPathOs } from "@/utils/nodeModules"

/** 按 ID 查找项目（消除散落在各处的 projects.value.find 重复） */
export function findProject(projects: Ref<GitProject[]>, id: string): GitProject | undefined {
  return projects.value.find((p) => p.id === id)
}

/** 按 ID 查找项目索引（消除散落在各处的 projects.value.findIndex 重复），未找到返回 -1 */
export function findProjectIndex(projects: Ref<GitProject[]>, id: string): number {
  return projects.value.findIndex((p) => p.id === id)
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
 * 从候选路径列表中解析当前设备上实际存在的首个路径（供编辑弹窗基于实时表单行重新检测远程）。
 * 与 resolveValidPath 不同：它不依赖已持久化的 GitProject，而是直接反映实时编辑中的路径。
 * 默认（strict=false）：皆不存在时降级返回首个非空路径；均为空返回空串。
 * strict=true：仅接受实际存在的路径；皆不存在时返回空串（调用方用于拒绝执行 git 写操作）。
 */
export function resolveValidPathFromPaths(paths: string[], opts?: { strict?: boolean }): string {
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
  return opts?.strict ? "" : candidates[0]
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
