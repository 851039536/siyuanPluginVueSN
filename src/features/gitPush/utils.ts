import type { Ref } from "vue"
import type { GitProject } from "./types"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 按 ID 查找项目（消除散落在各处的 projects.value.find 重复） */
export function findProject(projects: Ref<GitProject[]>, id: string): GitProject | undefined {
  return projects.value.find((p) => p.id === id)
}

/** 规范化路径用于去重比较（统一斜杠 + 去除末尾斜杠 + 小写） */
export function normalizePathForDedup(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
}

/**
 * 解析项目的有效本地路径（跨电脑适配核心）
 * 按优先级依次检测：主路径 path → localPaths 列表
 * 返回当前设备上实际存在的第一个路径；若皆不可用则降级返回主路径
 */
export function resolveValidPath(project: GitProject): string {
  const modules = getNodeFsPathOs()
  const { fs } = modules || {}
  const allPaths = [project.path, ...(project.localPaths || [])]
  if (fs) {
    for (const p of allPaths) {
      try {
        if (fs.existsSync(p)) {
          return p
        }
      } catch {
        // 权限不足或非法路径，继续检测下一个
      }
    }
  }
  // 降级：无 fs 模块或所有路径均无效时返回主路径
  return project.path
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
        return { path: project.path, source: "primary" }
      }
    } catch { /* skip */ }
    // 逐一检测备选路径
    if (project.localPaths) {
      for (const p of project.localPaths) {
        try {
          if (fs.existsSync(p)) {
            return { path: p, source: "alternate" }
          }
        } catch { /* skip */ }
      }
    }
  }
  // 降级
  return { path: project.path, source: "fallback" }
}
