// gitPush 弹窗关闭辅助：Esc 关闭 / 遮罩点击关闭 / 可选 body 滚动锁的统一样板
//
// 历史问题：模块内 10 个弹窗各自手写「keydown Esc → emit("close") + onMounted/onUnmounted
// 注册注销」样板，busy 守卫与 capture 与否的差异散落各处易漏。本 composable 收敛为单一入口；
// FileDetailModal 为首个参考实现，其余弹窗后续迁入（follow-up，不在本批改动范围）。
//
// 与 useDialogKeyboard 的分工：那个只管根节点聚焦（让 @keydown 能捕获），本 composable 管
// document 层监听的关闭行为（Teleport 到 body 的弹窗事件不在根节点冒泡路径上）。
// 两者可叠加使用，互不冲突。
import type { Ref } from "vue"
import { onBeforeUnmount, watch } from "vue"

// 模块级滚动锁计数：多个弹窗同时开启时，只有最后一个释放才恢复宿主原有的 overflow
let bodyLockCount = 0
let prevBodyOverflow = ""

export interface UseDialogCloseOptions {
  /** 弹窗是否可见（true 时才注册监听；变为 false 注销，避免常驻回调） */
  visible: Ref<boolean>
  /** 请求关闭回调（Esc / 遮罩点击统一走这里，由调用方决定 emit close 或忽略） */
  onClose: () => void
  /** busy 时忽略关闭请求（防止操作进行中误关；默认无守卫） */
  busy?: Ref<boolean>
  /** 可选：打开期间锁定 body 滚动（遮罩层下背景不跟随滚动） */
  lockBodyScroll?: boolean
}

/**
 * 注册弹窗关闭行为（Esc + 可选遮罩滚动锁）。在组件 setup 中调用一次即可。
 * 返回 onMaskClick 供遮罩元素 @click 绑定（busy 守卫与 Esc 共用）。
 */
export function useDialogClose(options: UseDialogCloseOptions): { onMaskClick: () => void } {
  const { visible, onClose, busy, lockBodyScroll } = options

  function guardedClose() {
    if (busy?.value) return
    onClose()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") guardedClose()
  }

  function onMaskClick() {
    guardedClose()
  }

  /** 打开/关闭滚动锁（计数制：避免覆盖宿主既有 overflow，也避免嵌套弹窗互相解锁） */
  function applyLock(locked: boolean) {
    if (!lockBodyScroll) return
    if (locked) {
      if (bodyLockCount++ === 0) {
        prevBodyOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
      }
      return
    }
    if (bodyLockCount === 0) return
    if (--bodyLockCount === 0) document.body.style.overflow = prevBodyOverflow
  }

  watch(visible, (v) => {
    if (v) {
      document.addEventListener("keydown", onKeydown)
      applyLock(true)
    } else {
      document.removeEventListener("keydown", onKeydown)
      applyLock(false)
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeydown)
    applyLock(false)
  })

  return { onMaskClick }
}
