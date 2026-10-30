// 选中内容右键菜单：编辑器内有选中文本时以插件菜单替换思源原生菜单，无选中时放行原生菜单
import type { ToolbarAction } from "../types"
import { findProtyleContainer, getSelectionText } from "./utils"

const STYLE_ID = "floating-toolbar-ctx-menu-styles"

/**
 * 选中内容右键菜单
 *
 * 监听 window 捕获阶段的 contextmenu（保证先于思源自身的处理器执行）：
 * - 事件目标在 protyle 内且存在选中文本（或块多选）→ 阻止原生菜单，弹出插件功能菜单，
 *   菜单项复用浮动工具栏已注册的 actions（复制 / 二维码 / 翻译等）
 * - 无选中或不在编辑器内 → 不拦截，思源原生菜单照常弹出
 */
export class SelectionContextMenu {
  private menuEl: HTMLElement | null = null
  private readonly getActions: () => ToolbarAction[]

  constructor(getActions: () => ToolbarAction[]) {
    this.getActions = getActions
  }

  init(): void {
    this.ensureStyles()
    window.addEventListener("contextmenu", this.handleContextMenu, true)
  }

  destroy(): void {
    window.removeEventListener("contextmenu", this.handleContextMenu, true)
    this.detachCloseListeners()
    this.menuEl?.remove()
    this.menuEl = null
    document.getElementById(STYLE_ID)?.remove()
  }

  private handleContextMenu = (e: MouseEvent): void => {
    this.hide()

    const target = e.target
    if (!(target instanceof Element)) return

    const protyle = findProtyleContainer(target)
    if (!protyle) return

    const selectedText = getSelectionText(protyle)
    if (!selectedText) return

    e.preventDefault()
    e.stopImmediatePropagation()
    this.show(e.clientX, e.clientY, selectedText)
  }

  /** 弹出菜单并做视口钳制（菜单先挂载量尺寸，再定位） */
  private show(x: number, y: number, selectedText: string): void {
    const menu = document.createElement("div")
    menu.className = "ft-ctx-menu"

    for (const action of this.getActions()) {
      const item = document.createElement("button")
      item.type = "button"
      item.className = "ft-ctx-menu__item"

      const icon = document.createElement("span")
      icon.className = "ft-ctx-menu__icon"
      icon.innerHTML = action.icon

      const label = document.createElement("span")
      label.textContent = action.name

      item.append(icon, label)
      item.addEventListener("click", async (clickEvent) => {
        clickEvent.stopPropagation()
        this.hide()
        try {
          await action.handler(selectedText)
        } catch (error) {
          console.error(`Action ${action.id} failed:`, error)
        }
      })

      menu.appendChild(item)
    }

    document.body.appendChild(menu)
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`

    this.menuEl = menu
    document.addEventListener("mousedown", this.handleDocMouseDown, true)
    document.addEventListener("keydown", this.handleDocKeyDown, true)
  }

  private hide(): void {
    if (!this.menuEl) return
    this.detachCloseListeners()
    this.menuEl.remove()
    this.menuEl = null
  }

  private detachCloseListeners(): void {
    document.removeEventListener("mousedown", this.handleDocMouseDown, true)
    document.removeEventListener("keydown", this.handleDocKeyDown, true)
  }

  private readonly handleDocMouseDown = (e: MouseEvent): void => {
    if (this.menuEl && !this.menuEl.contains(e.target as Node)) this.hide()
  }

  private readonly handleDocKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.hide()
  }

  private ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = `
      .ft-ctx-menu {
        position: fixed;
        z-index: 10000;
        min-width: 148px;
        padding: 4px;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
      }

      .ft-ctx-menu__item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 5px 8px;
        background: none;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        color: inherit;
        font: inherit;
        transition: background 0.12s;
      }

      .ft-ctx-menu__item:hover {
        background: var(--b3-list-hover);
      }

      .ft-ctx-menu__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .ft-ctx-menu__icon svg {
        width: 14px;
        height: 14px;
      }
    `
    document.head.appendChild(style)
  }
}
