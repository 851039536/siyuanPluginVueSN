// gitPush ProjectCard 依赖注入契约（index.vue provide，卡片 inject，消除中间人 props/emits）
import type { InjectionKey, Ref } from "vue"
import type { GitPushManager } from "../GitPushManager"
import type { GitProject } from "./storage"

/** 卡片自持数据域（父层操作完成后经 cardRefreshSignals 按域通知卡片重载） */
export type CardDataDomain = "log" | "branches" | "stash" | "tags" | "conflicts"

/** 按项目 id 键控的刷新信号计数（域计数递增 = 该域需要重载） */
export type CardRefreshSignals = Record<string, Partial<Record<CardDataDomain, number>>>

/** 卡片可直接调用的父层服务（随自包含下沉批次逐步扩充） */
export interface CardServices {
  /** Git 操作门面（卡片经 manager 直取自持数据，不再走父层 Record 切片） */
  manager: GitPushManager
  /** 更新项目元信息并同步父层项目列表（useProjectCrud 版本，含 patchProject 本地同步） */
  updateProjectMeta: (id: string, patch: Partial<Pick<GitProject, "name">>) => Promise<GitProject | null>
  /** 父层操作（提交/stash/tag/冲突/批量刷新）完成后的按域重载信号，卡片 watch 响应 */
  cardRefreshSignals: Ref<CardRefreshSignals>
  /** 提交日志加载后同步项目最近活动时间（原 useGitOps.loadCommitLog 的副作用） */
  recordCommitActivity: (id: string, isoTime: string) => Promise<void>
}

export const CARD_SERVICES_KEY: InjectionKey<CardServices> = Symbol("gitPushCardServices")
