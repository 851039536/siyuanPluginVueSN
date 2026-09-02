// gitPush 卡片服务注入与单项目派生（ProjectCard 及其区块组件经此取父层服务，消除中间人 props/emits）
import type { ComputedRef } from "vue"
import { computed, inject } from "vue"
import type {
  CardServices,
  GitProject,
  PushOutputEntry,
  PushStatusInfo,
  WorkingTreeInfo,
} from "../types"
import { CARD_SERVICES_KEY } from "../types"

/**
 * 卡片服务注入 + 按 project.id 派生单项目值的统一入口。
 * 传入 project 访问器（保持实时指向当前项目对象），返回 services 引用与全部派生 computed。
 * CardHeader / CardRemotes / CardActionBar 及 ProjectCard 编排层共用，杜绝重复写 inject/computed。
 */
export function useCardServices(project: () => GitProject): {
  services: CardServices
  pushStatus: ComputedRef<PushStatusInfo | undefined>
  workingTree: ComputedRef<WorkingTreeInfo | undefined>
  committing: ComputedRef<boolean>
  stashLoading: ComputedRef<boolean>
  pullOutputs: ComputedRef<PushOutputEntry[]>
  pushOutputs: ComputedRef<PushOutputEntry[]>
  commitOutput: ComputedRef<string>
  generatingMsg: ComputedRef<{ generating: boolean, text: string }>
  gitOpLoading: ComputedRef<boolean>
  tagPushLoading: ComputedRef<string>
  genStashDescLoading: ComputedRef<boolean>
  /** 全局单值（非按 id）：外部生成的 stash 描述文案 */
  generatedStashMsg: ComputedRef<string>
  fetching: ComputedRef<boolean>
  remoteStatusLoading: ComputedRef<boolean>
  refreshingWorkingTree: ComputedRef<boolean>
  /** 当前"全部刷新"的是否为本项目（仅本项目旋转图标） */
  isRefreshing: ComputedRef<boolean>
} {
  const services = inject(CARD_SERVICES_KEY)!
  const { records } = services
  const id = () => project().id

  /** 按项目 id 取 Record 条目（Record 无值时返回 undefined，模板自行降级） */
  const byId = <T>(rec: Record<string, T>): T | undefined => rec[id()]

  const pushStatus = computed(() => byId(records.pushStatuses.value))
  const workingTree = computed(() => byId(records.workingTrees.value))
  const committing = computed(() => byId(records.committing.value) ?? false)
  // 引用计数型标志：>0 视为 loading
  const stashLoading = computed(() => (byId(records.stashLoading.value) ?? 0) > 0)
  const pullOutputs = computed(() => byId(records.pullOutputs.value) ?? [])
  const pushOutputs = computed(() => byId(records.pushOutputs.value) ?? [])
  const commitOutput = computed(() => byId(records.commitOutputs.value) ?? "")
  const generatingMsg = computed(() => byId(records.generatingMsgs.value) ?? { generating: false, text: "" })
  const gitOpLoading = computed(() => (byId(records.gitOpLoading.value) ?? 0) > 0)
  const tagPushLoading = computed(() => byId(records.tagPushLoading.value) ?? "")
  const genStashDescLoading = computed(() => byId(records.genStashDescLoading.value) ?? false)
  const generatedStashMsg = computed(() => records.generatedStashMsg.value)
  const fetching = computed(() => (byId(records.fetching.value) ?? 0) > 0)
  const remoteStatusLoading = computed(() => (byId(records.remoteStatusLoading.value) ?? 0) > 0)
  const refreshingWorkingTree = computed(() => (byId(records.refreshingWorkingTree.value) ?? 0) > 0)
  const isRefreshing = computed(() => records.refreshing.value === id())

  return {
    services,
    pushStatus,
    workingTree,
    committing,
    stashLoading,
    pullOutputs,
    pushOutputs,
    commitOutput,
    generatingMsg,
    gitOpLoading,
    tagPushLoading,
    genStashDescLoading,
    generatedStashMsg,
    fetching,
    remoteStatusLoading,
    refreshingWorkingTree,
    isRefreshing,
  }
}
