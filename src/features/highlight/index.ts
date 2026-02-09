import { Plugin } from 'siyuan'

/**
 * 双击高亮字体功能
 * 功能：双击选中文本自动高亮所有匹配项，显示匹配数量
 */

let selectedText = ''
let styleAdded = false

export function registerHighlight(_plugin: Plugin, enableHighlight: boolean = true) {
  if (!enableHighlight) return

  addStyles()

  const handleMouseUp = (event: MouseEvent) => {
    const selection = window.getSelection()?.toString().trim()
    if (!selection || selection === selectedText) return

    const target = event.target as HTMLElement
    if (!target.closest('.protyle-wysiwyg')) return

    selectedText = selection
    const matchCount = highlightText(selection)
    showToast(selection, matchCount)
  }

  const handleMouseDown = () => {
    selectedText = ''
    CSS.highlights?.delete('selected-results')
  }

  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('mousedown', handleMouseDown)
}

/** 添加样式 */
function addStyles() {
  if (styleAdded) return

  const style = document.createElement('style')
  style.textContent = `
    ::highlight(selected-results) {
      background-color: rgb(255, 220, 60);
      color: rgb(0, 0, 0);
      border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
    }
    ::selection {
      color: rgb(0, 0, 0);
    }
    .highlight-toast {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: opacity 0.2s, transform 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--b3-border-color);
    }
    .highlight-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(-4px);
    }
    .highlight-toast .count {
      color: var(--b3-theme-primary);
      font-weight: 600;
    }
  `
  document.head.appendChild(style)
  styleAdded = true
}

/** 高亮文本，返回匹配数量 */
function highlightText(value: string): number {
  const docRoot = document.querySelector('.layout-tab-container > div:not(.fn__none) .protyle-wysiwyg')
  if (!docRoot) return 0

  const str = value.trim().toLowerCase()
  if (!str) return 0

  const docText = docRoot.textContent?.toLowerCase() ?? ''
  const allTextNodes: Text[] = []
  const cumLengths: number[] = []
  let cumLen = 0

  const treeWalker = document.createTreeWalker(docRoot, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = treeWalker.nextNode())) {
    allTextNodes.push(node as Text)
    cumLen += node.textContent?.length ?? 0
    cumLengths.push(cumLen)
  }

  const ranges: Range[] = []
  let startIndex = 0
  let nodeIdx = 0
  const nodeCount = allTextNodes.length

  while ((startIndex = docText.indexOf(str, startIndex)) !== -1) {
    const endIndex = startIndex + str.length
    const range = document.createRange()

    try {
      while (nodeIdx < nodeCount - 1 && cumLengths[nodeIdx] <= startIndex) nodeIdx++

      const startNode = allTextNodes[nodeIdx]
      const startOffset = startIndex - (cumLengths[nodeIdx] - startNode.textContent!.length)
      range.setStart(startNode, startOffset)

      let endNodeIdx = nodeIdx
      while (endNodeIdx < nodeCount - 1 && cumLengths[endNodeIdx] < endIndex) endNodeIdx++

      const endNode = allTextNodes[endNodeIdx]
      const endOffset = endIndex - (cumLengths[endNodeIdx] - endNode.textContent!.length)
      range.setEnd(endNode, endOffset)

      ranges.push(range)
    } catch (error) {
      console.error('Highlight range error:', error)
    }

    startIndex = endIndex
  }

  if (ranges.length > 0) {
    CSS.highlights?.set('selected-results', new Highlight(...ranges))
  } else {
    CSS.highlights?.delete('selected-results')
  }

  return ranges.length
}

/** 显示提示 */
function showToast(text: string, count: number) {
  const existing = document.querySelector('.highlight-toast')
  existing?.remove()

  const toast = document.createElement('div')
  toast.className = 'highlight-toast'
  toast.innerHTML = `已高亮 "${text.length > 20 ? text.slice(0, 20) + '...' : text}" <span class="count">${count}</span> 处`
  document.body.appendChild(toast)

  requestAnimationFrame(() => toast.classList.add('show'))

  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 200)
  }, 1800)
}
