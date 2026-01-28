import { Plugin } from 'siyuan'

/**
 * 双击高亮字体功能
 * 功能：双击选中文本自动高亮
 */

let selectedText = ''

export function registerHighlight(plugin: Plugin, enableHighlight: boolean = true) {
  // 如果功能未启用，则不注册
  if (!enableHighlight) {
    return
  }

  // 添加样式
  addStyle(`
    /* 双击关键词高亮样式 */
    ::highlight(selected-results) {
      background-color: rgb(235 235 5);
      color: rgb(0, 0, 0);
    }
    /* 选中文本的颜色 */
    ::selection {
      color: rgb(0,0,0);
    }
  `)

  // 监听鼠标释放事件
  document.addEventListener('mouseup', (event) => {
    const selection = window.getSelection().toString().trim()
    if (selection !== '' && selection !== selectedText) {
      selectedText = selection
      const target = event.target as HTMLElement
      const editor = target.closest('.protyle-wysiwyg')
      if (editor) {
        highlight(selectedText)
      }
    }
  })

  // 监听鼠标按下事件
  document.addEventListener('mousedown', () => {
    unhighlight()
  })
}

function highlight(text: string) {
  unhighlight()
  if (!text) return
  highlightHitResult(text)
}

function unhighlight() {
  selectedText = ''
  clearHighlights()
}

function clearHighlights() {
  ;(CSS.highlights as any).delete('selected-results')
}

function addStyle(css: string) {
  const style = document.createElement('style')
  style.type = 'text/css'
  style.textContent = css
  document.head.appendChild(style)
}

function highlightHitResult(value: string) {
  // 获取文档根
  const docRoot = document.querySelector('.layout-tab-container > div:not(.fn__none) .protyle-wysiwyg')
  if (!docRoot) return

  const docText = docRoot.textContent.toLowerCase()

  // 准备一个数组来保存所有文本节点
  const allTextNodes: Text[] = []
  const incr_lens: number[] = []
  let cur_len0 = 0

  const treeWalker = document.createTreeWalker(docRoot, NodeFilter.SHOW_TEXT)
  let currentNode = treeWalker.nextNode()
  while (currentNode) {
    allTextNodes.push(currentNode as Text)
    cur_len0 += currentNode.textContent.length
    incr_lens.push(cur_len0)
    currentNode = treeWalker.nextNode()
  }

  // 清除上个高亮
  clearHighlights()

  // 为空判断
  const str = value.trim().toLowerCase()
  if (!str) return

  const textNodeCnt = allTextNodes.length
  let cur_nodeIdx = 0
  let txtNode: Text

  // 查找所有文本节点是否包含搜索词，并创建对应的 Range 对象
  let ranges: Range[] = []
  let startIndex = 0
  let endIndex = 0

  while ((startIndex = docText.indexOf(str, startIndex)) !== -1) {
    const range = document.createRange()
    endIndex = startIndex + str.length

    try {
      while (cur_nodeIdx < textNodeCnt - 1 && incr_lens[cur_nodeIdx] <= startIndex) {
        cur_nodeIdx++
      }
      txtNode = allTextNodes[cur_nodeIdx]
      let startOffset = startIndex - incr_lens[cur_nodeIdx] + txtNode.textContent.length
      range.setStart(txtNode, startOffset)

      while (cur_nodeIdx < textNodeCnt - 1 && incr_lens[cur_nodeIdx] < endIndex) {
        cur_nodeIdx++
      }
      txtNode = allTextNodes[cur_nodeIdx]
      let endOffset = endIndex - incr_lens[cur_nodeIdx] + txtNode.textContent.length
      range.setEnd(txtNode, endOffset)
      ranges.push(range)
    } catch (error) {
      console.error('Error setting range in node:', error)
    }
    startIndex = endIndex
  }

  // 创建高亮对象
  const searchResultsHighlight = new Highlight(...ranges.flat())

  // 注册高亮
  ;(CSS.highlights as any).set('selected-results', searchResultsHighlight)
}
