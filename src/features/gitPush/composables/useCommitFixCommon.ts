// gitPush 修正提交弹窗共用逻辑（提交时间策略持久化 + 规则配置读取 + Esc 关闭 + 不可修正原因）
import type { CommitRuleConfig, GitPushManager } from "../types"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { DEFAULT_COMMIT_RULE_CONFIG } from "../types"

/** 修正前置状态（单条与批量弹窗各自采集，判定优先级共用） */
export interface CommitBlockedState {
  isMerge: boolean
  rebaseStuck: boolean
  headHash: string
  workingTreeClean: boolean
}

/** 不可修正原因（merge / rebase 残留 / 无 HEAD / 工作区脏）；可修正返回空串 */
export function computeCommitBlockedReason(state: CommitBlockedState, i18n: Record<string, any>): string {
  if (state.isMerge) return i18n.ruleFixMergeBlocked
  if (state.rebaseStuck) return i18n.ruleFixRebaseStuck
  if (!state.headHash) return i18n.ruleFixNoHead
  if (!state.workingTreeClean) return i18n.ruleFixDirtyWorkingTree
  return ""
}

/**
 * 修正弹窗共用状态。
 * @param manager 项目 manager（读取修正偏好与提交规则配置）
 * @param onClose Esc 关闭回调
 * @param canClose 是否允许关闭（批量弹窗执行中禁止 Esc 关闭）
 */
export function useCommitFixCommon(
  manager: GitPushManager,
  onClose: () => void,
  canClose: () => boolean = () => true,
) {
  /** 提交时间策略：true = 保留原始提交时间，false = 按当前时间提交 */
  const preserveDate = ref(true)
  /** 提交规则配置（与规则检查面板/AI 生成同口径） */
  const ruleConfig = ref<CommitRuleConfig>({ ...DEFAULT_COMMIT_RULE_CONFIG })

  /** 恢复持久化偏好（时间策略 + 规则配置；打开弹窗时调用一次） */
  async function loadCommitFixCommonPrefs() {
    const [fixPrefs, rules] = await Promise.all([
      manager.storage.commitFixPrefs.loadOrDefault(),
      manager.storage.getCommitRuleConfig(),
    ])
    preserveDate.value = fixPrefs.preserveDate
    ruleConfig.value = rules
  }

  /** 切换提交时间策略并即时持久化（下次打开弹窗恢复选择） */
  async function onDateChoiceChange(preserve: boolean) {
    preserveDate.value = preserve
    await manager.storage.commitFixPrefs.save({ preserveDate: preserve })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && canClose()) onClose()
  }

  onMounted(() => window.addEventListener("keydown", handleKeydown))
  onUnmounted(() => window.removeEventListener("keydown", handleKeydown))

  return {
    preserveDate,
    ruleConfig,
    loadCommitFixCommonPrefs,
    onDateChoiceChange,
  }
}
