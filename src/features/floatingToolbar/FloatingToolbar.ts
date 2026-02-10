import { Plugin } from 'siyuan'
import { ToolbarAction, ToolbarActionManager } from './actions'
import { showI18nMessage } from './utils'

/**
 * 浮动工具栏增强类
 * 为思源笔记的原生浮动工具栏添加自定义功能按钮
 */
export class FloatingToolbar {
    private plugin: Plugin
    private actionManager: ToolbarActionManager
    private selectionTimeoutId: ReturnType<typeof setTimeout> | null = null
    private lastSelectionText: string = ''

    constructor(plugin: Plugin) {
        this.plugin = plugin
        this.actionManager = new ToolbarActionManager()
    }

    /**
     * 初始化浮动工具栏增强
     */
    init(): void {
        // 注册所有内置功能
        this.registerBuiltinActions()
        // 绑定事件监听器
        this.bindEvents()
        // 添加样式
        this.addStyles()
    }

    /**
     * 注册内置功能
     */
    private registerBuiltinActions() {
        // 注册复制功能
        this.actionManager.registerAction({
            id: 'copy',
            name: (this.plugin.i18n as any).floatingToolbar?.copy || '复制',
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
     * 改为在 protyle 容器级别监听 mouseup，避免干扰选择过程
     */
    private bindEvents() {
        // 使用事件委托在 protyle 容器级别监听 mouseup
        // 这样不会干扰浏览器的文本选择过程
        document.addEventListener('mouseup', this.handleDocumentMouseUp, { passive: true })
    }

    /**
     * 处理文档级别的鼠标释放事件
     * 使用箭头函数保持上下文，避免bind创建新实例
     */
    private handleDocumentMouseUp = () => {
        // 清除之前的定时器
        if (this.selectionTimeoutId) {
            clearTimeout(this.selectionTimeoutId)
        }

        // 记录当前选择内容
        const currentSelection = window.getSelection()?.toString().trim() || ''
        this.lastSelectionText = currentSelection

        // 延迟执行，等待三击选择完成（400ms 足够三击完成）
        this.selectionTimeoutId = setTimeout(() => {
            // 再次检查选择是否与延迟前的内容一致（确保选择稳定）
            const stableSelection = window.getSelection()?.toString().trim() || ''
            if (stableSelection === this.lastSelectionText && stableSelection) {
                this.processSelection()
            } else if (!stableSelection) {
                this.cleanupAllToolbars()
            }
        }, 400)
    }

    /**
     * 处理选择状态
     */
    private processSelection() {
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim()

        if (!selectedText) {
            return
        }

        // 查找选择范围内的 protyle 容器
        const range = selection.getRangeAt(0)
        let protyle: Element | null = null

        // 对于 Element，使用 closest
        if (range.commonAncestorContainer instanceof Element) {
            protyle = range.commonAncestorContainer.closest('.protyle')
        }

        if (!protyle) {
            // 尝试通过 parentNode 查找（对于文本节点）
            let node: Node | null = range.commonAncestorContainer
            while (node) {
                if (node instanceof Element && node.classList.contains('protyle')) {
                    this.processToolbar(node as Element)
                    return
                }
                node = node.parentNode
            }
            return
        }

        this.processToolbar(protyle)
    }

    /**
     * 处理单个工具栏
     */
    private processToolbar(protyle: Element) {
        const toolbar = protyle.querySelector('.protyle-toolbar') as HTMLElement
        if (!toolbar) return

        // 检查按钮是否已添加
        if (toolbar.hasAttribute('data-custom-buttons-added')) return

        // 使用 requestAnimationFrame 在下一帧添加按钮
        requestAnimationFrame(() => {
            this.addCustomButtons(toolbar, protyle)
        })
    }

    /**
     * 清理所有工具栏的标记
     */
    private cleanupAllToolbars() {
        const toolbars = document.querySelectorAll('[data-custom-buttons-added]')
        toolbars.forEach(toolbar => {
            toolbar.removeAttribute('data-custom-buttons-added')
        })
    }


    /**
     * 添加自定义按钮到工具栏
     */
    private addCustomButtons(toolbar: HTMLElement, protyle: Element) {
        // 防止重复添加
        if (toolbar.hasAttribute('data-custom-buttons-added')) return
        toolbar.setAttribute('data-custom-buttons-added', 'true')

        // 获取所有已注册的功能
        const actions = this.actionManager.getAllActions()

        // 反转数组并添加按钮（以便按注册顺序显示）
        actions.reverse().forEach(action => {
            // 检查按钮是否已存在
            if (toolbar.querySelector(`button[data-type="${action.id}"]`)) return

            // 创建按钮HTML
            const buttonHTML = `
                <button class="protyle-toolbar__item b3-tooltips b3-tooltips__ne custom-toolbar-button"
                        data-type="${action.id}"
                        aria-label="${action.name}"
                        style="font-size:14px;">
                    ${action.icon}
                </button>`

            // 在工具栏开头插入按钮
            toolbar.insertAdjacentHTML('afterbegin', buttonHTML)

            // 获取新创建的按钮并添加点击事件
            const btnElement = toolbar.querySelector(`button[data-type="${action.id}"]`) as HTMLButtonElement
            if (btnElement) {
                btnElement.addEventListener('click', async (clickEvent) => {
                    clickEvent.stopPropagation()
                    // 隐藏工具栏
                    toolbar.classList.add('fn__none')
                    // 获取选中的文本
                    const selectedText = this.getSelection(protyle)
                    // 执行按钮功能
                    await action.handler(selectedText)
                })

                // 添加快捷键提示
                if (action.hotkey) {
                    btnElement.setAttribute('data-hotkey', action.hotkey)
                }
            }
        })

        // 监听工具栏隐藏事件，移除标记
        const observer = new MutationObserver(() => {
            if (toolbar.classList.contains('fn__none')) {
                toolbar.removeAttribute('data-custom-buttons-added')
                observer.disconnect()
            }
        })
        observer.observe(toolbar, {
            attributes: true,
            attributeFilter: ['class']
        })
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
            const markdowns = []
            selects.forEach(block => {
                // 这里应该使用 Lute 来转换，但为了简化直接获取文本
                markdowns.push(block.textContent || '')
            })
            return markdowns.join('\n')
        }

        return ''
    }

    /**
     * 复制文本
     */
    private async copyText(text: string) {
        try {
            await navigator.clipboard.writeText(text)
            showI18nMessage(this.plugin, 'copySuccess', '已复制到剪贴板')
        } catch (error) {
            // 降级方案
            const textarea = document.createElement('textarea')
            textarea.value = text
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            showI18nMessage(this.plugin, 'copySuccess', '已复制到剪贴板')
        }
    }

    /**
     * 添加样式
     */
    private addStyles() {
        const styleId = 'floating-toolbar-enhanced-styles'
        if (document.getElementById(styleId)) return

        const style = document.createElement('style')
        style.id = styleId
        style.textContent = `
            /* 自定义浮动工具栏按钮样式 */
            .custom-toolbar-button {
                transition: all 0.15s ease;
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
        // 移除事件监听（使用箭头函数同一引用）
        document.removeEventListener('mouseup', this.handleDocumentMouseUp)

        // 移除所有自定义按钮
        document.querySelectorAll('.custom-toolbar-button').forEach(button => {
            button.remove()
        })

        // 清理标记
        document.querySelectorAll('[data-floating-toolbar-attached], [data-custom-buttons-added]').forEach(toolbar => {
            toolbar.removeAttribute('data-floating-toolbar-attached')
            toolbar.removeAttribute('data-custom-buttons-added')
        })

        // 移除样式
        document.getElementById('floating-toolbar-enhanced-styles')?.remove()

        // 清理功能管理器
        this.actionManager.clear()
    }
}
