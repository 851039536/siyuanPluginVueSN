// gitPush 提交规则检查违规批量修复 composable（选中映射 + 串行启发式修复 + 结果统计）
import type { Ref } from "vue"
import type { CommitRuleReasonKey, CommitRuleViolation, GitPushManager } from "../types"
import { computed, ref } from "vue"
import { fixCommitMessageHeuristically } from "../commitRuleChecker"
import { resolveValidPath } from "../utils"

/** 批量修复结果统计（skipped = 不可自动修复，failed = 执行改写失败） */
export interface BatchFixResult {
  fixed: number
  skipped: number
  failed: number
  /** 被跳过的违规原因（去重，供结果提示解释为什么无法自动修复） */
  skippedReasons: CommitRuleReasonKey[]
}

/** 违规项唯一 key（与 ViolationListSection 渲染 key 一致：projectId-hash-reason） */
export function violationKey(v: CommitRuleViolation): string {
  return `${v.projectId}-${v.hash}-${v.reason}`
}

/** 违规是否可确定性自动修复（fixCommitMessageHeuristically 返回非空；false 需 AI/手动修正） */
export function isAutoFixable(v: CommitRuleViolation): boolean {
  return !!fixCommitMessageHeuristically(v.message)
}

/**
 * 违规批量修复：选中映射管理 + 串行执行启发式修复 + 结果统计。
 * 选中集合用对象映射（Record<string, boolean>）而非 Set，避免 Vue 3 对 Set 响应式代理的边界问题。
 */
export function useBatchCommitFix(manager: GitPushManager, violations: Ref<CommitRuleViolation[]>) {
  /** 选中的违规 key 映射（key → true） */
  const selectedMap = ref<Record<string, boolean>>({})
  /** 选中数量（按钮可用性/点击提示判断） */
  const selectedCount = computed(() => Object.keys(selectedMap.value).length)
  /** 批量修复执行中 */
  const fixing = ref(false)
  /** 最近一次批量修复结果（null = 未执行过） */
  const lastResult = ref<BatchFixResult | null>(null)

  /** 是否选中指定违规 */
  function isSelected(v: CommitRuleViolation): boolean {
    return !!selectedMap.value[violationKey(v)]
  }

  /** 切换选中态 */
  function toggle(key: string) {
    const next = { ...selectedMap.value }
    if (next[key]) {
      delete next[key]
    } else {
      next[key] = true
    }
    selectedMap.value = next
  }

  /** 全选当前可见违规项 */
  function selectAllVisible(visible: CommitRuleViolation[]) {
    const next = { ...selectedMap.value }
    for (const v of visible) {
      next[violationKey(v)] = true
    }
    selectedMap.value = next
  }

  /** 清空选中 */
  function clearSelection() {
    selectedMap.value = {}
  }

  /**
   * 批量修复选中项：仅可确定性修复的违规（fixCommitMessageHeuristically 返回非空）执行重写，
   * 串行执行避免历史提交 rebase 并发冲突；preserveDate=true 保持提交时间线稳定。
   * 返回结果统计（含跳过原因），调用方据此决定是否刷新分析。
   */
  async function fixSelected(): Promise<BatchFixResult> {
    const result: BatchFixResult = { fixed: 0, skipped: 0, failed: 0, skippedReasons: [] }
    if (fixing.value || selectedCount.value === 0) return result
    const targets = violations.value.filter((v) => selectedMap.value[violationKey(v)])
    if (targets.length === 0) return result
    const skippedReasonSet = new Set<CommitRuleReasonKey>()
    fixing.value = true
    try {
      for (const v of targets) {
        const fixed = fixCommitMessageHeuristically(v.message)
        if (!fixed) {
          result.skipped++
          skippedReasonSet.add(v.reason)
          continue
        }
        try {
          const project = await manager.getProjectById(v.projectId)
          if (!project) {
            result.failed++
            continue
          }
          await manager.rewriteCommitMessage(resolveValidPath(project), v.hash, fixed, true)
          result.fixed++
        } catch {
          result.failed++
        }
      }
    } finally {
      fixing.value = false
    }
    result.skippedReasons = [...skippedReasonSet]
    lastResult.value = result
    return result
  }

  return {
    selectedMap,
    selectedCount,
    fixing,
    lastResult,
    isSelected,
    toggle,
    selectAllVisible,
    clearSelection,
    fixSelected,
  }
}
