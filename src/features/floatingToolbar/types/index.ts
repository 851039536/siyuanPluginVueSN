/**
 * 浮动工具栏 - 类型定义
 */

export interface ToolbarAction {
  id: string
  name: string
  icon: string
  hotkey?: string
  handler: (selectedText: string) => Promise<void> | void
}

export class ToolbarActionManager {
  private actions: Map<string, ToolbarAction> = new Map()

  registerAction(action: ToolbarAction): void {
    if (this.actions.has(action.id)) {
      console.warn(
        `[FloatingToolbar] Action with id "${action.id}" already registered`,
      )
      return
    }
    this.actions.set(action.id, action)
  }

  unregisterAction(actionId: string): void {
    this.actions.delete(actionId)
  }

  getAllActions(): ToolbarAction[] {
    return Array.from(this.actions.values())
  }

  clear(): void {
    this.actions.clear()
  }
}
