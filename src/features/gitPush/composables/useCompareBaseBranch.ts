// gitPush Compare / 创建 PR 深链的基线分支（全局偏好，显式保存）
import type { Ref } from "vue"
import { ref } from "vue"
import type { TypedStorage } from "@/utils/typedStorage"

/**
 * Compare 基线分支：启动时读取，设置弹窗内显式保存。
 * 空值回退 "main"（避免生成 `/compare/...head` 这类坏链接）。
 */
export function useCompareBaseBranch(storage: TypedStorage<string>): {
  compareBaseBranch: Ref<string>
  loadCompareBaseBranch: () => Promise<void>
  setCompareBaseBranch: (branch: string) => void
} {
  const compareBaseBranch = ref("main")

  async function loadCompareBaseBranch(): Promise<void> {
    // 与 setter 同口径：历史值若为空串也回退 main，避免 Compare 入口整体消失
    compareBaseBranch.value = (await storage.loadOrDefault()).trim() || "main"
  }

  function setCompareBaseBranch(branch: string): void {
    const next = branch.trim() || "main"
    compareBaseBranch.value = next
    storage.save(next).catch(() => {})
  }

  return {
    compareBaseBranch,
    loadCompareBaseBranch,
    setCompareBaseBranch,
  }
}
