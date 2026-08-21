// gitPush 卡片内联下拉菜单共享（provide/inject：顶栏与操作栏菜单互斥，与拆分前行为完全一致）
import type { InjectionKey, Ref } from "vue"
import { inject, onBeforeUnmount, provide, ref, watch } from "vue"

/** 卡片内联菜单名（拉取/推送/IDE/刷新/平台，同时只允许一个展开） */
export type CardMenuName = "pull" | "push" | "ide" | "refresh" | "platform"

/** 卡片菜单上下文（编排层 provide，CardHeader/CardActionBar inject） */
export interface CardMenuContext {
  openMenu: Ref<CardMenuName | null>
  /** 切换内联下拉菜单（再次点击同一菜单则关闭） */
  toggleMenu: (name: CardMenuName) => void
}

const CARD_MENU_KEY: InjectionKey<CardMenuContext> = Symbol("gitPushCardMenu")

/** 编排层提供菜单状态（含全局点击关闭监听，卡片卸载自动清理） */
export function provideCardMenu(): CardMenuContext {
  const openMenu = ref<CardMenuName | null>(null)

  function toggleMenu(name: CardMenuName) {
    openMenu.value = openMenu.value === name ? null : name
  }

  /** 点击卡片外部时关闭内联下拉菜单（.gp-menu-wrap 覆盖全部菜单容器） */
  function closeMenuOnOutside(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (target && !target.closest(".gp-menu-wrap")) {
      openMenu.value = null
    }
  }

  // 菜单打开时才挂载全局点击监听，关闭时移除，避免多卡片常驻监听。
  // 用标志位防止菜单间切换时重复 addEventListener 累积监听器。
  let menuListenerAttached = false
  function attachMenuListener() {
    if (menuListenerAttached) return
    menuListenerAttached = true
    document.addEventListener("click", closeMenuOnOutside)
  }
  function detachMenuListener() {
    if (!menuListenerAttached) return
    menuListenerAttached = false
    document.removeEventListener("click", closeMenuOnOutside)
  }

  watch(openMenu, (open) => {
    if (open) attachMenuListener()
    else detachMenuListener()
  })

  onBeforeUnmount(() => {
    detachMenuListener()
  })

  const ctx: CardMenuContext = { openMenu, toggleMenu }
  provide(CARD_MENU_KEY, ctx)
  return ctx
}

/** 区块组件取菜单上下文（CardHeader/CardActionBar 内使用） */
export function useCardMenu(): CardMenuContext {
  return inject(CARD_MENU_KEY)!
}
