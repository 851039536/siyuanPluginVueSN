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

/** 编排层提供菜单状态（含全局点击/Esc 关闭监听，卡片卸载自动清理） */
export function provideCardMenu(): CardMenuContext {
  const openMenu = ref<CardMenuName | null>(null)
  /** 最近一次打开菜单的触发按钮（Esc 关闭后把焦点还给它，避免焦点丢失到 body） */
  let lastTrigger: HTMLElement | null = null

  function toggleMenu(name: CardMenuName) {
    const next = openMenu.value === name ? null : name
    // 打开时记录触发按钮，供 Esc 关闭后归还焦点；关闭时不记录（保持引用对称清零）
    lastTrigger = next !== null ? resolveTrigger() : null
    openMenu.value = next
  }

  /** 取当前焦点元素作为触发按钮；焦点落在 body（无有效焦点）时返回 null，调用方跳过归还 */
  function resolveTrigger(): HTMLElement | null {
    const active = document.activeElement
    return active instanceof HTMLElement && active !== document.body ? active : null
  }

  /** 点击卡片外部时关闭内联下拉菜单（.gp-menu-wrap 覆盖全部菜单容器） */
  function closeMenuOnOutside(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (target && !target.closest(".gp-menu-wrap")) {
      openMenu.value = null
      // 非键盘关闭：不归还焦点（用户已用鼠标点到别处），并清掉陈旧的触发引用
      lastTrigger = null
    }
  }

  /**
   * Esc 关闭菜单并把焦点归还触发按钮。
   *
   * 此前只有 click 监听：键盘用户可以打开菜单（触发按钮是正经 Button），却没有任何
   * 键盘方式关掉它 —— 若不慎 Tab 出菜单，它会一直悬在卡片上，只能再用鼠标点一下别处。
   * 这与其他手写弹层（TagPanel 创建表单 / EditableRemoteList 编辑态）的既有做法不一致。
   */
  function closeMenuOnEscape(e: KeyboardEvent) {
    if (e.key !== "Escape") return
    if (openMenu.value === null) return
    e.stopPropagation()
    openMenu.value = null
    lastTrigger?.focus()
    lastTrigger = null
  }

  // 菜单打开时才挂载全局监听，关闭时移除，避免多卡片常驻监听。
  // 用标志位防止菜单间切换时重复 addEventListener 累积监听器。
  // lastTrigger 的生命周期由 toggleMenu / closeMenuOnEscape 维护，本 watch 只负责挂卸监听。
  let menuListenerAttached = false
  function attachMenuListener() {
    if (menuListenerAttached) return
    menuListenerAttached = true
    document.addEventListener("click", closeMenuOnOutside)
    document.addEventListener("keydown", closeMenuOnEscape)
  }
  function detachMenuListener() {
    if (!menuListenerAttached) return
    menuListenerAttached = false
    document.removeEventListener("click", closeMenuOnOutside)
    document.removeEventListener("keydown", closeMenuOnEscape)
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
