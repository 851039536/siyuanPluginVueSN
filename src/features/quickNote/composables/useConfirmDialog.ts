/**
 * 速记功能 — 确认弹窗 composable
 * 承载「删除二次确认」的受控状态：open() 打开并登记确认回调，confirm() 执行回调后关闭。
 * 由 index.vue 单实例持有并经 props 下传三个 Tab（子组件不得自行创建，
 * 见 AGENTS_ARCH.md § 禁止将逻辑下放给子组件），替代此前的 window.confirm
 */
import type { Ref } from "vue"
import { ref } from "vue"

/** 确认弹窗状态（visible 受控，onConfirm 为确认后执行的动作） */
export interface ConfirmState {
  visible: boolean
  /** 弹窗标题 */
  header: string
  /** 确认按钮文案 */
  acceptLabel: string
  /** 取消按钮文案 */
  rejectLabel: string
  /** 确认后执行的动作 */
  onConfirm: () => void
}

/** 确认弹窗 API（供组件 v-model:visible 与事件绑定） */
export interface ConfirmDialogApi {
  /** 受控状态，模板中经 `:visible` / `:header` 等派生 */
  state: Ref<ConfirmState>
  /** 打开弹窗并登记确认回调 */
  open: (options: { header: string, acceptLabel: string, rejectLabel: string, onConfirm: () => void }) => void
  /** 确认：先关窗再执行回调（避免回调内报错导致弹窗卡住） */
  confirm: () => void
  /** 取消：仅关窗，不执行回调 */
  cancel: () => void
}

export function useConfirmDialog(): ConfirmDialogApi {
  const state = ref<ConfirmState>({
    visible: false,
    header: "",
    acceptLabel: "",
    rejectLabel: "",
    onConfirm: () => {},
  })

  /** 打开弹窗并登记确认回调 */
  const open: ConfirmDialogApi["open"] = (options) => {
    state.value = {
      visible: true,
      header: options.header,
      acceptLabel: options.acceptLabel,
      rejectLabel: options.rejectLabel,
      onConfirm: options.onConfirm,
    }
  }

  /** 确认：先关窗再执行回调（回调抛错时不会把弹窗留在打开态） */
  const confirm = (): void => {
    const action = state.value.onConfirm
    state.value = {
      ...state.value,
      visible: false,
      onConfirm: () => {},
    }
    action()
  }

  /** 取消：仅关窗，不执行回调 */
  const cancel = (): void => {
    state.value = {
      ...state.value,
      visible: false,
      onConfirm: () => {},
    }
  }

  return {
    state,
    open,
    confirm,
    cancel,
  }
}
