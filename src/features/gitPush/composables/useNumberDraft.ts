// 设置弹窗数字输入的草稿态辅助：键入过程保留原始字符，失焦/回车时才钳位并提交
import { ref, watch } from "vue"

export interface NumberDraftOptions {
  /** 当前生效值（来自 props 或父级权威状态） */
  value: () => number
  /** 钳位到允许范围（与持久化层共用同一函数，避免两处规则漂移） */
  clamp: (n: number) => number
  /** 提交有效值（仅在值发生变化时调用） */
  commit: (n: number) => void
}

/**
 * 受控数字输入不能逐字钳位：输入 "6" 会被立刻抬到下限 30，
 * 用户再按 "0" 就得到 "300"，永远输不进 60。
 * 故用草稿串承接键入过程，只在 commitDraft 时钳位并回填。
 */
export function useNumberDraft(options: NumberDraftOptions) {
  const draft = ref(String(options.value()))

  watch(options.value, (v) => {
    draft.value = String(v)
  })

  /** 键入过程中只更新草稿，允许暂时越界或为空 */
  function onInput(value: unknown) {
    draft.value = String(value ?? "")
  }

  /** 失焦/回车/change 时钳位提交；空串或非法值回退到当前生效值 */
  function commitDraft() {
    const raw = draft.value.trim()
    const parsed = Number(raw)
    if (raw === "" || !Number.isFinite(parsed)) {
      draft.value = String(options.value())
      return
    }
    const next = options.clamp(parsed)
    draft.value = String(next)
    if (next !== options.value()) options.commit(next)
  }

  return { draft, onInput, commitDraft }
}
