import { Plugin } from 'siyuan'
import { ToolbarAction, ToolbarActionManager } from '../types'
import { showI18nMessage } from './utils'

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
            fn(...args)
            timeoutId = null
        }, delay)
    }
}

/**
 * 浮动工具栏增强类
 * 为思源笔记的原生浮动工具栏添加自定义功能按钮
 */
export class FloatingToolbar {
    private plugin: Plugin
    private actionManager: ToolbarActionManager
    private lastSelectionText: string = ''
    private observers: Map<HTMLElement, MutationObserver> = new Map()
    private isProcessing: boolean = false
    private readonly debouncedHandleMouseUp: () => void
    private readonly styleId = 'floating-toolbar-enhanced-styles'

    constructor(plugin: Plugin) {
        this.plugin = plugin
        this.actionManager = new ToolbarActionManager()
        // 防抖处理选择事件，避免频繁触发
        this.debouncedHandleMouseUp = debounce(this.handleSelectionChange.bind(this), 300)
    }

    /**
     * 初始化浮动工具栏增强
     */
    init(): void {
        // 注册所有内置功能
        this.registerBuiltinActions()
        // 绑定事件监听器
        this.bindEvents()
        // 添加样式（仅添加一次）
        this.ensureStyles()
    }

    /**
     * 注册内置功能
     */
    private registerBuiltinActions() {
        // 注册复制功能
        this.actionManager.registerAction({
            id: 'copy',
            name: (this.plugin.i18n as any)?.floatingToolbar?.copy || '复制',
            icon: '<svg><use xlink:href="#iconCopy"></use></svg>',
            hotkey: undefined,
            handler: this.copyText.bind(this)
        })
    }

    /**
     * 注册新功能（供外部使用）
     */
    registerAction(action: ToolbarAction) {
        this.actionManager.registerAction(action)
    }

    /**
     * 移除功能
     */
    unregisterAction(actionId: string) {
        this.actionManager.unregisterAction(actionId)
    }

    /**
     * 绑定事件监听器
     * 使用防抖处理 mouseup 事件
     */
    private bindEvents() {
        document.addEventListener('mouseup', this.handleDocumentMouseUp, { passive: true })
        // 监听选择变化，清理工具栏
        document.addEventListener('selectionchange', this.handleSelectionChange.bind(this), { passive: true })
    }

    /**
     * 处理文档级别的鼠标释放事件
     * 使用箭头函数保持上下文
     */
    private handleDocumentMouseUp = () => {
        // 记录当前选择内容用于防抖比较
        this.lastSelectionText = window.getSelection()?.toString().trim() || ''
        // 使用防抖处理
        this.debouncedHandleMouseUp()
    }

    /**
     * 处理选择变化
     */
    private handleSelectionChange() {
        // 防止重复处理
        if (this.isProcessing) return

        const selection = window.getSelection()
        const selectedText = selection?.toString().trim() || ''

        // 选择为空时清理工具栏
        if (!selectedText) {
            this.cleanupAllToolbars()
            return
        }

        // 选择内容与上次一致且有效，开始处理
        if (selectedText === this.lastSelectionText && selectedText) {
            this.processSelection()
        }
    }

    /**
     * 处理选择状态
     */
    private processSelection() {
        if (this.isProcessing) return
        this.isProcessing = true

        try {
            const selection = window.getSelection()
            const selectedText = selection?.toString().trim()

            if (!selectedText || !selection.rangeCount) {
                return
            }

            // 查找选择范围内的 protyle 容器
            const range = selection.getRangeAt(0)
            const protyle = this.findProtyleContainer(range.commonAncestorContainer)

            if (protyle) {
                this.processToolbar(protyle)
            }
        } finally {
            // 使用 requestAnimationFrame 延迟重置处理状态
            requestAnimationFrame(() => {
                this.isProcessing = false
            })
        }
    }

    /**
     * 查找 protyle 容器
     * @param startNode 起始节点
     * @returns protyle 元素或 null
     */
    private findProtyleContainer(startNode: Node): Element | null {
        // 对于 Element，使用 closest
        if (startNode instanceof Element) {
            const protyle = startNode.closest('.protyle')
            if (protyle) return protyle
        }

        // 尝试通过 parentNode 查找（对于文本节点）
        let node: Node | null = startNode
        while (node) {
            if (node instanceof Element && node.classList.contains('protyle')) {
                return node
            }
            node = node.parentNode
        }

        return null
    }

    /**
     * 处理单个工具栏
     */
    private processToolbar(protyle: Element) {
        const toolbar = protyle.querySelector('.protyle-toolbar') as HTMLElement
        if (!toolbar || toolbar.dataset.customButtonsAdded === 'true') return

        // 使用 requestAnimationFrame 在下一帧添加按钮
        requestAnimationFrame(() => {
            this.addCustomButtons(toolbar, protyle)
        })
    }

    /**
     * 清理所有工具栏的标记
     */
    private cleanupAllToolbars() {
        const toolbars = document.querySelectorAll('[data-custom-buttons-added="true"]')
        toolbars.forEach(toolbar => {
            toolbar.removeAttribute('data-custom-buttons-added')
        })
        // 清理 observers
        this.observers.forEach((observer) => {
            observer.disconnect()
        })
        this.observers.clear()
    }

