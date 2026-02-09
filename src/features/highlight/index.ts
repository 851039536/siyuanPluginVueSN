import { Plugin } from 'siyuan'

/**
 * 双击高亮字体功能
 * 功能：双击选中文本自动高亮
 */

let selectedText = ''
let styleAdded = false

export function registerHighlight(plugin: Plugin, enableHighlight: boolean = true) {
  if (!enableHighlight) return

  // 只添加一次样式
  if (!styleAdded) {
    const style = document.createElement('style')
    style.textContent = `
      ::highlight(selected-results) {
        background-color: rgb(235, 235, 5);
        color: rgb(0, 0, 0);
      }
      ::selection {
        color: rgb(0, 0, 0);
      }
    `
    document.head.appendChild(style)
    styleAdded = true
  }

  const handleMouseUp = (event: MouseEvent) => {
    const selection = window.getSelection()?.toString().trim()
    if (!selection || selection === selectedText) return

    const target = event.target as HTMLElement
    if (!target.closest('.protyle-wysiwyg')) return

    selectedText = selection
    highlightText(selection)
  }

  const handleMouseDown = () => {
    selectedText = ''
    CSS.highlights?.delete('selected-results')
  }

  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('mousedown', handleMouseDown)

  // 插件卸载时清理
  plugin.eventBus?.on('destroy', () => {
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('mousedown', handleMouseDown)
    CSS.highlights?.delete('selected-results')
  })
}

function highlightText(value: string) {
  const docRoot = document.querySelector('.layout-tab-container > div:not(.fn__none) .protyle-wysiwyg')
  if (!docRoot) return

  const str = value.trim().toLowerCase()
  if (!str) return

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
  }
}
