// gitPush 文件状态标记与文案辅助（字符/图标标记 + i18n 文案，工作区、提交文件列表、差异弹窗共用）
import type { FileChange } from "../types"
import { FILE_STATUS_META } from "../types"
import type { IconKey } from "@/config/icons"

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

/** 文件状态文案（元数据只存 titleKey，文案由视图层经 i18n 解析；未知状态回退原始状态码，避免出现空白标签） */
export function fileStatusText(file: FileChange, i18n: Record<string, any>): string {
  const key = FILE_STATUS_META[file.status]?.titleKey
  return (key && i18n[key]) || file.status
}

/** 文件状态悬停标题（重命名/复制时附带原路径） */
export function fileStatusTitle(file: FileChange, i18n: Record<string, any>): string {
  const title = fileStatusText(file, i18n)
  return file.oldPath ? `${title}: ${file.oldPath} -> ${file.path}` : title
}
