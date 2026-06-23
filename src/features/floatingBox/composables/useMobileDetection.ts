/**
 * 移动端检测 composable
 * 监听窗口 resize，判断是否移动端布局（≤768px）
 */

import { onMounted, onUnmounted, ref } from "vue"

const MOBILE_BREAKPOINT = 768

export function useMobileDetection() {
  const isMobile = ref(false)

  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  const checkMobile = () => {
    isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
  }

  const debouncedCheckMobile = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(checkMobile, 150)
  }

  onMounted(() => {
    checkMobile()
    window.addEventListener("resize", debouncedCheckMobile)
  })

  onUnmounted(() => {
    window.removeEventListener("resize", debouncedCheckMobile)
    if (resizeTimer) clearTimeout(resizeTimer)
  })

  return { isMobile }
}
