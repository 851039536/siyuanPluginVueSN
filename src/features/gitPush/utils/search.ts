// gitPush 搜索高亮片段切分（纯函数，避免 v-html 渲染用户输入）
/** 搜索高亮片段：命中(hit=true)片段供模板包裹 <span class="gp-hl">，避免 v-html 带来的 XSS 风险 */
export interface HighlightSegment { text: string, hit: boolean }

/** 将文本按查询词（大小写不敏感）切分为命中/非命中片段序列 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const q = (query || "").trim()
  if (!q || !text) { return [{ text, hit: false }] }
  const lowerText = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  const segments: HighlightSegment[] = []
  let idx = 0
  let found = lowerText.indexOf(lowerQ, idx)
  while (found !== -1) {
    if (found > idx) { segments.push({ text: text.slice(idx, found), hit: false }) }
    segments.push({ text: text.slice(found, found + q.length), hit: true })
    idx = found + q.length
    found = lowerText.indexOf(lowerQ, idx)
  }
  if (idx < text.length) { segments.push({ text: text.slice(idx), hit: false }) }
  return segments
}
