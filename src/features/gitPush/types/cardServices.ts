// gitPush ProjectCard 依赖注入契约（index.vue provide，卡片 inject，消除中间人 props/emits）
import type { InjectionKey } from "vue"
import type { GitProject } from "./storage"

/** 卡片可直接调用的父层服务（随自包含下沉批次逐步扩充） */
export interface CardServices {
  /** 更新项目元信息并同步父层项目列表（useProjectCrud 版本，含 patchProject 本地同步） */
  updateProjectMeta: (id: string, patch: Partial<Pick<GitProject, "name">>) => Promise<GitProject | null>
}

export const CARD_SERVICES_KEY: InjectionKey<CardServices> = Symbol("gitPushCardServices")