    /**
     * 添加自定义按钮到工具栏
     */
    private addCustomButtons(toolbar: HTMLElement, protyle: Element) {
        // 防止重复添加
        if (toolbar.dataset.customButtonsAdded === 'true') return
        toolbar.dataset.customButtonsAdded = 'true'

        // 获取所有已注册的功能
        const actions = this.actionManager.getAllActions()

        // 反转数组并添加按钮（以便按注册顺序显示）
        // 使用 DocumentFragment 批量添加，减少重排
        const fragment = document.createDocumentFragment()

        actions.reverse().forEach(action => {
            // 检查按钮是否已存在
            if (toolbar.querySelector(`button[data-type="${action.id}"]`)) return

            // 创建按钮元素（而不是使用 insertAdjacentHTML）
            const button = this.createActionButton(action, toolbar, protyle)
            if (button) {
                fragment.appendChild(button)
            }
        })

        // 在工具栏开头批量插入按钮
        if (toolbar.firstChild) {
            toolbar.insertBefore(fragment, toolbar.firstChild)
        } else {
            toolbar.appendChild(fragment)
        }

        // 监听工具栏隐藏事件，移除标记
        this.setupToolbarObserver(toolbar)
    }

    /**
     * 创建操作按钮
     */
    private createActionButton(
        action: ToolbarAction,
        toolbar: HTMLElement,
        protyle: Element
    ): HTMLButtonElement | null {
        const button = document.createElement('button')
        button.className = 'protyle-toolbar__item b3-tooltips b3-tooltips__ne custom-toolbar-button'
        button.dataset.type = action.id
        button.setAttribute('aria-label', action.name)
        button.style.cssText = 'font-size:14px;'
        button.innerHTML = action.icon

        if (action.hotkey) {
            button.setAttribute('data-hotkey', action.hotkey)
        }

        // 使用一次性事件监听器，避免内存泄漏
        button.addEventListener('click', async (clickEvent) => {
            clickEvent.stopPropagation()
            // 隐藏工具栏
            toolbar.classList.add('fn__none')
            // 获取选中的文本
            const selectedText = this.getSelection(protyle)
            // 执行按钮功能
            try {
                await action.handler(selectedText)
            } catch (error) {
                console.error(`Action ${action.id} failed:`, error)
            }
        }, { once: false })

        return button
    }

    /**
     * 设置工具栏观察器
     */
    private setupToolbarObserver(toolbar: HTMLElement) {
        // 清理旧的 observer
        const existingObserver = this.observers.get(toolbar)
        if (existingObserver) {
            existingObserver.disconnect()
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'class' &&
                    toolbar.classList.contains('fn__none')) {
                    toolbar.removeAttribute('data-custom-buttons-added')
                    observer.disconnect()
                    this.observers.delete(toolbar)
                    break
                }
            }
        })

        observer.observe(toolbar, {
            attributes: true,
            attributeFilter: ['class']
        })

        this.observers.set(toolbar, observer)
    }

    /**
     * 获取选中的文本
     */
    private getSelection(protyle: Element): string {
        const selection = window.getSelection().toString().trim()
        if (selection) return selection

        // 处理多选块
        const selects = protyle.querySelectorAll('.protyle-wysiwyg--select')
        if (selects.length > 0) {
            return Array.from(selects)
                .map(block => block.textContent || '')
                .join('\n')
        }

        return ''
    }

    /**
     * 复制文本
     */
    private async copyText(text: string) {
        if (!text) {
            showI18nMessage(this.plugin, 'noTextSelected', '未选中文本')
            return
        }

        try {
            await navigator.clipboard.writeText(text)
            showI18nMessage(this.plugin, 'copySuccess', '已复制到剪贴板')
        } catch (error) {
            // 降级方案
            this.fallbackCopy(text)
        }
    }

    /**
     * 降级复制方案
     */
    private fallbackCopy(text: string) {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0;'
        document.body.appendChild(textarea)

        try {
            textarea.select()
            const success = document.execCommand('copy')
            if (success) {
                showI18nMessage(this.plugin, 'copySuccess', '已复制到剪贴板')
            } else {
                showI18nMessage(this.plugin, 'copyFailed', '复制失败')
            }
        } catch (e) {
            console.error('Fallback copy failed:', e)
            showI18nMessage(this.plugin, 'copyFailed', '复制失败')
        } finally {
            document.body.removeChild(textarea)
        }
    }

    /**
     * 确保样式已添加（单例模式）
     */
    private ensureStyles() {
        if (document.getElementById(this.styleId)) return

        const style = document.createElement('style')
        style.id = this.styleId
        style.textContent = `
            /* 自定义浮动工具栏按钮样式 */
            .custom-toolbar-button {
                transition: background-color 0.15s ease;
            }

            .custom-toolbar-button:hover {
                background-color: var(--b3-theme-surface-lighter);
            }

            .custom-toolbar-button:active {
                background-color: var(--b3-theme-surface);
            }
        `
        document.head.appendChild(style)
    }

    /**
     * 销毁工具栏增强，清理资源
     */
    destroy() {
        // 移除事件监听
        document.removeEventListener('mouseup', this.handleDocumentMouseUp)

        // 断开所有 observers
        this.observers.forEach((observer) => {
            observer.disconnect()
        })
        this.observers.clear()

        // 移除所有自定义按钮
        document.querySelectorAll('.custom-toolbar-button').forEach(button => {
            button.remove()
        })

        // 清理标记
        document.querySelectorAll('[data-custom-buttons-added]').forEach(toolbar => {
            toolbar.removeAttribute('data-custom-buttons-added')
        })

        // 移除样式
        document.getElementById(this.styleId)?.remove()

        // 清理功能管理器
        this.actionManager.clear()
    }
}
