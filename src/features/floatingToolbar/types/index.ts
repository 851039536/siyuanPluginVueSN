/**
 * 浮动工具栏 - 类型定义
 */

/**
 * 工具栏功能接口定义
 */
export interface ToolbarAction {
    /** 功能唯一标识符 */
    id: string
    /** 功能显示名称 */
    name: string
    /** 功能图标 SVG 字符串 */
    icon: string
    /** 可选的快捷键 */
    hotkey?: string
    /** 功能处理函数 */
    handler: (selectedText: string) => Promise<void> | void
}

/**
 * 工具栏功能管理器
 * 负责管理所有注册的浮动工具栏功能
 */
export class ToolbarActionManager {
    private actions: Map<string, ToolbarAction> = new Map()

    /**
     * 注册新功能
     * @param action 要注册的功能
     */
    registerAction(action: ToolbarAction): void {
        if (this.actions.has(action.id)) {
            console.warn(`[FloatingToolbar] Action with id "${action.id}" already registered`)
            return
        }
        this.actions.set(action.id, action)
    }

    /**
     * 移除功能
     * @param actionId 要移除的功能 ID
     */
    unregisterAction(actionId: string): void {
        this.actions.delete(actionId)
    }

    /**
     * 获取功能
     * @param actionId 功能 ID
     * @returns 功能定义或 undefined
     */
    getAction(actionId: string): ToolbarAction | undefined {
        return this.actions.get(actionId)
    }

    /**
     * 获取所有已注册的功能
     * @returns 功能数组
     */
    getAllActions(): ToolbarAction[] {
        return Array.from(this.actions.values())
    }

    /**
     * 检查功能是否已注册
     * @param actionId 功能 ID
     * @returns 是否已注册
     */
    hasAction(actionId: string): boolean {
        return this.actions.has(actionId)
    }

    /**
     * 清除所有已注册的功能
     */
    clear(): void {
        this.actions.clear()
    }

    /**
     * 获取已注册功能的数量
     * @returns 功能数量
     */
    getActionCount(): number {
        return this.actions.size
    }

    /**
     * 批量注册功能
     * @param actions 要注册的功能数组
     */
    registerActions(actions: ToolbarAction[]): void {
        for (const action of actions) {
            this.registerAction(action)
        }
    }
}

/**
 * 创建基础功能的辅助函数
 */
export class ToolbarActionFactory {
    /**
     * 创建一个简单的功能（使用 SiYuan 内置图标）
     * @param id 功能 ID
     * @param name 功能名称
     * @param iconName 图标名称（使用 SiYuan 内置图标）
     * @param handler 处理函数
     * @param hotkey 可选快捷键
     * @returns 功能对象
     */
    static createSimpleAction(
        id: string,
        name: string,
        iconName: string,
        handler: (selectedText: string) => Promise<void> | void,
        hotkey?: string
    ): ToolbarAction {
        return {
            id,
            name,
            icon: `<svg><use xlink:href="#icon${iconName}"></use></svg>`,
            handler,
            ...(hotkey && { hotkey })
        }
    }

    /**
     * 创建一个使用自定义 SVG 图标的功能
     * @param id 功能 ID
     * @param name 功能名称
     * @param svg 自定义 SVG 图标
     * @param handler 处理函数
     * @param hotkey 可选快捷键
     * @returns 功能对象
     */
    static createWithCustomIcon(
        id: string,
        name: string,
        svg: string,
        handler: (selectedText: string) => Promise<void> | void,
        hotkey?: string
    ): ToolbarAction {
        return {
            id,
            name,
            icon: svg,
            handler,
            ...(hotkey && { hotkey })
        }
    }
}

/**
 * 类型守卫：检查对象是否为 ToolbarAction
 */
export function isToolbarAction(obj: unknown): obj is ToolbarAction {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'id' in obj &&
        'name' in obj &&
        'icon' in obj &&
        'handler' in obj &&
        typeof (obj as ToolbarAction).id === 'string' &&
        typeof (obj as ToolbarAction).name === 'string' &&
        typeof (obj as ToolbarAction).icon === 'string' &&
        typeof (obj as ToolbarAction).handler === 'function'
    )
}
