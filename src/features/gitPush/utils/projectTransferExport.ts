/**
 * 项目配置导出（给 GitDesk 桌面端）
 *
 * 生成的 JSON 与「数据管理 → 按模块导出」的 `ModuleExportPayload` v1 **同形**，
 * 但只带与项目相关的 4 个槽位：桌面端「导入项目配置」只认这几项，
 * 缓存槽（提交分析 / 行数 / 一致性 / 报告）带上只会把几十 KB 的配置撑到 MB 级。
 *
 * 契约真源：桌面端 `src/renderer/src/features/gitPush/types/projectTransfer.ts`
 * 的 `PROJECT_SLOT_KEYS` / `PROJECT_CONFIG_VERSION`。两侧键名必须一致，
 * 任何变更都要同步通知对方（见 AGENTS_STYLE.md「与桌面端 GitDesk 的对账」）。
 */
import type { CommitTemplate, GitProject, ProjectCategory } from "../types/storage"
import { UNGROUPED_ID } from "../types/storage"

/** 导出到桌面端时携带的槽位键（必须与桌面端 PROJECT_SLOT_KEYS 完全一致） */
export const PROJECT_TRANSFER_SLOT_KEYS = [
  "git-push-projects",
  "git-push-categories",
  "git-push-tags",
  "git-push-commit-templates",
] as const

export type ProjectTransferSlotKey = (typeof PROJECT_TRANSFER_SLOT_KEYS)[number]

/** 4 个槽位的内容（键名即插件 JSON_SLOTS 注册表里的 key） */
export interface ProjectTransferSlots {
  "git-push-projects": GitProject[]
  "git-push-categories": ProjectCategory[]
  "git-push-tags": string[]
  "git-push-commit-templates": CommitTemplate[]
}

/** 与插件 ModuleExportPayload v1 同形的载荷（桌面端无消费方，tables/schemas 恒空） */
export interface ProjectTransferPayload {
  version: 1
  exportedAt: number
  owners: ["gitPush"]
  slots: ProjectTransferSlots
  tables: Record<string, never>
  schemas: Record<string, never>
}

/** 未分组分类（文件里缺它时补齐，保证桌面端映射时一定有落点） */
const FALLBACK_UNGROUPED: ProjectCategory = {
  id: UNGROUPED_ID,
  name: "未分组",
  color: "#888888",
  order: 0,
}

/**
 * 剔除不该跨仓传递的字段：`pushProfileId` 指向敏感槽位 `git-push-profiles`（令牌密文），
 * 桌面端导入时该 id 必然悬空，带过去只会产生一条指向不存在账号的引用。
 */
function stripProjectForExport(project: GitProject): GitProject {
  const copy: GitProject = { ...project }
  delete copy.pushProfileId
  return copy
}

function withUngrouped(categories: ProjectCategory[]): ProjectCategory[] {
  const list = categories.map((category) => ({ ...category }))
  if (!list.some((category) => category.id === UNGROUPED_ID)) {
    list.unshift({ ...FALLBACK_UNGROUPED })
  }
  return list
}

/**
 * 构造给桌面端的项目配置载荷。
 *
 * 纯函数：四个槽位的内容由调用方读好后传入，便于单测断言形状；
 * `slots` 按白名单**重建**（不是过滤已有对象），因此不会混入未注册的键 ——
 * 插件侧 `parseModulePayload` 遇到未注册 key 会整份拒绝，桌面端侧则只会忽略，
 * 两边都要求「导出永远干净」。
 */
export function buildDesktopTransferPayload(input: {
  projects: GitProject[]
  categories: ProjectCategory[]
  tags: string[]
  templates: CommitTemplate[]
  exportedAt?: number
}): ProjectTransferPayload {
  return {
    version: 1,
    exportedAt: input.exportedAt ?? Date.now(),
    owners: ["gitPush"],
    slots: {
      "git-push-projects": input.projects.map(stripProjectForExport),
      "git-push-categories": withUngrouped(input.categories),
      "git-push-tags": [...input.tags],
      "git-push-commit-templates": input.templates.map((template) => ({ ...template })),
    },
    tables: {},
    schemas: {},
  }
}

/** 导出文件名（与桌面端导出同款命名，便于两边混放时一眼看出是同一类文件） */
export function desktopTransferFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return `gitdesk-projects-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
}
