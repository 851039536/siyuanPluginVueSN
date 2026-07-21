/**
 * HTML展示 - Unicode 文本表格生成器（适配B站等不支持table标签的平台）
 */

function getDisplayWidth(str: string): number {
  let width = 0
  for (const char of str) {
    const code = char.codePointAt(0)!
    if (
      (code >= 0x4e00 && code <= 0x9fff)
      || (code >= 0x3000 && code <= 0x303f)
      || (code >= 0xff00 && code <= 0xffef)
      || (code >= 0x3400 && code <= 0x4dbf)
      || (code >= 0xac00 && code <= 0xd7af)
      || (code >= 0x3040 && code <= 0x30ff)
      || code >= 0x20000
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

function padEndCJK(str: string, targetWidth: number): string {
  const currentWidth = getDisplayWidth(str)
  const padding = Math.max(0, targetWidth - currentWidth)
  return str + " ".repeat(padding)
}

export function htmlToTextTable(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  const tables = doc.querySelectorAll("table")
  if (tables.length === 0) return ""

  const results: string[] = []
  for (const table of tables) {
    const rows: string[][] = []
    let maxCols = 0
    for (const tr of table.querySelectorAll("tr")) {
      const cells: string[] = []
      for (const cell of tr.querySelectorAll("th, td")) {
        cells.push((cell.textContent || "").trim().replace(/\s+/g, " "))
      }
      if (cells.length > maxCols) maxCols = cells.length
      rows.push(cells)
    }
    if (rows.length === 0 || maxCols === 0) continue

    const colWidths: number[] = new Array(maxCols).fill(4)
    for (const row of rows) {
      for (let c = 0; c < row.length; c++) {
        colWidths[c] = Math.max(colWidths[c], getDisplayWidth(row[c]))
      }
    }
    for (let c = 0; c < maxCols; c++) colWidths[c] = Math.min(colWidths[c], 40)

    const lines: string[] = []
    const topSep = colWidths.map((w) => "─".repeat(w + 2)).join("┬")
    lines.push(`┌${topSep}┐`)

    rows.forEach((row, idx) => {
      const padded = Array.from({ length: maxCols }, (_, c) => {
        const text = row[c] || ""
        const w = colWidths[c]
        const displayW = getDisplayWidth(text)
        if (displayW > w) {
          let truncated = ""
          let tw = 0
          for (const ch of text) {
            const cw = ch.codePointAt(0)! >= 0x4e00 ? 2 : 1
            if (tw + cw > w - 1) break
            truncated += ch
            tw += cw
          }
          return ` ${padEndCJK(`${truncated}…`, w)} `
        }
        return ` ${padEndCJK(text, w)} `
      })
      lines.push(`│${padded.join("│")}│`)
      if (idx === 0) {
        const headSep = colWidths.map((w) => "─".repeat(w + 2)).join("┼")
        lines.push(`├${headSep}┤`)
      }
    })
    const botSep = colWidths.map((w) => "─".repeat(w + 2)).join("┴")
    lines.push(`└${botSep}┘`)

    results.push(lines.join("\n"))
  }
  return results.join("\n\n")
}
