// gitPush 项目搜索纯函数（关键词归一化 + 多字段匹配；无响应式依赖，供筛选管道与单测共用）
// 直连 types/storage 而非 "../types" 桶：桶含 GitPushManager 等运行时模块，会拖累 Node 单测环境。
import type { GitProject } from "../types/storage"

/** 归一化搜索词：去首尾空白 + 小写；空串表示不过滤 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

/**
 * 项目的可搜索文本字段（统一小写）。
 * 覆盖展示层所有可辨识信息：名称、主/备路径、标签、备注、各平台远程 URL、设备名与分类名。
 */
export function projectSearchFields(project: GitProject, categoryName = ""): string[] {
  return [
    project.name,
    project.path,
    ...(project.localPaths ?? []),
    ...(project.tags ?? []),
    project.note ?? "",
    project.githubUrl ?? "",
    project.giteeUrl ?? "",
    project.giteaUrl ?? "",
    project.cnbUrl ?? "",
    ...Object.values(project.pathDevices ?? {}),
    categoryName,
  ]
    .filter((field) => field.length > 0)
    .map((field) => field.toLowerCase())
}

/** 项目是否命中搜索词（任一字段包含即命中）；空搜索词视为全部命中 */
export function matchProjectQuery(project: GitProject, query: string, categoryName = ""): boolean {
  const q = normalizeSearchQuery(query)
  if (!q) return true
  return projectSearchFields(project, categoryName).some((field) => field.includes(q))
}
